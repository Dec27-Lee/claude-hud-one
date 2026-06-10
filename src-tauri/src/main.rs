#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
use windows::{
    core::w,
    Win32::{
        Foundation::{CloseHandle, GetLastError, HANDLE, ERROR_ALREADY_EXISTS},
        System::Threading::CreateMutexW,
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
        return None;
    }

    Some(SingleInstanceGuard(mutex))
}

fn main() {
    #[cfg(windows)]
    let _single_instance = match acquire_single_instance() {
        Some(guard) => guard,
        None => return,
    };

    claude_hud_one_lib::run()
}
