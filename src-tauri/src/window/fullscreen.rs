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
        thread::sleep(Duration::from_millis(750));

        let next_state = if tracker.enabled() {
            detect_fullscreen_state(&app)
        } else {
            initial_fullscreen_state()
        };

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

fn detect_fullscreen_state(app: &AppHandle) -> FullscreenState {
    #[cfg(windows)]
    {
        let monitors = monitor_rects(app);
        if let Some(reason) = foreground_fullscreen_reason(monitors) {
            return FullscreenState {
                hidden: true,
                reason: Some(reason),
            };
        }
    }

    #[cfg(not(windows))]
    {
        let _ = app;
    }

    initial_fullscreen_state()
}

fn apply_fullscreen_visibility(app: &AppHandle, state: &FullscreenState) {
    if let Some(window) = app.get_webview_window("main") {
        if state.hidden {
            let _ = window.hide();
        } else {
            let _ = super::overlay::show_no_activate(&window);
        }
    }
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
