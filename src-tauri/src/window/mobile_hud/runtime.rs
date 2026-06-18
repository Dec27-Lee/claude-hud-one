use std::{
    fs,
    net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket},
    path::PathBuf,
    sync::{Arc, Mutex},
    time::Duration,
};

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use axum_server::{tls_rustls::RustlsConfig, Handle};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::oneshot;

use crate::window::{
    claude_status,
    settings::{self, AppSettings},
    usage_cost,
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

#[derive(Debug)]
struct MobileHudRuntimeState {
    status: MobileHudServiceStatus,
    shutdown: Option<oneshot::Sender<()>>,
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
        Ok(result) => Json(json!({ "ok": true, "result": result })),
        Err(error) => Json(json!({
            "ok": false,
            "error": error,
            "privacy": "Pairing errors do not echo token, fingerprint or device public key."
        })),
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

fn prepare_server_certificate(
    subject_alt_names: &[String],
) -> Result<(certificate::MobileHudCertificatePaths, String), String> {
    let paths = certificate::default_certificate_paths();
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
            return Ok((paths, fingerprint));
        }
    }

    let server_certificate = certificate::generate_server_certificate(subject_alt_names)?;
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
    "Phase 1A service exposes WSS local health/snapshot endpoints for automated validation. Mobile protocol DTOs remain sanitized and read-only.".to_string()
}

#[cfg(test)]
mod tests {
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
    fn status_does_not_expose_sensitive_session_data() {
        let status = disabled_status(None);
        let serialized = serde_json::to_string(&status).unwrap();

        assert!(!serialized.contains("transcriptPath"));
        assert!(!serialized.contains("intentId"));
        assert!(!serialized.contains("nonce"));
        assert!(serialized.contains("wssSpkiPinning"));
    }
}
