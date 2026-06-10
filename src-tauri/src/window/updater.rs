use std::process::Command;

use serde::Serialize;

const RELEASE_PAGE_URL: &str = "https://github.com/Dec27-Lee/claude-hud-one/releases";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateState {
    pub status: String,
    pub current_version: String,
    pub channel: String,
    pub last_checked_at: Option<String>,
    pub message: String,
    pub configured: bool,
    pub can_check: bool,
    pub download_available: bool,
    pub manual_update_available: bool,
    pub error_code: Option<String>,
    pub endpoint: Option<String>,
    pub release_page_url: Option<String>,
}

pub fn update_state() -> UpdateState {
    UpdateState {
        status: "not_configured".to_string(),
        current_version: env!("CARGO_PKG_VERSION").to_string(),
        channel: "stable".to_string(),
        last_checked_at: None,
        message: "Automatic updates are not configured yet. This build supports manual updates through GitHub Releases: download the latest NSIS/MSI installer and install over the current version.".to_string(),
        configured: false,
        can_check: false,
        download_available: false,
        manual_update_available: true,
        error_code: Some("manual_update_only".to_string()),
        endpoint: None,
        release_page_url: Some(RELEASE_PAGE_URL.to_string()),
    }
}

pub fn check_for_updates() -> UpdateState {
    UpdateState {
        status: "manual_update_only".to_string(),
        last_checked_at: Some("manual-preflight".to_string()),
        message: "Automatic update checking is disabled because no signed update feed is configured. Use the release page to manually download and install the latest NSIS/MSI package.".to_string(),
        ..update_state()
    }
}

pub fn open_release_page() -> Result<String, String> {
    Command::new("explorer")
        .arg(RELEASE_PAGE_URL)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(RELEASE_PAGE_URL.to_string())
}
