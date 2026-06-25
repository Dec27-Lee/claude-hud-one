use std::{env, fs, path::PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};

const HOOK_EVENTS: [&str; 16] = [
    "SessionStart",
    "UserPromptSubmit",
    "MessageDisplay",
    "PreToolUse",
    "PostToolUse",
    "PostToolUseFailure",
    "PostToolBatch",
    "Notification",
    "Stop",
    "StopFailure",
    "SubagentStart",
    "SubagentStop",
    "PreCompact",
    "PostCompact",
    "SessionEnd",
    "CwdChanged",
];
const CONTEXT_WINDOW_SIZE_ENV_KEY: &str = "CLAUDE_HUD_CONTEXT_WINDOW_SIZE";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeGlobalBridgeStatus {
    pub installed: bool,
    pub bridge_path: Option<String>,
    pub settings_path: Option<String>,
    pub backup_path: Option<String>,
    pub status_line_installed: bool,
    pub upstream_status_line_saved: bool,
    pub hook_events_installed: Vec<String>,
    pub message: String,
    pub compatibility_mode: String,
    pub status_line_owner: String,
    pub status_line_command: Option<String>,
    pub context_window_size_env: Option<String>,
    pub enhanced_capture_enabled: bool,
    pub hooks_installed: bool,
    pub upstream_status_line_command: Option<String>,
    pub can_restore_status_line: bool,
}

pub fn ensure_global_bridge() -> Result<ClaudeGlobalBridgeStatus, String> {
    let bridge_path = ensure_native_bridge()?;

    let settings_path = claude_settings_path().ok_or_else(|| "USERPROFILE/HOME is not available".to_string())?;
    let mut settings = read_settings_json(&settings_path)?;
    let original = settings.clone();
    let bridge_command = command_for_bridge(&bridge_path, false);
    let hook_command = command_for_bridge(&bridge_path, true);
    let previous_status_line = current_status_line_command(&settings);

    save_upstream_status_line(previous_status_line.as_deref(), &bridge_command)?;
    set_status_line(&mut settings, &bridge_command);
    ensure_hooks(&mut settings, &hook_command);

    let changed = settings != original;
    let backup_path = if changed && settings_path.exists() {
        backup_settings(&settings_path)?
    } else {
        None
    };

    if changed {
        write_settings_json(&settings_path, &settings)?;
    }

    Ok(status_from_settings(
        Some(bridge_path),
        Some(settings_path),
        backup_path,
        Some(settings),
        if changed {
            "Claude HUD One now owns Claude Code statusLine and hooks. Previous statusLine is kept only as an internal diagnostic backup."
        } else {
            "Claude HUD One already owns Claude Code statusLine and hooks."
        },
    ))
}

pub fn enable_status_line_bridge() -> Result<ClaudeGlobalBridgeStatus, String> {
    let bridge_path = ensure_native_bridge()?;

    let settings_path = claude_settings_path().ok_or_else(|| "USERPROFILE/HOME is not available".to_string())?;
    let mut settings = read_settings_json(&settings_path)?;
    let original = settings.clone();
    let bridge_command = command_for_bridge(&bridge_path, false);
    let hook_command = command_for_bridge(&bridge_path, true);
    let previous_status_line = current_status_line_command(&settings);

    save_upstream_status_line(previous_status_line.as_deref(), &bridge_command)?;
    set_status_line(&mut settings, &bridge_command);
    ensure_hooks(&mut settings, &hook_command);

    let changed = settings != original;
    let backup_path = if changed && settings_path.exists() {
        backup_settings(&settings_path)?
    } else {
        None
    };

    if changed {
        write_settings_json(&settings_path, &settings)?;
    }

    Ok(status_from_settings(
        Some(bridge_path),
        Some(settings_path),
        backup_path,
        Some(settings),
        if changed {
            "Claude HUD One statusLine owner repaired. Built-in Terminal HUD will render from the unified bridge."
        } else {
            "Claude HUD One statusLine owner is already active."
        },
    ))
}

pub fn restore_status_line() -> Result<ClaudeGlobalBridgeStatus, String> {
    let bridge_path = ensure_native_bridge()?;

    let settings_path = claude_settings_path().ok_or_else(|| "USERPROFILE/HOME is not available".to_string())?;
    let mut settings = read_settings_json(&settings_path)?;
    let original = settings.clone();
    let current = current_status_line_command(&settings);
    let message;

    if current.as_deref().map(command_is_bridge).unwrap_or(false) {
        ensure_object(&mut settings).remove("statusLine");
        message = "Claude HUD One statusLine removed. External statusLine restoration is not part of Claude HUD One owner mode; hooks remain installed.";
    } else {
        message = "Current statusLine is not managed by Claude HUD One. Nothing was changed.";
    }

    let changed = settings != original;
    let backup_path = if changed && settings_path.exists() {
        backup_settings(&settings_path)?
    } else {
        None
    };

    if changed {
        write_settings_json(&settings_path, &settings)?;
    }

    Ok(status_from_settings(
        Some(bridge_path),
        Some(settings_path),
        backup_path,
        Some(settings),
        message,
    ))
}

pub fn remove_global_bridge_hooks() -> Result<ClaudeGlobalBridgeStatus, String> {
    let bridge_path = ensure_native_bridge()?;

    let settings_path = claude_settings_path().ok_or_else(|| "USERPROFILE/HOME is not available".to_string())?;
    let mut settings = read_settings_json(&settings_path)?;
    let original = settings.clone();
    remove_hooks(&mut settings);

    let changed = settings != original;
    let backup_path = if changed && settings_path.exists() {
        backup_settings(&settings_path)?
    } else {
        None
    };

    if changed {
        write_settings_json(&settings_path, &settings)?;
    }

    Ok(status_from_settings(
        Some(bridge_path),
        Some(settings_path),
        backup_path,
        Some(settings),
        if changed {
            "Claude HUD One hooks removed. statusLine was left unchanged."
        } else {
            "No Claude HUD One hooks were found. statusLine was left unchanged."
        },
    ))
}

pub fn set_context_window_size_env(value: Option<String>) -> Result<ClaudeGlobalBridgeStatus, String> {
    let normalized = normalize_context_window_size(value)?;
    let bridge_path = ensure_native_bridge()?;

    let settings_path = claude_settings_path().ok_or_else(|| "USERPROFILE/HOME is not available".to_string())?;
    let mut settings = read_settings_json(&settings_path)?;
    let original = settings.clone();
    let bridge_command = command_for_bridge(&bridge_path, false);
    let previous_status_line = current_status_line_command(&settings);

    if !previous_status_line
        .as_deref()
        .map(command_is_bridge)
        .unwrap_or(false)
    {
        save_upstream_status_line(previous_status_line.as_deref(), &bridge_command)?;
        set_status_line(&mut settings, &bridge_command);
    }

    set_claude_env_value(
        &mut settings,
        CONTEXT_WINDOW_SIZE_ENV_KEY,
        normalized.as_deref(),
    );

    let changed = settings != original;
    let backup_path = if changed && settings_path.exists() {
        backup_settings(&settings_path)?
    } else {
        None
    };

    if changed {
        write_settings_json(&settings_path, &settings)?;
    }

    let message = if let Some(value) = normalized.as_deref() {
        format!("Claude HUD context window size override set to {}.", value)
    } else {
        "Claude HUD context window size override removed.".to_string()
    };

    Ok(status_from_settings(
        Some(bridge_path),
        Some(settings_path),
        backup_path,
        Some(settings),
        &message,
    ))
}

pub fn global_bridge_status() -> ClaudeGlobalBridgeStatus {
    let bridge_path = native_bridge_path();
    let settings_path = claude_settings_path();
    let settings = settings_path.as_ref().and_then(|path| read_settings_json(path).ok());

    status_from_settings(
        bridge_path,
        settings_path,
        None,
        settings,
        "Claude settings compatibility status loaded.",
    )
}

fn status_from_settings(
    bridge_path: Option<PathBuf>,
    settings_path: Option<PathBuf>,
    backup_path: Option<PathBuf>,
    settings: Option<Value>,
    message: &str,
) -> ClaudeGlobalBridgeStatus {
    let status_line_command = settings.as_ref().and_then(current_status_line_command);
    let status_line_installed = status_line_command
        .as_deref()
        .map(command_is_bridge)
        .unwrap_or(false);
    let hook_events_installed = settings
        .as_ref()
        .map(installed_hook_events)
        .unwrap_or_default();
    let hooks_installed = hook_events_installed.len() == HOOK_EVENTS.len();
    let bridge_exists = bridge_path.as_ref().map(|path| path.exists()).unwrap_or(false);
    let upstream_status_line_command = read_upstream_status_line_command();
    let upstream_status_line_saved = upstream_status_line_command.is_some();
    let installed = bridge_exists && hooks_installed;
    let compatibility_mode = match (hooks_installed, status_line_installed) {
        (true, true) => "owner",
        (true, false) => "hooks-only",
        (false, true) => "statusline-owner",
        (false, false) => "not-installed",
    }
    .to_string();
    let status_line_owner = status_line_command
        .as_deref()
        .map(status_line_owner)
        .unwrap_or("none")
        .to_string();
    let can_restore_status_line = upstream_status_line_saved || status_line_installed;
    let context_window_size_env = settings
        .as_ref()
        .and_then(|settings| current_context_window_size_env(settings));

    ClaudeGlobalBridgeStatus {
        installed,
        bridge_path: bridge_path.map(|path| path.to_string_lossy().to_string()),
        settings_path: settings_path.map(|path| path.to_string_lossy().to_string()),
        backup_path: backup_path.map(|path| path.to_string_lossy().to_string()),
        status_line_installed,
        upstream_status_line_saved,
        hook_events_installed,
        message: message.to_string(),
        compatibility_mode,
        status_line_owner,
        status_line_command,
        context_window_size_env,
        enhanced_capture_enabled: status_line_installed,
        hooks_installed,
        upstream_status_line_command,
        can_restore_status_line,
    }
}

fn app_data_dir() -> Option<PathBuf> {
    env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|appdata| appdata.join("Claude HUD One"))
}

fn native_bridge_path() -> Option<PathBuf> {
    let bridge_dir = app_data_dir()?.join("bridge");
    latest_installed_native_bridge(&bridge_dir).or_else(|| Some(bridge_dir.join("hud-bridge.exe")))
}

fn ensure_native_bridge() -> Result<PathBuf, String> {
    let bridge_dir = app_data_dir()
        .ok_or_else(|| "APPDATA is not available".to_string())?
        .join("bridge");
    fs::create_dir_all(&bridge_dir).map_err(|error| error.to_string())?;

    let source = native_bridge_resource_candidates()
        .into_iter()
        .find(|candidate| candidate.is_file());
    if let Some(source) = source {
        let hash = file_sha256_hex(&source)?;
        let target = bridge_dir.join(format!("hud-bridge-{}.exe", &hash[..12]));
        if native_bridge_needs_update(&source, &target) {
            fs::copy(&source, &target).map_err(|error| {
                format!(
                    "Failed to copy native hud-bridge from {}: {error}",
                    source.to_string_lossy()
                )
            })?;
        }
        best_effort_copy_legacy_native_bridge(&source, &bridge_dir.join("hud-bridge.exe"));
        return Ok(target);
    }

    latest_installed_native_bridge(&bridge_dir)
        .ok_or_else(|| "Native hud-bridge.exe resource was not found; Claude settings were left unchanged.".to_string())
}

fn latest_installed_native_bridge(bridge_dir: &PathBuf) -> Option<PathBuf> {
    let mut candidates = fs::read_dir(bridge_dir)
        .ok()?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.eq_ignore_ascii_case("hud-bridge.exe") || (name.starts_with("hud-bridge-") && name.ends_with(".exe")))
                .unwrap_or(false)
        })
        .filter(|path| path.is_file())
        .collect::<Vec<_>>();
    candidates.sort_by_key(|path| fs::metadata(path).and_then(|metadata| metadata.modified()).ok());
    candidates.pop()
}

fn native_bridge_needs_update(source: &PathBuf, target: &PathBuf) -> bool {
    if !target.is_file() {
        return true;
    }
    let source_len = fs::metadata(source).ok().map(|metadata| metadata.len());
    let target_len = fs::metadata(target).ok().map(|metadata| metadata.len());
    if source_len != target_len {
        return true;
    }
    fs::read(source).ok() != fs::read(target).ok()
}

fn best_effort_copy_legacy_native_bridge(source: &PathBuf, target: &PathBuf) {
    if native_bridge_needs_update(source, target) {
        let _ = fs::copy(source, target);
    }
}

fn file_sha256_hex(path: &PathBuf) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let digest = Sha256::digest(bytes);
    Ok(digest.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn native_bridge_resource_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(exe) = env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("resources").join("hud-bridge.exe"));
            candidates.push(dir.join("hud-bridge.exe"));
        }
    }
    if let Ok(current_dir) = env::current_dir() {
        candidates.push(current_dir.join("src-tauri").join("resources").join("hud-bridge.exe"));
        candidates.push(
            current_dir
                .join("src-tauri")
                .join("target")
                .join("release")
                .join("examples")
                .join("hud-bridge.exe"),
        );
    }
    candidates
}

fn upstream_statusline_path() -> Option<PathBuf> {
    app_data_dir().map(|dir| dir.join("bridge").join("upstream-statusline.json"))
}

fn claude_settings_path() -> Option<PathBuf> {
    env::var_os("USERPROFILE")
        .or_else(|| env::var_os("HOME"))
        .map(PathBuf::from)
        .map(|home| home.join(".claude").join("settings.json"))
}

fn read_settings_json(path: &PathBuf) -> Result<Value, String> {
    if !path.exists() {
        return Ok(json!({
            "$schema": "https://json.schemastore.org/claude-code-settings.json"
        }));
    }

    fs::read_to_string(path)
        .map_err(|error| error.to_string())
        .and_then(|content| serde_json::from_str::<Value>(&content).map_err(|error| error.to_string()))
        .map(|value| if value.is_object() { value } else { json!({}) })
}

fn write_settings_json(path: &PathBuf, settings: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let content = serde_json::to_string_pretty(settings).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())
}

fn backup_settings(path: &PathBuf) -> Result<Option<PathBuf>, String> {
    let backup_path = path.with_extension("json.claude-hud-one.bak");
    if !backup_path.exists() {
        fs::copy(path, &backup_path).map_err(|error| error.to_string())?;
        return Ok(Some(backup_path));
    }

    Ok(Some(backup_path))
}

fn command_for_bridge(path: &PathBuf, hook: bool) -> String {
    let mut command = format!("\"{}\"", path.to_string_lossy());
    if hook {
        command.push_str(" --hook");
    }
    command
}

fn command_is_bridge(command: &str) -> bool {
    let lower = command.to_ascii_lowercase();
    // Legacy Node bridge commands are recognized only so installer/repair can replace old settings.
    lower.contains("claude-status-bridge.mjs") || (lower.contains("hud-bridge") && lower.contains(".exe"))
}

fn status_line_owner(command: &str) -> &'static str {
    let lower = command.to_ascii_lowercase();
    if command_is_bridge(command) {
        "claude-hud-one"
    } else if lower.contains("claude-hud-plus") || lower.contains("hud-plus") {
        "claude-hud-plus"
    } else if lower.contains("claude-hud") {
        "claude-hud"
    } else {
        "custom"
    }
}

fn current_status_line_command(settings: &Value) -> Option<String> {
    settings
        .get("statusLine")
        .and_then(Value::as_object)
        .and_then(|object| object.get("command"))
        .and_then(Value::as_str)
        .filter(|command| !command.trim().is_empty())
        .map(ToString::to_string)
}

fn env_value_from_object(settings: &Value, object_key: &str, key: &str) -> Option<String> {
    settings
        .get(object_key)
        .and_then(Value::as_object)
        .and_then(|env| env.get(key))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn status_line_env_value(settings: &Value, key: &str) -> Option<String> {
    settings
        .get("statusLine")
        .and_then(Value::as_object)
        .and_then(|object| object.get("env"))
        .and_then(Value::as_object)
        .and_then(|env| env.get(key))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn current_context_window_size_env(settings: &Value) -> Option<String> {
    env_value_from_object(settings, "env", CONTEXT_WINDOW_SIZE_ENV_KEY)
        .or_else(|| status_line_env_value(settings, CONTEXT_WINDOW_SIZE_ENV_KEY))
}

fn normalize_context_window_size(value: Option<String>) -> Result<Option<String>, String> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let text = raw.trim();
    if text.is_empty() {
        return Ok(None);
    }
    let parsed = text
        .parse::<u64>()
        .map_err(|_| "Context window size must be a positive integer.".to_string())?;
    if parsed == 0 {
        return Err("Context window size must be greater than 0.".to_string());
    }
    Ok(Some(parsed.to_string()))
}

fn read_upstream_status_line_command() -> Option<String> {
    let path = upstream_statusline_path()?;
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str::<Value>(&content).ok())
        .and_then(|value| value.get("command").and_then(Value::as_str).map(ToString::to_string))
        .filter(|command| !command.trim().is_empty())
}

fn save_upstream_status_line(previous_command: Option<&str>, bridge_command: &str) -> Result<bool, String> {
    let Some(command) = previous_command else {
        return Ok(false);
    };
    if command.trim().is_empty() || command == bridge_command || command_is_bridge(command) {
        return Ok(false);
    }

    let Some(path) = upstream_statusline_path() else {
        return Ok(false);
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let content = serde_json::to_string_pretty(&json!({
        "command": command,
        "savedBy": "Claude HUD One",
    }))
    .map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())?;
    Ok(true)
}

fn set_status_line(settings: &mut Value, command: &str) {
    ensure_object(settings).insert(
        "statusLine".to_string(),
        json!({
            "type": "command",
            "command": command,
            "padding": 0,
            "refreshInterval": 1,
        }),
    );
}

fn set_claude_env_value(settings: &mut Value, key: &str, value: Option<&str>) {
    let object = ensure_object(settings);

    if let Some(value) = value {
        let env = object.entry("env".to_string()).or_insert_with(|| json!({}));
        if !env.is_object() {
            *env = json!({});
        }
        env.as_object_mut()
            .expect("Claude settings env object")
            .insert(key.to_string(), Value::String(value.to_string()));
    } else {
        let remove_env = if let Some(env) = object.get_mut("env").and_then(Value::as_object_mut) {
            env.remove(key);
            env.is_empty()
        } else {
            false
        };
        if remove_env {
            object.remove("env");
        }
    }

    if let Some(status_line) = object.get_mut("statusLine").and_then(Value::as_object_mut) {
        let remove_status_env = if let Some(env) = status_line.get_mut("env").and_then(Value::as_object_mut) {
            env.remove(key);
            env.is_empty()
        } else {
            false
        };
        if remove_status_env {
            status_line.remove("env");
        }
    }
}

fn ensure_hooks(settings: &mut Value, hook_command: &str) -> Vec<String> {
    let object = ensure_object(settings);
    let hooks = object.entry("hooks".to_string()).or_insert_with(|| json!({}));
    if !hooks.is_object() {
        *hooks = json!({});
    }
    let hooks_object = hooks.as_object_mut().expect("hooks object");
    let mut installed = Vec::new();

    for event in HOOK_EVENTS {
        let entry = hooks_object.entry(event.to_string()).or_insert_with(|| json!([]));
        if !entry.is_array() {
            *entry = json!([]);
        }
        let hooks_for_event = entry.as_array_mut().expect("hook array");
        let hook_timeout = if event == "PreToolUse" { 30 } else { 2 };
        ensure_hook_timeout(hooks_for_event, hook_command, hook_timeout);
        if !event_has_command(hooks_for_event, hook_command) {
            hooks_for_event.push(json!({
                "matcher": "",
                "hooks": [{
                    "type": "command",
                    "command": hook_command,
                    "timeout": hook_timeout,
                }]
            }));
        }
        installed.push(event.to_string());
    }

    installed
}

fn remove_hooks(settings: &mut Value) {
    let Some(hooks) = settings.get_mut("hooks").and_then(Value::as_object_mut) else {
        return;
    };

    let mut empty_events = Vec::new();
    for event in HOOK_EVENTS {
        if let Some(entries) = hooks.get_mut(event).and_then(Value::as_array_mut) {
            entries.retain(|entry| !entry_contains_bridge_command(entry));
            if entries.is_empty() {
                empty_events.push(event.to_string());
            }
        }
    }

    for event in empty_events {
        hooks.remove(&event);
    }
}

fn installed_hook_events(settings: &Value) -> Vec<String> {
    let Some(hooks) = settings.get("hooks").and_then(Value::as_object) else {
        return Vec::new();
    };

    HOOK_EVENTS
        .into_iter()
        .filter(|event| {
            hooks
                .get(*event)
                .and_then(Value::as_array)
                .map(|entries| entries.iter().any(entry_contains_bridge_command))
                .unwrap_or(false)
        })
        .map(ToString::to_string)
        .collect()
}

fn event_has_command(entries: &[Value], command: &str) -> bool {
    entries.iter().any(|entry| {
        entry
            .get("hooks")
            .and_then(Value::as_array)
            .map(|hooks| {
                hooks.iter().any(|hook| {
                    hook.get("command")
                        .and_then(Value::as_str)
                        .map(|existing| existing == command || command_is_bridge(existing))
                        .unwrap_or(false)
                })
            })
            .unwrap_or(false)
    })
}

fn ensure_hook_timeout(entries: &mut [Value], command: &str, timeout: u64) {
    for entry in entries {
        let Some(hooks) = entry.get_mut("hooks").and_then(Value::as_array_mut) else {
            continue;
        };
        for hook in hooks {
            let is_bridge_hook = hook
                .get("command")
                .and_then(Value::as_str)
                .map(|existing| existing == command || command_is_bridge(existing))
                .unwrap_or(false);
            if is_bridge_hook {
                hook["timeout"] = json!(timeout);
            }
        }
    }
}

fn entry_contains_bridge_command(entry: &Value) -> bool {
    entry
        .get("hooks")
        .and_then(Value::as_array)
        .map(|hooks| {
            hooks.iter().any(|hook| {
                hook.get("command")
                    .and_then(Value::as_str)
                    .map(command_is_bridge)
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

fn ensure_object(value: &mut Value) -> &mut Map<String, Value> {
    if !value.is_object() {
        *value = json!({});
    }
    value.as_object_mut().expect("settings object")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_detection_accepts_native_bridge() {
        assert!(command_is_bridge("\"C:\\Users\\Yue\\AppData\\Roaming\\Claude HUD One\\bridge\\hud-bridge.exe\" --hook"));
        assert!(command_is_bridge("\"C:\\Users\\Yue\\AppData\\Roaming\\Claude HUD One\\bridge\\hud-bridge-6765fbccc6db.exe\" --hook"));
        assert_eq!(status_line_owner("\"C:\\HUD\\hud-bridge.exe\""), "claude-hud-one");
        assert_eq!(status_line_owner("\"C:\\HUD\\hud-bridge-6765fbccc6db.exe\""), "claude-hud-one");
    }

    #[test]
    fn context_window_env_uses_top_level_claude_env() {
        let settings = json!({
            "env": { "CLAUDE_HUD_CONTEXT_WINDOW_SIZE": "270000" },
            "statusLine": {
                "env": { "CLAUDE_HUD_CONTEXT_WINDOW_SIZE": "123000" }
            }
        });

        assert_eq!(current_context_window_size_env(&settings).as_deref(), Some("270000"));
    }

    #[test]
    fn set_claude_env_value_sets_top_level_and_cleans_status_line_env() {
        let mut settings = json!({
            "statusLine": {
                "env": { "CLAUDE_HUD_CONTEXT_WINDOW_SIZE": "123000", "OTHER": "keep" }
            }
        });

        set_claude_env_value(&mut settings, CONTEXT_WINDOW_SIZE_ENV_KEY, Some("270000"));

        assert_eq!(
            settings["env"][CONTEXT_WINDOW_SIZE_ENV_KEY].as_str(),
            Some("270000")
        );
        assert!(settings["statusLine"]["env"].get(CONTEXT_WINDOW_SIZE_ENV_KEY).is_none());
        assert_eq!(settings["statusLine"]["env"]["OTHER"].as_str(), Some("keep"));
    }

    #[test]
    fn set_claude_env_value_removes_empty_env_object() {
        let mut settings = json!({
            "env": { "CLAUDE_HUD_CONTEXT_WINDOW_SIZE": "270000" }
        });

        set_claude_env_value(&mut settings, CONTEXT_WINDOW_SIZE_ENV_KEY, None);

        assert!(settings.get("env").is_none());
    }
}
