use std::{
    collections::VecDeque,
    fs,
    net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket},
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use axum::{
    body::Bytes,
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use axum_server::{tls_rustls::RustlsConfig, Handle};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::oneshot;

use crate::{
    hud_core::security::{self, MobileIntentAuthMetadata, MobileIntentVerificationRequest},
    local_runtime::audit,
    window::{
        claude_status,
        settings::{self, AppSettings},
        usage_cost,
    },
};

use super::{certificate, pairing, snapshot};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum MobileHudServicePhase {
    Disabled,
    Starting,
    Listening,
    Pairing,
    Connected,
    Failed,
    Stopping,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudServiceStatus {
    pub phase: MobileHudServicePhase,
    pub enabled: bool,
    pub host: String,
    pub port: u16,
    pub base_url: Option<String>,
    pub ws_url: Option<String>,
    pub transport: String,
    pub server_fingerprint: Option<String>,
    pub certificate_pem_path: Option<PathBuf>,
    pub last_error: Option<String>,
    pub connected_clients: usize,
    pub privacy_note: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MobileHudAuthQuery {
    device_id: Option<String>,
}

const MOBILE_INTENT_PATH: &str = "/intent/resolve";
const MOBILE_INTENT_METHOD: &str = "POST";
const MAX_REPLAY_CACHE_ITEMS: usize = 512;

#[derive(Debug, Clone)]
struct MobileIntentReplayEntry {
    device_id: String,
    nonce: String,
    idempotency_key: String,
    expires_at_ms: u64,
}

#[derive(Debug)]
struct MobileHudRuntimeState {
    status: MobileHudServiceStatus,
    shutdown: Option<oneshot::Sender<()>>,
    replay_cache: VecDeque<MobileIntentReplayEntry>,
}

#[derive(Debug, Clone)]
pub struct MobileHudRuntime {
    inner: Arc<Mutex<MobileHudRuntimeState>>,
}

impl Default for MobileHudRuntime {
    fn default() -> Self {
        Self {
            inner: Arc::new(Mutex::new(MobileHudRuntimeState {
                status: disabled_status(None),
                shutdown: None,
                replay_cache: VecDeque::new(),
            })),
        }
    }
}

impl MobileHudRuntime {
    pub fn status(&self) -> MobileHudServiceStatus {
        self.inner
            .lock()
            .map(|state| state.status.clone())
            .unwrap_or_else(|_| failed_status("Mobile HUD runtime lock is poisoned.".to_string()))
    }

    pub fn reconcile(&self, settings: AppSettings) -> Result<MobileHudServiceStatus, String> {
        if mobile_hud_enabled(&settings) && mobile_hud_auto_start(&settings) {
            let status = self.status();
            let desired_port = mobile_hud_port(&settings);
            let desired_transport = mobile_hud_transport(&settings);
            if is_active_phase(&status.phase)
                && status.port == desired_port
                && status.transport == desired_transport
            {
                return Ok(status);
            }
            return self.restart(settings);
        }

        self.stop()
    }

    pub fn start(&self, settings: AppSettings) -> Result<MobileHudServiceStatus, String> {
        {
            let state = self
                .inner
                .lock()
                .map_err(|_| "Mobile HUD runtime lock is poisoned.".to_string())?;
            if is_active_phase(&state.status.phase) {
                return Ok(state.status.clone());
            }
        }

        let host = mobile_hud_host();
        let port = mobile_hud_port(&settings);
        let transport = mobile_hud_transport(&settings);
        let (certificate_paths, server_fingerprint) = prepare_server_certificate(&[
            host.clone(),
            "127.0.0.1".to_string(),
            "localhost".to_string(),
        ])?;
        let fingerprint = Some(server_fingerprint);

        self.set_status(
            MobileHudServiceStatus {
                phase: MobileHudServicePhase::Starting,
                enabled: true,
                host: host.clone(),
                port,
                base_url: None,
                ws_url: None,
                transport: transport.clone(),
                server_fingerprint: fingerprint.clone(),
                certificate_pem_path: Some(certificate_paths.certificate_pem.clone()),
                last_error: None,
                connected_clients: 0,
                privacy_note: runtime_privacy_note(),
            },
            None,
        )?;

        let runtime = self.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(error) = runtime
                .run_server(
                    host,
                    port,
                    transport,
                    fingerprint,
                    certificate_paths.certificate_pem,
                    certificate_paths.private_key_pem,
                )
                .await
            {
                let _ = runtime.fail(error);
            }
        });

        Ok(self.status())
    }

    pub fn stop(&self) -> Result<MobileHudServiceStatus, String> {
        let shutdown = {
            let mut state = self
                .inner
                .lock()
                .map_err(|_| "Mobile HUD runtime lock is poisoned.".to_string())?;
            if matches!(state.status.phase, MobileHudServicePhase::Disabled) {
                return Ok(state.status.clone());
            }
            state.status.phase = MobileHudServicePhase::Stopping;
            state.shutdown.take()
        };
        if let Some(sender) = shutdown {
            let _ = sender.send(());
        }
        self.set_status(disabled_status(None), None)?;
        Ok(self.status())
    }

    pub fn restart(&self, settings: AppSettings) -> Result<MobileHudServiceStatus, String> {
        let _ = self.stop();
        self.start(settings)
    }

    pub fn mark_pairing(&self) -> Result<MobileHudServiceStatus, String> {
        let mut state = self
            .inner
            .lock()
            .map_err(|_| "Mobile HUD runtime lock is poisoned.".to_string())?;
        if matches!(state.status.phase, MobileHudServicePhase::Listening) {
            state.status.phase = MobileHudServicePhase::Pairing;
        }
        Ok(state.status.clone())
    }

    fn record_mobile_intent_replay(
        &self,
        metadata: &MobileIntentAuthMetadata,
        now_ms: u64,
    ) -> Result<(), String> {
        let mut state = self
            .inner
            .lock()
            .map_err(|_| "Mobile HUD runtime lock is poisoned.".to_string())?;
        state
            .replay_cache
            .retain(|entry| entry.expires_at_ms >= now_ms);

        let duplicate = state.replay_cache.iter().any(|entry| {
            entry.device_id == metadata.device_id
                && (entry.nonce == metadata.nonce
                    || entry.idempotency_key == metadata.idempotency_key)
        });
        if duplicate {
            return Err("Mobile intent nonce or idempotency key was already used.".to_string());
        }

        while state.replay_cache.len() >= MAX_REPLAY_CACHE_ITEMS {
            state.replay_cache.pop_front();
        }
        state.replay_cache.push_back(MobileIntentReplayEntry {
            device_id: metadata.device_id.clone(),
            nonce: metadata.nonce.clone(),
            idempotency_key: metadata.idempotency_key.clone(),
            expires_at_ms: metadata.timestamp_ms.saturating_add(metadata.ttl_ms),
        });
        Ok(())
    }

    fn set_status(
        &self,
        status: MobileHudServiceStatus,
        shutdown: Option<oneshot::Sender<()>>,
    ) -> Result<(), String> {
        let mut state = self
            .inner
            .lock()
            .map_err(|_| "Mobile HUD runtime lock is poisoned.".to_string())?;
        state.status = status;
        state.shutdown = shutdown;
        Ok(())
    }

    fn connection_opened(&self) {
        if let Ok(mut state) = self.inner.lock() {
            if state.status.enabled
                && !matches!(
                    state.status.phase,
                    MobileHudServicePhase::Stopping | MobileHudServicePhase::Disabled
                )
            {
                state.status.connected_clients = state.status.connected_clients.saturating_add(1);
                state.status.phase = MobileHudServicePhase::Connected;
            }
        }
    }

    fn connection_closed(&self) {
        if let Ok(mut state) = self.inner.lock() {
            if state.status.connected_clients > 0 {
                state.status.connected_clients -= 1;
            }
            if state.status.connected_clients == 0
                && matches!(state.status.phase, MobileHudServicePhase::Connected)
            {
                state.status.phase = MobileHudServicePhase::Listening;
            }
        }
    }

    fn fail(&self, error: String) -> Result<(), String> {
        self.set_status(failed_status(error), None)
    }

    async fn run_server(
        &self,
        host: String,
        port: u16,
        transport: String,
        fingerprint: Option<String>,
        certificate_pem_path: PathBuf,
        private_key_pem_path: PathBuf,
    ) -> Result<(), String> {
        let address = SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), port);
        let _ = rustls::crypto::ring::default_provider().install_default();
        let tls_config = RustlsConfig::from_pem_file(&certificate_pem_path, &private_key_pem_path)
            .await
            .map_err(|error| format!("Mobile HUD failed to load TLS certificate: {error}"))?;
        let base_url = format!("https://{}:{}", host, port);
        let ws_url = format!("wss://{}:{}/ws", host, port);
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
        let handle = Handle::new();
        let shutdown_handle = handle.clone();

        self.set_status(
            MobileHudServiceStatus {
                phase: MobileHudServicePhase::Listening,
                enabled: true,
                host,
                port,
                base_url: Some(base_url),
                ws_url: Some(ws_url),
                transport,
                server_fingerprint: fingerprint,
                certificate_pem_path: Some(certificate_pem_path),
                last_error: None,
                connected_clients: 0,
                privacy_note: runtime_privacy_note(),
            },
            Some(shutdown_tx),
        )?;

        tauri::async_runtime::spawn(async move {
            let _ = shutdown_rx.await;
            shutdown_handle.graceful_shutdown(Some(Duration::from_secs(2)));
        });

        let app = Router::new()
            .route("/health", get(health_handler))
            .route("/snapshot", get(snapshot_handler))
            .route("/pairing/claim", post(pairing_claim_handler))
            .route(MOBILE_INTENT_PATH, post(intent_resolve_handler))
            .route("/ws", get(ws_handler))
            .with_state(self.clone());

        axum_server::bind_rustls(address, tls_config)
            .handle(handle)
            .serve(app.into_make_service())
            .await
            .map_err(|error| error.to_string())?;

        let current = self.status();
        if current.phase == MobileHudServicePhase::Stopping {
            self.set_status(disabled_status(None), None)?;
        }
        Ok(())
    }
}

async fn health_handler() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "service": "mobileHud",
        "protocolVersion": 1,
        "transport": "wssSpkiPinning",
        "privacy": "health endpoint does not expose sessions, prompts, paths or tool data"
    }))
}

async fn snapshot_handler(Query(auth): Query<MobileHudAuthQuery>) -> impl IntoResponse {
    if authorized_query(&auth) {
        Json(json!(build_snapshot_envelope())).into_response()
    } else {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "ok": false,
                "error": "authorized device is required",
                "privacy": "unauthorized callers cannot read Mobile HUD snapshots"
            })),
        )
            .into_response()
    }
}

async fn pairing_claim_handler(
    Json(request): Json<pairing::MobileHudPairingClaimRequest>,
) -> Json<serde_json::Value> {
    match pairing::claim_pairing_device(request) {
        Ok(result) => {
            audit::record_best_effort(audit::mobile_intent_event(
                "mobile.pairing.claimed",
                "ok",
                Some(&result.device_id),
                None,
                None,
            ));
            Json(json!({ "ok": true, "result": result }))
        }
        Err(error) => {
            audit::record_best_effort(audit::mobile_service_event(
                "mobile.pairing.claim_failed",
                "rejected",
                Some("claim_rejected"),
            ));
            Json(json!({
                "ok": false,
                "error": error,
                "privacy": "Pairing errors do not echo token, fingerprint or device public key."
            }))
        }
    }
}

async fn intent_resolve_handler(
    State(runtime): State<MobileHudRuntime>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let now_ms = current_unix_ms();
    let auth = match mobile_intent_auth_from_headers(&headers) {
        Ok(value) => value,
        Err(error) => {
            audit::record_best_effort(audit::mobile_intent_event(
                "mobile.intent.auth_invalid",
                "rejected",
                None,
                None,
                Some("headers_invalid"),
            ));
            return mobile_intent_error(StatusCode::UNAUTHORIZED, error);
        }
    };
    audit::record_best_effort(audit::mobile_intent_event(
        "mobile.intent.received",
        "received",
        Some(&auth.metadata.device_id),
        None,
        None,
    ));

    let Some(device) = pairing::authorized_device_record(&auth.metadata.device_id) else {
        audit::record_best_effort(audit::mobile_intent_event(
            "mobile.intent.device_unknown",
            "rejected",
            Some(&auth.metadata.device_id),
            None,
            Some("device_not_approved"),
        ));
        return mobile_intent_error(
            StatusCode::FORBIDDEN,
            "Mobile intent device is not approved or was revoked.".to_string(),
        );
    };
    let Some(public_key_der_b64) = device.public_key_der_b64.as_deref() else {
        audit::record_best_effort(audit::mobile_intent_event(
            "mobile.intent.public_key_missing",
            "rejected",
            Some(&auth.metadata.device_id),
            None,
            Some("public_key_missing"),
        ));
        return mobile_intent_error(
            StatusCode::FORBIDDEN,
            "Mobile intent device must be re-paired before signed actions are accepted."
                .to_string(),
        );
    };

    let verification = MobileIntentVerificationRequest {
        public_key_der_b64: public_key_der_b64.to_string(),
        ..auth
    };
    if let Err(error) = security::verify_mobile_intent_request(&verification, &body, now_ms) {
        audit::record_best_effort(audit::mobile_intent_event(
            "mobile.intent.signature_rejected",
            "rejected",
            Some(&verification.metadata.device_id),
            None,
            Some("signature_invalid"),
        ));
        return mobile_intent_error(
            StatusCode::UNAUTHORIZED,
            format!("Mobile intent signature rejected: {error:?}"),
        );
    }

    let request =
        match serde_json::from_slice::<claude_status::PendingIntentResolutionRequest>(&body) {
            Ok(value) => value,
            Err(_) => {
                audit::record_best_effort(audit::mobile_intent_event(
                    "mobile.intent.body_invalid",
                    "rejected",
                    Some(&verification.metadata.device_id),
                    None,
                    Some("body_invalid"),
                ));
                return mobile_intent_error(
                    StatusCode::BAD_REQUEST,
                    "Mobile intent body is not a valid pending intent resolution request."
                        .to_string(),
                );
            }
        };
    let action = request.action.clone();

    if let Err(error) = runtime.record_mobile_intent_replay(&verification.metadata, now_ms) {
        audit::record_best_effort(audit::mobile_intent_event(
            "mobile.intent.replay_rejected",
            "conflict",
            Some(&verification.metadata.device_id),
            Some(&action),
            Some("replay"),
        ));
        return mobile_intent_error(StatusCode::CONFLICT, error);
    }

    match claude_status::resolve_pending_intent(request) {
        Ok(result) => {
            audit::record_best_effort(audit::mobile_intent_event(
                "mobile.intent.resolved",
                "ok",
                Some(&verification.metadata.device_id),
                Some(&action),
                None,
            ));
            Json(json!({
                "ok": true,
                "result": result,
                "privacy": "Signed mobile intent resolved using device public key, nonce, TTL, body hash and idempotency key."
            }))
            .into_response()
        }
        Err(error) => {
            audit::record_best_effort(audit::mobile_intent_event(
                "mobile.intent.resolve_failed",
                "rejected",
                Some(&verification.metadata.device_id),
                Some(&action),
                Some("resolve_failed"),
            ));
            mobile_intent_error(StatusCode::BAD_REQUEST, error)
        }
    }
}

async fn ws_handler(
    Query(auth): Query<MobileHudAuthQuery>,
    State(runtime): State<MobileHudRuntime>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    if !authorized_query(&auth) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "ok": false,
                "error": "authorized device is required",
                "privacy": "unauthorized callers cannot open the Mobile HUD WebSocket"
            })),
        )
            .into_response();
    }
    ws.on_upgrade(move |socket| handle_socket(runtime, socket))
        .into_response()
}

async fn handle_socket(runtime: MobileHudRuntime, socket: WebSocket) {
    runtime.connection_opened();
    let (mut sender, mut receiver) = socket.split();
    let snapshot = match serde_json::to_string(&build_snapshot_envelope()) {
        Ok(value) => value,
        Err(_) => {
            runtime.connection_closed();
            return;
        }
    };
    if sender.send(Message::Text(snapshot.into())).await.is_err() {
        runtime.connection_closed();
        return;
    }

    let mut snapshot_interval = tokio::time::interval(Duration::from_secs(3));
    let mut heartbeat_interval = tokio::time::interval(Duration::from_secs(15));
    loop {
        tokio::select! {
            _ = snapshot_interval.tick() => {
                let snapshot = match serde_json::to_string(&build_snapshot_envelope()) {
                    Ok(value) => value,
                    Err(_) => break,
                };
                if sender.send(Message::Text(snapshot.into())).await.is_err() {
                    break;
                }
            }
            _ = heartbeat_interval.tick() => {
                let heartbeat = json!({
                    "protocolVersion": 1,
                    "kind": "heartbeat",
                    "sensitivity": "low"
                }).to_string();
                if sender.send(Message::Text(heartbeat.into())).await.is_err() {
                    break;
                }
            }
            next = receiver.next() => {
                match next {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(payload))) => {
                        if sender.send(Message::Pong(payload)).await.is_err() {
                            break;
                        }
                    }
                    Some(Err(_)) => break,
                    _ => {}
                }
            }
        }
    }
    runtime.connection_closed();
}

fn build_snapshot_envelope() -> super::types::MobileHudEnvelope {
    snapshot::build_mobile_hud_envelope(
        claude_status::get_claude_status_bridge_sessions(),
        usage_cost::get_live_usage_cost_snapshot(),
        settings::load_app_settings(),
    )
}

fn authorized_query(auth: &MobileHudAuthQuery) -> bool {
    auth.device_id
        .as_deref()
        .map(pairing::is_device_authorized)
        .unwrap_or(false)
}

fn mobile_intent_auth_from_headers(
    headers: &HeaderMap,
) -> Result<MobileIntentVerificationRequest, String> {
    let protocol_version = optional_header(headers, "x-claude-hud-protocol-version")
        .map(|value| {
            value
                .parse::<u8>()
                .map_err(|_| "Mobile intent protocol version is invalid.".to_string())
        })
        .transpose()?
        .unwrap_or(security::MOBILE_INTENT_PROTOCOL_VERSION);
    let timestamp_ms = required_header(headers, "x-claude-hud-timestamp-ms")?
        .parse::<u64>()
        .map_err(|_| "Mobile intent timestamp is invalid.".to_string())?;
    let ttl_ms = required_header(headers, "x-claude-hud-ttl-ms")?
        .parse::<u64>()
        .map_err(|_| "Mobile intent TTL is invalid.".to_string())?;

    Ok(MobileIntentVerificationRequest {
        method: MOBILE_INTENT_METHOD.to_string(),
        path: MOBILE_INTENT_PATH.to_string(),
        protocol_version,
        metadata: MobileIntentAuthMetadata {
            device_id: required_header(headers, "x-claude-hud-device-id")?,
            nonce: required_header(headers, "x-claude-hud-nonce")?,
            timestamp_ms,
            ttl_ms,
            body_sha256: required_header(headers, "x-claude-hud-body-sha256")?,
            idempotency_key: required_header(headers, "x-claude-hud-idempotency-key")?,
        },
        signature_b64: required_header(headers, "x-claude-hud-signature")?,
        public_key_der_b64: String::new(),
    })
}

fn required_header(headers: &HeaderMap, name: &str) -> Result<String, String> {
    optional_header(headers, name)
        .ok_or_else(|| format!("Mobile intent header {name} is required."))
}

fn optional_header(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn mobile_intent_error(status: StatusCode, error: String) -> Response {
    (
        status,
        Json(json!({
            "ok": false,
            "error": error,
            "privacy": "Mobile intent errors do not echo signed body contents, private keys, nonces beyond header names, prompts or tool data."
        })),
    )
        .into_response()
}

fn current_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

fn prepare_server_certificate(
    subject_alt_names: &[String],
) -> Result<(certificate::MobileHudCertificatePaths, String), String> {
    prepare_server_certificate_at_paths(certificate::default_certificate_paths(), subject_alt_names)
}

fn prepare_server_certificate_at_paths(
    paths: certificate::MobileHudCertificatePaths,
    subject_alt_names: &[String],
) -> Result<(certificate::MobileHudCertificatePaths, String), String> {
    let subject_alt_names = certificate::normalize_subject_alt_names(subject_alt_names);
    fs::create_dir_all(&paths.directory).map_err(|error| {
        format!(
            "Mobile HUD failed to create certificate directory {}: {error}",
            paths.directory.display()
        )
    })?;

    if paths.certificate_pem.exists() && paths.private_key_pem.exists() {
        let private_key_pem = fs::read_to_string(&paths.private_key_pem).map_err(|error| {
            format!(
                "Mobile HUD failed to read private key {}: {error}",
                paths.private_key_pem.display()
            )
        })?;
        if let Ok(fingerprint) =
            certificate::spki_fingerprint_from_private_key_pem(&private_key_pem)
        {
            let metadata_matches = certificate::read_certificate_metadata(&paths)
                .map(|metadata| {
                    metadata.spki_fingerprint == fingerprint
                        && certificate::certificate_metadata_covers_subject_alt_names(
                            &metadata,
                            &subject_alt_names,
                        )
                })
                .unwrap_or(false);
            if metadata_matches {
                return Ok((paths, fingerprint));
            }

            let server_certificate = certificate::generate_server_certificate_from_private_key(
                &subject_alt_names,
                &private_key_pem,
            )?;
            fs::write(&paths.certificate_pem, &server_certificate.certificate_pem).map_err(
                |error| {
                    format!(
                        "Mobile HUD failed to write certificate {}: {error}",
                        paths.certificate_pem.display()
                    )
                },
            )?;
            certificate::write_certificate_metadata(
                &paths,
                &subject_alt_names,
                &server_certificate.spki_fingerprint,
            )
            .map_err(|error| {
                format!(
                    "Mobile HUD failed to write certificate metadata {}: {error}",
                    paths.metadata_json.display()
                )
            })?;
            return Ok((paths, server_certificate.spki_fingerprint));
        }
    }

    let server_certificate = certificate::generate_server_certificate(&subject_alt_names)?;
    fs::write(&paths.certificate_pem, &server_certificate.certificate_pem).map_err(|error| {
        format!(
            "Mobile HUD failed to write certificate {}: {error}",
            paths.certificate_pem.display()
        )
    })?;
    fs::write(&paths.private_key_pem, &server_certificate.private_key_pem).map_err(|error| {
        format!(
            "Mobile HUD failed to write private key {}: {error}",
            paths.private_key_pem.display()
        )
    })?;
    certificate::write_certificate_metadata(
        &paths,
        &subject_alt_names,
        &server_certificate.spki_fingerprint,
    )
    .map_err(|error| {
        format!(
            "Mobile HUD failed to write certificate metadata {}: {error}",
            paths.metadata_json.display()
        )
    })?;
    Ok((paths, server_certificate.spki_fingerprint))
}

fn mobile_hud_enabled(settings: &AppSettings) -> bool {
    settings
        .mobile_hud
        .get("enabled")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false)
}

fn mobile_hud_auto_start(settings: &AppSettings) -> bool {
    settings
        .mobile_hud
        .get("connection")
        .and_then(|value| value.get("autoStart"))
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false)
}

fn mobile_hud_host() -> String {
    UdpSocket::bind((Ipv4Addr::UNSPECIFIED, 0))
        .and_then(|socket| {
            let _ = socket.connect((Ipv4Addr::new(8, 8, 8, 8), 80));
            socket.local_addr()
        })
        .ok()
        .and_then(|address| match address.ip() {
            IpAddr::V4(ip) if !ip.is_unspecified() && !ip.is_loopback() => Some(ip.to_string()),
            _ => None,
        })
        .unwrap_or_else(|| "127.0.0.1".to_string())
}

fn mobile_hud_port(settings: &AppSettings) -> u16 {
    settings
        .mobile_hud
        .get("connection")
        .and_then(|value| value.get("port"))
        .and_then(serde_json::Value::as_u64)
        .and_then(|value| u16::try_from(value).ok())
        .filter(|value| *value >= 1024)
        .unwrap_or(27431)
}

fn mobile_hud_transport(settings: &AppSettings) -> String {
    settings
        .mobile_hud
        .get("security")
        .and_then(|value| value.get("transport"))
        .and_then(serde_json::Value::as_str)
        .unwrap_or("wssSpkiPinning")
        .to_string()
}

fn is_active_phase(phase: &MobileHudServicePhase) -> bool {
    matches!(
        phase,
        MobileHudServicePhase::Starting
            | MobileHudServicePhase::Listening
            | MobileHudServicePhase::Pairing
            | MobileHudServicePhase::Connected
    )
}

fn disabled_status(last_error: Option<String>) -> MobileHudServiceStatus {
    MobileHudServiceStatus {
        phase: MobileHudServicePhase::Disabled,
        enabled: false,
        host: "127.0.0.1".to_string(),
        port: 27431,
        base_url: None,
        ws_url: None,
        transport: "wssSpkiPinning".to_string(),
        server_fingerprint: None,
        certificate_pem_path: None,
        last_error,
        connected_clients: 0,
        privacy_note: runtime_privacy_note(),
    }
}

fn failed_status(error: String) -> MobileHudServiceStatus {
    MobileHudServiceStatus {
        phase: MobileHudServicePhase::Failed,
        enabled: false,
        host: "127.0.0.1".to_string(),
        port: 27431,
        base_url: None,
        ws_url: None,
        transport: "wssSpkiPinning".to_string(),
        server_fingerprint: None,
        certificate_pem_path: None,
        last_error: Some(error),
        connected_clients: 0,
        privacy_note: runtime_privacy_note(),
    }
}

fn runtime_privacy_note() -> String {
    "Mobile HUD exposes low-sensitive health/snapshot/WSS DTOs; any mobile-originated intent must pass device approval, P-256 signature, replay metadata, TTL, body hash and idempotency checks.".to_string()
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    use serde_json::json;

    use super::*;

    #[test]
    fn mobile_hud_port_uses_settings_with_safe_default() {
        let mut settings = AppSettings::default();
        settings.mobile_hud = json!({ "connection": { "port": 30123 }, "security": { "transport": "wssSpkiPinning" } });

        assert_eq!(mobile_hud_port(&settings), 30123);

        settings.mobile_hud = json!({ "connection": { "port": 80 } });
        assert_eq!(mobile_hud_port(&settings), 27431);
    }

    #[test]
    fn mobile_hud_host_can_generate_certificate_san() {
        let host = mobile_hud_host();
        let certificate = certificate::generate_server_certificate(&[
            host,
            "127.0.0.1".to_string(),
            "localhost".to_string(),
        ]);

        assert!(certificate.is_ok());
    }

    #[test]
    fn certificate_is_reissued_when_advertised_host_changes() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let root = std::env::temp_dir().join(format!(
            "claude-hud-one-mobile-cert-test-{}-{nonce}",
            std::process::id()
        ));
        let paths = certificate::certificate_paths_for_root(root.clone());

        let (_, first_fingerprint) = prepare_server_certificate_at_paths(
            paths.clone(),
            &[
                "192.168.31.201".to_string(),
                "127.0.0.1".to_string(),
                "localhost".to_string(),
            ],
        )
        .expect("initial certificate should be prepared");
        let first_certificate = fs::read_to_string(&paths.certificate_pem)
            .expect("initial certificate should be written");

        let (_, second_fingerprint) = prepare_server_certificate_at_paths(
            paths.clone(),
            &[
                "192.168.31.202".to_string(),
                "127.0.0.1".to_string(),
                "localhost".to_string(),
            ],
        )
        .expect("changed host should reissue certificate");
        let second_certificate = fs::read_to_string(&paths.certificate_pem)
            .expect("reissued certificate should be written");
        let metadata = certificate::read_certificate_metadata(&paths)
            .expect("certificate metadata should be written");

        assert_eq!(first_fingerprint, second_fingerprint);
        assert_ne!(first_certificate, second_certificate);
        assert!(certificate::certificate_metadata_covers_subject_alt_names(
            &metadata,
            &["192.168.31.202".to_string()]
        ));
        assert!(!certificate::certificate_metadata_covers_subject_alt_names(
            &metadata,
            &["192.168.31.201".to_string()]
        ));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn reconcile_requires_enabled_and_auto_start() {
        let runtime = MobileHudRuntime::default();
        let mut settings = AppSettings::default();
        settings.mobile_hud = json!({
            "enabled": true,
            "connection": { "autoStart": false, "port": 30123 },
            "security": { "transport": "wssSpkiPinning" }
        });

        let status = runtime.reconcile(settings).unwrap();

        assert_eq!(status.phase, MobileHudServicePhase::Disabled);
    }

    #[test]
    fn connection_count_toggles_connected_phase() {
        let runtime = MobileHudRuntime::default();
        runtime
            .set_status(
                MobileHudServiceStatus {
                    phase: MobileHudServicePhase::Listening,
                    enabled: true,
                    host: "127.0.0.1".to_string(),
                    port: 27431,
                    base_url: Some("https://127.0.0.1:27431".to_string()),
                    ws_url: Some("wss://127.0.0.1:27431/ws".to_string()),
                    transport: "wssSpkiPinning".to_string(),
                    server_fingerprint: Some(
                        "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=".to_string(),
                    ),
                    certificate_pem_path: None,
                    last_error: None,
                    connected_clients: 0,
                    privacy_note: runtime_privacy_note(),
                },
                None,
            )
            .unwrap();

        runtime.connection_opened();
        assert_eq!(runtime.status().phase, MobileHudServicePhase::Connected);
        assert_eq!(runtime.status().connected_clients, 1);

        runtime.connection_closed();
        assert_eq!(runtime.status().phase, MobileHudServicePhase::Listening);
        assert_eq!(runtime.status().connected_clients, 0);
    }

    #[test]
    fn mobile_intent_replay_cache_rejects_reused_nonce() {
        let runtime = MobileHudRuntime::default();
        let metadata = MobileIntentAuthMetadata {
            device_id: "device-1".to_string(),
            nonce: "nonce-1".to_string(),
            timestamp_ms: 1_000,
            ttl_ms: 60_000,
            body_sha256: security::body_sha256_hex(br#"{}"#),
            idempotency_key: "idem-1".to_string(),
        };

        assert!(runtime
            .record_mobile_intent_replay(&metadata, 2_000)
            .is_ok());
        assert!(runtime
            .record_mobile_intent_replay(&metadata, 2_001)
            .is_err());
    }

    #[test]
    fn mobile_intent_auth_headers_parse_protocol_metadata() {
        let mut headers = HeaderMap::new();
        headers.insert("x-claude-hud-device-id", "device-1".parse().unwrap());
        headers.insert("x-claude-hud-nonce", "nonce-1".parse().unwrap());
        headers.insert("x-claude-hud-timestamp-ms", "1000".parse().unwrap());
        headers.insert("x-claude-hud-ttl-ms", "60000".parse().unwrap());
        headers.insert("x-claude-hud-body-sha256", "abc".parse().unwrap());
        headers.insert("x-claude-hud-idempotency-key", "idem-1".parse().unwrap());
        headers.insert("x-claude-hud-signature", "sig".parse().unwrap());

        let auth = mobile_intent_auth_from_headers(&headers).unwrap();

        assert_eq!(auth.path, MOBILE_INTENT_PATH);
        assert_eq!(auth.metadata.device_id, "device-1");
        assert_eq!(auth.metadata.ttl_ms, 60_000);
    }

    #[test]
    fn status_does_not_expose_sensitive_session_data() {
        let status = disabled_status(None);
        let serialized = serde_json::to_string(&status).unwrap();

        assert!(!serialized.contains("transcriptPath"));
        assert!(!serialized.contains("intentId"));
        assert!(!serialized.contains("nonce"));
        assert!(serialized.contains("wssSpkiPinning"));
    }
}
