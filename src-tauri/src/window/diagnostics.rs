use std::{env, fs, path::{Path, PathBuf}, process::Command};

use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsSummary {
    pub app_version: String,
    pub app_data_dir: Option<String>,
    pub settings_path: Option<String>,
    pub settings_exists: bool,
    pub usage_cache_path: Option<String>,
    pub usage_cache_exists: bool,
    pub claude_projects_root: Option<String>,
    pub claude_projects_root_exists: bool,
    pub codex_sessions_root: Option<String>,
    pub codex_sessions_root_exists: bool,
    pub privacy_note: String,
}

pub fn get_diagnostics_summary(app: &AppHandle) -> DiagnosticsSummary {
    let app_data_dir = app_data_dir();
    let settings_path = app_data_dir.as_ref().map(|dir| dir.join("settings.json"));
    let usage_cache_path = app_data_dir.as_ref().map(|dir| dir.join("usage-cost-cache.json"));
    let claude_projects_root = claude_projects_root();
    let codex_sessions_root = codex_sessions_root();

    DiagnosticsSummary {
        app_version: app.package_info().version.to_string(),
        app_data_dir: display_path(app_data_dir.as_deref()),
        settings_exists: path_exists(settings_path.as_deref()),
        settings_path: display_path(settings_path.as_deref()),
        usage_cache_exists: path_exists(usage_cache_path.as_deref()),
        usage_cache_path: display_path(usage_cache_path.as_deref()),
        claude_projects_root_exists: path_exists(claude_projects_root.as_deref()),
        claude_projects_root: display_path(claude_projects_root.as_deref()),
        codex_sessions_root_exists: path_exists(codex_sessions_root.as_deref()),
        codex_sessions_root: display_path(codex_sessions_root.as_deref()),
        privacy_note: "Diagnostics only reports path existence, app version and cache/settings locations. It does not read or return prompt, transcript, tool-result or credential content.".to_string(),
    }
}

pub fn open_app_data_dir() -> Result<String, String> {
    let path = app_data_dir().ok_or_else(|| "APPDATA is not available".to_string())?;
    fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    open_path(&path)?;
    Ok(path.display().to_string())
}

fn app_data_dir() -> Option<PathBuf> {
    env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|appdata| appdata.join("Claude HUD One"))
}

fn claude_projects_root() -> Option<PathBuf> {
    env::var_os("CLAUDE_CONFIG_DIR")
        .and_then(|value| value.to_string_lossy().split(',').next().map(PathBuf::from))
        .map(|path| path.join("projects"))
        .or_else(|| env::var_os("USERPROFILE").map(|home| PathBuf::from(home).join(".claude").join("projects")))
}

fn codex_sessions_root() -> Option<PathBuf> {
    env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("USERPROFILE").map(|home| PathBuf::from(home).join(".codex")))
        .map(|path| path.join("sessions"))
}

fn path_exists(path: Option<&Path>) -> bool {
    path.is_some_and(Path::exists)
}

fn display_path(path: Option<&Path>) -> Option<String> {
    path.map(|path| path.display().to_string())
}

fn open_path(path: &Path) -> Result<(), String> {
    Command::new("explorer")
        .arg(path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}
