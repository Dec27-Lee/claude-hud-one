use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateState {
    pub status: String,
    pub current_version: String,
    pub channel: String,
    pub last_checked_at: Option<String>,
    pub message: String,
}

pub fn update_state() -> UpdateState {
    UpdateState {
        status: "not_configured".to_string(),
        current_version: env!("CARGO_PKG_VERSION").to_string(),
        channel: "stable".to_string(),
        last_checked_at: None,
        message: "Updater endpoint and signing key are not configured yet.".to_string(),
    }
}

pub fn check_for_updates() -> UpdateState {
    UpdateState {
        last_checked_at: Some("local-preflight".to_string()),
        ..update_state()
    }
}
