use std::{env, fs, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use uuid::Uuid;

const APP_NAME: &str = "Claude HUD One";
const DEFAULT_RETENTION_DAYS: u32 = 30;
const SENSITIVE_KEY_PARTS: &[&str] = &[
    "prompt",
    "message",
    "content",
    "toolinput",
    "toolresult",
    "transcript",
    "cwd",
    "projectdir",
    "command",
    "argument",
    "token",
    "cost",
    "nonce",
    "signature",
    "publickey",
    "privatekey",
    "body",
    "answertext",
    "credential",
    "secret",
    "password",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEvent {
    pub event_id: String,
    pub occurred_at_ms: u64,
    pub source: String,
    pub event_type: String,
    pub outcome: String,
    pub session_ref: Option<String>,
    pub project_ref: Option<String>,
    pub device_ref: Option<String>,
    pub hook_event_name: Option<String>,
    pub tool_name: Option<String>,
    pub action: Option<String>,
    pub reason_code: Option<String>,
    pub sensitivity: String,
    pub attributes: Value,
}

impl AuditEvent {
    pub fn new(source: &str, event_type: &str, outcome: &str) -> Self {
        Self {
            event_id: format!("audit-{}", Uuid::new_v4().simple()),
            occurred_at_ms: unix_millis() as u64,
            source: source.to_string(),
            event_type: event_type.to_string(),
            outcome: outcome.to_string(),
            session_ref: None,
            project_ref: None,
            device_ref: None,
            hook_event_name: None,
            tool_name: None,
            action: None,
            reason_code: None,
            sensitivity: "low".to_string(),
            attributes: json!({}),
        }
    }
}

#[derive(Debug, Clone)]
pub struct AuditStore {
    db_path: PathBuf,
}

impl AuditStore {
    pub fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }

    pub fn init(&self) -> Result<(), String> {
        let connection = self.connection()?;
        init_schema(&connection)
    }

    pub fn record(&self, event: &AuditEvent) -> Result<(), String> {
        reject_sensitive_attributes(&event.attributes)?;
        let connection = self.connection()?;
        init_schema(&connection)?;
        connection
            .execute(
                "INSERT OR IGNORE INTO audit_events (
                    event_id, occurred_at_ms, source, event_type, outcome,
                    session_ref, project_ref, device_ref, hook_event_name, tool_name,
                    action, reason_code, sensitivity, attributes_json, created_at_ms
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                params![
                    event.event_id,
                    event.occurred_at_ms as i64,
                    event.source,
                    event.event_type,
                    event.outcome,
                    event.session_ref,
                    event.project_ref,
                    event.device_ref,
                    event.hook_event_name,
                    event.tool_name,
                    event.action,
                    event.reason_code,
                    event.sensitivity,
                    serde_json::to_string(&event.attributes).map_err(|error| error.to_string())?,
                    unix_millis() as i64,
                ],
            )
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn prune_older_than(&self, retention_days: u32) -> Result<usize, String> {
        let connection = self.connection()?;
        init_schema(&connection)?;
        let retention_ms = retention_days.max(1) as u128 * 24 * 60 * 60 * 1000;
        let cutoff = unix_millis().saturating_sub(retention_ms) as i64;
        connection
            .execute("DELETE FROM audit_events WHERE occurred_at_ms < ?1", params![cutoff])
            .map_err(|error| error.to_string())
    }

    fn connection(&self) -> Result<Connection, String> {
        if let Some(parent) = self.db_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        Connection::open(&self.db_path).map_err(|error| error.to_string())
    }

    #[cfg(test)]
    fn dump_events(&self) -> Result<Vec<AuditEvent>, String> {
        let connection = self.connection()?;
        init_schema(&connection)?;
        let mut statement = connection
            .prepare(
                "SELECT event_id, occurred_at_ms, source, event_type, outcome,
                        session_ref, project_ref, device_ref, hook_event_name, tool_name,
                        action, reason_code, sensitivity, attributes_json
                 FROM audit_events ORDER BY id ASC",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| {
                let attributes_json: String = row.get(13)?;
                Ok(AuditEvent {
                    event_id: row.get(0)?,
                    occurred_at_ms: row.get::<_, i64>(1)? as u64,
                    source: row.get(2)?,
                    event_type: row.get(3)?,
                    outcome: row.get(4)?,
                    session_ref: row.get(5)?,
                    project_ref: row.get(6)?,
                    device_ref: row.get(7)?,
                    hook_event_name: row.get(8)?,
                    tool_name: row.get(9)?,
                    action: row.get(10)?,
                    reason_code: row.get(11)?,
                    sensitivity: row.get(12)?,
                    attributes: serde_json::from_str(&attributes_json).unwrap_or_else(|_| json!({})),
                })
            })
            .map_err(|error| error.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
    }
}

pub fn default_audit_db_path() -> Option<PathBuf> {
    env::var_os("CLAUDE_HUD_ONE_AUDIT_DB")
        .map(PathBuf::from)
        .or_else(|| env::var_os("APPDATA").map(PathBuf::from).map(|root| root.join(APP_NAME).join("audit").join("audit.sqlite3")))
}

pub fn record_best_effort(event: AuditEvent) {
    let Some(path) = default_audit_db_path() else {
        return;
    };
    let store = AuditStore::new(path);
    let _ = store.record(&event);
    let _ = store.prune_older_than(DEFAULT_RETENTION_DAYS);
}

pub fn bridge_parse_failed_event(mode: &str) -> AuditEvent {
    let mut event = AuditEvent::new("hudBridge", "bridge.input.parse_failed", "fallback");
    event.reason_code = Some("invalid_json".to_string());
    event.attributes = json!({ "mode": safe_short_value(mode) });
    event
}

pub fn bridge_event_from_state(state: &Value, mode: &str, outcome: &str) -> AuditEvent {
    let event_type = if mode == "hook" { "bridge.hook.processed" } else { "bridge.statusline.processed" };
    let mut event = AuditEvent::new("hudBridge", event_type, outcome);
    event.session_ref = session_ref_from_state(state);
    event.project_ref = project_ref_from_state(state);
    event.hook_event_name = state.get("hookEventName").and_then(Value::as_str).map(safe_short_value);
    event.tool_name = safe_tool_name(state.get("toolName").and_then(Value::as_str));
    event.attributes = json!({
        "mode": safe_short_value(mode),
        "hasModel": state.get("modelName").and_then(Value::as_str).is_some(),
        "hasContextPercent": state.get("contextUsedPercent").and_then(|value| value.as_f64()).is_some(),
        "hasGit": state.get("gitBranch").and_then(Value::as_str).is_some(),
        "hasPendingQueue": state.get("pendingQueue").and_then(|queue| queue.get("items")).and_then(Value::as_array).map(|items| !items.is_empty()).unwrap_or(false),
    });
    event
}

pub fn pending_intent_created_event(state: &Value, item: &Value) -> AuditEvent {
    let mut event = AuditEvent::new("hudBridge", "pending_intent.created", "ok");
    event.session_ref = session_ref_from_state(state);
    event.project_ref = project_ref_from_state(state);
    event.hook_event_name = item
        .get("hookEventName")
        .and_then(Value::as_str)
        .or_else(|| state.get("hookEventName").and_then(Value::as_str))
        .map(safe_short_value);
    event.tool_name = safe_tool_name(item.get("toolName").and_then(Value::as_str).or_else(|| state.get("toolName").and_then(Value::as_str)));
    event.attributes = json!({
        "kind": item.get("kind").and_then(Value::as_str).map(safe_short_value).unwrap_or_else(|| "approval".to_string()),
        "intentRef": item.get("intentId").and_then(Value::as_str).map(|value| stable_ref("intent", value)),
    });
    event
}

pub fn pending_intent_decision_event(state: &Value, action: &str, outcome: &str, reason_code: &str) -> AuditEvent {
    let mut event = AuditEvent::new("hudBridge", "pending_intent.decision_sent", outcome);
    event.session_ref = session_ref_from_state(state);
    event.project_ref = project_ref_from_state(state);
    event.hook_event_name = state.get("hookEventName").and_then(Value::as_str).map(safe_short_value);
    event.tool_name = safe_tool_name(state.get("toolName").and_then(Value::as_str));
    event.action = Some(safe_short_value(action));
    event.reason_code = Some(safe_short_value(reason_code));
    event
}

pub fn mobile_intent_event(event_type: &str, outcome: &str, device_id: Option<&str>, action: Option<&str>, reason_code: Option<&str>) -> AuditEvent {
    let mut event = AuditEvent::new("mobileHud", event_type, outcome);
    event.device_ref = device_id.map(|value| stable_ref("device", value));
    event.action = action.map(safe_short_value);
    event.reason_code = reason_code.map(safe_short_value);
    event
}

pub fn mobile_service_event(event_type: &str, outcome: &str, reason_code: Option<&str>) -> AuditEvent {
    let mut event = AuditEvent::new("mobileHud", event_type, outcome);
    event.reason_code = reason_code.map(safe_short_value);
    event
}

pub fn stable_ref(prefix: &str, raw: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    let digest = hasher.finalize();
    let short = digest.iter().take(12).map(|byte| format!("{byte:02x}")).collect::<String>();
    format!("{prefix}_{short}")
}

pub fn session_ref_from_state(state: &Value) -> Option<String> {
    state
        .get("sessionId")
        .and_then(Value::as_str)
        .or_else(|| state.get("sessionKey").and_then(Value::as_str))
        .or_else(|| state.get("transcriptPath").and_then(Value::as_str))
        .map(|value| stable_ref("session", value))
}

pub fn project_ref_from_state(state: &Value) -> Option<String> {
    state
        .get("projectDir")
        .and_then(Value::as_str)
        .or_else(|| state.get("cwd").and_then(Value::as_str))
        .or_else(|| state.get("projectSlug").and_then(Value::as_str))
        .map(|value| stable_ref("project", value))
}

pub fn safe_tool_name(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| {
            value
                .chars()
                .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | ':' | '.'))
                .take(96)
                .collect::<String>()
        })
        .filter(|value| !value.is_empty())
}

fn init_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS audit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT NOT NULL UNIQUE,
                occurred_at_ms INTEGER NOT NULL,
                source TEXT NOT NULL,
                event_type TEXT NOT NULL,
                outcome TEXT NOT NULL,
                session_ref TEXT,
                project_ref TEXT,
                device_ref TEXT,
                hook_event_name TEXT,
                tool_name TEXT,
                action TEXT,
                reason_code TEXT,
                sensitivity TEXT NOT NULL DEFAULT 'low',
                attributes_json TEXT NOT NULL DEFAULT '{}',
                created_at_ms INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_audit_events_time ON audit_events(occurred_at_ms);
            CREATE INDEX IF NOT EXISTS idx_audit_events_type_time ON audit_events(event_type, occurred_at_ms);
            CREATE INDEX IF NOT EXISTS idx_audit_events_session_time ON audit_events(session_ref, occurred_at_ms);",
        )
        .map_err(|error| error.to_string())
}

fn reject_sensitive_attributes(value: &Value) -> Result<(), String> {
    match value {
        Value::Object(object) => {
            for (key, nested) in object {
                let normalized = key.replace(['_', '-'], "").to_ascii_lowercase();
                if SENSITIVE_KEY_PARTS.iter().any(|part| normalized.contains(part)) {
                    return Err(format!("Audit attribute key is too sensitive: {key}"));
                }
                reject_sensitive_attributes(nested)?;
            }
        }
        Value::Array(items) => {
            for item in items {
                reject_sensitive_attributes(item)?;
            }
        }
        _ => {}
    }
    Ok(())
}

fn safe_short_value(value: &str) -> String {
    value
        .trim()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | ':' | '.' | '/' | ' '))
        .take(96)
        .collect::<String>()
}

fn unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_store(name: &str) -> AuditStore {
        let root = env::temp_dir().join(format!("claude-hud-one-audit-test-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        AuditStore::new(root.join("audit.sqlite3"))
    }

    #[test]
    fn audit_store_initializes_schema_and_records_event() {
        let store = temp_store("record");
        let mut event = AuditEvent::new("test", "bridge.statusline.processed", "ok");
        event.session_ref = Some(stable_ref("session", "raw-session-id"));
        event.attributes = json!({ "hasModel": true });

        store.init().unwrap();
        store.record(&event).unwrap();

        let events = store.dump_events().unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_type, "bridge.statusline.processed");
        assert!(!serde_json::to_string(&events).unwrap().contains("raw-session-id"));
    }

    #[test]
    fn audit_rejects_sensitive_attribute_keys() {
        let store = temp_store("reject");
        let mut event = AuditEvent::new("test", "bridge.hook.processed", "ok");
        event.attributes = json!({ "request": { "toolInput": "SECRET_TOOL_INPUT_SHOULD_NOT_LEAK" } });

        assert!(store.record(&event).is_err());
        assert!(store.dump_events().unwrap().is_empty());
    }

    #[test]
    fn audit_refs_hash_device_values() {
        let event = mobile_intent_event("mobile.intent.resolved", "ok", Some("device-secret-id"), Some("allowOnce"), None);
        let serialized = serde_json::to_string(&event).unwrap();
        assert!(serialized.contains("device_"));
        assert!(!serialized.contains("device-secret-id"));
    }
}
