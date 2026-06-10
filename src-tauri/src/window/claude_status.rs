use std::{collections::HashMap, env, fs, path::{Path, PathBuf}};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeStatusBridgeState {
    pub schema_version: u8,
    pub updated_at: String,
    pub activity_started_at: Option<String>,
    pub event: String,
    pub activity: String,
    pub status_text: String,
    pub session_key: Option<String>,
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
    pub context_used_tokens: Option<f64>,
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
        .find_map(read_state_file)
}

pub fn get_claude_status_bridge_sessions() -> Vec<ClaudeStatusBridgeState> {
    let mut sessions_by_key = HashMap::<String, ClaudeStatusBridgeState>::new();

    for path in session_state_paths() {
        if let Some(state) = read_state_file(path) {
            let key = state_key(&state);
            let should_replace = sessions_by_key
                .get(&key)
                .map(|current| state.updated_at > current.updated_at)
                .unwrap_or(true);
            if should_replace {
                sessions_by_key.insert(key, state);
            }
        }
    }

    if sessions_by_key.is_empty() {
        if let Some(state) = get_claude_status_bridge_state() {
            sessions_by_key.insert(state_key(&state), state);
        }
    }

    let mut sessions = sessions_by_key.into_values().collect::<Vec<_>>();
    sessions.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    sessions.truncate(24);
    sessions
}

fn read_state_file(path: PathBuf) -> Option<ClaudeStatusBridgeState> {
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str::<ClaudeStatusBridgeState>(&content).ok())
}

fn state_key(state: &ClaudeStatusBridgeState) -> String {
    state
        .session_key
        .as_deref()
        .or(state.session_id.as_deref())
        .or(state.transcript_path.as_deref())
        .or(state.project_slug.as_deref())
        .unwrap_or("claude-code")
        .to_string()
}

fn state_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Some(appdata) = env::var_os("APPDATA") {
        paths.push(PathBuf::from(appdata).join("Claude HUD One").join("claude-status.json"));
    }

    if let Ok(current_dir) = env::current_dir() {
        paths.push(current_dir.join(".claude").join("bridge").join("state").join("claude-status.json"));
    }

    paths
}

fn session_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Some(appdata) = env::var_os("APPDATA") {
        dirs.push(PathBuf::from(appdata).join("Claude HUD One").join("sessions"));
    }

    if let Ok(current_dir) = env::current_dir() {
        dirs.push(current_dir.join(".claude").join("bridge").join("state").join("sessions"));
    }

    dirs
}

fn session_state_paths() -> Vec<PathBuf> {
    session_dirs()
        .into_iter()
        .flat_map(read_json_files)
        .collect()
}

fn read_json_files(dir: PathBuf) -> Vec<PathBuf> {
    fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .map(|entry| entry.path())
                .filter(|path| is_json_file(path))
                .collect()
        })
        .unwrap_or_default()
}

fn is_json_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("json"))
        .unwrap_or(false)
}
