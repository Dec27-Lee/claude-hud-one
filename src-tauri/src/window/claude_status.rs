use std::{
    collections::HashMap,
    env,
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

use crate::local_runtime::audit;

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
    pub last_running_signal_at: Option<String>,
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
    pub permission_mode: Option<String>,
    pub tool_name: Option<String>,
    pub output_speed: Option<f64>,
    pub added_dir_slugs: Option<Vec<String>>,
    pub added_dirs_overflow_count: Option<f64>,
    pub git_branch: Option<String>,
    pub git_dirty: Option<bool>,
    pub git_ahead: Option<f64>,
    pub git_behind: Option<f64>,
    pub session_started_at: Option<String>,
    pub last_assistant_response_at: Option<String>,
    pub tools_count: Option<f64>,
    pub tools_running_count: Option<f64>,
    pub agents_count: Option<f64>,
    pub agents_running_count: Option<f64>,
    pub todos_active_count: Option<f64>,
    pub todos_completed_count: Option<f64>,
    pub todos_total_count: Option<f64>,
    pub pending_queue: Option<PendingQueueState>,
    pub terminal: Option<SessionTerminalMetadata>,
    pub source: String,
    pub privacy_note: String,
}

pub fn get_claude_status_bridge_state() -> Option<ClaudeStatusBridgeState> {
    state_paths().into_iter().find_map(read_state_file)
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

pub fn resolve_pending_intent(
    request: PendingIntentResolutionRequest,
) -> Result<PendingIntentResolutionResult, String> {
    let action = request.action.trim();
    if !matches!(action, "allowOnce" | "deny" | "answerIntent" | "dismiss") {
        return Err("Unsupported pending intent action.".to_string());
    }

    let intent_id = safe_path_segment(&request.intent_id)
        .ok_or_else(|| "Invalid pending intent id.".to_string())?;
    let pending_request = read_pending_intent_request(&intent_id)
        .ok_or_else(|| "Pending intent request was not found or has expired.".to_string())?;
    if pending_request_is_expired(&pending_request) {
        return Err("Pending intent request has expired.".to_string());
    }

    let kind = pending_request
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or("");
    let allowed = pending_request
        .get("allowedIntents")
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(serde_json::Value::as_str)
                .any(|value| value == action)
        })
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
        "hasAnswer": request.answer_text.as_deref().map(|value| !value.trim().is_empty()).unwrap_or(false),
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
        .transcript_path
        .as_deref()
        .or(state.session_key.as_deref())
        .or(state.session_id.as_deref())
        .or(state.project_slug.as_deref())
        .unwrap_or("claude-code")
        .to_string()
}

fn state_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Some(appdata) = env::var_os("APPDATA") {
        paths.push(
            PathBuf::from(appdata)
                .join("Claude HUD One")
                .join("claude-status.json"),
        );
    }

    if let Ok(current_dir) = env::current_dir() {
        paths.push(
            current_dir
                .join(".claude")
                .join("bridge")
                .join("state")
                .join("claude-status.json"),
        );
    }

    paths
}

fn session_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Some(appdata) = env::var_os("APPDATA") {
        dirs.push(
            PathBuf::from(appdata)
                .join("Claude HUD One")
                .join("sessions"),
        );
    }

    if let Ok(current_dir) = env::current_dir() {
        dirs.push(
            current_dir
                .join(".claude")
                .join("bridge")
                .join("state")
                .join("sessions"),
        );
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
        dirs.push(
            PathBuf::from(appdata)
                .join("Claude HUD One")
                .join("pending-intents"),
        );
    }

    if let Ok(current_dir) = env::current_dir() {
        dirs.push(
            current_dir
                .join(".claude")
                .join("bridge")
                .join("state")
                .join("pending-intents"),
        );
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
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-') {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .chars()
        .take(160)
        .collect::<String>();

    if safe.is_empty() {
        None
    } else {
        Some(safe)
    }
}

fn read_pending_intent_request(intent_id: &str) -> Option<serde_json::Value> {
    pending_intent_dirs()
        .into_iter()
        .map(|dir| dir.join("requests").join(format!("{intent_id}.json")))
        .find_map(|path| {
            fs::read_to_string(path)
                .ok()
                .and_then(|content| serde_json::from_str(&content).ok())
        })
}

fn pending_request_is_expired(request: &Value) -> bool {
    request
        .get("expiresAt")
        .and_then(Value::as_str)
        .and_then(ms_from_iso)
        .map(|expires_at| expires_at <= now_ms())
        .unwrap_or(true)
}

fn ms_from_iso(value: &str) -> Option<u128> {
    OffsetDateTime::parse(value, &Rfc3339)
        .ok()
        .and_then(|timestamp| timestamp.unix_timestamp_nanos().try_into().ok())
        .map(|nanos: u128| nanos / 1_000_000)
}

fn write_pending_intent_response(
    intent_id: &str,
    response: &serde_json::Value,
) -> Result<(), String> {
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
            "intentRef": audit::stable_ref("intent", intent_id),
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use time::Duration;

    static TEST_LOCK: Mutex<()> = Mutex::new(());

    struct EnvGuard {
        root: PathBuf,
        original_appdata: Option<String>,
        original_dir: PathBuf,
    }

    impl EnvGuard {
        fn new(name: &str) -> Self {
            let root = env::temp_dir().join(format!(
                "claude-hud-one-pending-intent-test-{}-{name}",
                std::process::id()
            ));
            let _ = fs::remove_dir_all(&root);
            fs::create_dir_all(&root).unwrap();
            let original_appdata = env::var("APPDATA").ok();
            let original_dir = env::current_dir().unwrap();
            env::set_var("APPDATA", root.join("appdata"));
            env::set_current_dir(&root).unwrap();
            Self {
                root,
                original_appdata,
                original_dir,
            }
        }

        fn write_request(
            &self,
            intent_id: &str,
            expires_at: OffsetDateTime,
            allowed: &[&str],
            kind: &str,
        ) {
            let request_dir = self
                .root
                .join("appdata")
                .join("Claude HUD One")
                .join("pending-intents")
                .join("requests");
            fs::create_dir_all(&request_dir).unwrap();
            fs::write(
                request_dir.join(format!("{intent_id}.json")),
                serde_json::to_string_pretty(&serde_json::json!({
                    "schemaVersion": 1,
                    "intentId": intent_id,
                    "nonce": "private-test-nonce",
                    "kind": kind,
                    "sessionId": "test-session",
                    "allowedIntents": allowed,
                    "expiresAt": expires_at.format(&Rfc3339).unwrap(),
                }))
                .unwrap(),
            )
            .unwrap();
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            if let Some(value) = &self.original_appdata {
                env::set_var("APPDATA", value);
            } else {
                env::remove_var("APPDATA");
            }
            let _ = env::set_current_dir(&self.original_dir);
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn bridge_sessions_dedupe_resume_aliases_by_transcript_path() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new("resume-dedupe");
        let sessions_dir = guard
            .root
            .join("appdata")
            .join("Claude HUD One")
            .join("sessions");
        fs::create_dir_all(&sessions_dir).unwrap();
        let transcript_path = guard
            .root
            .join("same-resume-transcript.jsonl")
            .to_string_lossy()
            .to_string();
        let base = serde_json::json!({
            "schemaVersion": 1,
            "updatedAt": "2026-06-29T00:00:00Z",
            "activityStartedAt": "2026-06-29T00:00:00Z",
            "lastRunningSignalAt": null,
            "event": "statusLine",
            "activity": "idle",
            "statusText": "Session idle",
            "sessionName": "Resume Fixture",
            "transcriptPath": transcript_path,
            "source": "statusLine",
            "privacyNote": "test"
        });
        let mut old_state = base.clone();
        old_state.as_object_mut().unwrap().insert(
            "sessionKey".to_string(),
            serde_json::json!("old-session-key"),
        );
        old_state
            .as_object_mut()
            .unwrap()
            .insert("sessionId".to_string(), serde_json::json!("old-session-id"));
        let mut new_state = base;
        new_state.as_object_mut().unwrap().insert(
            "updatedAt".to_string(),
            serde_json::json!("2026-06-29T00:01:00Z"),
        );
        new_state.as_object_mut().unwrap().insert(
            "sessionKey".to_string(),
            serde_json::json!("new-session-key"),
        );
        new_state
            .as_object_mut()
            .unwrap()
            .insert("sessionId".to_string(), serde_json::json!("new-session-id"));
        fs::write(
            sessions_dir.join("old-session-key.json"),
            serde_json::to_string_pretty(&old_state).unwrap(),
        )
        .unwrap();
        fs::write(
            sessions_dir.join("new-session-key.json"),
            serde_json::to_string_pretty(&new_state).unwrap(),
        )
        .unwrap();

        let sessions = get_claude_status_bridge_sessions();

        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].session_id.as_deref(), Some("new-session-id"));
    }

    #[test]
    fn resolve_pending_intent_does_not_persist_answer_text() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new("answer-text");
        let intent_id = "question-test-intent";
        guard.write_request(
            intent_id,
            OffsetDateTime::now_utc() + Duration::minutes(5),
            &["answerIntent", "dismiss"],
            "question",
        );

        let result = resolve_pending_intent(PendingIntentResolutionRequest {
            intent_id: intent_id.to_string(),
            item_id: Some("item-1".to_string()),
            display_key: Some("display-1".to_string()),
            session_id: Some("test-session".to_string()),
            action: "answerIntent".to_string(),
            choice_id: Some("freeform-answer".to_string()),
            answer_text: Some("SECRET_ANSWER_TEXT_SHOULD_NOT_LEAK".to_string()),
        })
        .unwrap();

        assert_eq!(result.status, "accepted");
        let response = fs::read_to_string(
            guard
                .root
                .join("appdata")
                .join("Claude HUD One")
                .join("pending-intents")
                .join("responses")
                .join(format!("{intent_id}.json")),
        )
        .unwrap();
        assert!(response.contains("hasAnswer"));
        assert!(!response.contains("answerText"));
        assert!(!response.contains("SECRET_ANSWER_TEXT_SHOULD_NOT_LEAK"));
        let audit = fs::read_to_string(
            guard
                .root
                .join("appdata")
                .join("Claude HUD One")
                .join("pending-intents")
                .join("audit.jsonl"),
        )
        .unwrap();
        assert!(audit.contains("intentRef"));
        assert!(!audit.contains(intent_id));
    }

    #[test]
    fn resolve_pending_intent_rejects_expired_request() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new("expired");
        let intent_id = "expired-test-intent";
        guard.write_request(
            intent_id,
            OffsetDateTime::now_utc() - Duration::minutes(5),
            &["allowOnce", "deny", "dismiss"],
            "approval",
        );

        let result = resolve_pending_intent(PendingIntentResolutionRequest {
            intent_id: intent_id.to_string(),
            item_id: Some("item-1".to_string()),
            display_key: Some("display-1".to_string()),
            session_id: Some("test-session".to_string()),
            action: "allowOnce".to_string(),
            choice_id: Some("allow-once".to_string()),
            answer_text: None,
        });

        assert!(result.unwrap_err().contains("expired"));
        assert!(!guard
            .root
            .join("appdata")
            .join("Claude HUD One")
            .join("pending-intents")
            .join("responses")
            .join(format!("{intent_id}.json"))
            .exists());
    }
}
