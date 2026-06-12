mod window;

use tauri::Manager;
use window::{
    claude_global::ClaudeGlobalBridgeStatus,
    claude_session::ClaudeCodeSummary,
    claude_status::ClaudeStatusBridgeState,
    diagnostics::DiagnosticsSummary,
    display::DisplayInfo,
    fullscreen::{FullscreenState, FullscreenTracker},
    overlay::{HitRegion, OverlayTracker},
    settings::{AppSettings, OverlayPosition},
    terminal_jump::{TerminalJumpRequest, TerminalJumpResult},
    updater::UpdateState,
    usage_cost::LiveUsageCostSnapshot,
};

#[tauri::command]
fn update_overlay_hit_region(
    tracker: tauri::State<'_, OverlayTracker>,
    region: HitRegion,
) -> Result<HitRegion, String> {
    tracker.set_hit_region(region);
    Ok(region)
}

#[tauri::command]
fn update_overlay_hit_regions(
    app: tauri::AppHandle,
    tracker: tauri::State<'_, OverlayTracker>,
    regions: Vec<HitRegion>,
) -> Result<Vec<HitRegion>, String> {
    if regions.is_empty() {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window::overlay::set_window_input_region(&window, None, 1.0);
        }
    }
    tracker.set_hit_regions(regions.clone());
    Ok(regions)
}

#[tauri::command]
fn update_overlay_layout(
    app: tauri::AppHandle,
    tracker: tauri::State<'_, OverlayTracker>,
    content_bounds: HitRegion,
    regions: Vec<HitRegion>,
) -> Result<Vec<HitRegion>, String> {
    let fitted_regions = window::display::fit_overlay_to_content(&app, &content_bounds, regions)?;
    tracker.set_hit_regions(fitted_regions.clone());
    Ok(fitted_regions)
}

#[tauri::command]
fn set_overlay_click_through(
    app: tauri::AppHandle,
    tracker: tauri::State<'_, OverlayTracker>,
    enabled: bool,
) -> Result<bool, String> {
    tracker.set_click_through_state(enabled);
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    window::overlay::set_click_through(&window, enabled).map_err(|error| error.to_string())?;
    Ok(enabled)
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    window::overlay::show_no_activate(&window).map_err(|error| error.to_string())
}

#[tauri::command]
fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("settings")
        .ok_or_else(|| "settings window not found".to_string())?;

    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
fn close_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("settings")
        .ok_or_else(|| "settings window not found".to_string())?;
    window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
fn list_displays(app: tauri::AppHandle) -> Result<Vec<DisplayInfo>, String> {
    window::display::list_displays(&app).map_err(|error| error.to_string())
}

#[tauri::command]
fn center_overlay_on_display(
    app: tauri::AppHandle,
    display_id: Option<String>,
    top_offset_px: Option<i32>,
) -> Result<DisplayInfo, String> {
    window::display::center_overlay_on_display(&app, display_id, top_offset_px)
}

#[tauri::command]
fn set_overlay_position(
    app: tauri::AppHandle,
    position: OverlayPosition,
) -> Result<OverlayPosition, String> {
    window::display::set_overlay_position(&app, &position)
}

#[tauri::command]
fn set_fullscreen_avoidance_enabled(
    app: tauri::AppHandle,
    tracker: tauri::State<'_, FullscreenTracker>,
    enabled: bool,
) -> Result<FullscreenState, String> {
    tracker.set_enabled(enabled);

    if enabled {
        Ok(tracker.state())
    } else {
        Ok(window::fullscreen::show_overlay_after_disabled(&app, &tracker))
    }
}

#[tauri::command]
fn get_fullscreen_state(
    tracker: tauri::State<'_, FullscreenTracker>,
) -> Result<FullscreenState, String> {
    Ok(tracker.state())
}

#[tauri::command]
fn get_claude_code_summary() -> Result<ClaudeCodeSummary, String> {
    window::claude_session::get_claude_code_summary()
}

#[tauri::command]
fn get_claude_status_bridge_state() -> Result<Option<ClaudeStatusBridgeState>, String> {
    Ok(window::claude_status::get_claude_status_bridge_state())
}

#[tauri::command]
fn get_claude_status_bridge_sessions() -> Result<Vec<ClaudeStatusBridgeState>, String> {
    Ok(window::claude_status::get_claude_status_bridge_sessions())
}

#[tauri::command]
fn get_claude_global_bridge_status() -> Result<ClaudeGlobalBridgeStatus, String> {
    Ok(window::claude_global::global_bridge_status())
}

#[tauri::command]
fn ensure_claude_global_bridge() -> Result<ClaudeGlobalBridgeStatus, String> {
    window::claude_global::ensure_global_bridge()
}

#[tauri::command]
fn enable_claude_status_line_bridge() -> Result<ClaudeGlobalBridgeStatus, String> {
    window::claude_global::enable_status_line_bridge()
}

#[tauri::command]
fn restore_claude_status_line() -> Result<ClaudeGlobalBridgeStatus, String> {
    window::claude_global::restore_status_line()
}

#[tauri::command]
fn remove_claude_global_bridge_hooks() -> Result<ClaudeGlobalBridgeStatus, String> {
    window::claude_global::remove_global_bridge_hooks()
}

#[tauri::command]
fn set_claude_hud_context_window_size(value: Option<String>) -> Result<ClaudeGlobalBridgeStatus, String> {
    window::claude_global::set_context_window_size_env(value)
}

#[tauri::command]
fn open_diagnostics_dir(kind: Option<String>) -> Result<String, String> {
    window::claude_session::open_diagnostics_dir(kind)
}

#[tauri::command]
fn get_diagnostics_summary(app: tauri::AppHandle) -> Result<DiagnosticsSummary, String> {
    Ok(window::diagnostics::get_diagnostics_summary(&app))
}

#[tauri::command]
fn open_app_data_dir() -> Result<String, String> {
    window::diagnostics::open_app_data_dir()
}

#[tauri::command]
fn get_live_usage_cost_snapshot() -> Result<LiveUsageCostSnapshot, String> {
    Ok(window::usage_cost::get_live_usage_cost_snapshot())
}

#[tauri::command]
fn jump_to_claude_session_terminal(request: TerminalJumpRequest) -> Result<TerminalJumpResult, String> {
    window::terminal_jump::jump_to_terminal(request)
}

#[tauri::command]
fn get_update_state() -> Result<UpdateState, String> {
    Ok(window::updater::update_state())
}

#[tauri::command]
fn check_for_updates() -> Result<UpdateState, String> {
    Ok(window::updater::check_for_updates())
}

#[tauri::command]
fn open_release_page() -> Result<String, String> {
    window::updater::open_release_page()
}

#[tauri::command]
fn load_app_settings() -> Result<AppSettings, String> {
    let mut settings = window::settings::load_app_settings();
    settings.launch_at_login = window::startup::get_launch_at_login();
    Ok(settings)
}

#[tauri::command]
fn save_app_settings(settings: AppSettings) -> Result<AppSettings, String> {
    let saved = window::settings::save_app_settings(settings)?;
    if let Some(context_window_size) = terminal_context_window_size_override(&saved) {
        let _ = window::claude_global::set_context_window_size_env(context_window_size);
    }
    Ok(saved)
}

fn terminal_context_window_size_override(settings: &AppSettings) -> Option<Option<String>> {
    let display = settings
        .terminal_hud
        .get("display")
        .and_then(serde_json::Value::as_object)?;
    let managed = display
        .get("contextWindowSizeOverrideManaged")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);
    if !managed {
        return None;
    }
    let value = display
        .get("contextWindowSizeOverride")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    Some(if value.is_empty() { None } else { Some(value) })
}

#[tauri::command]
fn get_launch_at_login() -> Result<bool, String> {
    Ok(window::startup::get_launch_at_login())
}

#[tauri::command]
fn set_launch_at_login(enabled: bool) -> Result<bool, String> {
    window::startup::set_launch_at_login(enabled)
}

fn settings_target_display_id(settings: &AppSettings) -> Option<String> {
    match &settings.target_display {
        serde_json::Value::String(value) if value == "auto" => None,
        serde_json::Value::String(value) => Some(value.clone()),
        serde_json::Value::Object(object) => object
            .get("id")
            .and_then(serde_json::Value::as_str)
            .map(ToString::to_string),
        _ => None,
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(OverlayTracker::default())
        .manage(FullscreenTracker::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            update_overlay_hit_region,
            update_overlay_hit_regions,
            update_overlay_layout,
            set_overlay_click_through,
            show_main_window,
            open_settings_window,
            close_settings_window,
            list_displays,
            center_overlay_on_display,
            set_overlay_position,
            set_fullscreen_avoidance_enabled,
            get_fullscreen_state,
            get_claude_code_summary,
            get_claude_status_bridge_state,
            get_claude_status_bridge_sessions,
            get_claude_global_bridge_status,
            ensure_claude_global_bridge,
            enable_claude_status_line_bridge,
            restore_claude_status_line,
            remove_claude_global_bridge_hooks,
            set_claude_hud_context_window_size,
            open_diagnostics_dir,
            get_diagnostics_summary,
            open_app_data_dir,
            get_live_usage_cost_snapshot,
            jump_to_claude_session_terminal,
            get_update_state,
            check_for_updates,
            open_release_page,
            load_app_settings,
            save_app_settings,
            get_launch_at_login,
            set_launch_at_login
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let tracker = app.state::<OverlayTracker>().inner().clone();
                window::overlay::configure_overlay_window(&window, tracker.clone())?;
                let settings = window::settings::load_app_settings();
                if let Some(position) = settings.overlay_position.as_ref() {
                    let _ = window::display::set_overlay_position(app.handle(), position);
                } else {
                    let display_id = settings_target_display_id(&settings);
                    let _ = window::display::center_overlay_on_display(app.handle(), display_id, Some(settings.top_offset_px));
                }
                window::overlay::start_hit_test_tracker(&window, tracker)?;
            }

            if let Some(settings_window) = app.get_webview_window("settings") {
                let settings_window_for_close = settings_window.clone();
                settings_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = settings_window_for_close.hide();
                    }
                });

                let _ = settings_window.show();
                let _ = settings_window.set_focus();
            }

            let fullscreen_tracker = app.state::<FullscreenTracker>().inner().clone();
            window::fullscreen::start_fullscreen_tracker(app.handle().clone(), fullscreen_tracker);
            window::single_instance::start_open_settings_listener(app.handle().clone());

            let _ = window::claude_global::ensure_global_bridge();

            window::tray::setup_tray(app.handle())?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Claude HUD One")
}
