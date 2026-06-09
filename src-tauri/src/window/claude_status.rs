use std::{env, fs, path::PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeStatusBridgeState {
    pub schema_version: u8,
    pub updated_at: String,
    pub event: String,
    pub activity: String,
    pub status_text: String,
    pub session_id: Option<String>,
    pub session_name: Option<String>,
    pub cwd: Option<String>,
    pub project_dir: Option<String>,
    pub project_slug: Option<String>,
    pub transcript_path: Option<String>,
    pub model_id: Option<String>,
    pub model_name: Option<String>,
    pub version: Option<String>,
    pub output_style: Option<String>,
    pub context_used_percent: Option<f64>,
    pub context_remaining_percent: Option<f64>,
    pub context_window_size: Option<f64>,
    pub input_tokens: Option<f64>,
    pub output_tokens: Option<f64>,
    pub cache_creation_input_tokens: Option<f64>,
    pub cache_read_input_tokens: Option<f64>,
    pub total_cost_usd: Option<f64>,
    pub total_duration_ms: Option<f64>,
    pub total_api_duration_ms: Option<f64>,
    pub total_lines_added: Option<f64>,
    pub total_lines_removed: Option<f64>,
    pub five_hour_used_percent: Option<f64>,
    pub five_hour_reset_at: Option<String>,
    pub seven_day_used_percent: Option<f64>,
    pub seven_day_reset_at: Option<String>,
    pub effort_level: Option<String>,
    pub thinking_enabled: Option<bool>,
    pub agent_name: Option<String>,
    pub hook_event_name: Option<String>,
    pub tool_name: Option<String>,
    pub source: String,
    pub privacy_note: String,
}

pub fn get_claude_status_bridge_state() -> Option<ClaudeStatusBridgeState> {
    state_paths()
        .into_iter()
        .find_map(|path| fs::read_to_string(path).ok())
        .and_then(|content| serde_json::from_str::<ClaudeStatusBridgeState>(&content).ok())
}

fn state_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Some(appdata) = env::var_os("APPDATA") {
        paths.push(PathBuf::from(appdata).join("Claude Island Win").join("claude-status.json"));
    }

    if let Ok(current_dir) = env::current_dir() {
        paths.push(current_dir.join(".claude").join("bridge").join("state").join("claude-status.json"));
    }

    paths
}
