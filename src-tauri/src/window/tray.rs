use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

const TRAY_SHOW: &str = "tray-show-island";
const TRAY_SETTINGS: &str = "tray-open-settings";
const TRAY_HIDE: &str = "tray-hide-island";
const TRAY_QUIT: &str = "tray-quit";

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, TRAY_SHOW, "Show Island", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, TRAY_SETTINGS, "Settings", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, TRAY_HIDE, "Hide Island", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, TRAY_QUIT, "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &settings, &hide, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("Claude Island Win")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            TRAY_SHOW => show_main_window(app),
            TRAY_SETTINGS => show_settings_window(app),
            TRAY_HIDE => hide_main_window(app),
            TRAY_QUIT => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. }
            | TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } => {
                show_main_window(tray.app_handle());
            }
            _ => {}
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = super::overlay::show_no_activate(&window);
    }
}

fn hide_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

fn show_settings_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
