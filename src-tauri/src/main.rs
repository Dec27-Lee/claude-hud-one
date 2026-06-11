#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
use windows::{
    core::w,
    Win32::{
        Foundation::{CloseHandle, GetLastError, HANDLE, ERROR_ALREADY_EXISTS},
        System::Threading::{CreateMutexW, OpenEventW, SetEvent, EVENT_MODIFY_STATE},
        UI::WindowsAndMessaging::{FindWindowW, SetForegroundWindow, ShowWindow, SW_SHOWNORMAL},
    },
};

#[cfg(windows)]
struct SingleInstanceGuard(HANDLE);

#[cfg(windows)]
impl Drop for SingleInstanceGuard {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}

#[cfg(windows)]
fn acquire_single_instance() -> Option<SingleInstanceGuard> {
    let mutex = unsafe { CreateMutexW(None, true, w!("Local\\ClaudeHUDOne.SingleInstance")) }.ok()?;
    let already_running = unsafe { GetLastError() } == ERROR_ALREADY_EXISTS;

    if already_running {
        unsafe {
            let _ = CloseHandle(mutex);
        }
        signal_existing_instance();
        return None;
    }

    Some(SingleInstanceGuard(mutex))
}

#[cfg(windows)]
fn signal_existing_instance() {
    if let Ok(event) = unsafe { OpenEventW(EVENT_MODIFY_STATE, false, w!("Local\\ClaudeHUDOne.OpenSettings")) } {
        unsafe {
            let _ = SetEvent(event);
            let _ = CloseHandle(event);
        }
    }

    raise_existing_settings_window();
}

#[cfg(windows)]
fn raise_existing_settings_window() {
    let Ok(window) = (unsafe { FindWindowW(None, w!("Claude HUD One Settings")) }) else {
        return;
    };

    unsafe {
        let _ = ShowWindow(window, SW_SHOWNORMAL);
        let _ = SetForegroundWindow(window);
    }
}

fn main() {
    #[cfg(windows)]
    let _single_instance = match acquire_single_instance() {
        Some(guard) => guard,
        None => return,
    };

    claude_hud_one_lib::run()
}
