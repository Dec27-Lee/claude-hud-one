use tauri::AppHandle;

#[cfg(windows)]
pub fn start_open_settings_listener(app: AppHandle) {
    use std::{ffi::c_void, thread};

    use windows::{
        core::w,
        Win32::{
            Foundation::{CloseHandle, HANDLE, WAIT_OBJECT_0},
            System::Threading::{CreateEventW, WaitForSingleObject, INFINITE},
        },
    };

    let Ok(event) = (unsafe { CreateEventW(None, false, false, w!("Local\\ClaudeHUDOne.OpenSettings")) }) else {
        return;
    };
    let event_raw = event.0 as isize;

    thread::spawn(move || {
        let event = HANDLE(event_raw as *mut c_void);

        loop {
            let wait_result = unsafe { WaitForSingleObject(event, INFINITE) };
            if wait_result != WAIT_OBJECT_0 {
                break;
            }

            let app_for_ui = app.clone();
            let _ = app.run_on_main_thread(move || {
                super::tray::show_main_and_settings(&app_for_ui);
            });
        }

        unsafe {
            let _ = CloseHandle(event);
        }
    });
}

#[cfg(not(windows))]
pub fn start_open_settings_listener(_app: AppHandle) {}
