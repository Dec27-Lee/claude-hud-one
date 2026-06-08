mod window;

use tauri::Manager;
use window::{
    claude_session::ClaudeCodeSummary,
    claude_status::ClaudeStatusBridgeState,
    diagnostics::DiagnosticsSummary,
    display::DisplayInfo,
    fullscreen::{FullscreenState, FullscreenTracker},
    overlay::{HitRegion, OverlayTracker},
    settings::AppSettings,
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
    tracker: tauri::State<'_, OverlayTracker>,
    regions: Vec<HitRegion>,
) -> Result<Vec<HitRegion>, String> {
    tracker.set_hit_regions(regions.clone());
    Ok(regions)
}

#[tauri::command]
fn set_overlay_click_through(app: tauri::AppHandle, enabled: bool) -> Result<bool, String> {
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
fn get_update_state() -> Result<UpdateState, String> {
    Ok(window::updater::update_state())
}

#[tauri::command]
fn check_for_updates() -> Result<UpdateState, String> {
    Ok(window::updater::check_for_updates())
}

#[tauri::command]
fn load_app_settings() -> Result<AppSettings, String> {
    let mut settings = window::settings::load_app_settings();
    settings.launch_at_login = window::startup::get_launch_at_login();
    Ok(settings)
}

#[tauri::command]
fn save_app_settings(settings: AppSettings) -> Result<AppSettings, String> {
    window::settings::save_app_settings(settings)
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
            set_overlay_click_through,
            show_main_window,
            open_settings_window,
            close_settings_window,
            list_displays,
            center_overlay_on_display,
            set_fullscreen_avoidance_enabled,
            get_fullscreen_state,
            get_claude_code_summary,
            get_claude_status_bridge_state,
            open_diagnostics_dir,
            get_diagnostics_summary,
            open_app_data_dir,
            get_live_usage_cost_snapshot,
            get_update_state,
            check_for_updates,
            load_app_settings,
            save_app_settings,
            get_launch_at_login,
            set_launch_at_login
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let tracker = app.state::<OverlayTracker>().inner().clone();
                window::overlay::configure_overlay_window(&window)?;
                let settings = window::settings::load_app_settings();
                let display_id = settings_target_display_id(&settings);
                let _ = window::display::center_overlay_on_display(app.handle(), display_id, Some(settings.top_offset_px));
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
            }

            let fullscreen_tracker = app.state::<FullscreenTracker>().inner().clone();
            window::fullscreen::start_fullscreen_tracker(app.handle().clone(), fullscreen_tracker);

            window::tray::setup_tray(app.handle())?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Claude Island Win")
}
