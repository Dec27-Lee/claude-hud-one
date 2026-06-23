#[allow(dead_code)]
pub const MOBILE_HUD_DENIED_KEYS: &[&str] = &[
    "transcriptPath",
    "projectDir",
    "cwd",
    "terminal",
    "intentId",
    "allowedIntents",
    "nonce",
    "rawInput",
    "rawOutput",
    "toolInput",
    "toolResult",
    "wtSession",
    "windowTitleHint",
    "bridgeProcessId",
];

#[allow(dead_code)]
pub fn contains_mobile_denied_key(serialized_json: &str) -> bool {
    MOBILE_HUD_DENIED_KEYS
        .iter()
        .any(|key| serialized_json.contains(&format!("\"{key}\"")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mobile_hud_detects_denied_keys() {
        assert!(contains_mobile_denied_key(r#"{"transcriptPath":"secret"}"#));
        assert!(!contains_mobile_denied_key(r#"{"sessionRef":"session_1"}"#));
    }
}
