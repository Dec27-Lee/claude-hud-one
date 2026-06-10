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

#[derive(Clone)]
pub struct OverlayTracker {
    hit_regions: Arc<Mutex<Vec<HitRegion>>>,
    click_through: Arc<AtomicBool>,
}

impl Default for OverlayTracker {
    fn default() -> Self {
        Self {
            hit_regions: Arc::new(Mutex::new(Vec::new())),
            click_through: Arc::new(AtomicBool::new(true)),
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
            .unwrap_or_default()
    }

    fn replace_click_through(&self, enabled: bool) -> bool {
        self.click_through.swap(enabled, Ordering::Relaxed)
    }
}

pub fn configure_overlay_window(
    window: &WebviewWindow,
    tracker: OverlayTracker,
) -> tauri::Result<()> {
    window.set_always_on_top(true)?;
    window.set_decorations(false)?;
    window.set_shadow(false)?;
    apply_native_overlay_styles(window, true, false)?;
    install_mouse_activate_guard(window, tracker)?;
    Ok(())
}

pub fn set_click_through(window: &WebviewWindow, enabled: bool) -> tauri::Result<()> {
    apply_native_overlay_styles(window, enabled, true)
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

pub fn demote_no_activate(window: &WebviewWindow) -> tauri::Result<()> {
    #[cfg(windows)]
    {
        let hwnd = window.hwnd()?;
        demote_hwnd_no_activate(hwnd.0 as isize);
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
            thread::sleep(Duration::from_millis(25));

            let next_click_through = match cursor_inside_hit_regions(hwnd_value, tracker.hit_regions()) {
                Some(inside) => !inside,
                None => true,
            };

            if tracker.replace_click_through(next_click_through) != next_click_through {
                apply_native_overlay_styles_hwnd(hwnd_value, next_click_through, true);
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
fn apply_native_overlay_styles(
    window: &WebviewWindow,
    click_through: bool,
    preserve_z_order: bool,
) -> tauri::Result<()> {
    let hwnd = window.hwnd()?;
    apply_native_overlay_styles_hwnd(hwnd.0 as isize, click_through, preserve_z_order);
    Ok(())
}

#[cfg(windows)]
fn install_mouse_activate_guard(
    window: &WebviewWindow,
    tracker: OverlayTracker,
) -> tauri::Result<()> {
    use windows::Win32::{
        Foundation::{HWND, LPARAM, LRESULT, WPARAM},
        UI::{
            Shell::{DefSubclassProc, SetWindowSubclass},
            WindowsAndMessaging::{HTCLIENT, HTTRANSPARENT, MA_NOACTIVATE, WM_MOUSEACTIVATE, WM_NCHITTEST},
        },
    };

    const OVERLAY_SUBCLASS_ID: usize = 1;

    unsafe extern "system" fn subclass_proc(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _subclass_id: usize,
        ref_data: usize,
    ) -> LRESULT {
        if message == WM_MOUSEACTIVATE {
            return LRESULT(MA_NOACTIVATE as isize);
        }

        if message == WM_NCHITTEST {
            let hit_regions = unsafe { &*(ref_data as *const Arc<Mutex<Vec<HitRegion>>>) };
            let (cursor_x, cursor_y) = point_from_lparam(lparam);
            let inside = hit_regions
                .lock()
                .ok()
                .and_then(|regions| point_inside_hit_regions(hwnd.0 as isize, cursor_x, cursor_y, &regions))
                .unwrap_or(false);

            return if inside {
                LRESULT(HTCLIENT as isize)
            } else {
                LRESULT(HTTRANSPARENT as isize)
            };
        }

        unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
    }

    let hwnd = window.hwnd()?;
    let hit_regions = tracker.hit_regions.clone();
    let ref_data = Box::into_raw(Box::new(hit_regions)) as usize;
    unsafe {
        let _ = SetWindowSubclass(hwnd, Some(subclass_proc), OVERLAY_SUBCLASS_ID, ref_data);
    }

    Ok(())
}

#[cfg(not(windows))]
fn install_mouse_activate_guard(
    _window: &WebviewWindow,
    _tracker: OverlayTracker,
) -> tauri::Result<()> {
    Ok(())
}

#[cfg(windows)]
fn apply_native_overlay_styles_hwnd(
    hwnd_value: isize,
    click_through: bool,
    preserve_z_order: bool,
) {
    use windows::Win32::{
        Foundation::HWND,
        UI::WindowsAndMessaging::{
            GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, HWND_TOPMOST,
            SET_WINDOW_POS_FLAGS, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER,
            SWP_SHOWWINDOW, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
            WS_EX_TRANSPARENT,
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

        let mut flags = SET_WINDOW_POS_FLAGS(
            SWP_NOMOVE.0 | SWP_NOSIZE.0 | SWP_NOACTIVATE.0 | SWP_SHOWWINDOW.0,
        );
        let insert_after = if preserve_z_order {
            flags = SET_WINDOW_POS_FLAGS(flags.0 | SWP_NOZORDER.0);
            None
        } else {
            Some(HWND_TOPMOST)
        };
        let _ = SetWindowPos(hwnd, insert_after, 0, 0, 0, 0, flags);
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
fn demote_hwnd_no_activate(hwnd_value: isize) {
    use windows::Win32::{
        Foundation::HWND,
        UI::WindowsAndMessaging::{
            SetWindowPos, HWND_NOTOPMOST, SET_WINDOW_POS_FLAGS, SWP_NOACTIVATE, SWP_NOMOVE,
            SWP_NOSIZE, SWP_SHOWWINDOW,
        },
    };

    let hwnd = HWND(hwnd_value as *mut core::ffi::c_void);
    let flags = SET_WINDOW_POS_FLAGS(
        SWP_NOMOVE.0 | SWP_NOSIZE.0 | SWP_NOACTIVATE.0 | SWP_SHOWWINDOW.0,
    );

    unsafe {
        let _ = SetWindowPos(hwnd, Some(HWND_NOTOPMOST), 0, 0, 0, 0, flags);
    }
}

#[cfg(windows)]
fn cursor_inside_hit_regions(hwnd_value: isize, regions: Vec<HitRegion>) -> Option<bool> {
    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
    use windows::Win32::Foundation::POINT;

    let mut cursor = POINT::default();

    unsafe {
        GetCursorPos(&mut cursor).ok()?;
    }

    point_inside_hit_regions(hwnd_value, cursor.x as f64, cursor.y as f64, &regions)
}

#[cfg(windows)]
fn point_inside_hit_regions(
    hwnd_value: isize,
    cursor_x: f64,
    cursor_y: f64,
    regions: &[HitRegion],
) -> Option<bool> {
    use windows::Win32::{
        Foundation::{HWND, RECT},
        UI::WindowsAndMessaging::GetWindowRect,
    };

    if regions.is_empty() {
        return Some(false);
    }

    let hwnd = HWND(hwnd_value as *mut core::ffi::c_void);
    let mut window_rect = RECT::default();

    unsafe {
        GetWindowRect(hwnd, &mut window_rect).ok()?;
    }

    Some(regions.iter().any(|region| {
        let left = window_rect.left as f64 + region.x;
        let top = window_rect.top as f64 + region.y;
        let right = left + region.width;
        let bottom = top + region.height;

        cursor_x >= left && cursor_x <= right && cursor_y >= top && cursor_y <= bottom
    }))
}

#[cfg(windows)]
fn point_from_lparam(lparam: windows::Win32::Foundation::LPARAM) -> (f64, f64) {
    let value = lparam.0 as u32;
    let x = (value & 0xffff) as i16 as f64;
    let y = ((value >> 16) & 0xffff) as i16 as f64;
    (x, y)
}

#[cfg(not(windows))]
fn apply_native_overlay_styles(
    _window: &WebviewWindow,
    _click_through: bool,
    _preserve_z_order: bool,
) -> tauri::Result<()> {
    Ok(())
}
