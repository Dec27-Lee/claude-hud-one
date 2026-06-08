use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::WebviewWindow;

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
pub struct HitRegion {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl HitRegion {
    fn is_valid(&self) -> bool {
        self.x.is_finite()
            && self.y.is_finite()
            && self.width.is_finite()
            && self.height.is_finite()
            && self.width > 0.0
            && self.height > 0.0
    }
}

impl Default for HitRegion {
    fn default() -> Self {
        Self {
            x: 308.0,
            y: 10.0,
            width: 284.0,
            height: 54.0,
        }
    }
}

#[derive(Clone)]
pub struct OverlayTracker {
    hit_regions: Arc<Mutex<Vec<HitRegion>>>,
    click_through: Arc<AtomicBool>,
}

impl Default for OverlayTracker {
    fn default() -> Self {
        Self {
            hit_regions: Arc::new(Mutex::new(vec![HitRegion::default()])),
            click_through: Arc::new(AtomicBool::new(false)),
        }
    }
}

impl OverlayTracker {
    pub fn set_hit_region(&self, region: HitRegion) {
        self.set_hit_regions(vec![region]);
    }

    pub fn set_hit_regions(&self, regions: Vec<HitRegion>) {
        let valid_regions = regions
            .into_iter()
            .filter(HitRegion::is_valid)
            .collect::<Vec<_>>();

        if let Ok(mut current) = self.hit_regions.lock() {
            *current = valid_regions;
        }
    }

    fn hit_regions(&self) -> Vec<HitRegion> {
        self.hit_regions
            .lock()
            .map(|regions| regions.clone())
            .unwrap_or_else(|_| vec![HitRegion::default()])
    }

    fn replace_click_through(&self, enabled: bool) -> bool {
        self.click_through.swap(enabled, Ordering::Relaxed)
    }
}

pub fn configure_overlay_window(window: &WebviewWindow) -> tauri::Result<()> {
    window.set_always_on_top(true)?;
    window.set_decorations(false)?;
    window.set_shadow(false)?;
    apply_native_overlay_styles(window, false)?;
    install_mouse_activate_guard(window)?;
    Ok(())
}

pub fn set_click_through(window: &WebviewWindow, enabled: bool) -> tauri::Result<()> {
    apply_native_overlay_styles(window, enabled)
}

pub fn show_no_activate(window: &WebviewWindow) -> tauri::Result<()> {
    #[cfg(windows)]
    {
        let hwnd = window.hwnd()?;
        show_hwnd_no_activate(hwnd.0 as isize);
        Ok(())
    }

    #[cfg(not(windows))]
    {
        window.show()
    }
}

pub fn start_hit_test_tracker(window: &WebviewWindow, tracker: OverlayTracker) -> tauri::Result<()> {
    #[cfg(windows)]
    {
        let hwnd = window.hwnd()?;
        let hwnd_value = hwnd.0 as isize;

        thread::spawn(move || loop {
            thread::sleep(Duration::from_millis(50));

            let Some(inside) = cursor_inside_hit_regions(hwnd_value, tracker.hit_regions()) else {
                continue;
            };
            let next_click_through = !inside;

            if tracker.replace_click_through(next_click_through) != next_click_through {
                apply_native_overlay_styles_hwnd(hwnd_value, next_click_through);
            }
        });
    }

    #[cfg(not(windows))]
    {
        let _ = window;
        let _ = tracker;
    }

    Ok(())
}

#[cfg(windows)]
fn apply_native_overlay_styles(window: &WebviewWindow, click_through: bool) -> tauri::Result<()> {
    let hwnd = window.hwnd()?;
    apply_native_overlay_styles_hwnd(hwnd.0 as isize, click_through);
    Ok(())
}

#[cfg(windows)]
fn install_mouse_activate_guard(window: &WebviewWindow) -> tauri::Result<()> {
    use windows::Win32::{
        Foundation::{HWND, LPARAM, LRESULT, WPARAM},
        UI::{
            Shell::{DefSubclassProc, SetWindowSubclass},
            WindowsAndMessaging::{MA_NOACTIVATE, WM_MOUSEACTIVATE},
        },
    };

    const OVERLAY_SUBCLASS_ID: usize = 1;

    unsafe extern "system" fn subclass_proc(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _subclass_id: usize,
        _ref_data: usize,
    ) -> LRESULT {
        if message == WM_MOUSEACTIVATE {
            return LRESULT(MA_NOACTIVATE as isize);
        }

        unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
    }

    let hwnd = window.hwnd()?;
    unsafe {
        let _ = SetWindowSubclass(hwnd, Some(subclass_proc), OVERLAY_SUBCLASS_ID, 0);
    }

    Ok(())
}

#[cfg(not(windows))]
fn install_mouse_activate_guard(_window: &WebviewWindow) -> tauri::Result<()> {
    Ok(())
}

#[cfg(windows)]
fn apply_native_overlay_styles_hwnd(hwnd_value: isize, click_through: bool) {
    use windows::Win32::{
        Foundation::HWND,
        UI::WindowsAndMessaging::{
            GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, HWND_TOPMOST,
            SET_WINDOW_POS_FLAGS, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW,
            WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT,
        },
    };

    let hwnd = HWND(hwnd_value as *mut core::ffi::c_void);

    unsafe {
        let current_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let mut next_style = current_style | WS_EX_LAYERED.0 | WS_EX_TOOLWINDOW.0 | WS_EX_NOACTIVATE.0;

        if click_through {
            next_style |= WS_EX_TRANSPARENT.0;
        } else {
            next_style &= !WS_EX_TRANSPARENT.0;
        }

        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next_style as isize);

        let flags = SET_WINDOW_POS_FLAGS(
            SWP_NOMOVE.0 | SWP_NOSIZE.0 | SWP_NOACTIVATE.0 | SWP_SHOWWINDOW.0,
        );
        let _ = SetWindowPos(hwnd, Some(HWND_TOPMOST), 0, 0, 0, 0, flags);
    }
}

#[cfg(windows)]
fn show_hwnd_no_activate(hwnd_value: isize) {
    use windows::Win32::{
        Foundation::HWND,
        UI::WindowsAndMessaging::{
            SetWindowPos, HWND_TOPMOST, SET_WINDOW_POS_FLAGS, SWP_NOACTIVATE, SWP_NOMOVE,
            SWP_NOSIZE, SWP_SHOWWINDOW,
        },
    };

    let hwnd = HWND(hwnd_value as *mut core::ffi::c_void);
    let flags = SET_WINDOW_POS_FLAGS(
        SWP_NOMOVE.0 | SWP_NOSIZE.0 | SWP_NOACTIVATE.0 | SWP_SHOWWINDOW.0,
    );

    unsafe {
        let _ = SetWindowPos(hwnd, Some(HWND_TOPMOST), 0, 0, 0, 0, flags);
    }
}

#[cfg(windows)]
fn cursor_inside_hit_regions(hwnd_value: isize, regions: Vec<HitRegion>) -> Option<bool> {
    use windows::Win32::{
        Foundation::{HWND, POINT, RECT},
        UI::WindowsAndMessaging::{GetCursorPos, GetWindowRect},
    };

    let hwnd = HWND(hwnd_value as *mut core::ffi::c_void);
    let mut cursor = POINT::default();
    let mut window_rect = RECT::default();

    unsafe {
        GetCursorPos(&mut cursor).ok()?;
        GetWindowRect(hwnd, &mut window_rect).ok()?;
    }

    let cursor_x = cursor.x as f64;
    let cursor_y = cursor.y as f64;

    Some(regions.iter().any(|region| {
        let left = window_rect.left as f64 + region.x;
        let top = window_rect.top as f64 + region.y;
        let right = left + region.width;
        let bottom = top + region.height;

        cursor_x >= left && cursor_x <= right && cursor_y >= top && cursor_y <= bottom
    }))
}

#[cfg(not(windows))]
fn apply_native_overlay_styles(_window: &WebviewWindow, _click_through: bool) -> tauri::Result<()> {
    Ok(())
}
