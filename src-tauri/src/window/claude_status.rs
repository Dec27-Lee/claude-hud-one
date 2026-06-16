use std::{collections::HashMap, env, fs::{self, OpenOptions}, io::Write, path::{Path, PathBuf}};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingQueueChoice {
    pub id: String,
    pub label: String,
    pub kind: Option<String>,
    pub intent: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingQueueItem {
    pub id: String,
    pub kind: String,
    pub status: String,
    pub session_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub expires_at: Option<String>,
    pub source: String,
    pub hook_event_name: Option<String>,
    pub permission_mode: Option<String>,
    pub tool_name: Option<String>,
    pub project_slug: Option<String>,
    pub cwd_slug: Option<String>,
    pub title: String,
    pub summary: Option<String>,
    pub choices: Option<Vec<PendingQueueChoice>>,
    pub intent_id: Option<String>,
    pub allowed_intents: Option<Vec<String>>,
    pub intent_expires_at: Option<String>,
    pub decision_state: Option<String>,
    pub question_mode: Option<String>,
    pub answer_placeholder: Option<String>,
    pub privacy_note: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingQueueState {
    pub schema_version: u8,
    pub updated_at: String,
    pub items: Vec<PendingQueueItem>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionTerminalMetadata {
    pub cwd: Option<String>,
    pub kind: String,
    pub wt_session: Option<String>,
    pub wt_profile_id: Option<String>,
    pub wt_profile_name: Option<String>,
    pub term_program: Option<String>,
    pub shell: Option<String>,
    pub bridge_process_id: Option<u32>,
    pub bridge_parent_process_id: Option<u32>,
    pub window_title_hint: Option<String>,
    pub captured_at: String,
}

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
    pub pending_queue: Option<PendingQueueState>,
    pub terminal: Option<SessionTerminalMetadata>,
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingIntentResolutionRequest {
    pub intent_id: String,
    pub item_id: Option<String>,
    pub display_key: Option<String>,
    pub session_id: Option<String>,
    pub action: String,
    pub choice_id: Option<String>,
    pub answer_text: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingIntentResolutionResult {
    pub status: String,
    pub intent_id: String,
    pub action: String,
    pub message: String,
}

pub fn resolve_pending_intent(request: PendingIntentResolutionRequest) -> Result<PendingIntentResolutionResult, String> {
    let action = request.action.trim();
    if !matches!(action, "allowOnce" | "deny" | "answerIntent" | "dismiss") {
        return Err("Unsupported pending intent action.".to_string());
    }

    let intent_id = safe_path_segment(&request.intent_id)
        .ok_or_else(|| "Invalid pending intent id.".to_string())?;
    let pending_request = read_pending_intent_request(&intent_id)
        .ok_or_else(|| "Pending intent request was not found or has expired.".to_string())?;

    let kind = pending_request
        .get("kind")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("");
    let allowed = pending_request
        .get("allowedIntents")
        .and_then(serde_json::Value::as_array)
        .map(|items| items.iter().filter_map(serde_json::Value::as_str).any(|value| value == action))
        .unwrap_or(false);
    if !allowed {
        return Err("This action is not allowed for the pending item.".to_string());
    }
    if kind == "approval" && !matches!(action, "allowOnce" | "deny" | "dismiss") {
        return Err("Approval items only accept allowOnce or deny.".to_string());
    }
    if kind == "question" && !matches!(action, "answerIntent" | "dismiss") {
        return Err("Question items only accept answer intent or dismiss.".to_string());
    }

    let nonce = pending_request
        .get("nonce")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "Pending intent request is missing its private nonce.".to_string())?;

    let response = serde_json::json!({
        "schemaVersion": 1,
        "intentId": intent_id.clone(),
        "itemId": request.item_id,
        "displayKey": request.display_key,
        "sessionId": request.session_id,
        "nonce": nonce,
        "action": action,
        "choiceId": request.choice_id,
        "answerText": request.answer_text,
        "resolvedAtMs": now_ms(),
    });
    write_pending_intent_response(&intent_id, &response)?;
    append_pending_intent_audit(&intent_id, action, kind)?;

    Ok(PendingIntentResolutionResult {
        status: "accepted".to_string(),
        intent_id,
        action: action.to_string(),
        message: match action {
            "allowOnce" => "Approval was sent to Claude Code.".to_string(),
            "deny" => "Denial was sent to Claude Code.".to_string(),
            "answerIntent" => "Question answer intent was recorded.".to_string(),
            _ => "HUD reminder was dismissed.".to_string(),
        },
    })
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

fn pending_intent_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Some(appdata) = env::var_os("APPDATA") {
        dirs.push(PathBuf::from(appdata).join("Claude HUD One").join("pending-intents"));
    }

    if let Ok(current_dir) = env::current_dir() {
        dirs.push(current_dir.join(".claude").join("bridge").join("state").join("pending-intents"));
    }

    dirs
}

fn safe_path_segment(value: &str) -> Option<String> {
    let safe = value
        .replace('\\', "/")
        .split('/')
        .filter(|part| !part.trim().is_empty())
        .collect::<Vec<_>>()
        .join("-")
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-') { ch } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .chars()
        .take(160)
        .collect::<String>();

    if safe.is_empty() { None } else { Some(safe) }
}

fn read_pending_intent_request(intent_id: &str) -> Option<serde_json::Value> {
    pending_intent_dirs()
        .into_iter()
        .map(|dir| dir.join("requests").join(format!("{intent_id}.json")))
        .find_map(|path| fs::read_to_string(path).ok().and_then(|content| serde_json::from_str(&content).ok()))
}

fn write_pending_intent_response(intent_id: &str, response: &serde_json::Value) -> Result<(), String> {
    let dirs = pending_intent_dirs();
    if dirs.is_empty() {
        return Err("No pending intent directory is available.".to_string());
    }

    let content = serde_json::to_string_pretty(response).map_err(|error| error.to_string())?;
    let mut last_error = None;
    for dir in dirs {
        let response_dir = dir.join("responses");
        if let Err(error) = fs::create_dir_all(&response_dir) {
            last_error = Some(error.to_string());
            continue;
        }

        let target = response_dir.join(format!("{intent_id}.json"));
        let tmp = response_dir.join(format!("{intent_id}.{}.tmp", std::process::id()));
        match fs::write(&tmp, &content).and_then(|_| fs::rename(&tmp, &target)) {
            Ok(_) => return Ok(()),
            Err(error) => {
                let _ = fs::remove_file(&tmp);
                last_error = Some(error.to_string());
            }
        }
    }

    Err(last_error.unwrap_or_else(|| "Failed to write pending intent response.".to_string()))
}

fn append_pending_intent_audit(intent_id: &str, action: &str, kind: &str) -> Result<(), String> {
    for dir in pending_intent_dirs() {
        fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
        let audit_path = dir.join("audit.jsonl");
        let event = serde_json::json!({
            "schemaVersion": 1,
            "intentId": intent_id,
            "action": action,
            "kind": kind,
            "recordedAtMs": now_ms(),
        });
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(audit_path)
            .map_err(|error| error.to_string())?;
        writeln!(file, "{}", event).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}
