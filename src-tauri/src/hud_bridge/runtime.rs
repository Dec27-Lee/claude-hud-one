use std::{
    collections::BTreeMap,
    env, fs,
    fs::File,
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    process::Command,
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde_json::{json, Map, Value};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

use crate::local_runtime::audit;

const FALLBACK_STATUS: &str = "Claude HUD One";
const APP_NAME: &str = "Claude HUD One";
const MAX_PENDING_ITEMS: usize = 10;
const PENDING_APPROVAL_TTL_MS: u128 = 2 * 60_000;
const PENDING_QUESTION_TTL_MS: u128 = 5 * 60_000;
const DEFAULT_PENDING_RESPONSE_WAIT_MS: u64 = 25_000;
const DEFAULT_PENDING_RESPONSE_POLL_MS: u64 = 250;
const RUNNING_SIGNAL_TTL_MS: u128 = 90_000;
const TRANSCRIPT_RUNNING_TOOL_TTL_MS: u128 = 10 * 60_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BridgeMode {
    StatusLine,
    Hook,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BridgeRunOutput {
    pub stdout: String,
}

pub fn run_bridge_once(raw_stdin: &str, mode: BridgeMode) -> BridgeRunOutput {
    let input = match parse_stdin_json(raw_stdin) {
        Ok(input) => input,
        Err(_) => {
            audit::record_best_effort(audit::bridge_parse_failed_event(bridge_mode_label(mode)));
            return BridgeRunOutput {
                stdout: if mode == BridgeMode::StatusLine {
                    FALLBACK_STATUS.to_string()
                } else {
                    String::new()
                },
            };
        }
    };

    let raw_state = match mode {
        BridgeMode::StatusLine => summarize_status_line(&input),
        BridgeMode::Hook => summarize_hook(&input),
    };
    let session_key = session_key_from_state(&raw_state);
    let previous = read_previous_related_state(&raw_state, &session_key);
    let mut state = merge_with_previous(raw_state, previous.as_ref(), mode);
    if let Some(object) = state.as_object_mut() {
        object.insert("sessionKey".to_string(), Value::String(session_key.clone()));
    }

    audit::record_best_effort(audit::bridge_event_from_state(&state, bridge_mode_label(mode), "ok"));
    write_pending_intent_requests(&state);
    write_state_files(&state, &session_key);

    match mode {
        BridgeMode::StatusLine => BridgeRunOutput {
            stdout: render_terminal_hud(&state)
                .unwrap_or_else(|| format!("Claude HUD One · {}", state_string(&state, "statusText").unwrap_or_else(|| "Claude Code active".to_string()))),
        },
        BridgeMode::Hook => BridgeRunOutput {
            stdout: hook_response_from_state(&state)
                .and_then(|response| serde_json::to_string(&response).ok())
                .unwrap_or_default(),
        },
    }
}

fn bridge_mode_label(mode: BridgeMode) -> &'static str {
    match mode {
        BridgeMode::StatusLine => "statusLine",
        BridgeMode::Hook => "hook",
    }
}

fn parse_stdin_json(input: &str) -> Result<Value, serde_json::Error> {
    let clean = input.trim_start_matches('\u{feff}');
    if clean.trim().is_empty() {
        return Ok(json!({}));
    }
    serde_json::from_str(clean)
}

fn summarize_status_line(input: &Value) -> Value {
    let now = iso_now();
    let context_window_size = context_window_override_size()
        .or_else(|| number_path(input, &["context_window", "context_window_size"]));
    let context_usage_tokens = sum_non_negative(&[
        number_path(input, &["context_window", "current_usage", "input_tokens"]),
        number_path(input, &["context_window", "current_usage", "cache_creation_input_tokens"]),
        number_path(input, &["context_window", "current_usage", "cache_read_input_tokens"]),
    ])
    .or_else(|| number_path(input, &["context_window", "total_input_tokens"]));
    let computed_context_used_percent = context_usage_tokens.and_then(|tokens| {
        context_window_size.and_then(|window| {
            if window > 0.0 {
                compact_percent(Some((tokens / window) * 100.0))
            } else {
                None
            }
        })
    });
    let context_used_percent = computed_context_used_percent
        .or_else(|| compact_percent(number_path(input, &["context_window", "used_percentage"])));
    let project_dir = string_path(input, &["workspace", "project_dir"])
        .or_else(|| string_path(input, &["workspace", "projectDir"]))
        .or_else(|| string_path(input, &["cwd"]));
    let project_slug = project_dir
        .as_deref()
        .and_then(base_name)
        .or_else(|| string_path(input, &["session_name"]))
        .unwrap_or_else(|| "Claude Code".to_string());
    let transcript_path = string_path(input, &["transcript_path"]).or_else(|| string_path(input, &["transcriptPath"]));
    let transcript_summary = read_transcript_summary(transcript_path.as_deref());
    let explicit_session_tokens = SessionTokenUsage {
        input_tokens: first_number(&[
            number_path(input, &["sessionTokens", "inputTokens"]),
            number_path(input, &["session_tokens", "input_tokens"]),
            number_path(input, &["usage", "sessionTokens", "inputTokens"]),
            number_path(input, &["tokens", "input_tokens"]),
            number_path(input, &["tokens", "input"]),
        ]),
        output_tokens: first_number(&[
            number_path(input, &["sessionTokens", "outputTokens"]),
            number_path(input, &["session_tokens", "output_tokens"]),
            number_path(input, &["usage", "sessionTokens", "outputTokens"]),
            number_path(input, &["tokens", "output_tokens"]),
            number_path(input, &["tokens", "output"]),
        ]),
        cache_creation_input_tokens: first_number(&[
            number_path(input, &["sessionTokens", "cacheCreationInputTokens"]),
            number_path(input, &["session_tokens", "cache_creation_input_tokens"]),
            number_path(input, &["tokens", "cache_creation_input_tokens"]),
        ]),
        cache_read_input_tokens: first_number(&[
            number_path(input, &["sessionTokens", "cacheReadInputTokens"]),
            number_path(input, &["session_tokens", "cache_read_input_tokens"]),
            number_path(input, &["tokens", "cache_read_input_tokens"]),
        ]),
    };
    let session_tokens = if transcript_summary.session_tokens.total() > 0.0 {
        transcript_summary.session_tokens
    } else {
        explicit_session_tokens
    };
    let model_id = string_path(input, &["model", "id"]);
    let model_name = string_path(input, &["model", "display_name"])
        .or_else(|| string_path(input, &["model", "displayName"]))
        .or_else(|| model_id.clone());
    let output_tokens = session_tokens.output_tokens;
    let total_duration_ms = number_path(input, &["cost", "total_duration_ms"]);
    let output_speed = positive_number(first_number(&[
        number_path(input, &["speed", "output_tokens_per_second"]),
        number_path(input, &["output_speed"]),
    ]))
    .or_else(|| match (output_tokens, total_duration_ms) {
        (Some(tokens), Some(duration_ms)) if duration_ms > 0.0 => Some(tokens / (duration_ms / 1000.0)),
        _ => None,
    });
    let terminal = terminal_metadata(project_dir.as_deref(), Some(&project_slug), string_path(input, &["session_name"]).as_deref(), string_path(input, &["session_id"]).as_deref());

    let mut state = Map::new();
    state.insert("schemaVersion".to_string(), json!(1));
    state.insert("updatedAt".to_string(), json!(now));
    state.insert("activityStartedAt".to_string(), json!(iso_now()));
    state.insert("event".to_string(), json!("statusLine"));
    state.insert("activity".to_string(), json!("idle"));
    insert_string(&mut state, "statusText", status_text_from_status_line(input));
    insert_string(&mut state, "sessionId", string_path(input, &["session_id"]).or_else(|| string_path(input, &["sessionId"])));
    insert_string(&mut state, "sessionName", string_path(input, &["session_name"]).or_else(|| string_path(input, &["sessionName"])));
    insert_string(&mut state, "cwd", string_path(input, &["cwd"]));
    insert_string(&mut state, "projectDir", project_dir.clone());
    insert_string(&mut state, "projectSlug", Some(project_slug));
    insert_string(&mut state, "transcriptPath", transcript_path.clone());
    insert_string(&mut state, "modelId", model_id);
    insert_string(&mut state, "modelName", model_name);
    insert_string(&mut state, "version", string_path(input, &["version"]));
    insert_string(&mut state, "outputStyle", string_path(input, &["output_style", "name"]).or_else(|| string_path(input, &["outputStyle", "name"])));
    insert_number(&mut state, "contextUsedPercent", context_used_percent);
    insert_number(&mut state, "contextRemainingPercent", compact_percent(number_path(input, &["context_window", "remaining_percentage"])));
    insert_number(&mut state, "contextWindowSize", context_window_size);
    insert_number(&mut state, "contextUsedTokens", context_usage_tokens);
    insert_string(&mut state, "permissionMode", extract_permission_mode(input));
    insert_number(&mut state, "inputTokens", session_tokens.input_tokens);
    insert_number(&mut state, "outputTokens", output_tokens);
    insert_number(&mut state, "cacheCreationInputTokens", session_tokens.cache_creation_input_tokens);
    insert_number(&mut state, "cacheReadInputTokens", session_tokens.cache_read_input_tokens);
    insert_number(&mut state, "totalCostUsd", number_path(input, &["cost", "total_cost_usd"]));
    insert_number(&mut state, "totalDurationMs", total_duration_ms);
    insert_number(&mut state, "totalApiDurationMs", number_path(input, &["cost", "total_api_duration_ms"]));
    insert_number(&mut state, "totalLinesAdded", number_path(input, &["cost", "total_lines_added"]));
    insert_number(&mut state, "totalLinesRemoved", number_path(input, &["cost", "total_lines_removed"]));
    insert_number(&mut state, "outputSpeed", output_speed);
    let added = sanitize_added_dirs(input.get("workspace"));
    state.insert("addedDirSlugs".to_string(), json!(added.0));
    state.insert("addedDirsOverflowCount".to_string(), json!(added.1));
    let git = collect_git_status(project_dir.as_deref());
    insert_string(&mut state, "gitBranch", string_path(input, &["git", "branch"]).or_else(|| string_path(input, &["gitBranch"])).or(git.branch));
    insert_bool(&mut state, "gitDirty", bool_path(input, &["git", "dirty"]).or_else(|| bool_path(input, &["gitDirty"])).or(git.dirty));
    insert_number(&mut state, "gitAhead", first_number(&[number_path(input, &["git", "ahead"]), number_path(input, &["gitAhead"]), git.ahead]));
    insert_number(&mut state, "gitBehind", first_number(&[number_path(input, &["git", "behind"]), number_path(input, &["gitBehind"]), git.behind]));
    if state.get("totalLinesAdded").and_then(value_number).is_none() {
        insert_number(&mut state, "totalLinesAdded", git.lines_added);
    }
    if state.get("totalLinesRemoved").and_then(value_number).is_none() {
        insert_number(&mut state, "totalLinesRemoved", git.lines_removed);
    }
    insert_string(
        &mut state,
        "sessionStartedAt",
        iso_string_from_input(input, &["session_started_at"])
            .or_else(|| iso_string_from_input(input, &["session", "started_at"]))
            .or(transcript_summary.first_timestamp),
    );
    insert_string(
        &mut state,
        "lastAssistantResponseAt",
        iso_string_from_input(input, &["last_assistant_response_at"])
            .or_else(|| iso_string_from_input(input, &["last_response_at"]))
            .or(transcript_summary.last_assistant_response_at),
    );
    insert_number(&mut state, "toolsCount", first_number(&[
        transcript_summary.tools_count,
        number_path(input, &["tools", "total"]),
        number_path(input, &["tools", "count"]),
        number_path(input, &["tool_calls", "total"]),
        number_path(input, &["toolCalls", "total"]),
    ]));
    insert_number(&mut state, "toolsRunningCount", first_number(&[
        number_path(input, &["tools", "running"]),
        number_path(input, &["tool", "running"]),
        transcript_summary.tools_running_count,
    ]));
    insert_number(&mut state, "agentsCount", first_number(&[
        transcript_summary.agents_count,
        number_path(input, &["agents", "total"]),
        number_path(input, &["agent", "total"]),
        number_path(input, &["agent", "count"]),
    ]));
    insert_number(&mut state, "agentsRunningCount", first_number(&[
        number_path(input, &["agents", "running"]),
        number_path(input, &["agent", "running"]),
        transcript_summary.agents_running_count,
    ]));
    insert_number(&mut state, "todosActiveCount", first_number(&[
        number_path(input, &["todos", "active"]),
        number_path(input, &["todos", "in_progress"]),
        number_path(input, &["todos", "pending"]),
        transcript_summary.todos_active_count,
    ]));
    insert_number(&mut state, "todosCompletedCount", first_number(&[
        number_path(input, &["todos", "completed"]),
        transcript_summary.todos_completed_count,
    ]));
    insert_number(&mut state, "todosTotalCount", first_number(&[
        number_path(input, &["todos", "total"]),
        transcript_summary.todos_total_count,
        transcript_summary.todo_operation_count,
    ]));
    if positive_count(state.get("toolsRunningCount").and_then(value_number)) > 0
        || positive_count(state.get("agentsRunningCount").and_then(value_number)) > 0
    {
        state.insert("activity".to_string(), json!("running"));
        state.insert("lastRunningSignalAt".to_string(), json!(now.clone()));
        if state
            .get("statusText")
            .and_then(Value::as_str)
            .map(|value| matches!(value.trim(), "Claude Code active" | "Session idle" | ""))
            .unwrap_or(true)
        {
            state.insert("statusText".to_string(), json!("Tool running"));
        }
    } else {
        insert_null(&mut state, "lastRunningSignalAt");
    }
    insert_number(&mut state, "fiveHourUsedPercent", compact_percent(number_path(input, &["rate_limits", "five_hour", "used_percentage"])));
    insert_string(&mut state, "fiveHourResetAt", string_path(input, &["rate_limits", "five_hour", "resets_at"]));
    insert_number(&mut state, "sevenDayUsedPercent", compact_percent(number_path(input, &["rate_limits", "seven_day", "used_percentage"])));
    insert_string(&mut state, "sevenDayResetAt", string_path(input, &["rate_limits", "seven_day", "resets_at"]));
    insert_string(&mut state, "effortLevel", string_path(input, &["effort", "level"]));
    insert_bool(&mut state, "thinkingEnabled", bool_path(input, &["thinking", "enabled"]));
    insert_string(&mut state, "agentName", string_path(input, &["agent", "name"]));
    insert_null(&mut state, "hookEventName");
    insert_string(&mut state, "toolName", regular_tool_name(first_string(&[
        string_path(input, &["tool", "name"]),
        string_path(input, &["toolName"]),
        string_path(input, &["tool_name"]),
    ])));
    state.insert("terminal".to_string(), terminal);
    state.insert("source".to_string(), json!("statusLine"));
    state.insert("privacyNote".to_string(), json!("Claude HUD One native bridge stores only sanitized status metrics. It does not store prompt, transcript, tool-result or credential content."));
    Value::Object(state)
}

fn summarize_hook(input: &Value) -> Value {
    let hook_event = sanitize_hook_event(input).unwrap_or_else(|| "Hook".to_string());
    let raw_tool_name = sanitize_tool_name(input);
    let tool_name = regular_tool_name(raw_tool_name.clone());
    let cwd = string_path(input, &["cwd"]);
    let project_dir = string_path(input, &["workspace", "project_dir"]).or_else(|| cwd.clone());
    let project_slug = project_dir
        .as_deref()
        .and_then(base_name)
        .or_else(|| string_path(input, &["session_name"]))
        .unwrap_or_else(|| "Claude Code".to_string());
    let pending_queue = pending_queue_from_hook(input, &hook_event, tool_name.as_deref(), &project_slug, project_dir.as_deref());
    let is_agent_tool = raw_tool_name.as_deref().map(|name| matches!(name, "Task" | "Agent")).unwrap_or(false);
    let is_todo_tool = raw_tool_name
        .as_deref()
        .map(|name| matches!(name, "TodoWrite" | "TodoRead" | "TaskCreate" | "TaskUpdate"))
        .unwrap_or(false);
    let is_tool_running = hook_event == "PreToolUse" && tool_name.is_some();
    let is_agent_running = (hook_event == "PreToolUse" && is_agent_tool) || hook_event == "SubagentStart";
    let is_todo_active = hook_event == "PreToolUse" && is_todo_tool;
    let terminal = terminal_metadata(project_dir.as_deref(), Some(&project_slug), string_path(input, &["session_name"]).as_deref(), string_path(input, &["session_id"]).as_deref());
    let now = iso_now();
    let activity = activity_from_hook(&hook_event);

    let mut state = Map::new();
    state.insert("schemaVersion".to_string(), json!(1));
    state.insert("updatedAt".to_string(), json!(now.clone()));
    state.insert("activityStartedAt".to_string(), json!(now.clone()));
    state.insert("event".to_string(), json!("hook"));
    state.insert("activity".to_string(), json!(activity));
    state.insert("statusText".to_string(), json!(status_text_from_hook(&hook_event, raw_tool_name.as_deref())));
    if activity == "running" {
        state.insert("lastRunningSignalAt".to_string(), json!(now));
    } else {
        insert_null(&mut state, "lastRunningSignalAt");
    }
    insert_string(&mut state, "sessionId", string_path(input, &["session_id"]).or_else(|| string_path(input, &["sessionId"])));
    insert_string(&mut state, "sessionName", string_path(input, &["session_name"]).or_else(|| string_path(input, &["sessionName"])));
    insert_string(&mut state, "cwd", cwd);
    insert_string(&mut state, "projectDir", project_dir);
    insert_string(&mut state, "projectSlug", Some(project_slug));
    insert_string(&mut state, "transcriptPath", string_path(input, &["transcript_path"]).or_else(|| string_path(input, &["transcriptPath"])));
    insert_null(&mut state, "modelId");
    insert_null(&mut state, "modelName");
    insert_string(&mut state, "version", string_path(input, &["version"]));
    insert_null(&mut state, "outputStyle");
    for key in [
        "contextUsedPercent",
        "contextRemainingPercent",
        "contextWindowSize",
        "contextUsedTokens",
        "inputTokens",
        "outputTokens",
        "cacheCreationInputTokens",
        "cacheReadInputTokens",
        "totalCostUsd",
        "totalDurationMs",
        "totalApiDurationMs",
        "totalLinesAdded",
        "totalLinesRemoved",
        "outputSpeed",
        "fiveHourUsedPercent",
        "fiveHourResetAt",
        "sevenDayUsedPercent",
        "sevenDayResetAt",
        "effortLevel",
        "thinkingEnabled",
        "agentName",
    ] {
        insert_null(&mut state, key);
    }
    insert_string(&mut state, "permissionMode", extract_permission_mode(input));
    let added = sanitize_added_dirs(input.get("workspace"));
    state.insert("addedDirSlugs".to_string(), json!(added.0));
    state.insert("addedDirsOverflowCount".to_string(), json!(added.1));
    insert_string(&mut state, "gitBranch", None);
    insert_null(&mut state, "gitDirty");
    insert_null(&mut state, "gitAhead");
    insert_null(&mut state, "gitBehind");
    insert_string(&mut state, "sessionStartedAt", iso_string_from_input(input, &["session_started_at"]).or_else(|| iso_string_from_input(input, &["session", "started_at"])));
    insert_null(&mut state, "lastAssistantResponseAt");
    insert_number(&mut state, "toolsCount", tool_name.as_ref().map(|_| 1.0));
    insert_number(&mut state, "toolsRunningCount", Some(if is_tool_running { 1.0 } else { 0.0 }));
    insert_number(&mut state, "agentsCount", if is_agent_tool { Some(1.0) } else { None });
    insert_number(&mut state, "agentsRunningCount", Some(if is_agent_running { 1.0 } else { 0.0 }));
    insert_number(&mut state, "todosActiveCount", Some(if is_todo_active { 1.0 } else { 0.0 }));
    insert_null(&mut state, "todosCompletedCount");
    insert_number(&mut state, "todosTotalCount", if is_todo_tool { Some(1.0) } else { None });
    state.insert("hookEventName".to_string(), json!(hook_event));
    insert_string(&mut state, "toolName", tool_name);
    state.insert("source".to_string(), json!("hook"));
    state.insert("pendingQueue".to_string(), pending_queue.unwrap_or(Value::Null));
    state.insert("terminal".to_string(), terminal);
    state.insert("privacyNote".to_string(), json!("Claude HUD One native hook bridge stores only event name, tool name and sanitized status metadata. It does not store user prompt, tool input, tool result, transcript or credential content."));
    Value::Object(state)
}

fn pending_queue_from_hook(
    input: &Value,
    hook_event: &str,
    tool_name: Option<&str>,
    project_slug: &str,
    project_dir: Option<&str>,
) -> Option<Value> {
    let item = pending_item_from_hook(input, hook_event, tool_name, project_slug, project_dir)?;
    let updated_at = item.get("updatedAt").and_then(Value::as_str).unwrap_or_default();
    Some(json!({
        "schemaVersion": 1,
        "updatedAt": updated_at,
        "items": [item]
    }))
}

fn pending_item_from_hook(
    input: &Value,
    hook_event: &str,
    tool_name: Option<&str>,
    project_slug: &str,
    project_dir: Option<&str>,
) -> Option<Value> {
    let now_iso = iso_now();
    let now_ms = unix_millis();
    let session_id = string_path(input, &["session_id"]).or_else(|| string_path(input, &["sessionId"]));
    let permission_mode = extract_permission_mode(input);
    let cwd_slug = project_dir.and_then(base_name);

    if hook_event == "PreToolUse" {
        let tool_name = tool_name?;
        if should_skip_hud_tool_approval(input, &tool_name) {
            return None;
        }
        let expires_at = iso_from_ms(now_ms.saturating_add(PENDING_APPROVAL_TTL_MS));
        let id = safe_path_segment(&format!("approval-{hook_event}-{}-{tool_name}-{now_ms}", session_id.clone().unwrap_or_default()))
            .unwrap_or_else(|| format!("approval-{now_ms}"));
        return Some(json!({
            "id": id,
            "intentId": id,
            "allowedIntents": ["allowOnce", "deny", "dismiss"],
            "intentExpiresAt": expires_at,
            "decisionState": "waiting",
            "questionMode": null,
            "kind": "approval",
            "status": "pending",
            "sessionId": session_id,
            "createdAt": now_iso,
            "updatedAt": iso_now(),
            "expiresAt": expires_at,
            "source": "hook",
            "hookEventName": hook_event,
            "permissionMode": permission_mode,
            "toolName": tool_name,
            "projectSlug": project_slug,
            "cwdSlug": cwd_slug,
            "title": format!("Approval needed for {tool_name}"),
            "summary": "Claude Code is requesting permission to run a tool. Review the request in the terminal.",
            "choices": [
                {"id": "deny-once", "label": "Deny", "kind": "deny", "intent": "deny"},
                {"id": "allow-once", "label": "Allow once", "kind": "allow", "intent": "allowOnce"},
                {"id": "review-terminal", "label": "Review in Claude Code", "kind": "dismiss", "intent": "dismiss"},
                {"id": "dismiss-local", "label": "Dismiss HUD reminder", "kind": "dismiss", "intent": "dismiss"}
            ],
            "privacyNote": "Sanitized pending item only. Tool input, command arguments, prompt, transcript and credentials are not stored."
        }));
    }

    if hook_event == "Notification" {
        let expires_at = iso_from_ms(now_ms.saturating_add(PENDING_QUESTION_TTL_MS));
        let id = safe_path_segment(&format!("question-{hook_event}-{}-{now_ms}", session_id.clone().unwrap_or_default()))
            .unwrap_or_else(|| format!("question-{now_ms}"));
        return Some(json!({
            "id": id,
            "intentId": id,
            "allowedIntents": ["dismiss"],
            "intentExpiresAt": expires_at,
            "decisionState": "waiting",
            "questionMode": "attentionOnly",
            "answerPlaceholder": "Review the request in Claude Code; HUD does not store or inject answer text.",
            "kind": "question",
            "status": "pending",
            "sessionId": session_id,
            "createdAt": now_iso,
            "updatedAt": iso_now(),
            "expiresAt": expires_at,
            "source": "hook",
            "hookEventName": hook_event,
            "permissionMode": permission_mode,
            "toolName": tool_name,
            "projectSlug": project_slug,
            "cwdSlug": cwd_slug,
            "title": "Claude Code needs attention",
            "summary": "A Claude Code session is waiting for your response. Review it in the terminal.",
            "choices": [
                {"id": "review-terminal", "label": "Review in Claude Code", "kind": "dismiss", "intent": "dismiss"},
                {"id": "dismiss-local", "label": "Dismiss HUD reminder", "kind": "dismiss", "intent": "dismiss"}
            ],
            "privacyNote": "Sanitized pending item only. User prompt, question text, transcript and credentials are not stored."
        }));
    }

    None
}

fn write_pending_intent_requests(state: &Value) {
    let Some(items) = state
        .get("pendingQueue")
        .and_then(|queue| queue.get("items"))
        .and_then(Value::as_array)
    else {
        return;
    };

    for item in items {
        if item.get("status").and_then(Value::as_str) != Some("pending") {
            continue;
        }
        let Some(intent_id) = item.get("intentId").and_then(Value::as_str).and_then(safe_path_segment) else {
            continue;
        };
        let request = json!({
            "schemaVersion": 1,
            "intentId": intent_id,
            "nonce": Uuid::new_v4().simple().to_string(),
            "kind": item.get("kind").and_then(Value::as_str).unwrap_or("approval"),
            "sessionKey": state.get("sessionKey").and_then(Value::as_str),
            "sessionId": item.get("sessionId").and_then(Value::as_str).or_else(|| state.get("sessionId").and_then(Value::as_str)),
            "hookEventName": item.get("hookEventName").and_then(Value::as_str).or_else(|| state.get("hookEventName").and_then(Value::as_str)),
            "toolName": item.get("toolName").and_then(Value::as_str).or_else(|| state.get("toolName").and_then(Value::as_str)),
            "projectSlug": item.get("projectSlug").and_then(Value::as_str).or_else(|| state.get("projectSlug").and_then(Value::as_str)),
            "cwdSlug": item.get("cwdSlug").and_then(Value::as_str),
            "allowedIntents": item.get("allowedIntents").cloned().unwrap_or_else(|| json!([])),
            "createdAt": item.get("createdAt").and_then(Value::as_str),
            "expiresAt": item.get("intentExpiresAt").and_then(Value::as_str).or_else(|| item.get("expiresAt").and_then(Value::as_str)),
            "privacyNote": "Request contains only sanitized routing metadata and a private nonce; raw prompts, tool inputs and credentials are not stored."
        });
        for dir in pending_intent_dirs() {
            let target = dir.join("requests").join(format!("{intent_id}.json"));
            if target.exists() {
                continue;
            }
            if write_json_atomic_if_absent(&target, &request).is_ok() {
                audit::record_best_effort(audit::pending_intent_created_event(state, item));
            }
        }
    }
}

fn hook_response_from_state(state: &Value) -> Option<Value> {
    if state.get("hookEventName").and_then(Value::as_str) != Some("PreToolUse") {
        return None;
    }
    let tool_name = state.get("toolName").and_then(Value::as_str)?;
    let approval_item = state
        .get("pendingQueue")
        .and_then(|queue| queue.get("items"))
        .and_then(Value::as_array)?
        .iter()
        .find(|item| {
            item.get("kind").and_then(Value::as_str) == Some("approval")
                && item.get("toolName").and_then(Value::as_str) == Some(tool_name)
                && item.get("intentId").and_then(Value::as_str).is_some()
        })?;

    let action = wait_for_pending_intent_response(approval_item);
    match action.as_deref() {
        Some("allowOnce") => {
            audit::record_best_effort(audit::pending_intent_decision_event(state, "allowOnce", "allow", "validated_response"));
            Some(json!({
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "allow",
                    "permissionDecisionReason": "Approved once from Claude HUD One native bridge after nonce and TTL validation."
                }
            }))
        }
        Some("deny") => {
            audit::record_best_effort(audit::pending_intent_decision_event(state, "deny", "deny", "validated_response"));
            Some(json!({
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": "Denied from Claude HUD One native bridge after nonce and TTL validation."
                }
            }))
        }
        _ => {
            audit::record_best_effort(audit::pending_intent_decision_event(state, "defer", "defer", "timeout"));
            Some(json!({
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "defer",
                    "permissionDecisionReason": "Claude HUD One did not receive a validated HUD decision before timeout; final permission remains with Claude Code."
                }
            }))
        }
    }
}

fn wait_for_pending_intent_response(item: &Value) -> Option<String> {
    let intent_id = item.get("intentId").and_then(Value::as_str).and_then(safe_path_segment)?;
    let request = read_pending_intent_request(&intent_id)?;
    let wait_ms = env_u64("CLAUDE_HUD_ONE_PENDING_RESPONSE_WAIT_MS", DEFAULT_PENDING_RESPONSE_WAIT_MS);
    let poll_ms = env_u64("CLAUDE_HUD_ONE_PENDING_RESPONSE_POLL_MS", DEFAULT_PENDING_RESPONSE_POLL_MS).max(50);
    let request_deadline = request
        .get("expiresAt")
        .and_then(Value::as_str)
        .and_then(ms_from_iso);
    let deadline = unix_millis()
        .saturating_add(wait_ms as u128)
        .min(request_deadline.unwrap_or_else(|| unix_millis().saturating_add(wait_ms as u128)));

    loop {
        if let Some(response) = read_pending_intent_response(&intent_id) {
            if let Some(action) = validate_pending_intent_response(item, &request, &response) {
                return Some(action);
            }
        }
        if unix_millis() >= deadline {
            return None;
        }
        thread::sleep(Duration::from_millis(poll_ms));
    }
}

fn validate_pending_intent_response(item: &Value, request: &Value, response: &Value) -> Option<String> {
    let intent_id = item.get("intentId").and_then(Value::as_str)?;
    if response.get("intentId").and_then(Value::as_str) != Some(intent_id) {
        return None;
    }
    if response.get("nonce").and_then(Value::as_str) != request.get("nonce").and_then(Value::as_str) {
        return None;
    }
    if let (Some(request_session), Some(response_session)) = (
        request.get("sessionId").and_then(Value::as_str),
        response.get("sessionId").and_then(Value::as_str),
    ) {
        if request_session != response_session {
            return None;
        }
    }
    let action = response.get("action").and_then(Value::as_str)?;
    let allowed = request
        .get("allowedIntents")
        .and_then(Value::as_array)
        .map(|items| items.iter().filter_map(Value::as_str).any(|value| value == action))
        .unwrap_or(false);
    if !allowed {
        return None;
    }
    if request
        .get("expiresAt")
        .and_then(Value::as_str)
        .and_then(ms_from_iso)
        .map(|expires_at| expires_at <= unix_millis())
        .unwrap_or(false)
    {
        return None;
    }
    Some(action.to_string())
}

fn read_pending_intent_request(intent_id: &str) -> Option<Value> {
    pending_intent_dirs()
        .into_iter()
        .map(|dir| dir.join("requests").join(format!("{intent_id}.json")))
        .find_map(read_json_file)
}

fn read_pending_intent_response(intent_id: &str) -> Option<Value> {
    pending_intent_dirs()
        .into_iter()
        .map(|dir| dir.join("responses").join(format!("{intent_id}.json")))
        .find_map(read_json_file)
}

fn render_terminal_hud(state: &Value) -> Option<String> {
    let config = read_terminal_hud_config();
    if !config_bool(&config, &["enabled"], true) {
        return None;
    }

    let separator = if config_bool(&config, &["showSeparators"], false) {
        " │ "
    } else {
        " "
    };
    let rows = config_rows(&config);
    let max_width = terminal_max_width(&config);
    let row_overflow = config_string(&config, &["rowOverflow"]).unwrap_or_else(|| "truncate".to_string());

    let lines = rows
        .into_iter()
        .filter_map(|row| {
            let parts = row
                .into_iter()
                .filter_map(|item| render_terminal_row_item(state, &item, &config))
                .collect::<Vec<_>>();
            if parts.is_empty() {
                None
            } else {
                Some(parts.join(separator))
            }
        })
        .collect::<Vec<_>>();

    let rendered = if lines.is_empty() {
        vec![format!(
            "Claude HUD One · {}",
            state_string(state, "statusText").unwrap_or_else(|| "Claude Code active".to_string())
        )]
    } else {
        lines
    };

    let output = rendered
        .into_iter()
        .flat_map(|line| {
            if row_overflow == "wrap" {
                wrap_line_to_width(&line, max_width)
            } else {
                vec![truncate_to_width(&line, max_width)]
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    Some(output)
}

fn read_terminal_hud_config() -> Value {
    if env::var("CLAUDE_HUD_ONE_TERMINAL_HUD").ok().as_deref() == Some("0") {
        return json!({ "enabled": false });
    }
    app_data_root()
        .map(|root| root.join("settings.json"))
        .and_then(read_json_file)
        .and_then(|settings| settings.get("terminalHud").cloned())
        .unwrap_or_else(|| json!({}))
}

fn config_rows(config: &Value) -> Vec<Vec<String>> {
    config
        .get("rows")
        .and_then(Value::as_array)
        .map(|rows| {
            rows.iter()
                .filter_map(|row| {
                    row.as_array().map(|items| {
                        items
                            .iter()
                            .filter_map(Value::as_str)
                            .map(ToString::to_string)
                            .collect::<Vec<_>>()
                    })
                })
                .filter(|row| !row.is_empty())
                .collect::<Vec<_>>()
        })
        .filter(|rows| !rows.is_empty())
        .unwrap_or_else(|| {
            vec![
                vec!["model".to_string(), "contextBar".to_string(), "contextValue".to_string()],
                vec!["project".to_string(), "addedDirs".to_string(), "git".to_string()],
                vec!["sessionTokens".to_string(), "sessionTime".to_string()],
                vec!["activity".to_string()],
            ]
        })
}

fn render_terminal_row_item(state: &Value, item: &str, config: &Value) -> Option<String> {
    match item {
        "model" => render_model_part(state, config),
        "contextBar" => {
            if config_bool(config, &["display", "showContextBar"], true) {
                render_bar(context_used_percent(state), config, 10, "context")
            } else {
                None
            }
        }
        "contextValue" => render_context_value(state, config),
        "project" => {
            if config_bool(config, &["display", "showProject"], true) {
                let project = state_string(state, "projectSlug")
                    .or_else(|| state_string(state, "projectDir").and_then(|value| base_name(&value)))
                    .or_else(|| state_string(state, "cwd").and_then(|value| base_name(&value)));
                project.map(|value| themed(config, "project", "33", &value))
            } else {
                None
            }
        }
        "addedDirs" => render_added_dirs(state, config),
        "git" => render_git(state, config),
        "tools" => render_tools(state, config, false, true),
        "agents" => render_agents(state, config, false, true),
        "todos" => render_todos(state, config, false, true),
        "activity" => render_activity(state, config),
        "sessionTokens" => render_session_tokens(state, config),
        "usage" => render_usage(state, config),
        "promptCache" => render_prompt_cache(state, config),
        "memory" => render_memory(state, config),
        "environment" => render_environment(state, config),
        "cost" => {
            if config_bool(config, &["display", "showCost"], false) {
                state_number(state, "totalCostUsd")
                    .and_then(format_usd)
                    .map(|value| label_value(config, "Cost", &value))
            } else {
                None
            }
        }
        "duration" => {
            if config_bool(config, &["display", "showDuration"], false) {
                state_number(state, "totalDurationMs")
                    .and_then(format_duration)
                    .map(|value| label_value(config, "Duration", &value))
            } else {
                None
            }
        }
        "speed" => render_speed(state, config),
        "sessionTime" => render_session_time(state, config),
        "outputStyle" => {
            if config_bool(config, &["display", "showOutputStyle"], false) {
                state_string(state, "outputStyle").map(|value| label_value(config, "style", &value))
            } else {
                None
            }
        }
        "claudeCodeVersion" => {
            if config_bool(config, &["display", "showClaudeCodeVersion"], false) {
                state_string(state, "version").map(|value| label_value(config, "Claude Code", &value))
            } else {
                None
            }
        }
        "effortLevel" => {
            if config_bool(config, &["display", "showEffortLevel"], true) {
                state_string(state, "effortLevel").map(|value| {
                    let value = if state.get("thinkingEnabled").and_then(Value::as_bool).unwrap_or(false) {
                        format!("{value} · thinking")
                    } else {
                        value
                    };
                    label_value(config, "effort", &value)
                })
            } else {
                None
            }
        }
        "customLine" => config_string(config, &["display", "customLine"])
            .filter(|value| !value.trim().is_empty())
            .map(|value| themed(config, "custom", "38;5;208", &value)),
        _ => None,
    }
}

fn render_model_part(state: &Value, config: &Value) -> Option<String> {
    if !config_bool(config, &["display", "showModel"], true) {
        return None;
    }
    let mut model = config_string(config, &["display", "modelOverride"])
        .filter(|value| !value.trim().is_empty())
        .or_else(|| state_string(state, "modelName"))
        .or_else(|| state_string(state, "modelId"))?;
    match config_string(config, &["display", "modelFormat"]).as_deref() {
        Some("short") => {
            model = model.trim_start_matches("claude ").trim_start_matches("Claude ").to_string();
        }
        Some("compact") => {
            if let Some(index) = model.to_ascii_lowercase().find(" context") {
                model.truncate(index);
            }
        }
        _ => {}
    }
    let effort = if config_bool(config, &["display", "showEffortLevel"], true) {
        state_string(state, "effortLevel").map(|value| {
            if state.get("thinkingEnabled").and_then(Value::as_bool).unwrap_or(false) {
                format!("✦ {value}")
            } else {
                value
            }
        })
    } else {
        None
    };
    let label = format!("[{}]", [Some(model), effort].into_iter().flatten().collect::<Vec<_>>().join(" | "));
    Some(themed(config, "model", "94", &label))
}

fn render_context_value(state: &Value, config: &Value) -> Option<String> {
    let used_tokens = state_number(state, "contextUsedTokens");
    let window_tokens = state_number(state, "contextWindowSize");
    let used_percent = context_used_percent(state);
    let remaining_percent = state_number(state, "contextRemainingPercent")
        .or_else(|| used_percent.map(|value| (100.0 - value).max(0.0)));
    let remaining_tokens = match (used_tokens, window_tokens) {
        (Some(used), Some(window)) => Some((window - used).max(0.0)),
        _ => None,
    };
    let token_label = used_tokens.and_then(|used| {
        if let Some(window) = window_tokens {
            Some(format!(
                "{}/{}",
                format_token_k(used, true)?,
                format_token_k(window, true)?
            ))
        } else {
            format_token_k(used, true)
        }
    });
    let percent_label = used_percent.map(|value| format!("{}%", value.round()));
    let remaining_label = remaining_tokens
        .and_then(|tokens| format_token_k(tokens, true).map(|label| format!("{label} left")))
        .or_else(|| remaining_percent.map(|value| format!("{}% left", value.round())));

    let text = match config_string(config, &["display", "contextValue"])
        .as_deref()
        .unwrap_or("both")
    {
        "tokens" => token_label,
        "percent" => percent_label,
        "remaining" => remaining_label,
        _ => match (percent_label, token_label) {
            (Some(percent), Some(tokens)) => Some(format!("{percent} ({tokens})")),
            (Some(percent), None) => Some(percent),
            (None, Some(tokens)) => Some(tokens),
            _ => None,
        },
    }?;
    let code = context_color_code(config, used_percent);
    Some(themed_code(&code, &text))
}

fn render_added_dirs(state: &Value, config: &Value) -> Option<String> {
    if !config_bool(config, &["display", "showAddedDirs"], true) {
        return None;
    }
    let dirs = state
        .get("addedDirSlugs")
        .and_then(Value::as_array)
        .map(|items| items.iter().filter_map(Value::as_str).collect::<Vec<_>>())
        .unwrap_or_default();
    if dirs.is_empty() {
        return None;
    }
    let overflow = state_number(state, "addedDirsOverflowCount").unwrap_or(0.0).round() as i64;
    let mut label = dirs.join(", ");
    if overflow > 0 {
        label.push_str(&format!(" +{overflow}"));
    }
    Some(label_value(config, "dirs", &label))
}

fn render_git(state: &Value, config: &Value) -> Option<String> {
    if !config_bool(config, &["gitStatus", "enabled"], true) {
        return None;
    }
    let mut branch = state_string(state, "gitBranch")?;
    if config_string(config, &["gitStatus", "branchOverflow"]).as_deref() != Some("wrap") {
        branch = truncate_to_width(&branch, Some(32));
    }
    let mut parts = Vec::new();
    let dirty = state.get("gitDirty").and_then(Value::as_bool).unwrap_or(false);
    let branch_label = if config_bool(config, &["gitStatus", "showDirty"], true) && dirty {
        format!("{branch}*")
    } else {
        branch
    };
    parts.push(themed(config, "gitBranch", "36", &branch_label));
    if config_bool(config, &["gitStatus", "showAheadBehind"], true) {
        if let Some(ahead) = state_number(state, "gitAhead").filter(|value| *value > 0.0) {
            parts.push(themed(config, "git", "35", &format!("↑{}", ahead.round())));
        }
        if let Some(behind) = state_number(state, "gitBehind").filter(|value| *value > 0.0) {
            parts.push(themed(config, "git", "35", &format!("↓{}", behind.round())));
        }
    }
    if config_bool(config, &["gitStatus", "showFileStats"], true) {
        if let Some(added) = state_number(state, "totalLinesAdded").filter(|value| *value > 0.0) {
            parts.push(themed_code("32", &format!("+{}", added.round())));
        }
        if let Some(removed) = state_number(state, "totalLinesRemoved").filter(|value| *value > 0.0) {
            parts.push(themed_code("31", &format!("-{}", removed.round())));
        }
    }
    Some(format!(
        "{}{}{}",
        themed(config, "git", "35", "git:("),
        parts.join(" "),
        themed(config, "git", "35", ")")
    ))
}

fn render_session_tokens(state: &Value, config: &Value) -> Option<String> {
    if !config_bool(config, &["display", "showSessionTokens"], true) {
        return None;
    }
    let input = positive_count(state_number(state, "inputTokens"));
    let output = positive_count(state_number(state, "outputTokens"));
    let cache = positive_count(state_number(state, "cacheCreationInputTokens"))
        + positive_count(state_number(state, "cacheReadInputTokens"));
    let total = input + output + cache;
    let mut value = format_token_k(total as f64, true)?;
    if config_bool(config, &["display", "showTokenBreakdown"], true) {
        let details = if total == 0 {
            vec!["in: 0".to_string(), "out: 0".to_string(), "cache: 0".to_string()]
        } else {
            [
                (input > 0).then(|| format!("in: {}", format_token_k(input as f64, false).unwrap_or_default())),
                (output > 0).then(|| format!("out: {}", format_token_k(output as f64, false).unwrap_or_default())),
                (cache > 0).then(|| format!("cache: {}", format_token_k(cache as f64, false).unwrap_or_default())),
            ]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
        };
        if !details.is_empty() {
            value.push_str(&format!(" ({})", details.join(", ")));
        }
    }
    Some(label_value(config, "Tokens", &value))
}

fn render_usage(state: &Value, config: &Value) -> Option<String> {
    if !config_bool(config, &["display", "showUsage"], false) {
        return None;
    }
    let mut parts = Vec::new();
    for (label, key, reset_key, threshold_key) in [
        ("5h", "fiveHourUsedPercent", "fiveHourResetAt", "usageThreshold"),
        ("7d", "sevenDayUsedPercent", "sevenDayResetAt", "sevenDayThreshold"),
    ] {
        if let Some(used) = state_number(state, key).map(|value| value.round().clamp(0.0, 100.0)) {
            let threshold = config_number(config, &["display", threshold_key]).unwrap_or(0.0);
            let usage_code = usage_color_code(config, Some(used), threshold);
            let value = if config_string(config, &["display", "usageValue"]).as_deref() == Some("remaining") {
                format!("{}% left", (100.0 - used).max(0.0))
            } else {
                format!("{used}%")
            };
            let usage_bar = if config_bool(config, &["display", "usageBarEnabled"], true)
                && !config_bool(config, &["display", "usageCompact"], false)
            {
                render_bar_with_code(Some(used), config, 8, &usage_code)
                    .map(|bar| format!("{bar} "))
                    .unwrap_or_default()
            } else {
                String::new()
            };
            let reset = if config_bool(config, &["display", "showResetLabel"], true) {
                state_string(state, reset_key)
                    .and_then(|value| duration_until(&value))
                    .map(|value| format!(" {}", label_value(config, "reset", &value)))
                    .unwrap_or_default()
            } else {
                String::new()
            };
            parts.push(format!(
                "{} {}{}{}",
                themed(config, "labelTitle", "94", label),
                usage_bar,
                themed_code(&usage_code, &value),
                reset
            ));
        }
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join(if config_bool(config, &["display", "usageCompact"], false) { " " } else { " · " }))
    }
}

fn render_prompt_cache(state: &Value, config: &Value) -> Option<String> {
    if !config_bool(config, &["display", "showPromptCache"], false) {
        return None;
    }
    render_prompt_cache_value(state, config).map(|value| {
        if value == "expired" {
            themed(config, "warning", "33", "cache expired")
        } else {
            label_value(config, "cache", &format!("{value} left"))
        }
    })
}

fn render_prompt_cache_value(state: &Value, config: &Value) -> Option<String> {
    let timestamp = state_string(state, "lastAssistantResponseAt").and_then(|value| ms_from_iso(&value))?;
    let ttl = config_number(config, &["display", "promptCacheTtlSeconds"]).unwrap_or(300.0) * 1000.0;
    let remaining = (timestamp + ttl as u128).saturating_sub(unix_millis());
    if remaining == 0 {
        Some("expired".to_string())
    } else {
        Some(format_duration(remaining as f64).unwrap_or_else(|| "now".to_string()))
    }
}

fn render_memory(state: &Value, config: &Value) -> Option<String> {
    if !config_bool(config, &["display", "showMemoryUsage"], false) {
        return None;
    }
    let used = state_number(state, "memoryUsedPercent")?.round().clamp(0.0, 100.0);
    let memory_code = usage_color_code(config, Some(used), 90.0);
    let bar = render_bar_with_code(Some(used), config, 8, &memory_code)
        .unwrap_or_else(|| themed_code(&memory_code, &format!("{}%", used.round())));
    Some(format!("{} {}", themed(config, "labelTitle", "94", "RAM"), bar))
}

fn render_environment(state: &Value, config: &Value) -> Option<String> {
    if !config_bool(config, &["display", "showEnvironment"], false) {
        return None;
    }
    let parts = [
        state_number(state, "claudeMdCount").filter(|value| *value > 0.0).map(|value| format!("{} CLAUDE.md", value.round())),
        state_number(state, "rulesCount").filter(|value| *value > 0.0).map(|value| format!("{} rules", value.round())),
        state_number(state, "mcpCount").filter(|value| *value > 0.0).map(|value| format!("{} MCP", value.round())),
        state_number(state, "hooksCount").filter(|value| *value > 0.0).map(|value| format!("{} settings", value.round())),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();
    if parts.is_empty() {
        None
    } else {
        let value = parts.join(" · ");
        let threshold = config_number(config, &["display", "environmentThreshold"]).unwrap_or(0.0);
        if threshold > 0.0 && state_number(state, "mcpCount").unwrap_or(0.0) >= threshold {
            Some(format!(
                "{} {}",
                themed(config, "labelTitle", "94", "env"),
                themed(config, "warning", "33", &value)
            ))
        } else {
            Some(label_value(config, "env", &value))
        }
    }
}

fn render_tools(state: &Value, config: &Value, summary: bool, respect_display: bool) -> Option<String> {
    if respect_display && !config_bool(config, &["display", "showTools"], true) {
        return None;
    }
    let total = positive_count(state_number(state, "toolsCount"));
    let tool = state_string(state, "toolName").filter(|name| regular_tool_name(Some(name.clone())).is_some());
    let running = positive_count(state_number(state, "toolsRunningCount")).max(if tool.is_some() { 1 } else { 0 });
    if total == 0 && running == 0 && tool.is_none() {
        return None;
    }
    if !summary {
        if let Some(tool) = tool {
            let value = format!(
                "{}{}",
                short_tool_name(&tool, config),
                if total > 0 { format!(" · ✓ Tools {total}") } else { String::new() }
            );
            return Some(label_value(config, "◐", &value));
        }
    }
    let count = total.max(running).max(1);
    let title = format!("{} Tools", if running > 0 { "◐" } else { "✓" });
    let value = format!("{}{}", count, if running > 0 { format!(" ({running} running)") } else { String::new() });
    Some(label_value(config, &title, &value))
}

fn render_agents(state: &Value, config: &Value, _summary: bool, respect_display: bool) -> Option<String> {
    if respect_display && !config_bool(config, &["display", "showAgents"], true) {
        return None;
    }
    let total = positive_count(state_number(state, "agentsCount"));
    let running = positive_count(state_number(state, "agentsRunningCount"));
    if total == 0 && running == 0 {
        return None;
    }
    let count = total.max(running);
    let title = format!("{} Agents", if running > 0 { "◐" } else { "✓" });
    let value = format!("{}{}", count, if running > 0 { format!(" ({running} running)") } else { String::new() });
    Some(label_value(config, &title, &value))
}

fn render_todos(state: &Value, config: &Value, summary: bool, respect_display: bool) -> Option<String> {
    if respect_display && !config_bool(config, &["display", "showTodos"], true) {
        return None;
    }
    let total = positive_count(state_number(state, "todosTotalCount"));
    let active = positive_count(state_number(state, "todosActiveCount"));
    let completed = positive_count(state_number(state, "todosCompletedCount"));
    if total == 0 && active == 0 && completed == 0 {
        return None;
    }
    let effective_total = total.max(active + completed);
    let progress = if effective_total > 0 { Some(format!("({completed}/{effective_total})")) } else { None };
    let title = if summary {
        if active > 0 {
            Some("▸ Todo")
        } else if effective_total > 0 && completed >= effective_total {
            Some("✓ Todos")
        } else {
            Some("Todo")
        }
    } else if active > 0 {
        Some("▸ Todo")
    } else if effective_total > 0 && completed >= effective_total {
        Some("✓ All todos complete")
    } else {
        None
    }?;
    Some(match progress {
        Some(value) => label_value(config, title, &value),
        None => themed(config, "labelTitle", "94", title),
    })
}

fn render_session_time(state: &Value, config: &Value) -> Option<String> {
    let started = state_string(state, "sessionStartedAt").and_then(|value| absolute_date_minute(&value));
    let last = state_string(state, "lastAssistantResponseAt").and_then(|value| configured_time(&value, config));
    let parts = [
        (config_bool(config, &["display", "showSessionStartDate"], true) && started.is_some()).then(|| label_value(config, "Started", &started.unwrap_or_default())),
        (config_bool(config, &["display", "showLastResponseAt"], false) && last.is_some()).then(|| label_value(config, "Last reply", &last.unwrap_or_default())),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();
    if parts.is_empty() {
        None
    } else {
        Some(parts.join(" │ "))
    }
}

fn render_speed(state: &Value, config: &Value) -> Option<String> {
    if !config_bool(config, &["display", "showSpeed"], false) {
        return None;
    }
    state_number(state, "outputSpeed")
        .filter(|value| *value > 0.0)
        .map(|value| {
            let value = if value >= 10.0 { format!("{} tok/s", value.round()) } else { format!("{value:.1} tok/s") };
            label_value(config, "speed", &value)
        })
}

fn render_activity(state: &Value, config: &Value) -> Option<String> {
    let warning_parts = render_activity_warnings(state, config);
    let detail_parts = [
        warning_parts.clone(),
        if config_bool(config, &["activityLine", "items", "todos"], true) { render_todos(state, config, false, false) } else { None },
        if config_bool(config, &["activityLine", "items", "agents"], true) { render_agents(state, config, false, false) } else { None },
        if config_bool(config, &["activityLine", "items", "tools"], true) { render_tools(state, config, false, false) } else { None },
        if config_bool(config, &["activityLine", "items", "sessionTime"], false) { render_session_time(state, config) } else { None },
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();
    let summary_parts = [
        warning_parts,
        if config_bool(config, &["activityLine", "items", "todos"], true) { render_todos(state, config, true, false) } else { None },
        if config_bool(config, &["activityLine", "items", "agents"], true) { render_agents(state, config, true, false) } else { None },
        if config_bool(config, &["activityLine", "items", "tools"], true) { render_tools(state, config, true, false) } else { None },
        if config_bool(config, &["activityLine", "items", "sessionTime"], false) { render_session_time(state, config) } else { None },
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();
    let status = meaningful_status_text(state).map(|text| themed(config, "label", "36", &text));
    let details = if detail_parts.is_empty() { None } else { Some(detail_parts.join(" ")) };
    let summary = if summary_parts.is_empty() { None } else { Some(summary_parts.join(" | ")) };
    match config_string(config, &["activityLine", "mode"]).as_deref() {
        Some("summary") => summary.or(status),
        Some("details") => details.or(status),
        _ => {
            let max_width = terminal_max_width(config).unwrap_or(100);
            let ratio = config_number(config, &["activityLine", "maxWidthRatio"])
                .unwrap_or(1.0)
                .clamp(0.3, 1.0);
            let allowed = ((max_width as f64) * ratio).floor().max(20.0) as usize;
            if details.as_ref().map(|value| cell_width(value) <= allowed).unwrap_or(false) {
                details
            } else {
                summary.or(details).or(status)
            }
        }
    }
}

fn render_activity_warnings(state: &Value, config: &Value) -> Option<String> {
    let mut warnings = Vec::new();
    let usage_threshold = config_number(config, &["display", "usageThreshold"]).unwrap_or(0.0);
    if config_bool(config, &["activityLine", "warnings", "usage"], false) && usage_threshold > 0.0 {
        if let Some(used) = state_number(state, "fiveHourUsedPercent").map(|value| value.round().clamp(0.0, 100.0)).filter(|used| *used >= usage_threshold) {
            warnings.push(themed(config, "usageWarning", "95", &format!("⚠ Usage {}%", used.round())));
        }
    }
    if config_bool(config, &["activityLine", "warnings", "memory"], false) {
        if let Some(used) = state_number(state, "memoryUsedPercent").map(|value| value.round().clamp(0.0, 100.0)).filter(|used| *used >= 90.0) {
            warnings.push(themed(config, "warning", "33", &format!("⚠ RAM {}%", used.round())));
        }
    }
    let environment_threshold = config_number(config, &["display", "environmentThreshold"]).unwrap_or(0.0);
    if config_bool(config, &["activityLine", "warnings", "environment"], false) && environment_threshold > 0.0 {
        if let Some(count) = state_number(state, "mcpCount").filter(|value| *value >= environment_threshold) {
            warnings.push(themed(config, "warning", "33", &format!("⚠ Env {}", count.round())));
        }
    }
    if config_bool(config, &["activityLine", "warnings", "promptCache"], false) {
        if let Some(value) = render_prompt_cache_value(state, config) {
            let text = if value == "expired" { "⚠ cache expired".to_string() } else { format!("cache {value} left") };
            warnings.push(themed(config, "warning", "33", &text));
        }
    }
    if warnings.is_empty() {
        None
    } else {
        Some(warnings.join(" "))
    }
}

fn render_bar(value: Option<f64>, config: &Value, width: usize, color_key: &str) -> Option<String> {
    let percent = value.map(|value| value.round().clamp(0.0, 100.0))?;
    let code = match color_key {
        "context" => context_color_code(config, Some(percent)),
        "usage" => usage_color_code(config, Some(percent), config_number(config, &["display", "usageThreshold"]).unwrap_or(0.0)),
        "warning" => usage_color_code(config, Some(percent), 90.0),
        other => color_code_from_key(config, other, "36"),
    };
    render_bar_with_code(Some(percent), config, width, &code)
}

fn render_bar_with_code(value: Option<f64>, config: &Value, width: usize, color_code: &str) -> Option<String> {
    let percent = value.map(|value| value.round().clamp(0.0, 100.0))?;
    let filled = ((percent / 100.0) * width as f64).round() as usize;
    let filled_char = config_string(config, &["colors", "barFilled"]).unwrap_or_else(|| "█".to_string());
    let empty_char = config_string(config, &["colors", "barEmpty"]).unwrap_or_else(|| "░".to_string());
    let text = format!("{}{}", filled_char.repeat(filled), empty_char.repeat(width.saturating_sub(filled)));
    Some(themed_code(color_code, &text))
}

fn context_used_percent(state: &Value) -> Option<f64> {
    state_number(state, "contextUsedPercent")
        .or_else(|| match (state_number(state, "contextUsedTokens"), state_number(state, "contextWindowSize")) {
            (Some(used), Some(window)) if window > 0.0 => Some(((used / window) * 100.0).round().clamp(0.0, 100.0)),
            _ => None,
        })
}

fn meaningful_status_text(state: &Value) -> Option<String> {
    let text = state_string(state, "statusText")?;
    if matches!(text.to_ascii_lowercase().as_str(), "active" | "claude code active" | "claude hud one") {
        None
    } else {
        Some(text)
    }
}

fn positive_count(value: Option<f64>) -> i64 {
    value.filter(|value| *value > 0.0).map(|value| value.round() as i64).unwrap_or(0)
}

fn config_value<'a>(config: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut current = config;
    for key in path {
        current = current.get(*key)?;
    }
    Some(current)
}

fn config_string(config: &Value, path: &[&str]) -> Option<String> {
    config_value(config, path)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn config_number(config: &Value, path: &[&str]) -> Option<f64> {
    config_value(config, path).and_then(value_number)
}

fn config_bool(config: &Value, path: &[&str], default: bool) -> bool {
    config_value(config, path).and_then(Value::as_bool).unwrap_or(default)
}

fn color_enabled() -> bool {
    env::var("NO_COLOR").ok().as_deref() != Some("1") && env::var("CLAUDE_HUD_ONE_NO_COLOR").ok().as_deref() != Some("1")
}

fn themed(config: &Value, key: &str, fallback_code: &str, text: &str) -> String {
    let code = color_code_from_key(config, key, fallback_code);
    themed_code(&code, text)
}

fn label_value(config: &Value, label: &str, value: &str) -> String {
    format!(
        "{} {}",
        themed(config, "labelTitle", "94", label),
        themed(config, "labelValue", "36", value)
    )
}

fn themed_code(code: &str, text: &str) -> String {
    if !color_enabled() {
        return text.to_string();
    }
    format!("\x1b[{code}m{text}\x1b[0m")
}

fn color_code_from_key(config: &Value, key: &str, fallback_code: &str) -> String {
    config_value(config, &["colors", key])
        .and_then(color_code_from_value)
        .unwrap_or_else(|| fallback_code.to_string())
}

fn context_color_code(config: &Value, percent: Option<f64>) -> String {
    if let Some(percent) = percent {
        if let Some(code) = band_color_code(config, "contextBands", percent) {
            return code;
        }
        let critical = config_number(config, &["display", "contextCriticalThreshold"]).unwrap_or(85.0);
        if critical > 0.0 && percent >= critical {
            return color_code_from_key(config, "critical", "31");
        }
        let warning = config_number(config, &["display", "contextWarningThreshold"]).unwrap_or(70.0);
        if warning > 0.0 && percent >= warning {
            return color_code_from_key(config, "warning", "33");
        }
    }
    color_code_from_key(config, "context", "36")
}

fn usage_color_code(config: &Value, percent: Option<f64>, threshold: f64) -> String {
    if let Some(percent) = percent {
        if let Some(code) = band_color_code(config, "usageBands", percent) {
            return code;
        }
        if threshold > 0.0 && percent >= threshold {
            return color_code_from_key(config, "usageWarning", "95");
        }
    }
    color_code_from_key(config, "usage", "94")
}

fn band_color_code(config: &Value, key: &str, percent: f64) -> Option<String> {
    let bands = config_value(config, &["colors", key])?.as_array()?;
    let mut selected = None::<(f64, String)>;
    for band in bands {
        let min = band.get("min").and_then(value_number)?;
        if percent >= min {
            let code = band.get("color").and_then(color_code_from_value)?;
            if selected.as_ref().map(|(current_min, _)| min >= *current_min).unwrap_or(true) {
                selected = Some((min, code));
            }
        }
    }
    selected.map(|(_, code)| code)
}

fn color_code_from_value(value: &Value) -> Option<String> {
    value
        .as_str()
        .map(ToString::to_string)
        .or_else(|| value.as_i64().map(|number| number.to_string()))
        .and_then(|value| color_code(&value))
}

fn color_code(value: &str) -> Option<String> {
    match value {
        "dim" => Some("2".to_string()),
        "red" => Some("31".to_string()),
        "green" => Some("32".to_string()),
        "yellow" => Some("33".to_string()),
        "magenta" => Some("35".to_string()),
        "cyan" => Some("36".to_string()),
        "brightBlue" => Some("94".to_string()),
        "brightMagenta" => Some("95".to_string()),
        _ => {
            if let Ok(code) = value.parse::<u8>() {
                return Some(format!("38;5;{code}"));
            }
            let hex = value.trim_start_matches('#');
            if hex.len() == 6 && hex.chars().all(|ch| ch.is_ascii_hexdigit()) {
                let red = u8::from_str_radix(&hex[0..2], 16).ok()?;
                let green = u8::from_str_radix(&hex[2..4], 16).ok()?;
                let blue = u8::from_str_radix(&hex[4..6], 16).ok()?;
                Some(format!("38;2;{red};{green};{blue}"))
            } else {
                None
            }
        }
    }
}

fn terminal_max_width(config: &Value) -> Option<usize> {
    config_number(config, &["maxWidth"])
        .or_else(|| env::var("CLAUDE_HUD_ONE_TERMINAL_MAX_WIDTH").ok().and_then(|value| value.parse::<f64>().ok()))
        .filter(|value| *value > 0.0)
        .map(|value| value.round() as usize)
}

fn strip_ansi(text: &str) -> String {
    let mut output = String::new();
    let mut chars = text.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\x1b' && chars.peek() == Some(&'[') {
            chars.next();
            for next in chars.by_ref() {
                if next == 'm' {
                    break;
                }
            }
        } else {
            output.push(ch);
        }
    }
    output
}

fn cell_width(text: &str) -> usize {
    strip_ansi(text).chars().map(|ch| if is_wide_char(ch) { 2 } else { 1 }).sum()
}

fn is_wide_char(ch: char) -> bool {
    let code = ch as u32;
    matches!(
        code,
        0x1100..=0x115f
            | 0x2329
            | 0x232a
            | 0x2e80..=0xa4cf
            | 0xac00..=0xd7a3
            | 0xf900..=0xfaff
            | 0xfe10..=0xfe19
            | 0xfe30..=0xfe6f
            | 0xff00..=0xff60
            | 0xffe0..=0xffe6
            | 0x1f300..=0x1faff
    )
}

fn truncate_to_width(text: &str, max_width: Option<usize>) -> String {
    let Some(max_width) = max_width else {
        return text.to_string();
    };
    if max_width == 0 {
        return String::new();
    }
    if cell_width(text) <= max_width {
        return text.to_string();
    }
    let visible_limit = max_width.saturating_sub(1);
    let mut output = String::new();
    let mut chars = text.chars().peekable();
    let mut width = 0;
    let mut saw_ansi = false;
    while let Some(ch) = chars.next() {
        if ch == '\x1b' && chars.peek() == Some(&'[') {
            output.push(ch);
            output.push(chars.next().unwrap_or('['));
            while let Some(next) = chars.next() {
                output.push(next);
                if next == 'm' {
                    saw_ansi = true;
                    break;
                }
            }
            continue;
        }
        let char_width = if is_wide_char(ch) { 2 } else { 1 };
        if width + char_width > visible_limit {
            break;
        }
        output.push(ch);
        width += char_width;
    }
    output.push('…');
    if saw_ansi {
        output.push_str("\x1b[0m");
    }
    output
}

fn wrap_line_to_width(text: &str, max_width: Option<usize>) -> Vec<String> {
    let Some(max_width) = max_width else {
        return vec![text.to_string()];
    };
    if cell_width(text) <= max_width {
        return vec![text.to_string()];
    }
    let mut lines = Vec::new();
    let mut current = String::new();
    for part in text.split(' ') {
        if part.is_empty() {
            continue;
        }
        let next = if current.is_empty() { part.to_string() } else { format!("{current} {part}") };
        if !current.is_empty() && cell_width(&next) > max_width {
            lines.push(truncate_to_width(&current, Some(max_width)));
            current = part.to_string();
        } else {
            current = next;
        }
    }
    if !current.is_empty() {
        lines.push(truncate_to_width(&current, Some(max_width)));
    }
    if lines.is_empty() {
        vec![truncate_to_width(text, Some(max_width))]
    } else {
        lines
    }
}

fn short_tool_name(tool_name: &str, config: &Value) -> String {
    if config_string(config, &["activityLine", "toolNameFormat"]).as_deref() == Some("full") {
        return tool_name.to_string();
    }
    tool_name.trim_start_matches("mcp__").to_string()
}

fn format_usd(value: f64) -> Option<String> {
    if !value.is_finite() || value <= 0.0 {
        return None;
    }
    Some(if value < 10.0 { format!("${value:.2}") } else { format!("${value:.1}") })
}

fn format_duration(value_ms: f64) -> Option<String> {
    if !value_ms.is_finite() || value_ms <= 0.0 {
        return None;
    }
    let seconds = (value_ms / 1000.0).round() as i64;
    if seconds < 60 {
        Some(format!("{seconds}s"))
    } else {
        let minutes = (seconds as f64 / 60.0).round() as i64;
        if minutes < 60 {
            Some(format!("{minutes}m"))
        } else {
            Some(format!("{}h {}m", minutes / 60, minutes % 60))
        }
    }
}

fn duration_until(value: &str) -> Option<String> {
    let target = ms_from_iso(value)?;
    let diff = target.saturating_sub(unix_millis());
    if diff == 0 {
        Some("now".to_string())
    } else {
        format_duration(diff as f64)
    }
}

fn configured_time(value: &str, config: &Value) -> Option<String> {
    match config_string(config, &["display", "timeFormat"]).as_deref() {
        Some("absolute") => clock_time(value),
        Some("both") => {
            let parts = [clock_time(value), relative_time(value)].into_iter().flatten().collect::<Vec<_>>();
            if parts.is_empty() { None } else { Some(parts.join(" / ")) }
        }
        _ => relative_time(value),
    }
}

fn clock_time(value: &str) -> Option<String> {
    let timestamp = OffsetDateTime::parse(value, &Rfc3339).ok()?;
    Some(format!("{:02}:{:02}", timestamp.hour(), timestamp.minute()))
}

fn absolute_date_minute(value: &str) -> Option<String> {
    let timestamp = OffsetDateTime::parse(value, &Rfc3339).ok()?;
    Some(format!(
        "{:04}-{:02}-{:02} {:02}:{:02}",
        timestamp.year(),
        timestamp.month() as u8,
        timestamp.day(),
        timestamp.hour(),
        timestamp.minute()
    ))
}

fn relative_time(value: &str) -> Option<String> {
    let timestamp = ms_from_iso(value)?;
    let diff = unix_millis().saturating_sub(timestamp);
    let seconds = (diff / 1000) as i64;
    if seconds < 60 {
        Some(format!("{seconds}s ago"))
    } else {
        let minutes = ((seconds as f64) / 60.0).round() as i64;
        if minutes < 60 {
            Some(format!("{minutes}m ago"))
        } else {
            let hours = ((minutes as f64) / 60.0).round() as i64;
            if hours < 48 {
                Some(format!("{hours}h ago"))
            } else {
                Some(format!("{}d ago", ((hours as f64) / 24.0).round() as i64))
            }
        }
    }
}

fn merge_with_previous(next_state: Value, previous_state: Option<&Value>, mode: BridgeMode) -> Value {
    let Some(previous) = previous_state else {
        return next_state;
    };
    let Some(next_object) = next_state.as_object() else {
        return next_state;
    };
    let mut merged = next_object.clone();

    for key in [
        "modelId",
        "modelName",
        "contextUsedPercent",
        "contextRemainingPercent",
        "contextWindowSize",
        "contextUsedTokens",
        "permissionMode",
        "inputTokens",
        "outputTokens",
        "cacheCreationInputTokens",
        "cacheReadInputTokens",
        "totalCostUsd",
        "totalDurationMs",
        "totalApiDurationMs",
        "totalLinesAdded",
        "totalLinesRemoved",
        "outputSpeed",
        "sessionStartedAt",
        "lastAssistantResponseAt",
        "toolsCount",
        "toolsRunningCount",
        "agentsCount",
        "agentsRunningCount",
        "todosActiveCount",
        "todosCompletedCount",
        "todosTotalCount",
        "fiveHourUsedPercent",
        "fiveHourResetAt",
        "sevenDayUsedPercent",
        "sevenDayResetAt",
        "effortLevel",
        "thinkingEnabled",
        "agentName",
        "terminal",
    ] {
        if mode == BridgeMode::StatusLine && is_statusline_live_metric_key(key) {
            continue;
        }
        if is_null_or_missing(merged.get(key)) {
            if let Some(previous_value) = previous.get(key) {
                merged.insert(key.to_string(), previous_value.clone());
            }
        }
    }
    if is_null_or_missing(merged.get("projectDir")) {
        if let Some(previous_value) = previous.get("projectDir") {
            merged.insert("projectDir".to_string(), previous_value.clone());
        }
    }
    if merged
        .get("projectSlug")
        .and_then(Value::as_str)
        .map(|value| value == "Claude Code" || value.trim().is_empty())
        .unwrap_or(true)
    {
        if let Some(previous_value) = previous.get("projectSlug") {
            merged.insert("projectSlug".to_string(), previous_value.clone());
        }
    }
    let merged_queue = merge_pending_queue(&Value::Object(merged.clone()), previous, mode);
    merged.insert("pendingQueue".to_string(), merged_queue);
    preserve_recent_running_signal(&mut merged, previous, mode);
    Value::Object(merged)
}

fn preserve_recent_running_signal(
    merged: &mut Map<String, Value>,
    previous: &Value,
    mode: BridgeMode,
) {
    if mode != BridgeMode::StatusLine || state_has_running_signal(&Value::Object(merged.clone())) {
        return;
    }
    let previous_is_hook_running_signal = previous.get("source").and_then(Value::as_str) == Some("hook")
        || is_running_hook_event(previous.get("hookEventName").and_then(Value::as_str));
    if !previous_is_hook_running_signal || !state_has_running_signal(previous) {
        return;
    }
    let Some(signal_at) = previous
        .get("lastRunningSignalAt")
        .and_then(Value::as_str)
        .or_else(|| previous.get("updatedAt").and_then(Value::as_str))
    else {
        return;
    };
    let Some(signal_ms) = ms_from_iso(signal_at) else {
        return;
    };
    if unix_millis().saturating_sub(signal_ms) > RUNNING_SIGNAL_TTL_MS {
        return;
    }

    merged.insert("activity".to_string(), json!("running"));
    merged.insert("lastRunningSignalAt".to_string(), json!(signal_at));
    for key in ["statusText", "hookEventName", "toolName", "source"] {
        if let Some(previous_value) = previous.get(key) {
            merged.insert(key.to_string(), previous_value.clone());
        }
    }
    if let Some(previous_value) = previous.get("activityStartedAt") {
        merged.insert("activityStartedAt".to_string(), previous_value.clone());
    }
    for key in ["toolsRunningCount", "agentsRunningCount"] {
        if positive_count(previous.get(key).and_then(value_number)) > 0 {
            if let Some(previous_value) = previous.get(key) {
                merged.insert(key.to_string(), previous_value.clone());
            }
        }
    }
}

fn state_has_running_signal(state: &Value) -> bool {
    positive_count(state.get("toolsRunningCount").and_then(value_number)) > 0
        || positive_count(state.get("agentsRunningCount").and_then(value_number)) > 0
        || is_running_hook_event(state.get("hookEventName").and_then(Value::as_str))
        || state
            .get("statusText")
            .and_then(Value::as_str)
            .map(status_text_has_running_signal)
            .unwrap_or(false)
        || state.get("activity").and_then(Value::as_str) == Some("running")
}

fn is_running_hook_event(hook_event: Option<&str>) -> bool {
    matches!(
        hook_event,
        Some("MessageDisplay" | "PreToolUse" | "SubagentStart" | "PreCompact")
    )
}

fn status_text_has_running_signal(status_text: &str) -> bool {
    let trimmed = status_text.trim();
    trimmed.eq_ignore_ascii_case("Generating response")
        || trimmed.eq_ignore_ascii_case("Agent running")
        || trimmed.eq_ignore_ascii_case("Compacting context")
        || trimmed
            .to_ascii_lowercase()
            .starts_with("tool running")
}

fn is_statusline_live_metric_key(key: &str) -> bool {
    matches!(
        key,
        "contextUsedPercent"
            | "contextRemainingPercent"
            | "contextWindowSize"
            | "contextUsedTokens"
            | "inputTokens"
            | "outputTokens"
            | "cacheCreationInputTokens"
            | "cacheReadInputTokens"
            | "totalCostUsd"
            | "totalDurationMs"
            | "totalApiDurationMs"
            | "outputSpeed"
            | "sessionStartedAt"
            | "lastAssistantResponseAt"
            | "toolsCount"
            | "toolsRunningCount"
            | "agentsCount"
            | "agentsRunningCount"
            | "todosActiveCount"
            | "todosCompletedCount"
            | "todosTotalCount"
            | "fiveHourUsedPercent"
            | "fiveHourResetAt"
            | "sevenDayUsedPercent"
            | "sevenDayResetAt"
    )
}

fn merge_pending_queue(next_state: &Value, previous_state: &Value, mode: BridgeMode) -> Value {
    let mut items_by_id = BTreeMap::<String, Value>::new();
    for item in pruned_pending_items(previous_state.get("pendingQueue")) {
        if let Some(id) = item.get("id").and_then(Value::as_str) {
            items_by_id.insert(id.to_string(), item);
        }
    }
    for item in pruned_pending_items(next_state.get("pendingQueue")) {
        if let Some(id) = item.get("id").and_then(Value::as_str) {
            items_by_id.insert(id.to_string(), item);
        }
    }

    let hook_event = next_state.get("hookEventName").and_then(Value::as_str);
    let tool_name = next_state.get("toolName").and_then(Value::as_str);
    if hook_event == Some("PostToolUse") {
        if let Some(tool_name) = tool_name {
            items_by_id.retain(|_, item| {
                item.get("kind").and_then(Value::as_str) != Some("approval")
                    || item.get("toolName").and_then(Value::as_str) != Some(tool_name)
            });
        }
    }
    if matches!(hook_event, Some("UserPromptSubmit") | Some("SessionEnd")) {
        items_by_id.retain(|_, item| item.get("kind").and_then(Value::as_str) != Some("question"));
    }
    if mode == BridgeMode::StatusLine
        && hook_event.is_none()
        && next_state.get("activity").and_then(Value::as_str) != Some("waiting")
    {
        items_by_id.clear();
    }

    let mut items = items_by_id.into_values().collect::<Vec<_>>();
    if items.len() > MAX_PENDING_ITEMS {
        items = items.split_off(items.len() - MAX_PENDING_ITEMS);
    }
    json!({
        "schemaVersion": 1,
        "updatedAt": iso_now(),
        "items": items
    })
}

fn pruned_pending_items(queue: Option<&Value>) -> Vec<Value> {
    let now = unix_millis();
    queue
        .and_then(|queue| queue.get("items"))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter(|item| item.get("status").and_then(Value::as_str) == Some("pending"))
                .filter(|item| {
                    item.get("expiresAt")
                        .and_then(Value::as_str)
                        .and_then(ms_from_iso)
                        .map(|expires_at| expires_at > now)
                        .unwrap_or(true)
                })
                .cloned()
                .collect()
        })
        .unwrap_or_default()
}

fn write_state_files(state: &Value, session_key: &str) {
    for path in state_paths() {
        let _ = write_json_atomic_replace(&path, state);
    }
    for path in session_state_paths(session_key) {
        let _ = write_json_atomic_replace(&path, state);
    }
}

fn state_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(appdata) = app_data_root() {
        paths.push(appdata.join("claude-status.json"));
    }
    if let Some(project) = project_state_root() {
        paths.push(project.join("claude-status.json"));
    }
    paths
}

fn session_state_paths(session_key: &str) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(appdata) = app_data_root() {
        paths.push(appdata.join("sessions").join(format!("{session_key}.json")));
    }
    if let Some(project) = project_state_root() {
        paths.push(project.join("sessions").join(format!("{session_key}.json")));
    }
    paths
}

fn pending_intent_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(appdata) = app_data_root() {
        dirs.push(appdata.join("pending-intents"));
    }
    if let Some(project) = project_state_root() {
        dirs.push(project.join("pending-intents"));
    }
    dirs
}

fn app_data_root() -> Option<PathBuf> {
    env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|path| path.join(APP_NAME))
}

fn project_state_root() -> Option<PathBuf> {
    env::current_dir()
        .ok()
        .map(|path| path.join(".claude").join("bridge").join("state"))
}

fn read_previous_related_state(next_state: &Value, session_key: &str) -> Option<Value> {
    previous_session_candidate_keys(next_state, session_key)
        .into_iter()
        .find_map(|key| read_previous_session_state(&key))
        .or_else(|| {
            state_paths()
                .into_iter()
                .filter_map(read_json_file)
                .find(|state| previous_state_matches_next(state, next_state, session_key))
        })
        .or_else(|| {
            session_state_dirs()
                .into_iter()
                .flat_map(read_json_files)
                .filter_map(read_json_file)
                .find(|state| previous_state_matches_next(state, next_state, session_key))
        })
}

fn previous_session_candidate_keys(next_state: &Value, session_key: &str) -> Vec<String> {
    let mut keys = vec![session_key.to_string()];
    for key in ["transcriptPath", "sessionId"] {
        if let Some(candidate) = state_string(next_state, key).and_then(|value| safe_path_segment(&value)) {
            if !keys.iter().any(|existing| existing == &candidate) {
                keys.push(candidate);
            }
        }
    }
    keys
}

fn previous_state_matches_next(previous: &Value, next: &Value, session_key: &str) -> bool {
    previous
        .get("sessionKey")
        .and_then(Value::as_str)
        .map(|value| value == session_key)
        .unwrap_or(false)
        || session_key_from_state(previous) == session_key
        || shared_non_empty_state_string(previous, next, "transcriptPath")
        || shared_non_empty_state_string(previous, next, "sessionId")
}

fn shared_non_empty_state_string(left: &Value, right: &Value, key: &str) -> bool {
    match (state_string(left, key), state_string(right, key)) {
        (Some(left), Some(right)) => left == right,
        _ => false,
    }
}

fn read_previous_session_state(session_key: &str) -> Option<Value> {
    session_state_paths(session_key).into_iter().find_map(read_json_file)
}

fn session_state_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(appdata) = app_data_root() {
        dirs.push(appdata.join("sessions"));
    }
    if let Some(project) = project_state_root() {
        dirs.push(project.join("sessions"));
    }
    dirs
}

fn read_json_files(dir: PathBuf) -> Vec<PathBuf> {
    fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .map(|entry| entry.path())
                .filter(|path| path.extension().and_then(|extension| extension.to_str()).map(|extension| extension.eq_ignore_ascii_case("json")).unwrap_or(false))
                .collect()
        })
        .unwrap_or_default()
}

fn read_json_file(path: PathBuf) -> Option<Value> {
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str::<Value>(&content).ok())
}

fn write_json_atomic_if_absent(path: &Path, value: &Value) -> Result<(), String> {
    if path.exists() {
        return Ok(());
    }
    write_json_atomic(path, value, false)
}

fn write_json_atomic_replace(path: &Path, value: &Value) -> Result<(), String> {
    write_json_atomic(path, value, true)
}

fn write_json_atomic(path: &Path, value: &Value, replace: bool) -> Result<(), String> {
    let Some(parent) = path.parent() else {
        return Err("target path has no parent".to_string());
    };
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    if !replace && path.exists() {
        return Ok(());
    }
    let content = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    let tmp = path.with_extension(format!("json.{}.tmp", std::process::id()));
    fs::write(&tmp, content).map_err(|error| error.to_string())?;
    if replace && path.exists() {
        let _ = fs::remove_file(path);
    }
    match fs::rename(&tmp, path) {
        Ok(_) => Ok(()),
        Err(error) => {
            let _ = fs::remove_file(&tmp);
            Err(error.to_string())
        }
    }
}

fn session_key_from_state(state: &Value) -> String {
    state_string(state, "transcriptPath")
        .and_then(|value| safe_path_segment(&value))
        .or_else(|| state_string(state, "sessionId").and_then(|value| safe_path_segment(&value)))
        .or_else(|| {
            safe_path_segment(&[
                state_string(state, "projectSlug"),
                state_string(state, "sessionName"),
                state_string(state, "projectDir").or_else(|| state_string(state, "cwd")),
            ]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .join("-"))
        })
        .unwrap_or_else(|| format!("pid-{}", std::process::id()))
}

#[derive(Debug, Clone, Copy, Default)]
struct SessionTokenUsage {
    input_tokens: Option<f64>,
    output_tokens: Option<f64>,
    cache_creation_input_tokens: Option<f64>,
    cache_read_input_tokens: Option<f64>,
}

impl SessionTokenUsage {
    fn total(self) -> f64 {
        self.input_tokens.unwrap_or(0.0)
            + self.output_tokens.unwrap_or(0.0)
            + self.cache_creation_input_tokens.unwrap_or(0.0)
            + self.cache_read_input_tokens.unwrap_or(0.0)
    }
}

#[derive(Debug, Clone, Copy)]
struct TranscriptRunningItem {
    kind: &'static str,
    started_at_ms: Option<u128>,
}

#[derive(Debug, Clone, Default)]
struct TranscriptSummary {
    session_tokens: SessionTokenUsage,
    tools_count: Option<f64>,
    tools_running_count: Option<f64>,
    agents_count: Option<f64>,
    agents_running_count: Option<f64>,
    todo_operation_count: Option<f64>,
    todos_active_count: Option<f64>,
    todos_completed_count: Option<f64>,
    todos_total_count: Option<f64>,
    first_timestamp: Option<String>,
    last_assistant_response_at: Option<String>,
}

fn read_transcript_summary(transcript_path: Option<&str>) -> TranscriptSummary {
    let Some(path) = transcript_path.map(PathBuf::from).filter(|path| path.is_file()) else {
        return TranscriptSummary::default();
    };
    let Ok(file) = File::open(path) else {
        return TranscriptSummary::default();
    };

    let mut summary = TranscriptSummary::default();
    let mut saw_usage = false;
    let mut tools_count = 0.0;
    let mut agents_count = 0.0;
    let mut todo_operation_count = 0.0;
    let mut latest_todo_counts: Option<(f64, f64, f64)> = None;
    let mut running_tools = BTreeMap::<String, TranscriptRunningItem>::new();
    let mut task_statuses = Vec::<String>::new();

    for line in BufReader::new(file).lines().map_while(Result::ok) {
        let clean = line.trim_start_matches('\u{feff}').trim();
        if clean.is_empty() {
            continue;
        }
        let Ok(entry) = serde_json::from_str::<Value>(clean) else {
            continue;
        };

        let entry_timestamp_ms = string_path(&entry, &["timestamp"]).and_then(|value| {
            let ms = ms_from_iso(&value)?;
            if summary.first_timestamp.is_none() {
                summary.first_timestamp = Some(value.clone());
            }
            if entry.get("type").and_then(Value::as_str) == Some("assistant")
                || entry.get("message").and_then(|message| message.get("role")).and_then(Value::as_str) == Some("assistant")
            {
                summary.last_assistant_response_at = Some(value);
            }
            Some(ms)
        });

        let usage = entry
            .get("message")
            .and_then(|message| message.get("usage"))
            .or_else(|| entry.get("usage"));
        if let Some(usage) = usage.filter(|value| value.is_object()) {
            saw_usage = true;
            summary.session_tokens.input_tokens = Some(summary.session_tokens.input_tokens.unwrap_or(0.0) + safe_usage_count(usage.get("input_tokens")));
            summary.session_tokens.output_tokens = Some(summary.session_tokens.output_tokens.unwrap_or(0.0) + safe_usage_count(usage.get("output_tokens")));
            summary.session_tokens.cache_creation_input_tokens = Some(summary.session_tokens.cache_creation_input_tokens.unwrap_or(0.0) + safe_usage_count(usage.get("cache_creation_input_tokens")));
            summary.session_tokens.cache_read_input_tokens = Some(summary.session_tokens.cache_read_input_tokens.unwrap_or(0.0) + safe_usage_count(usage.get("cache_read_input_tokens")));
        }

        for item in transcript_content_items(&entry) {
            if item.get("type").and_then(Value::as_str) == Some("tool_result") {
                if let Some(tool_id) = item.get("tool_use_id").and_then(Value::as_str) {
                    running_tools.remove(tool_id);
                }
                continue;
            }
            let Some(name) = item.get("name").and_then(Value::as_str) else {
                continue;
            };
            let id = item.get("id").and_then(Value::as_str).map(ToString::to_string);
            if matches!(name, "Task" | "Agent") {
                agents_count += 1.0;
                if let Some(id) = id {
                    running_tools.insert(id, TranscriptRunningItem { kind: "agent", started_at_ms: entry_timestamp_ms });
                }
                continue;
            }
            if matches!(name, "TodoWrite" | "TodoRead" | "TaskCreate" | "TaskUpdate") {
                todo_operation_count += 1.0;
                if let Some(counts) = todo_counts_from_tool_input(item.get("input")) {
                    latest_todo_counts = Some(counts);
                }
                if let Some(status) = item
                    .get("input")
                    .and_then(|input| input.get("status"))
                    .and_then(Value::as_str)
                {
                    task_statuses.push(status.to_string());
                }
                if let Some(id) = id {
                    running_tools.insert(id, TranscriptRunningItem { kind: "todo", started_at_ms: entry_timestamp_ms });
                }
                continue;
            }
            if regular_tool_name(Some(name.to_string())).is_some() {
                tools_count += 1.0;
                if let Some(id) = id {
                    running_tools.insert(id, TranscriptRunningItem { kind: "tool", started_at_ms: entry_timestamp_ms });
                }
            }
        }
    }

    if !saw_usage {
        summary.session_tokens = SessionTokenUsage::default();
    }
    summary.todo_operation_count = (todo_operation_count > 0.0).then_some(todo_operation_count);
    let now_ms = unix_millis();
    let tools_running = running_tools
        .values()
        .filter(|item| item.kind == "tool" && transcript_running_item_is_fresh(*item, now_ms))
        .count() as f64;
    let agents_running = running_tools
        .values()
        .filter(|item| item.kind == "agent" && transcript_running_item_is_fresh(*item, now_ms))
        .count() as f64;
    summary.tools_count = (tools_count > 0.0).then_some(tools_count);
    summary.tools_running_count = (tools_running > 0.0).then_some(tools_running);
    summary.agents_count = (agents_count > 0.0).then_some(agents_count);
    summary.agents_running_count = (agents_running > 0.0).then_some(agents_running);
    let todo_counts = latest_todo_counts.or_else(|| todo_counts_from_statuses(task_statuses.iter().map(String::as_str)));
    if let Some((active, completed, total)) = todo_counts {
        summary.todos_active_count = Some(active);
        summary.todos_completed_count = Some(completed);
        summary.todos_total_count = Some(total);
    }
    summary
}

fn transcript_running_item_is_fresh(item: &TranscriptRunningItem, now_ms: u128) -> bool {
    item.started_at_ms
        .map(|started_at_ms| now_ms.saturating_sub(started_at_ms) <= TRANSCRIPT_RUNNING_TOOL_TTL_MS)
        .unwrap_or(false)
}

fn transcript_content_items(entry: &Value) -> Vec<&Value> {
    entry
        .get("message")
        .and_then(|message| message.get("content"))
        .or_else(|| entry.get("content"))
        .and_then(Value::as_array)
        .map(|items| items.iter().collect())
        .unwrap_or_default()
}

fn todo_counts_from_tool_input(input: Option<&Value>) -> Option<(f64, f64, f64)> {
    let input = input.filter(|value| value.is_object())?;
    let todos = input
        .get("todos")
        .or_else(|| input.get("items"))
        .and_then(Value::as_array)?;
    todo_counts_from_statuses(todos.iter().filter_map(|todo| todo.get("status").and_then(Value::as_str)))
}

fn todo_counts_from_statuses<'a>(statuses: impl Iterator<Item = &'a str>) -> Option<(f64, f64, f64)> {
    let mut active = 0.0;
    let mut completed = 0.0;
    let mut total = 0.0;
    for status in statuses {
        total += 1.0;
        match status {
            "completed" | "done" => completed += 1.0,
            "in_progress" | "active" | "pending" => active += 1.0,
            _ => {}
        }
    }
    (total > 0.0).then_some((active, completed, total))
}

fn safe_usage_count(value: Option<&Value>) -> f64 {
    value.and_then(value_number).filter(|value| *value >= 0.0).unwrap_or(0.0)
}

#[derive(Default)]
struct GitStatus {
    branch: Option<String>,
    dirty: Option<bool>,
    ahead: Option<f64>,
    behind: Option<f64>,
    lines_added: Option<f64>,
    lines_removed: Option<f64>,
}

fn collect_git_status(project_dir: Option<&str>) -> GitStatus {
    let dir = project_dir
        .map(PathBuf::from)
        .filter(|path| path.is_dir())
        .or_else(|| env::current_dir().ok());
    let Some(dir) = dir else {
        return GitStatus::default();
    };
    let Some(status_output) = git_output(&dir, &["status", "--porcelain=v1", "--branch"]) else {
        return GitStatus::default();
    };
    let mut lines = status_output.lines();
    let header = lines.next().unwrap_or_default();
    let dirty = lines.any(|line| !line.trim().is_empty());
    let (branch, ahead, behind) = parse_git_status_header(header);
    let (lines_added, lines_removed) = collect_git_numstat(&dir);
    GitStatus {
        branch,
        dirty: Some(dirty),
        ahead,
        behind,
        lines_added,
        lines_removed,
    }
}

fn git_output(dir: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8(output.stdout).ok()
}

fn parse_git_status_header(header: &str) -> (Option<String>, Option<f64>, Option<f64>) {
    let text = header.trim().strip_prefix("## ").unwrap_or(header.trim());
    let (branch_part, meta_part) = text
        .split_once(" [")
        .map(|(branch, meta)| (branch, Some(meta.trim_end_matches(']'))))
        .unwrap_or((text, None));
    let branch = branch_part
        .split("...")
        .next()
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != "HEAD (no branch)")
        .map(ToString::to_string);
    let mut ahead = None;
    let mut behind = None;
    if let Some(meta) = meta_part {
        for part in meta.split(',').map(str::trim) {
            if let Some(value) = part.strip_prefix("ahead ").and_then(|value| value.parse::<f64>().ok()) {
                ahead = Some(value);
            }
            if let Some(value) = part.strip_prefix("behind ").and_then(|value| value.parse::<f64>().ok()) {
                behind = Some(value);
            }
        }
    }
    (branch, ahead, behind)
}

fn collect_git_numstat(dir: &Path) -> (Option<f64>, Option<f64>) {
    let Some(output) = git_output(dir, &["diff", "--numstat", "HEAD", "--"]) else {
        return (None, None);
    };
    let mut added = 0.0;
    let mut removed = 0.0;
    for line in output.lines() {
        let mut parts = line.split_whitespace();
        if let Some(value) = parts.next().and_then(|value| value.parse::<f64>().ok()) {
            added += value;
        }
        if let Some(value) = parts.next().and_then(|value| value.parse::<f64>().ok()) {
            removed += value;
        }
    }
    (
        (added > 0.0).then_some(added),
        (removed > 0.0).then_some(removed),
    )
}

fn terminal_metadata(cwd: Option<&str>, project_slug: Option<&str>, session_name: Option<&str>, session_id: Option<&str>) -> Value {
    json!({
        "cwd": cwd,
        "kind": if env::var_os("WT_SESSION").is_some() { "windowsTerminal" } else { "terminal" },
        "wtSession": env::var("WT_SESSION").ok(),
        "wtProfileId": env::var("WT_PROFILE_ID").ok(),
        "wtProfileName": env::var("WT_PROFILE_NAME").ok(),
        "termProgram": env::var("TERM_PROGRAM").ok(),
        "shell": env::var("SHELL").ok().or_else(|| env::var("ComSpec").ok()),
        "bridgeProcessId": std::process::id(),
        "bridgeParentProcessId": null,
        "windowTitleHint": terminal_title_hint(cwd, project_slug, session_name, session_id),
        "capturedAt": iso_now()
    })
}

fn terminal_title_hint(cwd: Option<&str>, project_slug: Option<&str>, session_name: Option<&str>, session_id: Option<&str>) -> String {
    let project = project_slug
        .map(ToString::to_string)
        .or_else(|| cwd.and_then(base_name))
        .unwrap_or_else(|| "Claude Code".to_string());
    let session = session_name
        .map(ToString::to_string)
        .or_else(|| session_id.map(short_session_id))
        .unwrap_or_else(|| "session".to_string());
    format!("Claude HUD One · {project} · {session}")
}

fn activity_from_hook(hook_event: &str) -> &'static str {
    match hook_event {
        "MessageDisplay" | "PreToolUse" | "SubagentStart" | "PreCompact" => "running",
        "Notification" => "waiting",
        "StopFailure" => "error",
        "PostToolUse" | "PostToolUseFailure" | "PostToolBatch" | "SubagentStop" | "Stop" | "PostCompact" | "SessionEnd" => "idle",
        _ => "active",
    }
}

fn status_text_from_status_line(input: &Value) -> Option<String> {
    let status_text = string_path(input, &["status_text"])
        .or_else(|| string_path(input, &["statusText"]))
        .unwrap_or_else(|| "Session idle".to_string());
    Some(if matches!(status_text.trim(), "Claude Code active" | "active" | "") {
        "Session idle".to_string()
    } else {
        status_text
    })
}

fn status_text_from_hook(hook_event: &str, tool_name: Option<&str>) -> String {
    match hook_event {
        "UserPromptSubmit" => "Prompt submitted".to_string(),
        "MessageDisplay" => "Generating response".to_string(),
        "PreToolUse" => tool_name.map(|name| format!("Tool running: {name}")).unwrap_or_else(|| "Tool running".to_string()),
        "PostToolUse" => tool_name.map(|name| format!("Tool finished: {name}")).unwrap_or_else(|| "Tool finished".to_string()),
        "PostToolUseFailure" => tool_name.map(|name| format!("Tool failed: {name}")).unwrap_or_else(|| "Tool failed".to_string()),
        "PostToolBatch" => "Tool batch finished".to_string(),
        "Notification" => "Needs attention".to_string(),
        "Stop" => "Session idle".to_string(),
        "StopFailure" => "Run failed".to_string(),
        "SubagentStart" => "Agent running".to_string(),
        "SubagentStop" => "Agent finished".to_string(),
        "SessionStart" => "Session started".to_string(),
        "SessionEnd" => "Session ended".to_string(),
        "PreCompact" => "Compacting context".to_string(),
        "PostCompact" => "Compaction finished".to_string(),
        "CwdChanged" => "Working directory changed".to_string(),
        value => value.to_string(),
    }
}

fn sanitize_hook_event(input: &Value) -> Option<String> {
    first_string(&[
        string_path(input, &["hook_event_name"]),
        string_path(input, &["hookEventName"]),
        string_path(input, &["event"]),
    ])
}

fn sanitize_tool_name(input: &Value) -> Option<String> {
    first_string(&[
        string_path(input, &["tool_name"]),
        string_path(input, &["toolName"]),
        string_path(input, &["tool", "name"]),
    ])
}

fn regular_tool_name(value: Option<String>) -> Option<String> {
    value.filter(|name| !matches!(name.as_str(), "Task" | "Agent" | "TodoWrite" | "TodoRead" | "TaskCreate" | "TaskUpdate"))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ClaudePermissionDecision {
    Deny,
    Ask,
    Allow,
}

impl ClaudePermissionDecision {
    fn key(self) -> &'static str {
        match self {
            Self::Deny => "deny",
            Self::Ask => "ask",
            Self::Allow => "allow",
        }
    }
}

fn should_skip_hud_tool_approval(input: &Value, tool_name: &str) -> bool {
    if extract_permission_mode(input).as_deref() == Some("bypassPermissions") {
        return true;
    }
    matches!(
        claude_code_permission_decision(input, tool_name),
        Some(ClaudePermissionDecision::Allow | ClaudePermissionDecision::Deny)
    )
}

fn claude_code_permission_decision(input: &Value, tool_name: &str) -> Option<ClaudePermissionDecision> {
    let settings = claude_code_settings_candidates()
        .into_iter()
        .filter_map(read_json_file)
        .collect::<Vec<_>>();
    if settings.is_empty() {
        return None;
    }

    for decision in [ClaudePermissionDecision::Deny, ClaudePermissionDecision::Ask, ClaudePermissionDecision::Allow] {
        if settings
            .iter()
            .flat_map(|settings| permission_rules(settings, decision))
            .any(|rule| permission_rule_matches(&rule, input, tool_name))
        {
            return Some(decision);
        }
    }
    None
}

fn claude_code_settings_candidates() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(config_dir) = env::var_os("CLAUDE_CONFIG_DIR").map(PathBuf::from) {
        push_unique_path(&mut paths, config_dir.join("settings.json"));
        push_unique_path(&mut paths, config_dir.join("settings.local.json"));
    }
    for env_key in ["USERPROFILE", "HOME"] {
        if let Some(home) = env::var_os(env_key).map(PathBuf::from) {
            push_unique_path(&mut paths, home.join(".claude").join("settings.json"));
            push_unique_path(&mut paths, home.join(".claude").join("settings.local.json"));
        }
    }
    let mut dir = env::current_dir().ok();
    while let Some(current) = dir {
        push_unique_path(&mut paths, current.join(".claude").join("settings.json"));
        push_unique_path(&mut paths, current.join(".claude").join("settings.local.json"));
        dir = current.parent().map(Path::to_path_buf);
    }
    paths
}

fn push_unique_path(paths: &mut Vec<PathBuf>, path: PathBuf) {
    if !paths.iter().any(|existing| existing == &path) {
        paths.push(path);
    }
}

fn permission_rules(settings: &Value, decision: ClaudePermissionDecision) -> Vec<String> {
    let mut rules = settings
        .get("permissions")
        .and_then(|permissions| permissions.get(decision.key()))
        .and_then(Value::as_array)
        .map(|items| items.iter().filter_map(Value::as_str).map(ToString::to_string).collect::<Vec<_>>())
        .unwrap_or_default();
    let legacy_key = match decision {
        ClaudePermissionDecision::Allow => Some("allowedTools"),
        ClaudePermissionDecision::Deny => Some("deniedTools"),
        ClaudePermissionDecision::Ask => None,
    };
    if let Some(legacy_key) = legacy_key {
        if let Some(items) = settings.get(legacy_key).and_then(Value::as_array) {
            rules.extend(items.iter().filter_map(Value::as_str).map(ToString::to_string));
        }
    }
    rules
}

fn permission_rule_matches(rule: &str, input: &Value, tool_name: &str) -> bool {
    let rule = rule.trim();
    if rule.is_empty() {
        return false;
    }
    let Some(open_paren) = rule.find('(') else {
        return glob_match(rule, tool_name);
    };
    if !rule.ends_with(')') || open_paren == 0 {
        return glob_match(rule, tool_name);
    }
    let rule_tool = rule[..open_paren].trim();
    if !glob_match(rule_tool, tool_name) {
        return false;
    }
    let pattern = rule[open_paren + 1..rule.len() - 1].trim();
    if pattern.is_empty() {
        return true;
    }
    permission_rule_input_values(input, tool_name)
        .iter()
        .any(|value| glob_match_normalized(pattern, value))
}

fn permission_rule_input_values(input: &Value, tool_name: &str) -> Vec<String> {
    let mut values = Vec::new();
    match tool_name {
        "Bash" => push_optional_string(&mut values, string_path(input, &["tool_input", "command"])),
        "Read" | "Write" | "Edit" | "MultiEdit" | "NotebookEdit" => {
            push_optional_string(&mut values, string_path(input, &["tool_input", "file_path"]));
            push_optional_string(&mut values, string_path(input, &["tool_input", "path"]));
        }
        "Glob" | "Grep" => {
            push_optional_string(&mut values, string_path(input, &["tool_input", "path"]));
            push_optional_string(&mut values, string_path(input, &["tool_input", "pattern"]));
        }
        _ => {}
    }
    values
}

fn push_optional_string(values: &mut Vec<String>, value: Option<String>) {
    if let Some(value) = value {
        values.push(value);
    }
}

fn glob_match_normalized(pattern: &str, value: &str) -> bool {
    glob_match(pattern, value) || glob_match(&pattern.replace('\\', "/"), &value.replace('\\', "/"))
}

fn glob_match(pattern: &str, value: &str) -> bool {
    if pattern == "*" || pattern == "**" || pattern == value {
        return true;
    }
    if !pattern.contains('*') {
        return pattern == value;
    }

    let starts_with_wildcard = pattern.starts_with('*');
    let ends_with_wildcard = pattern.ends_with('*');
    let parts = pattern.split('*').filter(|part| !part.is_empty()).collect::<Vec<_>>();
    if parts.is_empty() {
        return true;
    }

    let mut offset = 0usize;
    for (index, part) in parts.iter().enumerate() {
        let Some(found) = value[offset..].find(part) else {
            return false;
        };
        if index == 0 && !starts_with_wildcard && found != 0 {
            return false;
        }
        offset += found + part.len();
    }

    if !ends_with_wildcard {
        if let Some(last) = parts.last() {
            return value.ends_with(last);
        }
    }
    true
}

fn extract_permission_mode(input: &Value) -> Option<String> {
    first_string(&[
        string_path(input, &["permission_mode"]),
        string_path(input, &["permissionMode"]),
    ])
}

fn context_window_override_size() -> Option<f64> {
    env::var("CLAUDE_HUD_CONTEXT_WINDOW_SIZE")
        .ok()
        .and_then(|value| value.trim().parse::<f64>().ok())
        .filter(|value| *value > 0.0)
}

fn sanitize_added_dirs(workspace: Option<&Value>) -> (Vec<String>, usize) {
    let Some(dirs) = workspace
        .and_then(|workspace| workspace.get("added_dirs").or_else(|| workspace.get("addedDirs")))
        .and_then(Value::as_array)
    else {
        return (Vec::new(), 0);
    };
    let mut slugs = Vec::new();
    for dir in dirs.iter().filter_map(Value::as_str) {
        if let Some(slug) = base_name(dir) {
            if !slugs.contains(&slug) {
                slugs.push(slug);
            }
        }
        if slugs.len() >= 4 {
            break;
        }
    }
    let overflow = dirs.len().saturating_sub(slugs.len());
    (slugs, overflow)
}

fn string_path(input: &Value, path: &[&str]) -> Option<String> {
    let mut current = input;
    for key in path {
        current = current.get(*key)?;
    }
    current
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn number_path(input: &Value, path: &[&str]) -> Option<f64> {
    let mut current = input;
    for key in path {
        current = current.get(*key)?;
    }
    value_number(current)
}

fn bool_path(input: &Value, path: &[&str]) -> Option<bool> {
    let mut current = input;
    for key in path {
        current = current.get(*key)?;
    }
    current.as_bool()
}

fn value_number(value: &Value) -> Option<f64> {
    value
        .as_f64()
        .or_else(|| value.as_str().and_then(|text| text.trim().parse::<f64>().ok()))
        .filter(|value| value.is_finite())
}

fn state_string(state: &Value, key: &str) -> Option<String> {
    state
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn state_number(state: &Value, key: &str) -> Option<f64> {
    state.get(key).and_then(value_number)
}

fn first_string(values: &[Option<String>]) -> Option<String> {
    values
        .iter()
        .filter_map(|value| value.as_ref())
        .map(|value| value.trim())
        .find(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn first_number(values: &[Option<f64>]) -> Option<f64> {
    values.iter().copied().flatten().next()
}

fn positive_number(value: Option<f64>) -> Option<f64> {
    value.filter(|value| *value > 0.0)
}

fn sum_non_negative(values: &[Option<f64>]) -> Option<f64> {
    let numbers = values
        .iter()
        .copied()
        .flatten()
        .filter(|value| *value >= 0.0)
        .collect::<Vec<_>>();
    if numbers.is_empty() {
        None
    } else {
        Some(numbers.iter().sum())
    }
}

fn compact_percent(value: Option<f64>) -> Option<f64> {
    value.map(|number| number.round().clamp(0.0, 100.0))
}

fn format_token_k(tokens: f64, allow_zero: bool) -> Option<String> {
    if tokens < 0.0 || (!allow_zero && tokens == 0.0) {
        return None;
    }
    Some(if tokens == 0.0 {
        "0".to_string()
    } else if tokens < 1_000.0 {
        format!("{} tokens", tokens.round())
    } else if tokens < 10_000.0 {
        format!("{:.1}K", tokens / 1_000.0)
    } else if tokens < 1_000_000.0 {
        format!("{}K", (tokens / 1_000.0).round())
    } else {
        format!("{:.1}M", tokens / 1_000_000.0)
    })
}

fn insert_string(state: &mut Map<String, Value>, key: &str, value: Option<String>) {
    state.insert(key.to_string(), value.map(Value::String).unwrap_or(Value::Null));
}

fn insert_number(state: &mut Map<String, Value>, key: &str, value: Option<f64>) {
    state.insert(key.to_string(), value.map(|value| json!(value)).unwrap_or(Value::Null));
}

fn insert_bool(state: &mut Map<String, Value>, key: &str, value: Option<bool>) {
    state.insert(key.to_string(), value.map(|value| json!(value)).unwrap_or(Value::Null));
}

fn insert_null(state: &mut Map<String, Value>, key: &str) {
    state.insert(key.to_string(), Value::Null);
}

fn is_null_or_missing(value: Option<&Value>) -> bool {
    value.map(Value::is_null).unwrap_or(true)
}

fn base_name(value: &str) -> Option<String> {
    value
        .replace('\\', "/")
        .split('/')
        .filter(|part| !part.trim().is_empty())
        .last()
        .map(ToString::to_string)
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

fn short_session_id(value: &str) -> String {
    value.chars().take(8).collect()
}

fn env_u64(key: &str, default: u64) -> u64 {
    env::var(key)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .unwrap_or(default)
}

fn iso_now() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn iso_from_ms(ms: u128) -> String {
    let seconds = (ms / 1000).min(i64::MAX as u128) as i64;
    OffsetDateTime::from_unix_timestamp(seconds)
        .ok()
        .and_then(|time| time.format(&Rfc3339).ok())
        .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string())
}

fn iso_string_from_input(input: &Value, path: &[&str]) -> Option<String> {
    let value = string_path(input, path)?;
    if ms_from_iso(&value).is_some() {
        Some(value)
    } else {
        None
    }
}

fn ms_from_iso(value: &str) -> Option<u128> {
    OffsetDateTime::parse(value, &Rfc3339)
        .ok()
        .and_then(|time| time.unix_timestamp_nanos().try_into().ok())
        .map(|nanos: u128| nanos / 1_000_000)
}

fn unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::*;

    static TEST_LOCK: Mutex<()> = Mutex::new(());

    const STATUSLINE_BASIC: &str = include_str!("../../../schemas/hud-bridge/fixtures/statusline-basic.json");
    const PRETOOLUSE_APPROVAL: &str = include_str!("../../../schemas/hud-bridge/fixtures/hook-pretooluse-approval.json");
    const USER_PROMPT: &str = include_str!("../../../schemas/hud-bridge/fixtures/hook-user-prompt-submit.json");
    const NOTIFICATION_QUESTION: &str = include_str!("../../../schemas/hud-bridge/fixtures/hook-notification-question.json");
    const MALFORMED: &str = include_str!("../../../schemas/hud-bridge/fixtures/malformed-stdin.txt");

    struct EnvGuard {
        original_appdata: Option<String>,
        original_wait: Option<String>,
        original_context_window: Option<String>,
        original_userprofile: Option<String>,
        original_home: Option<String>,
        original_claude_config_dir: Option<String>,
        original_dir: PathBuf,
        root: PathBuf,
    }

    impl EnvGuard {
        fn new() -> Self {
            let original_appdata = env::var("APPDATA").ok();
            let original_wait = env::var("CLAUDE_HUD_ONE_PENDING_RESPONSE_WAIT_MS").ok();
            let original_context_window = env::var("CLAUDE_HUD_CONTEXT_WINDOW_SIZE").ok();
            let original_userprofile = env::var("USERPROFILE").ok();
            let original_home = env::var("HOME").ok();
            let original_claude_config_dir = env::var("CLAUDE_CONFIG_DIR").ok();
            let original_dir = env::current_dir().unwrap();
            let root = env::temp_dir().join(format!("claude-hud-one-bridge-test-{}-{}", std::process::id(), unix_millis()));
            let project = root.join("project");
            fs::create_dir_all(&project).unwrap();
            env::set_var("APPDATA", root.join("appdata"));
            env::set_var("USERPROFILE", root.join("home"));
            env::set_var("HOME", root.join("home"));
            env::set_var("CLAUDE_CONFIG_DIR", root.join("claude-config"));
            env::set_var("CLAUDE_HUD_ONE_PENDING_RESPONSE_WAIT_MS", "0");
            env::remove_var("CLAUDE_HUD_CONTEXT_WINDOW_SIZE");
            env::set_current_dir(&project).unwrap();
            Self {
                original_appdata,
                original_wait,
                original_context_window,
                original_userprofile,
                original_home,
                original_claude_config_dir,
                original_dir,
                root,
            }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            env::set_current_dir(&self.original_dir).unwrap();
            match &self.original_appdata {
                Some(value) => env::set_var("APPDATA", value),
                None => env::remove_var("APPDATA"),
            }
            match &self.original_wait {
                Some(value) => env::set_var("CLAUDE_HUD_ONE_PENDING_RESPONSE_WAIT_MS", value),
                None => env::remove_var("CLAUDE_HUD_ONE_PENDING_RESPONSE_WAIT_MS"),
            }
            match &self.original_context_window {
                Some(value) => env::set_var("CLAUDE_HUD_CONTEXT_WINDOW_SIZE", value),
                None => env::remove_var("CLAUDE_HUD_CONTEXT_WINDOW_SIZE"),
            }
            match &self.original_userprofile {
                Some(value) => env::set_var("USERPROFILE", value),
                None => env::remove_var("USERPROFILE"),
            }
            match &self.original_home {
                Some(value) => env::set_var("HOME", value),
                None => env::remove_var("HOME"),
            }
            match &self.original_claude_config_dir {
                Some(value) => env::set_var("CLAUDE_CONFIG_DIR", value),
                None => env::remove_var("CLAUDE_CONFIG_DIR"),
            }
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn hud_bridge_statusline_writes_state_without_raw_secret() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();

        let output = run_bridge_once(STATUSLINE_BASIC, BridgeMode::StatusLine);

        assert!(output.stdout.contains("Claude Opus 4.8"));
        assert!(output.stdout.contains("10%"));
        assert!(output.stdout.contains("█"));
        assert!(output.stdout.contains('\n'));
        assert_ne!(output.stdout, FALLBACK_STATUS);

        let state_path = guard.root.join("appdata").join(APP_NAME).join("claude-status.json");
        let serialized = fs::read_to_string(state_path).unwrap();
        assert!(serialized.contains("statusLine"));
        assert!(serialized.contains("Claude Opus 4.8"));
        assert!(!serialized.contains("SECRET_PROMPT_SHOULD_NOT_LEAK"));
        assert!(!serialized.contains("SECRET_COMMAND_ARGS_SHOULD_NOT_LEAK"));
    }

    #[test]
    fn hud_bridge_terminal_hud_respects_settings_rows() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();
        let settings_dir = guard.root.join("appdata").join(APP_NAME);
        fs::create_dir_all(&settings_dir).unwrap();
        fs::write(
            settings_dir.join("settings.json"),
            serde_json::to_string_pretty(&json!({
                "terminalHud": {
                    "rows": [["model"], ["contextBar", "contextValue"]],
                    "display": { "showModel": true, "showContextBar": true, "contextValue": "percent" },
                    "colors": { "barFilled": "█", "barEmpty": "░" }
                }
            }))
            .unwrap(),
        )
        .unwrap();

        let output = run_bridge_once(STATUSLINE_BASIC, BridgeMode::StatusLine);

        assert!(output.stdout.contains("Claude Opus 4.8"));
        assert!(output.stdout.contains("10%"));
        assert!(output.stdout.contains("█"));
        assert!(output.stdout.contains('\n'));
        assert!(!output.stdout.contains("Tokens"));
    }

    #[test]
    fn hud_bridge_statusline_without_running_work_is_idle() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();

        let output = run_bridge_once(STATUSLINE_BASIC, BridgeMode::StatusLine);

        assert!(output.stdout.contains("Session idle"));
        let state_path = guard.root.join("appdata").join(APP_NAME).join("claude-status.json");
        let state = serde_json::from_str::<Value>(&fs::read_to_string(state_path).unwrap()).unwrap();
        assert_eq!(state.get("activity").and_then(Value::as_str), Some("idle"));
        assert_eq!(state.get("statusText").and_then(Value::as_str), Some("Session idle"));
    }

    #[test]
    fn hud_bridge_statusline_with_running_work_is_running() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();
        let mut statusline = serde_json::from_str::<Value>(STATUSLINE_BASIC).unwrap();
        if let Some(object) = statusline.as_object_mut() {
            object.insert("tools".to_string(), json!({ "running": 1, "total": 1 }));
        }

        let output = run_bridge_once(&serde_json::to_string(&statusline).unwrap(), BridgeMode::StatusLine);

        assert_ne!(output.stdout, FALLBACK_STATUS);
        let state_path = guard.root.join("appdata").join(APP_NAME).join("claude-status.json");
        let state = serde_json::from_str::<Value>(&fs::read_to_string(state_path).unwrap()).unwrap();
        assert_eq!(state.get("activity").and_then(Value::as_str), Some("running"));
        assert_eq!(state.get("statusText").and_then(Value::as_str), Some("Tool running"));
    }

    #[test]
    fn hud_bridge_pretooluse_writes_pending_request_and_defers() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();

        let output = run_bridge_once(PRETOOLUSE_APPROVAL, BridgeMode::Hook);

        assert!(output.stdout.contains("permissionDecision"));
        assert!(output.stdout.contains("defer"));
        let requests_dir = guard
            .root
            .join("appdata")
            .join(APP_NAME)
            .join("pending-intents")
            .join("requests");
        let requests = fs::read_dir(requests_dir).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
        assert_eq!(requests.len(), 1);
        let request = fs::read_to_string(requests[0].path()).unwrap();
        assert!(request.contains("allowOnce"));
        assert!(request.contains("nonce"));
        assert!(!request.contains("SECRET_COMMAND_ARGS_SHOULD_NOT_LEAK"));
    }

    #[test]
    fn hud_bridge_bypass_permissions_skips_hud_approval() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();
        let mut pretool = serde_json::from_str::<Value>(PRETOOLUSE_APPROVAL).unwrap();
        if let Some(object) = pretool.as_object_mut() {
            object.insert("permission_mode".to_string(), json!("bypassPermissions"));
        }

        let output = run_bridge_once(&serde_json::to_string(&pretool).unwrap(), BridgeMode::Hook);

        assert!(output.stdout.is_empty());
        let state_path = guard.root.join("appdata").join(APP_NAME).join("claude-status.json");
        let state = serde_json::from_str::<Value>(&fs::read_to_string(state_path).unwrap()).unwrap();
        assert!(state.get("pendingQueue").map(Value::is_null).unwrap_or(true));
        let requests_dir = guard.root.join("appdata").join(APP_NAME).join("pending-intents").join("requests");
        assert!(!requests_dir.exists());
    }

    #[test]
    fn hud_bridge_claude_allow_rule_skips_hud_approval() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();
        let claude_dir = env::current_dir().unwrap().join(".claude");
        fs::create_dir_all(&claude_dir).unwrap();
        fs::write(
            claude_dir.join("settings.json"),
            serde_json::to_string_pretty(&json!({
                "permissions": {
                    "allow": ["Bash(*)"]
                }
            }))
            .unwrap(),
        )
        .unwrap();

        let output = run_bridge_once(PRETOOLUSE_APPROVAL, BridgeMode::Hook);

        assert!(output.stdout.is_empty());
        let state_path = guard.root.join("appdata").join(APP_NAME).join("claude-status.json");
        let state = serde_json::from_str::<Value>(&fs::read_to_string(state_path).unwrap()).unwrap();
        assert!(state.get("pendingQueue").map(Value::is_null).unwrap_or(true));
        let requests_dir = guard.root.join("appdata").join(APP_NAME).join("pending-intents").join("requests");
        assert!(!requests_dir.exists());
    }

    #[test]
    fn hud_bridge_posttooluse_clears_running_counts() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();
        let pretool = serde_json::from_str::<Value>(PRETOOLUSE_APPROVAL).unwrap();
        let mut posttool = pretool.clone();
        if let Some(object) = posttool.as_object_mut() {
            object.insert("hook_event_name".to_string(), json!("PostToolUse"));
        }

        let pre_output = run_bridge_once(&serde_json::to_string(&pretool).unwrap(), BridgeMode::Hook);
        assert!(pre_output.stdout.contains("defer"));
        let post_output = run_bridge_once(&serde_json::to_string(&posttool).unwrap(), BridgeMode::Hook);
        assert!(post_output.stdout.is_empty());

        let state_path = guard.root.join("appdata").join(APP_NAME).join("claude-status.json");
        let state = serde_json::from_str::<Value>(&fs::read_to_string(state_path).unwrap()).unwrap();
        assert_eq!(state.get("activity").and_then(Value::as_str), Some("idle"));
        assert_eq!(state.get("toolsRunningCount").and_then(Value::as_f64), Some(0.0));
        assert_eq!(state.get("agentsRunningCount").and_then(Value::as_f64), Some(0.0));
        assert_eq!(state.get("todosActiveCount").and_then(Value::as_f64), Some(0.0));
        let items = state
            .get("pendingQueue")
            .and_then(|queue| queue.get("items"))
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        assert!(items.is_empty());
    }

    #[test]
    fn hud_bridge_stop_does_not_create_attention_question() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();
        let stop = json!({
            "hook_event_name": "Stop",
            "session_id": "stop-session",
            "session_name": "Stop Session",
            "cwd": "E:/Develop_E/stop-session"
        });

        let output = run_bridge_once(&serde_json::to_string(&stop).unwrap(), BridgeMode::Hook);
        assert!(output.stdout.is_empty());

        let state_path = guard.root.join("appdata").join(APP_NAME).join("claude-status.json");
        let state = serde_json::from_str::<Value>(&fs::read_to_string(state_path).unwrap()).unwrap();
        assert_eq!(state.get("activity").and_then(Value::as_str), Some("idle"));
        assert_eq!(state.get("statusText").and_then(Value::as_str), Some("Session idle"));
        let items = state
            .get("pendingQueue")
            .and_then(|queue| queue.get("items"))
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        assert!(items.is_empty());
    }

    #[test]
    fn hud_bridge_user_prompt_submit_is_active_not_running() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();

        let output = run_bridge_once(USER_PROMPT, BridgeMode::Hook);

        assert!(output.stdout.is_empty());
        let state_path = guard.root.join("appdata").join(APP_NAME).join("claude-status.json");
        let state = serde_json::from_str::<Value>(&fs::read_to_string(state_path).unwrap()).unwrap();
        assert_eq!(state.get("hookEventName").and_then(Value::as_str), Some("UserPromptSubmit"));
        assert_eq!(state.get("activity").and_then(Value::as_str), Some("active"));
        assert_eq!(state.get("statusText").and_then(Value::as_str), Some("Prompt submitted"));
    }

    #[test]
    fn hud_bridge_message_display_marks_response_running() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();
        let mut message = serde_json::from_str::<Value>(USER_PROMPT).unwrap();
        if let Some(object) = message.as_object_mut() {
            object.insert("hook_event_name".to_string(), json!("MessageDisplay"));
        }

        let output = run_bridge_once(&serde_json::to_string(&message).unwrap(), BridgeMode::Hook);

        assert!(output.stdout.is_empty());
        let state_path = guard.root.join("appdata").join(APP_NAME).join("claude-status.json");
        let state = serde_json::from_str::<Value>(&fs::read_to_string(state_path).unwrap()).unwrap();
        assert_eq!(state.get("hookEventName").and_then(Value::as_str), Some("MessageDisplay"));
        assert_eq!(state.get("activity").and_then(Value::as_str), Some("running"));
        assert_eq!(state.get("statusText").and_then(Value::as_str), Some("Generating response"));
    }

    #[test]
    fn hud_bridge_statusline_preserves_recent_message_display_running_signal() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();
        let mut message = serde_json::from_str::<Value>(USER_PROMPT).unwrap();
        if let Some(object) = message.as_object_mut() {
            object.insert("hook_event_name".to_string(), json!("MessageDisplay"));
        }
        let statusline = json!({
            "session_id": "fixture-session-001",
            "session_name": "Fixture Session",
            "cwd": "E:/Develop_E/claude-hud-one",
            "model": { "display_name": "Claude Opus 4.8" }
        });

        let hook_output = run_bridge_once(&serde_json::to_string(&message).unwrap(), BridgeMode::Hook);
        assert!(hook_output.stdout.is_empty());
        let status_output = run_bridge_once(&serde_json::to_string(&statusline).unwrap(), BridgeMode::StatusLine);
        assert!(status_output.stdout.contains("Generating response"));

        let state_path = guard.root.join("appdata").join(APP_NAME).join("claude-status.json");
        let state = serde_json::from_str::<Value>(&fs::read_to_string(state_path).unwrap()).unwrap();
        assert_eq!(state.get("activity").and_then(Value::as_str), Some("running"));
        assert_eq!(state.get("hookEventName").and_then(Value::as_str), Some("MessageDisplay"));
        assert_eq!(state.get("statusText").and_then(Value::as_str), Some("Generating response"));
        assert!(state.get("lastRunningSignalAt").and_then(Value::as_str).is_some());
    }

    #[test]
    fn hud_bridge_subagent_start_marks_agent_running() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();
        let mut subagent = serde_json::from_str::<Value>(USER_PROMPT).unwrap();
        if let Some(object) = subagent.as_object_mut() {
            object.insert("hook_event_name".to_string(), json!("SubagentStart"));
        }

        let output = run_bridge_once(&serde_json::to_string(&subagent).unwrap(), BridgeMode::Hook);

        assert!(output.stdout.is_empty());
        let state_path = guard.root.join("appdata").join(APP_NAME).join("claude-status.json");
        let state = serde_json::from_str::<Value>(&fs::read_to_string(state_path).unwrap()).unwrap();
        assert_eq!(state.get("activity").and_then(Value::as_str), Some("running"));
        assert_eq!(state.get("agentsRunningCount").and_then(Value::as_f64), Some(1.0));
    }

    #[test]
    fn hud_bridge_non_blocking_hooks_do_not_echo_sensitive_text() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();

        let prompt_output = run_bridge_once(USER_PROMPT, BridgeMode::Hook);
        assert!(prompt_output.stdout.is_empty());
        let notification_output = run_bridge_once(NOTIFICATION_QUESTION, BridgeMode::Hook);
        assert!(notification_output.stdout.is_empty());

        let state_path = guard.root.join("appdata").join(APP_NAME).join("claude-status.json");
        let serialized = fs::read_to_string(state_path).unwrap();
        assert!(serialized.contains("question"));
        assert!(!serialized.contains("answerIntent"));
        assert!(!serialized.contains("SECRET_PROMPT_SHOULD_NOT_LEAK"));
        assert!(!serialized.contains("SECRET_NOTIFICATION_TEXT_SHOULD_NOT_LEAK"));
    }

    #[test]
    fn hud_bridge_statusline_does_not_reuse_global_state_from_other_session() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();
        let settings_dir = guard.root.join("appdata").join(APP_NAME);
        fs::create_dir_all(&settings_dir).unwrap();
        fs::write(
            settings_dir.join("settings.json"),
            serde_json::to_string_pretty(&json!({
                "terminalHud": {
                    "rows": [["sessionTokens"], ["activity"]],
                    "display": { "showSessionTokens": true, "showTodos": true, "showAgents": true, "showTools": true }
                }
            }))
            .unwrap(),
        )
        .unwrap();

        let session_a = json!({
            "session_id": "session-a",
            "session_name": "A",
            "cwd": "E:/Develop_E/project-a",
            "model": { "display_name": "Claude Opus 4.8" },
            "sessionTokens": {
                "inputTokens": 1000,
                "outputTokens": 2000,
                "cacheReadInputTokens": 3000
            },
            "todos": { "active": 1, "completed": 2, "total": 3 },
            "agents": { "count": 1, "running": 1 },
            "tools": { "count": 1, "running": 1 }
        });
        let session_b = json!({
            "session_id": "session-b",
            "session_name": "B",
            "cwd": "E:/Develop_E/project-b",
            "model": { "display_name": "Claude Sonnet 4.6" }
        });

        let first = run_bridge_once(&serde_json::to_string(&session_a).unwrap(), BridgeMode::StatusLine);
        assert!(first.stdout.contains("Tokens"));
        assert!(first.stdout.contains("Todo"));

        let second = run_bridge_once(&serde_json::to_string(&session_b).unwrap(), BridgeMode::StatusLine);

        assert!(second.stdout.contains("Tokens"));
        assert!(second.stdout.contains("0 (in: 0, out: 0, cache: 0)"));
        assert!(!second.stdout.contains("Todo"));
        assert!(!second.stdout.contains("Agents"));
        assert!(!second.stdout.contains("Tools"));
        let session_b_state = guard
            .root
            .join("appdata")
            .join(APP_NAME)
            .join("sessions")
            .join("session-b.json");
        let serialized = fs::read_to_string(session_b_state).unwrap();
        assert!(serialized.contains("session-b"));
        assert!(!serialized.contains("inputTokens\":1000"));
        assert!(!serialized.contains("todosActiveCount\":1"));
    }

    #[test]
    fn hud_bridge_statusline_drops_stale_live_metrics_from_same_session_when_absent() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();
        let settings_dir = guard.root.join("appdata").join(APP_NAME);
        fs::create_dir_all(&settings_dir).unwrap();
        fs::write(
            settings_dir.join("settings.json"),
            serde_json::to_string_pretty(&json!({
                "terminalHud": {
                    "rows": [["sessionTokens"], ["sessionTime"], ["activity"]],
                    "display": { "showSessionTokens": true, "showTodos": true, "showAgents": true, "showTools": true }
                }
            }))
            .unwrap(),
        )
        .unwrap();

        let contaminated_session = json!({
            "session_id": "session-c",
            "session_name": "C",
            "cwd": "E:/Develop_E/project-c",
            "model": { "display_name": "Claude Opus 4.8" },
            "sessionTokens": {
                "inputTokens": 1000,
                "outputTokens": 2000,
                "cacheReadInputTokens": 3000
            },
            "sessionStartedAt": "2026-06-22T00:25:12.065Z",
            "todos": { "active": 1, "completed": 22, "total": 23 },
            "agents": { "count": 1, "running": 1 },
            "tools": { "count": 1, "running": 1 }
        });
        let clean_statusline = json!({
            "session_id": "session-c",
            "session_name": "C",
            "cwd": "E:/Develop_E/project-c",
            "model": { "display_name": "Claude Sonnet 4.6" }
        });

        let first = run_bridge_once(&serde_json::to_string(&contaminated_session).unwrap(), BridgeMode::StatusLine);
        assert!(first.stdout.contains("Tokens"));
        assert!(first.stdout.contains("Todo"));

        let second = run_bridge_once(&serde_json::to_string(&clean_statusline).unwrap(), BridgeMode::StatusLine);

        assert!(second.stdout.contains("Tokens"));
        assert!(second.stdout.contains("0 (in: 0, out: 0, cache: 0)"));
        assert!(!second.stdout.contains("Started"));
        assert!(!second.stdout.contains("Todo"));
        assert!(!second.stdout.contains("Agents"));
        assert!(!second.stdout.contains("Tools"));
        let session_state = guard
            .root
            .join("appdata")
            .join(APP_NAME)
            .join("sessions")
            .join("session-c.json");
        let serialized = fs::read_to_string(session_state).unwrap();
        assert!(serialized.contains("session-c"));
        assert!(!serialized.contains("inputTokens\":1000"));
        assert!(!serialized.contains("todosCompletedCount\":22"));
    }

    #[test]
    fn hud_bridge_session_tokens_show_zero_for_new_session() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();
        let settings_dir = guard.root.join("appdata").join(APP_NAME);
        fs::create_dir_all(&settings_dir).unwrap();
        fs::write(
            settings_dir.join("settings.json"),
            serde_json::to_string_pretty(&json!({
                "terminalHud": {
                    "rows": [["sessionTokens"]],
                    "display": { "showSessionTokens": true, "showTokenBreakdown": true }
                }
            }))
            .unwrap(),
        )
        .unwrap();
        let statusline = json!({
            "session_id": "new-zero-session",
            "session_name": "New Zero",
            "cwd": "E:/Develop_E/new-zero",
            "model": { "display_name": "Claude Sonnet 4.6" }
        });

        let output = run_bridge_once(&serde_json::to_string(&statusline).unwrap(), BridgeMode::StatusLine);

        assert!(output.stdout.contains("Tokens"));
        assert!(output.stdout.contains("0 (in: 0, out: 0, cache: 0)"));
    }

    #[test]
    fn hud_bridge_statusline_restores_completed_activity_from_transcript() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();
        let settings_dir = guard.root.join("appdata").join(APP_NAME);
        fs::create_dir_all(&settings_dir).unwrap();
        fs::write(
            settings_dir.join("settings.json"),
            serde_json::to_string_pretty(&json!({
                "terminalHud": {
                    "rows": [["activity"]],
                    "display": { "showTodos": true, "showAgents": true, "showTools": true }
                }
            }))
            .unwrap(),
        )
        .unwrap();
        let transcript_path = guard.root.join("session-transcript.jsonl");
        fs::write(
            &transcript_path,
            [
                serde_json::to_string(&json!({
                    "type": "assistant",
                    "timestamp": "2026-06-22T00:25:12.065Z",
                    "message": {
                        "role": "assistant",
                        "usage": {
                            "input_tokens": 100,
                            "output_tokens": 20,
                            "cache_read_input_tokens": 300
                        },
                        "content": [
                            { "type": "tool_use", "id": "tool-1", "name": "Read", "input": {} },
                            { "type": "tool_use", "id": "agent-1", "name": "Task", "input": {} },
                            { "type": "tool_use", "id": "todo-1", "name": "TodoWrite", "input": { "todos": [
                                { "status": "completed" },
                                { "status": "in_progress" }
                            ] } }
                        ]
                    }
                })).unwrap(),
                serde_json::to_string(&json!({
                    "type": "user",
                    "timestamp": "2026-06-22T00:26:12.065Z",
                    "message": {
                        "role": "user",
                        "content": [
                            { "type": "tool_result", "tool_use_id": "tool-1" },
                            { "type": "tool_result", "tool_use_id": "agent-1" }
                        ]
                    }
                })).unwrap(),
            ]
            .join("\n"),
        )
        .unwrap();
        let statusline = json!({
            "session_id": "session-transcript",
            "session_name": "Transcript",
            "cwd": "E:/Develop_E/project-transcript",
            "transcript_path": transcript_path.to_string_lossy(),
            "model": { "display_name": "Claude Sonnet 4.6" }
        });

        let output = run_bridge_once(&serde_json::to_string(&statusline).unwrap(), BridgeMode::StatusLine);

        assert!(output.stdout.contains("Todo"));
        assert!(output.stdout.contains("Agents"));
        assert!(output.stdout.contains("Tools"));
        assert!(output.stdout.contains("1"));
    }

    #[test]
    fn hud_bridge_statusline_uses_transcript_path_as_resume_session_key() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();
        let transcript_path = guard.root.join("resume-transcript.jsonl");
        fs::write(&transcript_path, "").unwrap();
        let first = json!({
            "session_id": "resume-session-before",
            "session_name": "Resume Fixture",
            "cwd": "E:/Develop_E/resume-fixture",
            "transcript_path": transcript_path.to_string_lossy(),
            "model": { "display_name": "Claude Sonnet 4.6" }
        });
        let second = json!({
            "session_id": "resume-session-after",
            "session_name": "Resume Fixture",
            "cwd": "E:/Develop_E/resume-fixture",
            "transcript_path": transcript_path.to_string_lossy(),
            "model": { "display_name": "Claude Sonnet 4.6" }
        });

        run_bridge_once(&serde_json::to_string(&first).unwrap(), BridgeMode::StatusLine);
        run_bridge_once(&serde_json::to_string(&second).unwrap(), BridgeMode::StatusLine);

        let state_path = guard.root.join("appdata").join(APP_NAME).join("claude-status.json");
        let state = serde_json::from_str::<Value>(&fs::read_to_string(state_path).unwrap()).unwrap();
        let expected_key = safe_path_segment(&transcript_path.to_string_lossy()).unwrap();
        assert_eq!(state.get("sessionKey").and_then(Value::as_str), Some(expected_key.as_str()));
        assert_eq!(state.get("sessionId").and_then(Value::as_str), Some("resume-session-after"));
        let sessions_dir = guard.root.join("appdata").join(APP_NAME).join("sessions");
        let session_files = fs::read_dir(sessions_dir).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
        assert_eq!(session_files.len(), 1);
    }

    #[test]
    fn hud_bridge_statusline_ignores_stale_unpaired_transcript_tool_as_running() {
        let _lock = TEST_LOCK.lock().unwrap();
        let guard = EnvGuard::new();
        let transcript_path = guard.root.join("stale-running-transcript.jsonl");
        fs::write(
            &transcript_path,
            serde_json::to_string(&json!({
                "type": "assistant",
                "timestamp": "2026-06-22T00:25:12.065Z",
                "message": {
                    "role": "assistant",
                    "content": [
                        { "type": "tool_use", "id": "old-tool-1", "name": "Read", "input": {} },
                        { "type": "tool_use", "id": "old-agent-1", "name": "Task", "input": {} }
                    ]
                }
            })).unwrap(),
        )
        .unwrap();
        let statusline = json!({
            "session_id": "stale-transcript-session",
            "session_name": "Stale Transcript",
            "cwd": "E:/Develop_E/stale-transcript",
            "transcript_path": transcript_path.to_string_lossy(),
            "model": { "display_name": "Claude Sonnet 4.6" }
        });

        run_bridge_once(&serde_json::to_string(&statusline).unwrap(), BridgeMode::StatusLine);

        let state_path = guard.root.join("appdata").join(APP_NAME).join("claude-status.json");
        let state = serde_json::from_str::<Value>(&fs::read_to_string(state_path).unwrap()).unwrap();
        assert_eq!(state.get("activity").and_then(Value::as_str), Some("idle"));
        assert_eq!(state.get("toolsCount").and_then(Value::as_f64), Some(1.0));
        assert_eq!(state.get("agentsCount").and_then(Value::as_f64), Some(1.0));
        assert!(state.get("toolsRunningCount").and_then(Value::as_f64).unwrap_or(0.0) == 0.0);
        assert!(state.get("agentsRunningCount").and_then(Value::as_f64).unwrap_or(0.0) == 0.0);
    }

    #[test]
    fn hud_bridge_malformed_statusline_falls_back_without_error() {
        let _lock = TEST_LOCK.lock().unwrap();
        let _guard = EnvGuard::new();

        let output = run_bridge_once(MALFORMED, BridgeMode::StatusLine);

        assert_eq!(output.stdout, FALLBACK_STATUS);
    }
}
