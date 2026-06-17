use std::{path::Path, time::{SystemTime, UNIX_EPOCH}};

use serde_json::Value;
use sha2::{Digest, Sha256};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
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
const DEFAULT_VISIBLE_ITEMS: [&str; 13] = [
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
];
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
    let generated_at = now_rfc3339();
    let snapshot_version = unix_millis();
    let visible_items = mobile_visible_items(&settings.mobile_hud);
    let hidden_by_desktop_config = hidden_by_desktop_config(&settings.desktop_hud, &visible_items);
    let notifications_enabled = json_bool(&settings.mobile_hud, &["notifications", "enabled"]).unwrap_or(true);

    let cards = sessions.iter().map(session_card).collect::<Vec<_>>();
    let attention = sessions
        .iter()
        .flat_map(attention_items_for_session)
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
        completion: completion_card_placeholder(&sessions, &generated_at),
        notification_events,
    }
}

#[cfg(test)]
pub fn serialized_snapshot_contains_sensitive_keywords(value: &MobileHudViewModel) -> Vec<&'static str> {
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
        activity: state.activity.clone(),
        status_text: fallback_string(&state.status_text, "Waiting for Claude Code"),
        model_label: first_non_empty([state.model_name.as_deref(), state.model_id.as_deref()]).map(ToString::to_string),
        context_used_percent: rounded_percent(state.context_used_percent),
        context_remaining_percent: rounded_percent(state.context_remaining_percent),
        context_used_tokens: rounded_number(state.context_used_tokens),
        input_tokens: rounded_number(state.input_tokens),
        output_tokens: rounded_number(state.output_tokens),
        total_cost_usd: state.total_cost_usd.map(|value| (value * 10000.0).round() / 10000.0),
        five_hour_used_percent: rounded_percent(state.five_hour_used_percent),
        seven_day_used_percent: rounded_percent(state.seven_day_used_percent),
        effort_level: state.effort_level.clone(),
        updated_at: state.updated_at.clone(),
        privacy_note: "Sanitized mobile session card. Full path, transcript and terminal metadata are held on the PC only.".to_string(),
    }
}

fn attention_items_for_session(state: &ClaudeStatusBridgeState) -> Vec<MobileHudAttentionItem> {
    let session_ref = session_ref(state);
    state
        .pending_queue
        .as_ref()
        .map(|queue| {
            queue
                .items
                .iter()
                .filter(|item| item.status != "resolved" && item.status != "dismissed")
                .map(|item| attention_item(&session_ref, item))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
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
        event_id: short_hash(&format!("notification:{}:{}", item.session_ref, item.item_ref)),
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

fn completion_card_placeholder(sessions: &[ClaudeStatusBridgeState], generated_at: &str) -> Option<MobileHudCompletionCard> {
    let settled = sessions.iter().find(|session| {
        matches!(session.activity.as_str(), "idle" | "completed" | "success")
            && session.pending_queue.as_ref().map(|queue| queue.items.is_empty()).unwrap_or(true)
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
        push_item(&mut items, visible_items, "activity", "Activity", session.status_text.clone(), None);
        push_item(&mut items, visible_items, "project", "Project", session.project_label.clone(), None);
        if let Some(model) = session.model_label.as_ref() {
            push_item(&mut items, visible_items, "model", "Model", model.clone(), None);
        }
        if let Some(percent) = session.context_used_percent {
            push_item(&mut items, visible_items, "contextValue", "Context", format!("{percent:.0}% used"), Some(context_emphasis(percent)));
        }
        if let Some(cost) = session.total_cost_usd {
            push_item(&mut items, visible_items, "cost", "Cost", format!("${cost:.4}"), None);
        }
    }
    push_item(
        &mut items,
        visible_items,
        "usage",
        "Usage",
        format!("5h {:.0}% · 7d {:.0}%", usage.claude_provider.five_hour.used_percent * 100.0, usage.claude_provider.weekly.used_percent * 100.0),
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
        .unwrap_or_else(|| DEFAULT_VISIBLE_ITEMS.iter().map(ToString::to_string).collect());

    if configured.is_empty() {
        DEFAULT_VISIBLE_ITEMS.iter().map(ToString::to_string).collect()
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
    } else if status.eq_ignore_ascii_case("running") || status.eq_ignore_ascii_case("active") {
        "running".to_string()
    } else {
        "idle".to_string()
    }
}

fn now_rfc3339() -> String {
    OffsetDateTime::now_utc()
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
        usage_cost::{CostSummaryStateDto, DailyTokenBucketDto, LiveUsageCostSnapshot, ProviderLiveStateDto, WindowUsageStateDto},
    };

    use super::*;

    #[test]
    fn mobile_snapshot_drops_sensitive_fields() {
        let settings = AppSettings::default();
        let snapshot = build_mobile_hud_view_model(vec![sample_session()], sample_usage(), settings);

        assert_eq!(serialized_snapshot_contains_sensitive_keywords(&snapshot), Vec::<&'static str>::new());
        assert_eq!(snapshot.attention[0].action_state, "readonly");
        assert!(!snapshot.display_policy.approval_actions);
        assert!(!snapshot.display_policy.question_actions);
        assert!(!snapshot.display_policy.terminal_jump);
    }

    #[test]
    fn mobile_snapshot_serializes_protocol_envelope() {
        let envelope = build_mobile_hud_envelope(vec![sample_session()], sample_usage(), AppSettings::default());
        let value = serde_json::to_value(envelope).expect("mobile envelope should serialize");

        assert_eq!(value["protocolVersion"], json!(1));
        assert_eq!(value["kind"], json!("snapshot"));
        assert_eq!(value["payload"]["displayMode"], json!("trustedAppView"));
        assert!(value["payload"]["sessions"].as_array().unwrap().len() == 1);
    }

    #[test]
    fn mobile_snapshot_uses_low_sensitive_notification_text() {
        let snapshot = build_mobile_hud_view_model(vec![sample_session()], sample_usage(), AppSettings::default());
        let serialized = serde_json::to_string(&snapshot.notification_events).unwrap();

        assert!(serialized.contains("Claude needs attention"));
        assert!(!serialized.contains("E:/Develop_E"));
        assert!(!serialized.contains("dangerous shell command"));
    }

    fn sample_session() -> ClaudeStatusBridgeState {
        ClaudeStatusBridgeState {
            schema_version: 1,
            updated_at: "2026-06-17T08:00:00Z".to_string(),
            activity_started_at: Some("2026-06-17T07:59:00Z".to_string()),
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
            pending_queue: Some(PendingQueueState {
                schema_version: 1,
                updated_at: "2026-06-17T08:00:00Z".to_string(),
                items: vec![PendingQueueItem {
                    id: "pending-1".to_string(),
                    kind: "approval".to_string(),
                    status: "pending".to_string(),
                    session_id: Some("session-id".to_string()),
                    created_at: "2026-06-17T08:00:00Z".to_string(),
                    updated_at: "2026-06-17T08:00:00Z".to_string(),
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
