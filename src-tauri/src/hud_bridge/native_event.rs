use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeBridgeEvent {
    pub schema_version: u8,
    pub event_id: String,
    pub observed_at_ms: u64,
    pub source: String,
    pub mode: String,
    pub session_ref: String,
    pub event_name: Option<String>,
    pub permission_mode: Option<String>,
    pub has_session_id: bool,
    pub has_transcript_path: bool,
    pub has_cwd: bool,
    pub privacy_note: String,
}

pub fn build_native_bridge_event(input: &Value, mode: &str) -> NativeBridgeEvent {
    let session_key = first_string(input, &["session_id", "sessionId", "session_key", "sessionKey"])
        .or_else(|| first_string(input, &["transcript_path", "transcriptPath"]))
        .or_else(|| workspace_string(input, &["current_dir", "currentDir", "project_dir", "projectDir"]))
        .unwrap_or_else(|| "claude-code".to_string());
    let event_name = first_string(
        input,
        &[
            "hook_event_name",
            "hookEventName",
            "event",
            "eventName",
            "tool_event_name",
            "toolEventName",
        ],
    );
    let permission_mode = first_string(input, &["permission_mode", "permissionMode"]);
    let observed_at_ms = unix_millis();
    let event_id = format!(
        "native_{}",
        short_hash(&format!("{}:{}:{}", mode, session_key, observed_at_ms))
    );

    NativeBridgeEvent {
        schema_version: 1,
        event_id,
        observed_at_ms,
        source: "hudNativeBridge".to_string(),
        mode: mode.to_string(),
        session_ref: format!("session_{}", short_hash(&session_key)),
        event_name,
        permission_mode,
        has_session_id: first_string(input, &["session_id", "sessionId"]).is_some(),
        has_transcript_path: first_string(input, &["transcript_path", "transcriptPath"]).is_some(),
        has_cwd: first_string(input, &["cwd"]).is_some()
            || workspace_string(input, &["current_dir", "currentDir", "project_dir", "projectDir"])
                .is_some(),
        privacy_note: "Native bridge event intentionally emits refs and presence flags only; raw cwd, transcript path, tool input and prompt text stay on the PC.".to_string(),
    }
}

pub fn render_native_bridge_event_json(input: &Value, mode: &str) -> Value {
    json!(build_native_bridge_event(input, mode))
}

fn first_string(input: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .filter_map(|key| input.get(*key).and_then(Value::as_str))
        .map(str::trim)
        .find(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn workspace_string(input: &Value, keys: &[&str]) -> Option<String> {
    let workspace = input.get("workspace")?;
    keys.iter()
        .filter_map(|key| workspace.get(*key).and_then(Value::as_str))
        .map(str::trim)
        .find(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn unix_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn short_hash(value: &str) -> String {
    let digest = Sha256::digest(value.as_bytes());
    digest
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn hud_bridge_event_drops_raw_paths() {
        let input = json!({
            "session_id": "session-secret",
            "transcript_path": "C:/Users/Yue/.claude/projects/secret.jsonl",
            "cwd": "E:/Develop_E/claude-hud-one",
            "hook_event_name": "PreToolUse",
            "permission_mode": "default",
            "tool_input": "rm -rf secret"
        });

        let event = render_native_bridge_event_json(&input, "hook");
        let serialized = serde_json::to_string(&event).unwrap();

        assert!(serialized.contains("hudNativeBridge"));
        assert!(serialized.contains("PreToolUse"));
        assert!(!serialized.contains("secret.jsonl"));
        assert!(!serialized.contains("E:/Develop_E"));
        assert!(!serialized.contains("rm -rf"));
    }

    #[test]
    fn hud_bridge_event_uses_workspace_fallback() {
        let input = json!({
            "workspace": {
                "current_dir": "E:/Develop_E/claude-hud-one"
            }
        });

        let event = build_native_bridge_event(&input, "statusLine");

        assert!(event.session_ref.starts_with("session_"));
        assert!(event.has_cwd);
        assert!(!event.has_session_id);
    }
}
