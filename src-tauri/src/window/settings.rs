use std::{env, fs, path::PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub launch_at_login: bool,
    pub refresh_interval_minutes: u8,
    pub language: String,
    pub always_show_usage: bool,
    pub low_power_mode: bool,
    pub fullscreen_avoidance: bool,
    pub alerts_enabled: bool,
    pub warning_threshold: u8,
    pub critical_threshold: u8,
    pub target_display: Value,
    pub top_offset_px: i32,
    pub island_width_mode: String,
    pub chart_style: String,
    pub cost_style: String,
    pub token_count_mode: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            launch_at_login: false,
            refresh_interval_minutes: 5,
            language: "zh-CN".to_string(),
            always_show_usage: false,
            low_power_mode: false,
            fullscreen_avoidance: true,
            alerts_enabled: false,
            warning_threshold: 80,
            critical_threshold: 95,
            target_display: json!("auto"),
            top_offset_px: 0,
            island_width_mode: "notch".to_string(),
            chart_style: "ring".to_string(),
            cost_style: "usd".to_string(),
            token_count_mode: "all".to_string(),
        }
    }
}

pub fn load_app_settings() -> AppSettings {
    let Some(path) = settings_path() else {
        return AppSettings::default();
    };

    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str::<AppSettings>(&content).ok())
        .unwrap_or_default()
}

pub fn save_app_settings(settings: AppSettings) -> Result<AppSettings, String> {
    let path = settings_path().ok_or_else(|| "APPDATA is not available".to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let content = serde_json::to_string_pretty(&settings).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())?;
    Ok(settings)
}

fn settings_path() -> Option<PathBuf> {
    env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|appdata| appdata.join("Claude Island Win").join("settings.json"))
}
