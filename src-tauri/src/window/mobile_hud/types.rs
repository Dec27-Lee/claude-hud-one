use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudEnvelope {
    pub protocol_version: u8,
    pub message_id: String,
    pub seq: u64,
    pub kind: String,
    pub sent_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub snapshot_version: Option<u64>,
    pub payload: MobileHudViewModel,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudViewModel {
    pub protocol_version: u8,
    pub snapshot_version: u64,
    pub snapshot_id: String,
    pub generated_at: String,
    pub display_mode: String,
    pub privacy_level: String,
    pub summary: MobileHudSummary,
    pub display_policy: MobileHudDisplayPolicy,
    pub capsule: MobileHudCapsule,
    pub sessions: Vec<MobileHudSessionCard>,
    pub attention: Vec<MobileHudAttentionItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completion: Option<MobileHudCompletionCard>,
    pub notification_events: Vec<MobileHudNotificationEvent>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudSummary {
    pub status: String,
    pub status_text: String,
    pub active_session_count: usize,
    pub attention_count: usize,
    pub notification_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_label: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudDisplayPolicy {
    pub visible_items: Vec<String>,
    pub hidden_by_desktop_config: Vec<String>,
    pub terminal_jump: bool,
    pub approval_actions: bool,
    pub question_actions: bool,
    pub notifications_enabled: bool,
    pub privacy_note: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudCapsule {
    pub mascot: String,
    pub state: String,
    pub title: String,
    pub status_text: String,
    pub ticker: Vec<MobileHudDisplayItem>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudDisplayItem {
    pub id: String,
    pub label: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emphasis: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudSessionCard {
    pub session_ref: String,
    pub session_name: String,
    pub project_label: String,
    pub activity: String,
    pub status_text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_used_percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_remaining_percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_used_tokens: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_tokens: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_tokens: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_cost_usd: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub five_hour_used_percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seven_day_used_percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub effort_level: Option<String>,
    pub updated_at: String,
    pub privacy_note: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudAttentionItem {
    pub item_ref: String,
    pub session_ref: String,
    pub kind: String,
    pub status: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    pub action_state: String,
    pub privacy_note: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudCompletionCard {
    pub session_ref: String,
    pub title: String,
    pub body: String,
    pub completed_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudNotificationEvent {
    pub event_id: String,
    pub dedupe_key: String,
    pub collapse_key: String,
    pub kind: String,
    pub sensitivity: String,
    pub title: String,
    pub body: String,
    pub created_at: String,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_session_ref: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileHudFixtureDocument {
    pub name: String,
    pub description: String,
    pub envelope: MobileHudEnvelope,
    #[serde(default)]
    pub android_fallback: Value,
}
