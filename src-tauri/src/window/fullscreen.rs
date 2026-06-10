use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Deserialize, PartialEq, Serialize)]
pub struct FullscreenState {
    pub hidden: bool,
    pub reason: Option<String>,
}

#[derive(Clone)]
pub struct FullscreenTracker {
    enabled: Arc<AtomicBool>,
    state: Arc<Mutex<FullscreenState>>,
}

#[derive(Debug, Clone)]
struct MonitorRect {
    name: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[cfg(windows)]
#[derive(Debug)]
struct WindowInfo {
    rect: windows::Win32::Foundation::RECT,
    title: String,
    class_name: String,
    process_id: u32,
    process_name: String,
    style: u32,
    ex_style: u32,
}

impl Default for FullscreenTracker {
    fn default() -> Self {
        Self {
            enabled: Arc::new(AtomicBool::new(true)),
            state: Arc::new(Mutex::new(initial_fullscreen_state())),
        }
    }
}

impl FullscreenTracker {
    pub fn set_enabled(&self, enabled: bool) {
        self.enabled.store(enabled, Ordering::Relaxed);
    }

    pub fn enabled(&self) -> bool {
        self.enabled.load(Ordering::Relaxed)
    }

    pub fn state(&self) -> FullscreenState {
        self.state
            .lock()
            .map(|state| state.clone())
            .unwrap_or_else(|_| initial_fullscreen_state())
    }

    pub fn replace_state(&self, next_state: FullscreenState) -> bool {
        if let Ok(mut current) = self.state.lock() {
            if *current == next_state {
                return false;
            }

            *current = next_state;
            return true;
        }

        false
    }
}

pub fn initial_fullscreen_state() -> FullscreenState {
    FullscreenState {
        hidden: false,
        reason: None,
    }
}

pub fn start_fullscreen_tracker(app: AppHandle, tracker: FullscreenTracker) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(250));

        let next_state = detect_fullscreen_state(&app, tracker.enabled());

        if tracker.replace_state(next_state.clone()) {
            apply_fullscreen_visibility(&app, &next_state);
        }
    });
}

pub fn show_overlay_after_disabled(app: &AppHandle, tracker: &FullscreenTracker) -> FullscreenState {
    let state = initial_fullscreen_state();
    tracker.replace_state(state.clone());
    apply_fullscreen_visibility(app, &state);
    state
}

fn detect_fullscreen_state(app: &AppHandle, fullscreen_avoidance_enabled: bool) -> FullscreenState {
    #[cfg(windows)]
    {
        let monitors = monitor_rects(app);
        if let Some(reason) = screen_capture_overlay_reason(&monitors) {
            return FullscreenState {
                hidden: true,
                reason: Some(reason),
            };
        }

        if fullscreen_avoidance_enabled {
            if let Some(reason) = foreground_fullscreen_reason(monitors) {
                return FullscreenState {
                    hidden: true,
                    reason: Some(reason),
                };
            }
        }
    }

    #[cfg(not(windows))]
    {
        let _ = app;
        let _ = fullscreen_avoidance_enabled;
    }

    initial_fullscreen_state()
}

fn apply_fullscreen_visibility(app: &AppHandle, state: &FullscreenState) {
    if let Some(window) = app.get_webview_window("main") {
        if state.hidden && is_capture_overlay_state(state) {
            let _ = super::overlay::demote_no_activate(&window);
        } else if state.hidden {
            let _ = window.hide();
        } else {
            let _ = super::overlay::show_no_activate(&window);
        }
    }
}

fn is_capture_overlay_state(state: &FullscreenState) -> bool {
    state
        .reason
        .as_deref()
        .map(|reason| {
            reason.starts_with("screen capture overlay detected:")
                || reason.starts_with("fullscreen topmost overlay detected:")
        })
        .unwrap_or(false)
}

#[cfg(windows)]
fn monitor_rects(app: &AppHandle) -> Vec<MonitorRect> {
    app.available_monitors()
        .map(|monitors| {
            monitors
                .into_iter()
                .enumerate()
                .map(|(index, monitor)| {
                    let position = monitor.position();
                    let size = monitor.size();
                    MonitorRect {
                        name: monitor
                            .name()
                            .cloned()
                            .unwrap_or_else(|| format!("Display {}", index + 1)),
                        x: position.x,
                        y: position.y,
                        width: size.width,
                        height: size.height,
                    }
                })
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(windows)]
fn screen_capture_overlay_reason(monitors: &[MonitorRect]) -> Option<String> {
    let current_process_id = std::process::id();

    visible_windows().into_iter().find_map(|window| {
        if should_ignore_overlay_window(&window, current_process_id) {
            return None;
        }

        let covers_monitor = monitors
            .iter()
            .any(|monitor| rect_covers_monitor(&window.rect, monitor, 8));
        if !covers_monitor {
            return None;
        }

        let matches_capture_tool = is_capture_tool_window(&window);
        let matches_generic_overlay = is_generic_fullscreen_overlay_window(&window);

        (matches_capture_tool || matches_generic_overlay).then(|| {
            let label = window_label(&window);
            if matches_capture_tool {
                format!("screen capture overlay detected: {label}")
            } else {
                format!("fullscreen topmost overlay detected: {label}")
            }
        })
    })
}

#[cfg(windows)]
fn visible_windows() -> Vec<WindowInfo> {
    use windows::{
        core::BOOL,
        Win32::{
            Foundation::{HWND, LPARAM, RECT},
            UI::WindowsAndMessaging::{
                EnumWindows, GetWindowLongPtrW, GetWindowRect, IsWindowVisible, GWL_EXSTYLE,
                GWL_STYLE,
            },
        },
    };

    unsafe extern "system" fn enum_window(hwnd: HWND, lparam: LPARAM) -> BOOL {
        if !unsafe { IsWindowVisible(hwnd).as_bool() } {
            return BOOL(1);
        }

        let mut rect = RECT::default();
        if unsafe { GetWindowRect(hwnd, &mut rect) }.is_err() {
            return BOOL(1);
        }

        if rect.right <= rect.left || rect.bottom <= rect.top {
            return BOOL(1);
        }

        let (process_id, process_name) = window_process_info(hwnd);
        let windows = unsafe { &mut *(lparam.0 as *mut Vec<WindowInfo>) };
        windows.push(WindowInfo {
            rect,
            title: window_title(hwnd),
            class_name: window_class_name(hwnd),
            process_id,
            process_name,
            style: unsafe { GetWindowLongPtrW(hwnd, GWL_STYLE) as u32 },
            ex_style: unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32 },
        });

        BOOL(1)
    }

    let mut windows = Vec::new();
    unsafe {
        let _ = EnumWindows(Some(enum_window), LPARAM(&mut windows as *mut _ as isize));
    }
    windows
}

#[cfg(windows)]
fn window_title(hwnd: windows::Win32::Foundation::HWND) -> String {
    use windows::Win32::UI::WindowsAndMessaging::{GetWindowTextLengthW, GetWindowTextW};

    let length = unsafe { GetWindowTextLengthW(hwnd) };
    if length <= 0 {
        return String::new();
    }

    let mut buffer = vec![0_u16; length as usize + 1];
    let copied = unsafe { GetWindowTextW(hwnd, &mut buffer) };
    String::from_utf16_lossy(&buffer[..copied.max(0) as usize])
}

#[cfg(windows)]
fn window_class_name(hwnd: windows::Win32::Foundation::HWND) -> String {
    use windows::Win32::UI::WindowsAndMessaging::GetClassNameW;

    let mut buffer = vec![0_u16; 256];
    let copied = unsafe { GetClassNameW(hwnd, &mut buffer) };
    String::from_utf16_lossy(&buffer[..copied.max(0) as usize])
}

#[cfg(windows)]
fn window_process_info(hwnd: windows::Win32::Foundation::HWND) -> (u32, String) {
    use std::path::Path;
    use windows::{
        core::PWSTR,
        Win32::{
            Foundation::CloseHandle,
            System::Threading::{
                OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
                PROCESS_QUERY_LIMITED_INFORMATION,
            },
            UI::WindowsAndMessaging::GetWindowThreadProcessId,
        },
    };

    let mut process_id = 0_u32;
    unsafe {
        GetWindowThreadProcessId(hwnd, Some(&mut process_id));
    }
    if process_id == 0 {
        return (0, String::new());
    }

    let Ok(process) = (unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id) }) else {
        return (process_id, String::new());
    };

    let mut buffer = vec![0_u16; 32_768];
    let mut size = buffer.len() as u32;
    let path = if unsafe {
        QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, PWSTR(buffer.as_mut_ptr()), &mut size)
    }
    .is_ok()
    {
        String::from_utf16_lossy(&buffer[..size as usize])
    } else {
        String::new()
    };

    unsafe {
        let _ = CloseHandle(process);
    }

    let name = Path::new(&path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(path.as_str())
        .to_string();

    (process_id, name)
}

#[cfg(windows)]
fn window_label(window: &WindowInfo) -> String {
    if !window.process_name.is_empty() {
        return window.process_name.clone();
    }

    if !window.title.is_empty() {
        return window.title.clone();
    }

    if !window.class_name.is_empty() {
        return window.class_name.clone();
    }

    format!("pid {}", window.process_id)
}

#[cfg(windows)]
fn should_ignore_overlay_window(window: &WindowInfo, current_process_id: u32) -> bool {
    if window.process_id == current_process_id {
        return true;
    }

    let class_name = window.class_name.to_ascii_lowercase();
    let process_name = window.process_name.to_ascii_lowercase();

    class_name == "progman"
        || class_name == "workerw"
        || class_name == "shell_traywnd"
        || class_name == "shell_secondarytraywnd"
        || class_name == "button"
        || process_name == "explorer.exe" && class_name.contains("tray")
}

#[cfg(windows)]
fn is_capture_tool_window(window: &WindowInfo) -> bool {
    let title = window.title.to_ascii_lowercase();
    let class_name = window.class_name.to_ascii_lowercase();
    let process_name = window.process_name.to_ascii_lowercase();

    process_name.contains("screenclippinghost.exe")
        || process_name.contains("snippingtool.exe")
        || process_name.contains("snipandsketch.exe")
        || title.contains("snipping tool")
        || title.contains("screen snipping")
        || title.contains("screen clipping")
        || title.contains("屏幕截图")
        || title.contains("截图")
        || title.contains("截屏")
        || class_name.contains("screenclipping")
}

#[cfg(windows)]
fn is_generic_fullscreen_overlay_window(window: &WindowInfo) -> bool {
    use windows::Win32::UI::WindowsAndMessaging::{
        WS_CAPTION, WS_CHILD, WS_EX_APPWINDOW, WS_EX_LAYERED, WS_EX_TOOLWINDOW,
        WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP, WS_THICKFRAME,
    };

    if window.style & WS_CHILD.0 != 0 {
        return false;
    }

    let title_is_empty = window.title.trim().is_empty();
    let is_topmost = window.ex_style & WS_EX_TOPMOST.0 != 0;
    let is_layered = window.ex_style & WS_EX_LAYERED.0 != 0;
    let is_transparent = window.ex_style & WS_EX_TRANSPARENT.0 != 0;
    let is_toolwindow = window.ex_style & WS_EX_TOOLWINDOW.0 != 0;
    let is_appwindow = window.ex_style & WS_EX_APPWINDOW.0 != 0;
    let is_popup = window.style & WS_POPUP.0 != 0;
    let has_caption = window.style & WS_CAPTION.0 != 0;
    let has_thickframe = window.style & WS_THICKFRAME.0 != 0;
    let is_borderless_popup = is_popup && !has_caption && !has_thickframe;

    if !is_topmost || !is_borderless_popup {
        return false;
    }

    let mut score = 0;
    if is_topmost {
        score += 3;
    }
    if is_layered {
        score += 2;
    }
    if is_borderless_popup {
        score += 2;
    }
    if is_transparent {
        score += 1;
    }
    if is_toolwindow {
        score += 1;
    }
    if title_is_empty {
        score += 1;
    }
    if !is_appwindow {
        score += 1;
    }

    score >= 7 && (is_layered || is_transparent || is_toolwindow || title_is_empty)
}

#[cfg(windows)]
fn rect_covers_monitor(rect: &windows::Win32::Foundation::RECT, monitor: &MonitorRect, tolerance: i32) -> bool {
    let monitor_right = monitor.x + monitor.width as i32;
    let monitor_bottom = monitor.y + monitor.height as i32;

    rect.left <= monitor.x + tolerance
        && rect.top <= monitor.y + tolerance
        && rect.right >= monitor_right - tolerance
        && rect.bottom >= monitor_bottom - tolerance
}

#[cfg(windows)]
fn foreground_fullscreen_reason(monitors: Vec<MonitorRect>) -> Option<String> {
    use windows::Win32::{
        Foundation::RECT,
        UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowRect, IsWindowVisible},
    };

    let foreground = unsafe { GetForegroundWindow() };
    if foreground.0.is_null() || !unsafe { IsWindowVisible(foreground).as_bool() } {
        return None;
    }

    let mut rect = RECT::default();
    unsafe {
        GetWindowRect(foreground, &mut rect).ok()?;
    }

    let window_width = rect.right - rect.left;
    let window_height = rect.bottom - rect.top;
    if window_width <= 0 || window_height <= 0 {
        return None;
    }

    let tolerance = 4_i32;
    monitors.into_iter().find_map(|monitor| {
        let monitor_right = monitor.x + monitor.width as i32;
        let monitor_bottom = monitor.y + monitor.height as i32;
        let covers_monitor = rect.left <= monitor.x + tolerance
            && rect.top <= monitor.y + tolerance
            && rect.right >= monitor_right - tolerance
            && rect.bottom >= monitor_bottom - tolerance;

        covers_monitor.then(|| format!("foreground window covers {}", monitor.name))
    })
}
