use std::{env, fs, path::PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub launch_at_login: bool,
    pub refresh_interval_minutes: u8,
    pub language: String,
    pub always_show_usage: bool,
    pub low_power_mode: bool,
    pub fullscreen_avoidance: bool,
    pub alerts_enabled: bool,
    pub warning_threshold: u8,
    pub critical_threshold: u8,
    pub target_display: Value,
    pub top_offset_px: i32,
    pub overlay_position: Option<OverlayPosition>,
    pub island_width_mode: String,
    pub chart_style: String,
    pub cost_style: String,
    pub token_count_mode: String,
    #[serde(default = "default_visible_providers")]
    pub visible_providers: Value,
    #[serde(default = "default_terminal_hud")]
    pub terminal_hud: Value,
    #[serde(default = "default_desktop_hud")]
    pub desktop_hud: Value,
}

fn default_visible_providers() -> Value {
    json!({ "claude": true, "codex": false })
}

fn default_terminal_hud() -> Value {
    serde_json::from_str(
        r##"{
            "enabled": true,
            "preset": "custom",
            "language": "en",
            "rows": [
                ["model", "contextBar", "contextValue"],
                ["project", "addedDirs", "git"],
                ["sessionTokens", "sessionTime"],
                ["activity"]
            ],
            "rowOverflow": "truncate",
            "activityLine": {
                "mode": "auto",
                "maxWidthRatio": 1,
                "toolNameFormat": "short",
                "items": {
                    "todos": true,
                    "agents": true,
                    "tools": true,
                    "sessionTime": false
                },
                "warnings": {
                    "usage": false,
                    "memory": false,
                    "environment": false,
                    "promptCache": false
                }
            },
            "showSeparators": false,
            "pathLevels": 1,
            "maxWidth": null,
            "elementOrder": ["project", "addedDirs", "context", "usage", "promptCache", "memory", "environment", "tools", "agents", "todos", "sessionTime"],
            "gitStatus": {
                "enabled": true,
                "showDirty": true,
                "showAheadBehind": true,
                "showFileStats": true,
                "branchOverflow": "truncate",
                "pushWarningThreshold": 0,
                "pushCriticalThreshold": 0
            },
            "colors": {
                "context": "#22D3EE",
                "usage": "brightBlue",
                "warning": "#F59E0B",
                "usageWarning": "brightMagenta",
                "critical": "#F43F5E",
                "model": "#38BDF8",
                "project": "#FBBF24",
                "git": "#C084FC",
                "gitBranch": "#22D3EE",
                "label": "#38BDF8",
                "labelTitle": "#38BDF8",
                "labelValue": "#b8eaff",
                "custom": 208,
                "barFilled": "█",
                "barEmpty": "░",
                "contextBands": [],
                "usageBands": []
            },
            "display": {
                "showModel": true,
                "showProject": true,
                "showAddedDirs": true,
                "addedDirsLayout": "inline",
                "showContextBar": true,
                "contextValue": "both",
                "showConfigCounts": false,
                "showCost": false,
                "showDuration": false,
                "showSpeed": false,
                "showTokenBreakdown": true,
                "showUsage": false,
                "usageValue": "percent",
                "usageBarEnabled": true,
                "showResetLabel": true,
                "usageCompact": false,
                "showTools": true,
                "showAgents": true,
                "showTodos": true,
                "showSessionName": false,
                "showClaudeCodeVersion": false,
                "showEffortLevel": true,
                "showMemoryUsage": false,
                "showEnvironment": false,
                "showPromptCache": false,
                "promptCacheTtlSeconds": 300,
                "showSessionTokens": true,
                "showOutputStyle": false,
                "showSessionStartDate": true,
                "showLastResponseAt": false,
                "mergeGroups": [["context", "usage"]],
                "autocompactBuffer": "enabled",
                "contextWarningThreshold": 70,
                "contextCriticalThreshold": 85,
                "usageThreshold": 0,
                "sevenDayThreshold": 80,
                "environmentThreshold": 0,
                "externalUsagePath": "",
                "externalUsageFreshnessMs": 300000,
                "modelFormat": "full",
                "modelOverride": "",
                "contextWindowSizeOverride": "",
                "contextWindowSizeOverrideManaged": true,
                "customLine": "",
                "timeFormat": "relative"
            }
        }"##,
    )
    .expect("default terminal HUD config must be valid JSON")
}

fn default_desktop_hud() -> Value {
    json!({
        "version": 2,
        "enabled": true,
        "preset": "one-default",
        "density": "compact",
        "defaultPage": "usage",
        "visibleItems": {
            "model": true,
            "contextValue": true,
            "project": true,
            "sessionTokens": true,
            "usage": true,
            "cost": true,
            "tools": true,
            "activity": true,
            "git": true,
            "addedDirs": true,
            "agents": true,
            "todos": true,
            "speed": true,
            "effortLevel": true
        },
        "zones": {
            "compact": ["activity", "project", "tools"],
            "peek": ["activity", "project", "tools", "git"],
            "panel": ["contextValue", "tools", "model", "git", "agents", "todos"],
            "ticker": ["activity", "project", "tools"],
            "usagePage": ["usage", "contextValue", "sessionTokens"],
            "costPage": ["cost", "sessionTokens", "model"],
            "overviewPage": ["activity", "project", "git", "agents", "todos"]
        },
        "itemOptions": {},
        "hoverDelayMs": 500,
        "collapseDelayMs": 150,
        "maxVisibleSessions": 6,
        "mascotSpeed": "normal",
        "animationIntensity": "normal",
        "autoExpandOnWaiting": true,
        "autoExpandOnCompletion": true,
        "smartSuppress": true,
        "terminalJumpBehavior": "focus",
        "panelItems": ["contextValue", "tools", "model", "git", "agents", "todos"],
        "tickerItems": ["activity", "project", "tools"]
    })
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            launch_at_login: false,
            refresh_interval_minutes: 5,
            language: "zh-CN".to_string(),
            always_show_usage: false,
            low_power_mode: false,
            fullscreen_avoidance: true,
            alerts_enabled: false,
            warning_threshold: 80,
            critical_threshold: 95,
            target_display: json!("auto"),
            top_offset_px: 0,
            overlay_position: None,
            island_width_mode: "notch".to_string(),
            chart_style: "ring".to_string(),
            cost_style: "usd".to_string(),
            token_count_mode: "all".to_string(),
            visible_providers: default_visible_providers(),
            terminal_hud: default_terminal_hud(),
            desktop_hud: default_desktop_hud(),
        }
    }
}

pub fn load_app_settings() -> AppSettings {
    let Some(path) = settings_path() else {
        return AppSettings::default();
    };

    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str::<AppSettings>(&content).ok())
        .unwrap_or_default()
}

pub fn save_app_settings(settings: AppSettings) -> Result<AppSettings, String> {
    let path = settings_path().ok_or_else(|| "APPDATA is not available".to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let content = serde_json::to_string_pretty(&settings).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())?;
    Ok(settings)
}

fn settings_path() -> Option<PathBuf> {
    env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|appdata| appdata.join("Claude HUD One").join("settings.json"))
}
