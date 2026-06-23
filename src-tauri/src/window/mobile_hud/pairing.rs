use std::{env, fs, path::PathBuf};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use time::{format_description::well_known::Rfc3339, Duration, OffsetDateTime};
use uuid::Uuid;

use crate::window::settings::AppSettings;

use super::runtime::{MobileHudServicePhase, MobileHudServiceStatus};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudPairingOffer {
    pub pairing_id: String,
    pub host: String,
    pub port: u16,
    pub expires_at: String,
    pub ttl_seconds: u64,
    pub deeplink: String,
    pub qr_payload: String,
    pub token_hint: String,
    pub fingerprint_hint: String,
    pub require_pc_confirmation: bool,
    pub privacy_note: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudPendingPairing {
    pub pairing_id: String,
    pub token_hash: String,
    pub host: String,
    pub port: u16,
    pub server_fingerprint: String,
    pub created_at: String,
    pub expires_at: String,
    pub require_pc_confirmation: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudDeviceRecord {
    pub device_id: String,
    pub device_label: String,
    pub public_key_hash: String,
    pub public_key_der_b64: Option<String>,
    pub approved: bool,
    pub revoked: bool,
    pub registered_at: String,
    pub last_seen_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudPairingClaimRequest {
    pub pairing_id: String,
    pub token: String,
    pub device_label: Option<String>,
    pub device_public_key: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudPairingClaimResult {
    pub status: String,
    pub device_id: String,
    pub device_label: String,
    pub approved: bool,
    pub privacy_note: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudDeviceRegistry {
    pub version: u8,
    pub pending_pairings: Vec<MobileHudPendingPairing>,
    pub devices: Vec<MobileHudDeviceRecord>,
}

pub fn create_pairing_offer(
    status: &MobileHudServiceStatus,
    settings: &AppSettings,
) -> Result<MobileHudPairingOffer, String> {
    if !matches!(
        status.phase,
        MobileHudServicePhase::Listening
            | MobileHudServicePhase::Pairing
            | MobileHudServicePhase::Connected
    ) {
        return Err("Start the Mobile HUD service before creating a pairing offer.".to_string());
    }

    let server_fingerprint = status
        .server_fingerprint
        .as_ref()
        .filter(|value| value.starts_with("sha256/"))
        .ok_or_else(|| "Mobile HUD service does not have a SPKI fingerprint yet.".to_string())?
        .clone();
    let pairing_id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();
    let ttl_seconds = pairing_ttl_seconds(settings);
    let created_at = now_rfc3339();
    let expires_at = (OffsetDateTime::now_utc() + Duration::seconds(ttl_seconds as i64))
        .format(&Rfc3339)
        .unwrap_or_else(|_| "unknown".to_string());
    let require_pc_confirmation = require_pc_confirmation(settings);
    let deeplink = format!(
        "claudehud://pair?host={}&port={}&pairingId={}&token={}&fp={}&expires={}",
        encode_component(&status.host),
        status.port,
        encode_component(&pairing_id),
        encode_component(&token),
        encode_component(&server_fingerprint),
        encode_component(&expires_at),
    );

    let mut registry = load_device_registry();
    registry.version = 1;
    registry
        .pending_pairings
        .retain(|pairing| pairing.expires_at > created_at);
    registry.pending_pairings.push(MobileHudPendingPairing {
        pairing_id: pairing_id.clone(),
        token_hash: hash_secret(&token),
        host: status.host.clone(),
        port: status.port,
        server_fingerprint: server_fingerprint.clone(),
        created_at,
        expires_at: expires_at.clone(),
        require_pc_confirmation,
    });
    save_device_registry(&registry)?;

    Ok(MobileHudPairingOffer {
        pairing_id,
        host: status.host.clone(),
        port: status.port,
        expires_at,
        ttl_seconds,
        qr_payload: deeplink.clone(),
        deeplink,
        token_hint: mask_secret(&token),
        fingerprint_hint: mask_fingerprint(&server_fingerprint),
        require_pc_confirmation,
        privacy_note: "UI may render qrPayload as a QR code, but must not print the full token or fingerprint as text.".to_string(),
    })
}

pub fn load_device_registry() -> MobileHudDeviceRegistry {
    registry_path()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|content| serde_json::from_str::<MobileHudDeviceRegistry>(&content).ok())
        .unwrap_or_else(|| MobileHudDeviceRegistry {
            version: 1,
            pending_pairings: Vec::new(),
            devices: Vec::new(),
        })
}

pub fn save_device_registry(registry: &MobileHudDeviceRegistry) -> Result<(), String> {
    let path = registry_path().ok_or_else(|| "APPDATA is not available".to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let content = serde_json::to_string_pretty(registry).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())
}

pub fn claim_pairing_device(
    request: MobileHudPairingClaimRequest,
) -> Result<MobileHudPairingClaimResult, String> {
    if request.pairing_id.trim().is_empty() || request.token.trim().is_empty() {
        return Err("Pairing id and token are required.".to_string());
    }
    if request.device_public_key.trim().is_empty() {
        return Err("Device public key is required.".to_string());
    }

    let now = now_rfc3339();
    let mut registry = load_device_registry();
    registry
        .pending_pairings
        .retain(|pairing| pairing.expires_at > now);
    let pending = registry
        .pending_pairings
        .iter()
        .find(|pairing| pairing.pairing_id == request.pairing_id)
        .cloned()
        .ok_or_else(|| "Pairing offer expired or was not found.".to_string())?;
    if pending.token_hash != hash_secret(&request.token) {
        return Err("Pairing token is invalid.".to_string());
    }

    let device_label = sanitize_device_label(request.device_label.as_deref());
    let public_key_der_b64 = request.device_public_key.trim().to_string();
    let public_key_hash = hash_secret(&public_key_der_b64);
    let requested_approval = !pending.require_pc_confirmation;
    let (device_id, approved) = upsert_device_record(
        &mut registry,
        device_label.clone(),
        public_key_hash,
        Some(public_key_der_b64),
        requested_approval,
        now.clone(),
    );
    registry
        .pending_pairings
        .retain(|pairing| pairing.pairing_id != pending.pairing_id);
    save_device_registry(&registry)?;

    Ok(MobileHudPairingClaimResult {
        status: if approved { "approved".to_string() } else { "pendingPcConfirmation".to_string() },
        device_id,
        device_label,
        approved,
        privacy_note: "Pairing claim stores a one-time token hash and the device public key needed for future signature verification; private keys and raw pairing secrets are not persisted.".to_string(),
    })
}

fn upsert_device_record(
    registry: &mut MobileHudDeviceRegistry,
    device_label: String,
    public_key_hash: String,
    public_key_der_b64: Option<String>,
    requested_approval: bool,
    now: String,
) -> (String, bool) {
    if let Some(device) = registry
        .devices
        .iter_mut()
        .find(|device| device.public_key_hash == public_key_hash)
    {
        device.device_label = device_label;
        if public_key_der_b64.is_some() {
            device.public_key_der_b64 = public_key_der_b64;
        }
        device.approved = if device.revoked {
            requested_approval
        } else {
            device.approved || requested_approval
        };
        device.revoked = false;
        device.last_seen_at = Some(now);
        return (device.device_id.clone(), device.approved);
    }

    let device_id = Uuid::new_v4().to_string();
    registry.devices.push(MobileHudDeviceRecord {
        device_id: device_id.clone(),
        device_label,
        public_key_hash,
        public_key_der_b64,
        approved: requested_approval,
        revoked: false,
        registered_at: now,
        last_seen_at: None,
    });
    (device_id, requested_approval)
}

pub fn is_device_authorized(device_id: &str) -> bool {
    authorized_device_record(device_id).is_some()
}

pub fn authorized_device_record(device_id: &str) -> Option<MobileHudDeviceRecord> {
    if device_id.trim().is_empty() {
        return None;
    }
    load_device_registry()
        .devices
        .into_iter()
        .find(|device| device.device_id == device_id && device.approved && !device.revoked)
}

pub fn approve_device(device_id: &str) -> Result<MobileHudDeviceRegistry, String> {
    let mut registry = load_device_registry();
    for device in &mut registry.devices {
        if device.device_id == device_id && !device.revoked {
            device.approved = true;
        }
    }
    save_device_registry(&registry)?;
    Ok(registry)
}

pub fn revoke_device(device_id: &str) -> Result<MobileHudDeviceRegistry, String> {
    let mut registry = load_device_registry();
    for device in &mut registry.devices {
        if device.device_id == device_id {
            device.revoked = true;
            device.approved = false;
        }
    }
    save_device_registry(&registry)?;
    Ok(registry)
}

pub fn delete_device(device_id: &str) -> Result<MobileHudDeviceRegistry, String> {
    let mut registry = load_device_registry();
    registry
        .devices
        .retain(|device| device.device_id != device_id);
    save_device_registry(&registry)?;
    Ok(registry)
}

fn registry_path() -> Option<PathBuf> {
    env::var_os("APPDATA").map(PathBuf::from).map(|appdata| {
        appdata
            .join("Claude HUD One")
            .join("mobile-hud")
            .join("device-registry.json")
    })
}

fn pairing_ttl_seconds(settings: &AppSettings) -> u64 {
    settings
        .mobile_hud
        .get("security")
        .and_then(|value| value.get("pairingTokenTtlSeconds"))
        .and_then(serde_json::Value::as_u64)
        .map(|value| value.clamp(15, 300))
        .unwrap_or(60)
}

fn require_pc_confirmation(settings: &AppSettings) -> bool {
    settings
        .mobile_hud
        .get("connection")
        .and_then(|value| value.get("requirePcConfirmation"))
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(true)
}

fn sanitize_device_label(label: Option<&str>) -> String {
    let sanitized = label
        .unwrap_or("Android device")
        .chars()
        .filter(|character| !character.is_control())
        .take(48)
        .collect::<String>()
        .trim()
        .to_string();
    if sanitized.is_empty() {
        "Android device".to_string()
    } else {
        sanitized
    }
}

fn now_rfc3339() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "unknown".to_string())
}

fn hash_secret(secret: &str) -> String {
    let digest = Sha256::digest(secret.as_bytes());
    format!("sha256/{}", BASE64_STANDARD.encode(digest))
}

fn mask_secret(secret: &str) -> String {
    let compact = secret.replace('-', "");
    let start = compact.get(0..4).unwrap_or("****");
    let end = compact
        .get(compact.len().saturating_sub(4)..)
        .unwrap_or("****");
    format!("{}…{}", start, end)
}

fn mask_fingerprint(fingerprint: &str) -> String {
    let end = fingerprint
        .get(fingerprint.len().saturating_sub(8)..)
        .unwrap_or("********");
    format!("sha256/…{}", end)
}

fn encode_component(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                vec![byte as char]
            }
            _ => format!("%{byte:02X}").chars().collect(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn pairing_ttl_is_clamped() {
        let mut settings = AppSettings::default();
        settings.mobile_hud = json!({ "security": { "pairingTokenTtlSeconds": 1 } });
        assert_eq!(pairing_ttl_seconds(&settings), 15);

        settings.mobile_hud = json!({ "security": { "pairingTokenTtlSeconds": 999 } });
        assert_eq!(pairing_ttl_seconds(&settings), 300);
    }

    #[test]
    fn token_hash_and_mask_do_not_expose_full_secret() {
        let token = "one-time-mobile-token";
        let hash = hash_secret(token);
        let mask = mask_secret(token);

        assert!(hash.starts_with("sha256/"));
        assert!(!hash.contains(token));
        assert!(!mask.contains(token));
        assert!(mask.contains('…'));
    }

    #[test]
    fn deeplink_encodes_spki_fingerprint() {
        let encoded = encode_component("sha256/abc+=");

        assert_eq!(encoded, "sha256%2Fabc%2B%3D");
    }

    #[test]
    fn same_public_key_upserts_existing_device() {
        let mut registry = MobileHudDeviceRegistry::default();
        let public_key_hash = hash_secret("phone-public-key");
        let (first_id, first_approved) = upsert_device_record(
            &mut registry,
            "Yue Phone".to_string(),
            public_key_hash.clone(),
            Some("phone-public-key".to_string()),
            false,
            "2026-06-18T08:00:00Z".to_string(),
        );
        let (second_id, second_approved) = upsert_device_record(
            &mut registry,
            "Yue Phone Again".to_string(),
            public_key_hash,
            Some("phone-public-key-rotated-label".to_string()),
            true,
            "2026-06-18T08:01:00Z".to_string(),
        );

        assert_eq!(registry.devices.len(), 1);
        assert_eq!(first_id, second_id);
        assert!(!first_approved);
        assert!(second_approved);
        assert_eq!(registry.devices[0].device_label, "Yue Phone Again");
        assert_eq!(
            registry.devices[0].last_seen_at.as_deref(),
            Some("2026-06-18T08:01:00Z")
        );
    }

    #[test]
    fn revoked_public_key_reuses_record_as_pending() {
        let mut registry = MobileHudDeviceRegistry::default();
        let public_key_hash = hash_secret("phone-public-key");
        let (device_id, _) = upsert_device_record(
            &mut registry,
            "Yue Phone".to_string(),
            public_key_hash.clone(),
            Some("phone-public-key".to_string()),
            true,
            "2026-06-18T08:00:00Z".to_string(),
        );
        registry.devices[0].revoked = true;
        registry.devices[0].approved = false;
        let (new_device_id, approved) = upsert_device_record(
            &mut registry,
            "Yue Phone".to_string(),
            public_key_hash,
            Some("phone-public-key".to_string()),
            false,
            "2026-06-18T08:02:00Z".to_string(),
        );

        assert_eq!(registry.devices.len(), 1);
        assert_eq!(device_id, new_device_id);
        assert!(!approved);
        assert!(!registry.devices[0].revoked);
    }

    #[test]
    fn inactive_service_cannot_create_pairing_offer() {
        let status = MobileHudServiceStatus {
            phase: MobileHudServicePhase::Disabled,
            enabled: false,
            host: "127.0.0.1".to_string(),
            port: 27431,
            base_url: None,
            ws_url: None,
            transport: "wssSpkiPinning".to_string(),
            server_fingerprint: None,
            certificate_pem_path: None,
            last_error: None,
            connected_clients: 0,
            privacy_note: "test".to_string(),
        };

        assert!(create_pairing_offer(&status, &AppSettings::default()).is_err());
    }
}
