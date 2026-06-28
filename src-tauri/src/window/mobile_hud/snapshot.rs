use std::{
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use serde_json::Value;
use sha2::{Digest, Sha256};
use time::{format_description::well_known::Rfc3339, Duration, OffsetDateTime};
use uuid::Uuid;

use crate::window::{
    claude_status::{ClaudeStatusBridgeState, PendingQueueItem},
    settings::AppSettings,
    usage_cost::LiveUsageCostSnapshot,
};

use super::types::{
    MobileHudAttentionItem, MobileHudCapsule, MobileHudCompletionCard, MobileHudDisplayItem,
    MobileHudDisplayPolicy, MobileHudEnvelope, MobileHudNotificationEvent, MobileHudSessionCard,
    MobileHudSummary, MobileHudViewModel,
};

const PROTOCOL_VERSION: u8 = 1;
const DEFAULT_VISIBLE_ITEMS: [&str; 14] = [
    "activity",
    "project",
    "model",
    "tools",
    "contextValue",
    "sessionTokens",
    "usage",
    "cost",
    "git",
    "addedDirs",
    "agents",
    "todos",
    "speed",
    "effortLevel",
];
const MOBILE_SESSION_FRESH_SECONDS: i64 = 10 * 60;
#[cfg(test)]
const SENSITIVE_KEYWORDS: [&str; 14] = [
    "\"transcriptPath\"",
    "\"projectDir\"",
    "\"cwd\"",
    "\"terminal\"",
    "\"intentId\"",
    "\"allowedIntents\"",
    "\"nonce\"",
    "\"rawInput\"",
    "\"rawOutput\"",
    "\"toolInput\"",
    "\"toolResult\"",
    "\"wtSession\"",
    "\"windowTitleHint\"",
    "\"bridgeProcessId\"",
];

pub fn build_mobile_hud_envelope(
    sessions: Vec<ClaudeStatusBridgeState>,
    usage: LiveUsageCostSnapshot,
    settings: AppSettings,
) -> MobileHudEnvelope {
    let payload = build_mobile_hud_view_model(sessions, usage, settings);
    MobileHudEnvelope {
        protocol_version: PROTOCOL_VERSION,
        message_id: format!("msg_{}", Uuid::new_v4()),
        seq: payload.snapshot_version,
        kind: "snapshot".to_string(),
        sent_at: payload.generated_at.clone(),
        snapshot_version: Some(payload.snapshot_version),
        payload,
    }
}

pub fn build_mobile_hud_view_model(
    sessions: Vec<ClaudeStatusBridgeState>,
    usage: LiveUsageCostSnapshot,
    settings: AppSettings,
) -> MobileHudViewModel {
    let now = OffsetDateTime::now_utc();
    let generated_at = format_rfc3339(now);
    let snapshot_version = unix_millis();
    let visible_items = mobile_visible_items(&settings.mobile_hud);
    let hidden_by_desktop_config = hidden_by_desktop_config(&settings.desktop_hud, &visible_items);
    let notifications_enabled =
        json_bool(&settings.mobile_hud, &["notifications", "enabled"]).unwrap_or(true);

    let fresh_sessions = sessions
        .into_iter()
        .filter(|session| bridge_session_is_fresh(session, now))
        .collect::<Vec<_>>();
    let mut cards = fresh_sessions.iter().map(session_card).collect::<Vec<_>>();
    cards.sort_by(|left, right| {
        mobile_activity_rank(&left.activity)
            .cmp(&mobile_activity_rank(&right.activity))
            .then_with(|| right.updated_at.cmp(&left.updated_at))
    });
    let attention = fresh_sessions
        .iter()
        .flat_map(|session| attention_items_for_session(session, now))
        .collect::<Vec<_>>();
    let notification_events = attention
        .iter()
        .map(waiting_attention_notification)
        .collect::<Vec<_>>();
    let primary = cards.first();
    let status = primary
        .map(|card| card.activity.clone())
        .unwrap_or_else(|| "idle".to_string());
    let status_text = primary
        .map(|card| card.status_text.clone())
        .unwrap_or_else(|| "Claude Code status is waiting for a bridge update.".to_string());
    let model_label = primary.and_then(|card| card.model_label.clone());
    let project_label = primary.map(|card| card.project_label.clone());
    let ticker = build_ticker(primary, &usage, &visible_items);

    MobileHudViewModel {
        protocol_version: PROTOCOL_VERSION,
        snapshot_version,
        snapshot_id: format!("snap_{}", Uuid::new_v4()),
        generated_at: generated_at.clone(),
        display_mode: "trustedAppView".to_string(),
        privacy_level: "trustedAppView".to_string(),
        summary: MobileHudSummary {
            status: status.clone(),
            status_text: status_text.clone(),
            active_session_count: cards.len(),
            attention_count: attention.len(),
            notification_count: notification_events.len(),
            model_label,
            project_label,
        },
        display_policy: MobileHudDisplayPolicy {
            visible_items,
            hidden_by_desktop_config,
            terminal_jump: false,
            approval_actions: false,
            question_actions: false,
            notifications_enabled,
            privacy_note: "Mobile HUD receives sanitized display DTOs only. Paths, transcript files, terminal metadata, intent ids, nonces, raw prompts, tool inputs and tool results are not included.".to_string(),
        },
        capsule: MobileHudCapsule {
            mascot: "clawd".to_string(),
            state: capsule_state(&status, !attention.is_empty()),
            title: "Claude HUD One".to_string(),
            status_text,
            ticker,
        },
        sessions: cards,
        attention,
        completion: completion_card_placeholder(&fresh_sessions, &generated_at),
        notification_events,
    }
}

#[cfg(test)]
pub fn serialized_snapshot_contains_sensitive_keywords(
    value: &MobileHudViewModel,
) -> Vec<&'static str> {
    let serialized = serde_json::to_string(value).unwrap_or_default();
    SENSITIVE_KEYWORDS
        .iter()
        .copied()
        .filter(|keyword| serialized.contains(keyword))
        .collect()
}

fn session_card(state: &ClaudeStatusBridgeState) -> MobileHudSessionCard {
    MobileHudSessionCard {
        session_ref: session_ref(state),
        session_name: first_non_empty([state.session_name.as_deref(), state.session_id.as_deref()])
            .unwrap_or("Claude Code")
            .to_string(),
        project_label: project_label(state),
        activity: session_activity(state),
        status_text: fallback_string(&state.status_text, "Waiting for Claude Code"),
        model_label: first_non_empty([state.model_name.as_deref(), state.model_id.as_deref()]).map(ToString::to_string),
        active_tool_name: state.tool_name.clone(),
        permission_mode: state.permission_mode.clone(),
        context_used_percent: rounded_percent(state.context_used_percent),
        context_remaining_percent: rounded_percent(state.context_remaining_percent),
        context_window_size: rounded_number(state.context_window_size),
        context_used_tokens: rounded_number(state.context_used_tokens),
        input_tokens: rounded_number(state.input_tokens),
        output_tokens: rounded_number(state.output_tokens),
        cache_creation_input_tokens: rounded_number(state.cache_creation_input_tokens),
        cache_read_input_tokens: rounded_number(state.cache_read_input_tokens),
        total_cost_usd: state.total_cost_usd.map(|value| (value * 10000.0).round() / 10000.0),
        five_hour_used_percent: rounded_percent(state.five_hour_used_percent),
        seven_day_used_percent: rounded_percent(state.seven_day_used_percent),
        effort_level: state.effort_level.clone(),
        thinking_enabled: state.thinking_enabled,
        git_branch: state.git_branch.clone(),
        git_dirty: state.git_dirty,
        git_ahead: rounded_number(state.git_ahead),
        git_behind: rounded_number(state.git_behind),
        added_dir_slugs: state.added_dir_slugs.clone(),
        added_dirs_overflow_count: rounded_number(state.added_dirs_overflow_count),
        tools_count: rounded_number(state.tools_count),
        tools_running_count: rounded_number(state.tools_running_count),
        agents_count: rounded_number(state.agents_count),
        agents_running_count: rounded_number(state.agents_running_count),
        todos_active_count: rounded_number(state.todos_active_count),
        todos_completed_count: rounded_number(state.todos_completed_count),
        todos_total_count: rounded_number(state.todos_total_count),
        output_speed: state.output_speed.map(|value| (value * 10.0).round() / 10.0),
        session_started_at: state.session_started_at.clone(),
        last_assistant_response_at: state.last_assistant_response_at.clone(),
        updated_at: state.updated_at.clone(),
        privacy_note: "Sanitized mobile session card. Full path, transcript and terminal metadata are held on the PC only.".to_string(),
    }
}

fn session_activity(state: &ClaudeStatusBridgeState) -> String {
    if state.hook_event_name.as_deref() == Some("SessionEnd") {
        return "idle".to_string();
    }
    if matches!(state.hook_event_name.as_deref(), Some("Stop") | Some("PostToolUse") | Some("PostToolUseFailure") | Some("PostToolBatch") | Some("SubagentStop") | Some("PostCompact")) {
        return "idle".to_string();
    }
    if matches!(state.activity.as_str(), "waiting" | "error") {
        return state.activity.clone();
    }
    if bridge_has_running_work(state) {
        return "running".to_string();
    }
    if state.source == "statusLine" {
        return "idle".to_string();
    }
    if state.activity == "active" {
        "active".to_string()
    } else {
        state.activity.clone()
    }
}

fn bridge_has_running_work(state: &ClaudeStatusBridgeState) -> bool {
    positive_count(state.tools_running_count).is_some()
        || positive_count(state.agents_running_count).is_some()
        || matches!(state.hook_event_name.as_deref(), Some("MessageDisplay") | Some("PreToolUse") | Some("SubagentStart") | Some("PreCompact"))
        || status_text_has_running_signal(&state.status_text)
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

fn mobile_activity_rank(activity: &str) -> u8 {
    match activity {
        "waiting" => 0,
        "running" => 1,
        "error" => 2,
        "active" => 3,
        "idle" => 4,
        _ => 5,
    }
}

fn attention_items_for_session(
    state: &ClaudeStatusBridgeState,
    now: OffsetDateTime,
) -> Vec<MobileHudAttentionItem> {
    let session_ref = session_ref(state);
    state
        .pending_queue
        .as_ref()
        .map(|queue| {
            queue
                .items
                .iter()
                .filter(|item| pending_item_is_active(item, now))
                .map(|item| attention_item(&session_ref, item))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn bridge_session_is_fresh(state: &ClaudeStatusBridgeState, now: OffsetDateTime) -> bool {
    is_fresh_rfc3339(&state.updated_at, now, MOBILE_SESSION_FRESH_SECONDS)
}

fn pending_item_is_active(item: &PendingQueueItem, now: OffsetDateTime) -> bool {
    if item.status != "pending" {
        return false;
    }
    item.expires_at
        .as_deref()
        .and_then(parse_rfc3339)
        .map(|expires_at| expires_at > now)
        .unwrap_or(true)
}

fn is_fresh_rfc3339(value: &str, now: OffsetDateTime, ttl_seconds: i64) -> bool {
    parse_rfc3339(value)
        .map(|timestamp| now - timestamp <= Duration::seconds(ttl_seconds))
        .unwrap_or(false)
}

fn parse_rfc3339(value: &str) -> Option<OffsetDateTime> {
    OffsetDateTime::parse(value, &Rfc3339).ok()
}

fn attention_item(session_ref: &str, item: &PendingQueueItem) -> MobileHudAttentionItem {
    MobileHudAttentionItem {
        item_ref: short_hash(&format!("{}:{}:{}", session_ref, item.kind, item.id)),
        session_ref: session_ref.to_string(),
        kind: item.kind.clone(),
        status: item.status.clone(),
        title: item.title.clone(),
        summary: item.summary.clone(),
        tool_name: item.tool_name.clone(),
        created_at: item.created_at.clone(),
        expires_at: item.expires_at.clone(),
        action_state: "readonly".to_string(),
        privacy_note: "Read-only attention item. Mobile does not receive intent ids, allowed intents, nonce or raw tool data.".to_string(),
    }
}

fn waiting_attention_notification(item: &MobileHudAttentionItem) -> MobileHudNotificationEvent {
    let kind = match item.kind.as_str() {
        "question" => "waitingAttention",
        "approval" => "waitingAttention",
        _ => "waitingAttention",
    };
    MobileHudNotificationEvent {
        event_id: short_hash(&format!(
            "notification:{}:{}",
            item.session_ref, item.item_ref
        )),
        dedupe_key: format!("attention:{}:{}", item.session_ref, item.item_ref),
        collapse_key: format!("attention:{}", item.session_ref),
        kind: kind.to_string(),
        sensitivity: "low".to_string(),
        title: "Claude needs attention".to_string(),
        body: match item.kind.as_str() {
            "question" => "A Claude Code question is waiting on your PC.".to_string(),
            "approval" => "A Claude Code approval is waiting on your PC.".to_string(),
            _ => "Claude Code is waiting on your PC.".to_string(),
        },
        created_at: item.created_at.clone(),
        source: "pendingQueue".to_string(),
        target_session_ref: Some(item.session_ref.clone()),
    }
}

fn completion_card_placeholder(
    sessions: &[ClaudeStatusBridgeState],
    generated_at: &str,
) -> Option<MobileHudCompletionCard> {
    let settled = sessions.iter().find(|session| {
        matches!(session.activity.as_str(), "idle" | "completed" | "success")
            && session
                .pending_queue
                .as_ref()
                .map(|queue| queue.items.is_empty())
                .unwrap_or(true)
    })?;

    Some(MobileHudCompletionCard {
        session_ref: session_ref(settled),
        title: "Claude Code is settled".to_string(),
        body: "Latest activity has finished or is idle on the PC.".to_string(),
        completed_at: generated_at.to_string(),
    })
}

fn build_ticker(
    primary: Option<&MobileHudSessionCard>,
    usage: &LiveUsageCostSnapshot,
    visible_items: &[String],
) -> Vec<MobileHudDisplayItem> {
    let mut items = Vec::new();
    if let Some(session) = primary {
        push_item(
            &mut items,
            visible_items,
            "activity",
            "Activity",
            localized_status_text(&session.status_text),
            None,
        );
        push_item(
            &mut items,
            visible_items,
            "project",
            "Project",
            format!(
                "{} {}",
                session.project_label,
                compact_label(&session.session_name, 18)
            ),
            None,
        );
        if let Some(tool) = session.active_tool_name.as_ref() {
            push_item(
                &mut items,
                visible_items,
                "tools",
                "Tools",
                format!("Tool {}", short_tool_name(tool)),
                None,
            );
        } else if let Some(count) = positive_count(session.tools_count) {
            push_item(
                &mut items,
                visible_items,
                "tools",
                "Tools",
                format!("Tools {count}"),
                None,
            );
        }
        if let Some(model) = session.model_label.as_ref() {
            push_item(
                &mut items,
                visible_items,
                "model",
                "Model",
                compact_label(model, 18),
                None,
            );
        }
        if let Some(tokens) = session.context_used_tokens {
            push_item(
                &mut items,
                visible_items,
                "contextValue",
                "Context",
                format!("{} context", compact_tokens(tokens)),
                session.context_used_percent.map(context_emphasis),
            );
        } else if let Some(percent) = session.context_used_percent {
            push_item(
                &mut items,
                visible_items,
                "contextValue",
                "Context",
                format!("{percent:.0}% used"),
                Some(context_emphasis(percent)),
            );
        }
        if let Some(total) = session_token_total(session) {
            push_item(
                &mut items,
                visible_items,
                "sessionTokens",
                "Tokens",
                format!("{} session", compact_tokens(total)),
                None,
            );
        }
        if let Some(cost) = session.total_cost_usd.filter(|value| *value > 0.0) {
            push_item(
                &mut items,
                visible_items,
                "cost",
                "Cost",
                format!("${:.2}", cost),
                None,
            );
        }
        if let Some(branch) = session.git_branch.as_ref() {
            let dirty = if session.git_dirty == Some(true) {
                "*"
            } else {
                ""
            };
            push_item(
                &mut items,
                visible_items,
                "git",
                "Git",
                format!("git {}{}", compact_label(branch, 18), dirty),
                None,
            );
        }
        if let Some(dirs) = session
            .added_dir_slugs
            .as_ref()
            .filter(|dirs| !dirs.is_empty())
        {
            let overflow = positive_count(session.added_dirs_overflow_count)
                .map(|count| format!(" +{count}"))
                .unwrap_or_default();
            push_item(
                &mut items,
                visible_items,
                "addedDirs",
                "Dirs",
                format!(
                    "Dirs {}{}",
                    dirs.iter().take(2).cloned().collect::<Vec<_>>().join(", "),
                    overflow
                ),
                None,
            );
        }
        if let Some(count) = positive_count(session.agents_count)
            .or_else(|| positive_count(session.agents_running_count))
        {
            push_item(
                &mut items,
                visible_items,
                "agents",
                "Agents",
                format!("Agents {count}"),
                None,
            );
        }
        if let Some(total) = positive_count(session.todos_total_count) {
            let done = positive_count(session.todos_completed_count).unwrap_or(0);
            push_item(
                &mut items,
                visible_items,
                "todos",
                "Todos",
                format!("Todos {done}/{total}"),
                None,
            );
        }
        if let Some(speed) = session.output_speed.filter(|value| *value > 0.0) {
            push_item(
                &mut items,
                visible_items,
                "speed",
                "Speed",
                format!("{speed:.1} tok/s"),
                None,
            );
        }
        if let Some(effort) = session.effort_level.as_ref() {
            push_item(
                &mut items,
                visible_items,
                "effortLevel",
                "Effort",
                format!("Effort {effort}"),
                None,
            );
        }
    }
    push_item(
        &mut items,
        visible_items,
        "usage",
        "Usage",
        format!(
            "5h {:.0}% · 7d {:.0}%",
            usage.claude_provider.five_hour.used_percent * 100.0,
            usage.claude_provider.weekly.used_percent * 100.0
        ),
        None,
    );
    items
}

fn push_item(
    items: &mut Vec<MobileHudDisplayItem>,
    visible_items: &[String],
    id: &str,
    label: &str,
    value: String,
    emphasis: Option<String>,
) {
    if visible_items.iter().any(|item| item == id) {
        items.push(MobileHudDisplayItem {
            id: id.to_string(),
            label: label.to_string(),
            value,
            emphasis,
        });
    }
}

fn mobile_visible_items(settings: &Value) -> Vec<String> {
    let configured = settings
        .get("visibleItems")
        .and_then(Value::as_object)
        .map(|items| {
            DEFAULT_VISIBLE_ITEMS
                .iter()
                .copied()
                .filter(|item| items.get(*item).and_then(Value::as_bool).unwrap_or(true))
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_else(|| {
            DEFAULT_VISIBLE_ITEMS
                .iter()
                .map(ToString::to_string)
                .collect()
        });

    if configured.is_empty() {
        DEFAULT_VISIBLE_ITEMS
            .iter()
            .map(ToString::to_string)
            .collect()
    } else {
        configured
    }
}

fn hidden_by_desktop_config(desktop_hud: &Value, visible_items: &[String]) -> Vec<String> {
    let Some(items) = desktop_hud.get("visibleItems").and_then(Value::as_object) else {
        return Vec::new();
    };
    visible_items
        .iter()
        .filter(|item| items.get(item.as_str()).and_then(Value::as_bool) == Some(false))
        .cloned()
        .collect()
}

fn json_bool(value: &Value, path: &[&str]) -> Option<bool> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    current.as_bool()
}

fn project_label(state: &ClaudeStatusBridgeState) -> String {
    first_non_empty([state.project_slug.as_deref(), state.session_name.as_deref()])
        .map(ToString::to_string)
        .or_else(|| basename(state.project_dir.as_deref()))
        .or_else(|| basename(state.cwd.as_deref()))
        .unwrap_or_else(|| "Claude Code".to_string())
}

fn basename(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    if value.is_empty() {
        return None;
    }
    Path::new(value)
        .file_name()
        .and_then(|item| item.to_str())
        .filter(|item| !item.trim().is_empty())
        .map(ToString::to_string)
}

fn session_ref(state: &ClaudeStatusBridgeState) -> String {
    let key = first_non_empty([
        state.session_key.as_deref(),
        state.session_id.as_deref(),
        state.transcript_path.as_deref(),
        state.project_slug.as_deref(),
        state.session_name.as_deref(),
    ])
    .unwrap_or("claude-code");
    format!("session_{}", short_hash(key))
}

fn short_hash(value: &str) -> String {
    let digest = Sha256::digest(value.as_bytes());
    digest
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>()
}

fn first_non_empty<const N: usize>(items: [Option<&str>; N]) -> Option<&str> {
    items
        .into_iter()
        .flatten()
        .map(str::trim)
        .find(|value| !value.is_empty())
}

fn fallback_string(value: &str, fallback: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed.to_string()
    }
}

fn rounded_percent(value: Option<f64>) -> Option<f64> {
    value.map(|number| (number * 10.0).round() / 10.0)
}

fn rounded_number(value: Option<f64>) -> Option<f64> {
    value.map(|number| number.round())
}

fn positive_count(value: Option<f64>) -> Option<u64> {
    let count = value?.round();
    if count > 0.0 && count.is_finite() {
        Some(count as u64)
    } else {
        None
    }
}

fn compact_label(value: &str, max_length: usize) -> String {
    if value.chars().count() <= max_length {
        return value.to_string();
    }
    value
        .chars()
        .take(max_length.saturating_sub(1))
        .collect::<String>()
        + "…"
}

fn compact_tokens(tokens: f64) -> String {
    if tokens < 1_000.0 {
        format!("{:.0}", tokens)
    } else if tokens < 10_000.0 {
        format!("{:.1}K", tokens / 1_000.0)
    } else if tokens < 1_000_000.0 {
        format!("{:.0}K", tokens / 1_000.0)
    } else {
        format!("{:.1}M", tokens / 1_000_000.0)
    }
}

fn session_token_total(session: &MobileHudSessionCard) -> Option<f64> {
    let total = [
        session.input_tokens,
        session.output_tokens,
        session.cache_creation_input_tokens,
        session.cache_read_input_tokens,
    ]
    .into_iter()
    .flatten()
    .filter(|value| *value > 0.0 && value.is_finite())
    .sum::<f64>();
    if total > 0.0 {
        Some(total)
    } else {
        None
    }
}

fn short_tool_name(value: &str) -> String {
    value
        .strip_prefix("mcp__")
        .unwrap_or(value)
        .split("__")
        .last()
        .unwrap_or(value)
        .to_string()
}

fn localized_status_text(value: &str) -> String {
    if let Some(tool) = value.strip_prefix("Tool running: ") {
        return format!("工具运行中：{}", short_tool_name(tool));
    }
    if let Some(tool) = value.strip_prefix("Tool finished: ") {
        return format!("工具已完成：{}", short_tool_name(tool));
    }
    match value {
        "Generating response" => "正在生成回复".to_string(),
        "Tool running" => "工具运行中".to_string(),
        "Tool finished" => "工具已完成".to_string(),
        "Needs attention" => "需要处理".to_string(),
        "Waiting for user" => "等待用户".to_string(),
        "Session idle" => "会话空闲".to_string(),
        other => other.to_string(),
    }
}

fn context_emphasis(percent: f64) -> String {
    if percent >= 85.0 {
        "critical".to_string()
    } else if percent >= 70.0 {
        "warning".to_string()
    } else {
        "normal".to_string()
    }
}

fn capsule_state(status: &str, has_attention: bool) -> String {
    if has_attention {
        "waiting".to_string()
    } else if status.eq_ignore_ascii_case("error") || status.eq_ignore_ascii_case("failed") {
        "error".to_string()
    } else if status.eq_ignore_ascii_case("running") {
        "running".to_string()
    } else if status.eq_ignore_ascii_case("active") {
        "active".to_string()
    } else {
        "idle".to_string()
    }
}

#[cfg(test)]
fn now_rfc3339() -> String {
    format_rfc3339(OffsetDateTime::now_utc())
}

fn format_rfc3339(value: OffsetDateTime) -> String {
    value
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn unix_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use crate::window::{
        claude_status::{PendingQueueItem, PendingQueueState},
        settings::AppSettings,
        usage_cost::{
            CostSummaryStateDto, DailyTokenBucketDto, LiveUsageCostSnapshot, ProviderLiveStateDto,
            WindowUsageStateDto,
        },
    };

    use super::*;

    #[test]
    fn mobile_snapshot_drops_sensitive_fields() {
        let settings = AppSettings::default();
        let snapshot =
            build_mobile_hud_view_model(vec![sample_session()], sample_usage(), settings);

        assert_eq!(
            serialized_snapshot_contains_sensitive_keywords(&snapshot),
            Vec::<&'static str>::new()
        );
        assert_eq!(snapshot.attention[0].action_state, "readonly");
        assert!(!snapshot.display_policy.approval_actions);
        assert!(!snapshot.display_policy.question_actions);
        assert!(!snapshot.display_policy.terminal_jump);
    }

    #[test]
    fn mobile_snapshot_serializes_protocol_envelope() {
        let envelope = build_mobile_hud_envelope(
            vec![sample_session()],
            sample_usage(),
            AppSettings::default(),
        );
        let value = serde_json::to_value(envelope).expect("mobile envelope should serialize");

        assert_eq!(value["protocolVersion"], json!(1));
        assert_eq!(value["kind"], json!("snapshot"));
        assert_eq!(value["payload"]["displayMode"], json!("trustedAppView"));
        assert!(value["payload"]["sessions"].as_array().unwrap().len() == 1);
    }

    #[test]
    fn mobile_snapshot_uses_low_sensitive_notification_text() {
        let snapshot = build_mobile_hud_view_model(
            vec![sample_session()],
            sample_usage(),
            AppSettings::default(),
        );
        let serialized = serde_json::to_string(&snapshot.notification_events).unwrap();

        assert!(serialized.contains("Claude needs attention"));
        assert!(!serialized.contains("E:/Develop_E"));
        assert!(!serialized.contains("dangerous shell command"));
    }

    #[test]
    fn mobile_snapshot_filters_stale_sessions_like_desktop_hud() {
        let fresh = sample_session();
        let mut stale = sample_session();
        stale.session_key = Some("stale-session".to_string());
        stale.session_name = Some("stale session".to_string());
        stale.updated_at = format_rfc3339(
            OffsetDateTime::now_utc() - Duration::seconds(MOBILE_SESSION_FRESH_SECONDS + 1),
        );
        stale.activity = "running".to_string();

        let snapshot =
            build_mobile_hud_view_model(vec![stale, fresh], sample_usage(), AppSettings::default());

        assert_eq!(snapshot.summary.active_session_count, 1);
        assert_eq!(snapshot.sessions.len(), 1);
        assert_eq!(snapshot.sessions[0].session_name, "Android HUD");
    }

    #[test]
    fn mobile_snapshot_derives_running_from_message_display() {
        let mut session = sample_session();
        session.activity = "active".to_string();
        session.status_text = "Generating response".to_string();
        session.hook_event_name = Some("MessageDisplay".to_string());
        session.tools_running_count = None;
        session.agents_running_count = None;
        session.pending_queue = None;

        let snapshot = build_mobile_hud_view_model(vec![session], sample_usage(), AppSettings::default());

        assert_eq!(snapshot.sessions[0].activity, "running");
        assert_eq!(snapshot.summary.status, "running");
        assert_eq!(snapshot.capsule.state, "running");
    }

    #[test]
    fn mobile_snapshot_prioritizes_running_session_over_newer_idle_heartbeat() {
        let now = OffsetDateTime::now_utc();
        let mut running = sample_session();
        running.session_key = Some("running-session".to_string());
        running.session_name = Some("Running Session".to_string());
        running.activity = "running".to_string();
        running.status_text = "Generating response".to_string();
        running.hook_event_name = Some("MessageDisplay".to_string());
        running.updated_at = format_rfc3339(now - Duration::seconds(60));
        running.last_running_signal_at = Some(running.updated_at.clone());
        running.pending_queue = None;

        let mut idle = sample_session();
        idle.session_key = Some("idle-session".to_string());
        idle.session_name = Some("Idle Session".to_string());
        idle.activity = "idle".to_string();
        idle.status_text = "Session idle".to_string();
        idle.hook_event_name = None;
        idle.tools_running_count = None;
        idle.agents_running_count = None;
        idle.source = "statusLine".to_string();
        idle.updated_at = format_rfc3339(now);
        idle.last_running_signal_at = None;
        idle.pending_queue = None;

        let snapshot = build_mobile_hud_view_model(vec![idle, running], sample_usage(), AppSettings::default());

        assert_eq!(snapshot.sessions[0].activity, "running");
        assert_eq!(snapshot.sessions[0].session_name, "Running Session");
        assert_eq!(snapshot.summary.status, "running");
        assert_eq!(snapshot.capsule.state, "running");
    }

    #[test]
    fn mobile_snapshot_derives_running_from_status_text_when_hook_is_missing() {
        let mut session = sample_session();
        session.activity = "idle".to_string();
        session.status_text = "Generating response".to_string();
        session.hook_event_name = None;
        session.tools_running_count = None;
        session.agents_running_count = None;
        session.source = "statusLine".to_string();
        session.pending_queue = None;

        let snapshot = build_mobile_hud_view_model(vec![session], sample_usage(), AppSettings::default());

        assert_eq!(snapshot.sessions[0].activity, "running");
        assert_eq!(snapshot.summary.status, "running");
        assert_eq!(snapshot.capsule.state, "running");
    }

    #[test]
    fn mobile_snapshot_keeps_user_prompt_submit_active() {
        let mut session = sample_session();
        session.activity = "active".to_string();
        session.status_text = "Prompt submitted".to_string();
        session.hook_event_name = Some("UserPromptSubmit".to_string());
        session.tools_running_count = None;
        session.agents_running_count = None;
        session.pending_queue = None;

        let snapshot = build_mobile_hud_view_model(vec![session], sample_usage(), AppSettings::default());

        assert_eq!(snapshot.sessions[0].activity, "active");
        assert_eq!(snapshot.summary.status, "active");
        assert_eq!(snapshot.capsule.state, "active");
    }

    #[test]
    fn mobile_snapshot_drops_expired_pending_attention() {
        let mut session = sample_session();
        if let Some(queue) = session.pending_queue.as_mut() {
            queue.items[0].expires_at = Some(format_rfc3339(
                OffsetDateTime::now_utc() - Duration::seconds(1),
            ));
        }

        let snapshot =
            build_mobile_hud_view_model(vec![session], sample_usage(), AppSettings::default());

        assert!(snapshot.attention.is_empty());
        assert!(snapshot.notification_events.is_empty());
    }

    fn sample_session() -> ClaudeStatusBridgeState {
        let now = now_rfc3339();
        ClaudeStatusBridgeState {
            schema_version: 1,
            updated_at: now.clone(),
            activity_started_at: Some("2026-06-17T07:59:00Z".to_string()),
            last_running_signal_at: Some(now.clone()),
            event: "PreToolUse".to_string(),
            activity: "waiting".to_string(),
            status_text: "Waiting for approval".to_string(),
            session_key: Some("session-key".to_string()),
            session_id: Some("session-id".to_string()),
            session_name: Some("Android HUD".to_string()),
            cwd: Some(r"E:\Develop_E\claude-hud-one".to_string()),
            project_dir: Some(r"E:\Develop_E\claude-hud-one".to_string()),
            project_slug: Some("claude-hud-one".to_string()),
            transcript_path: Some(r"C:\Users\Yue\.claude\projects\secret.jsonl".to_string()),
            model_id: Some("claude-opus-4-8".to_string()),
            model_name: Some("Opus 4.8".to_string()),
            version: Some("1.0.0".to_string()),
            output_style: None,
            context_used_percent: Some(42.42),
            context_remaining_percent: Some(57.58),
            context_window_size: Some(200000.0),
            context_used_tokens: Some(84840.2),
            input_tokens: Some(1200.0),
            output_tokens: Some(340.0),
            cache_creation_input_tokens: Some(10.0),
            cache_read_input_tokens: Some(20.0),
            total_cost_usd: Some(0.123456),
            total_duration_ms: Some(1000.0),
            total_api_duration_ms: Some(900.0),
            total_lines_added: Some(1.0),
            total_lines_removed: Some(0.0),
            five_hour_used_percent: Some(12.5),
            five_hour_reset_at: None,
            seven_day_used_percent: Some(22.5),
            seven_day_reset_at: None,
            effort_level: Some("high".to_string()),
            thinking_enabled: Some(true),
            agent_name: None,
            hook_event_name: Some("PreToolUse".to_string()),
            permission_mode: Some("default".to_string()),
            tool_name: Some("Bash".to_string()),
            output_speed: Some(12.3),
            added_dir_slugs: Some(vec!["apps/android".to_string()]),
            added_dirs_overflow_count: Some(1.0),
            git_branch: Some("main".to_string()),
            git_dirty: Some(true),
            git_ahead: Some(0.0),
            git_behind: Some(0.0),
            session_started_at: Some("2026-06-17T07:55:00Z".to_string()),
            last_assistant_response_at: Some(now.clone()),
            tools_count: Some(3.0),
            tools_running_count: Some(1.0),
            agents_count: Some(2.0),
            agents_running_count: Some(1.0),
            todos_active_count: Some(1.0),
            todos_completed_count: Some(2.0),
            todos_total_count: Some(3.0),
            pending_queue: Some(PendingQueueState {
                schema_version: 1,
                updated_at: now.clone(),
                items: vec![PendingQueueItem {
                    id: "pending-1".to_string(),
                    kind: "approval".to_string(),
                    status: "pending".to_string(),
                    session_id: Some("session-id".to_string()),
                    created_at: now.clone(),
                    updated_at: now.clone(),
                    expires_at: None,
                    source: "hook".to_string(),
                    hook_event_name: Some("PreToolUse".to_string()),
                    permission_mode: Some("default".to_string()),
                    tool_name: Some("Bash".to_string()),
                    project_slug: Some("claude-hud-one".to_string()),
                    cwd_slug: Some("claude-hud-one".to_string()),
                    title: "Tool approval required".to_string(),
                    summary: Some("dangerous shell command omitted".to_string()),
                    choices: None,
                    intent_id: Some("intent-secret".to_string()),
                    allowed_intents: Some(vec!["allowOnce".to_string(), "deny".to_string()]),
                    intent_expires_at: None,
                    decision_state: None,
                    question_mode: None,
                    answer_placeholder: None,
                    privacy_note: "sanitized".to_string(),
                }],
            }),
            terminal: None,
            source: "bridge".to_string(),
            privacy_note: "sanitized".to_string(),
        }
    }

    fn sample_usage() -> LiveUsageCostSnapshot {
        let window = WindowUsageStateDto {
            used_percent: 0.2,
            reset_at_label: "soon".to_string(),
            error: None,
        };
        let provider = ProviderLiveStateDto {
            five_hour: window.clone(),
            weekly: window,
            stale: false,
            last_updated_label: "now".to_string(),
            source: "claudeCode".to_string(),
            auth_status: "ok".to_string(),
        };
        let cost = CostSummaryStateDto {
            today_usd: 0.0,
            month_usd: 0.0,
            today_tokens: 0,
            month_tokens: 0,
            today_billable_tokens: 0,
            month_billable_tokens: 0,
            trend: vec![],
            breakdown: vec![],
        };
        LiveUsageCostSnapshot {
            claude_provider: provider.clone(),
            codex_provider: provider,
            claude_cost: cost.clone(),
            codex_cost: cost,
            daily_buckets: Vec::<DailyTokenBucketDto>::new(),
            last_usage_sync_label: "now".to_string(),
            last_cost_sync_label: "now".to_string(),
            privacy_note: "usage only".to_string(),
        }
    }
}
