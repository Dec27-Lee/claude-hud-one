use crate::window::claude_status::ClaudeStatusBridgeState;

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct SanitizedBridgeSessionRef {
    pub session_key: Option<String>,
    pub session_id: Option<String>,
    pub project_slug: Option<String>,
    pub session_name: Option<String>,
    pub updated_at: String,
    pub activity: String,
}

#[allow(dead_code)]
pub fn to_sanitized_session_ref(state: &ClaudeStatusBridgeState) -> SanitizedBridgeSessionRef {
    SanitizedBridgeSessionRef {
        session_key: state.session_key.clone(),
        session_id: state.session_id.clone(),
        project_slug: state.project_slug.clone(),
        session_name: state.session_name.clone(),
        updated_at: state.updated_at.clone(),
        activity: state.activity.clone(),
    }
}
