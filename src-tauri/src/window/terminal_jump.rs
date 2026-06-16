use std::{
    collections::{HashMap, HashSet},
    env,
    path::{Path, PathBuf},
    process::Command,
};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalJumpRequest {
    pub behavior: Option<String>,
    pub cwd: Option<String>,
    pub fallback_cwd: Option<String>,
    pub bridge_process_id: Option<u32>,
    pub bridge_parent_process_id: Option<u32>,
    pub window_title_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalJumpResult {
    pub action: String,
    pub cwd: Option<String>,
    pub message: String,
}

fn raw_cwd_label(request: &TerminalJumpRequest) -> Option<String> {
    request
        .cwd
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| request.fallback_cwd.as_deref().filter(|value| !value.trim().is_empty()))
        .map(|value| value.trim().to_string())
}

pub fn jump_to_terminal(request: TerminalJumpRequest) -> Result<TerminalJumpResult, String> {
    #[cfg(not(target_os = "windows"))]
    {
        if request.behavior.as_deref() == Some("disabled") {
            return Ok(TerminalJumpResult {
                action: "disabled".to_string(),
                cwd: raw_cwd_label(&request),
                message: "Terminal jump is disabled.".to_string(),
            });
        }

        Ok(TerminalJumpResult {
            action: "unsupported".to_string(),
            cwd: raw_cwd_label(&request),
            message: "Terminal jump is currently only supported on Windows.".to_string(),
        })
    }

    #[cfg(target_os = "windows")]
    {
        let behavior = request.behavior.as_deref().unwrap_or("openCwd");
        let cwd_label = raw_cwd_label(&request);

        if behavior == "disabled" {
            return Ok(TerminalJumpResult {
                action: "disabled".to_string(),
                cwd: cwd_label,
                message: "Terminal jump is disabled.".to_string(),
            });
        }

        if focus_existing_terminal(
            request.bridge_process_id,
            request.bridge_parent_process_id,
            cwd_label.as_deref(),
            request.window_title_hint.as_deref(),
        ) {
            return Ok(TerminalJumpResult {
                action: "focused".to_string(),
                cwd: cwd_label,
                message: "Focused an existing Windows Terminal for this Claude Code session.".to_string(),
            });
        }

        if behavior == "focus" {
            return Ok(TerminalJumpResult {
                action: "notFound".to_string(),
                cwd: cwd_label,
                message: "No existing Windows Terminal window was found for this Claude Code session.".to_string(),
            });
        }

        let cwd = request
            .cwd
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .or_else(|| request.fallback_cwd.as_deref().filter(|value| !value.trim().is_empty()))
            .ok_or_else(|| "No working directory was captured for this Claude Code session.".to_string())?;

        let canonical_cwd = canonical_directory(cwd)?;
        let canonical_label = canonical_cwd.to_string_lossy().to_string();
        open_windows_terminal(&canonical_cwd)?;

        Ok(TerminalJumpResult {
            action: "opened".to_string(),
            cwd: Some(canonical_label.clone()),
            message: format!("Opened Windows Terminal at {canonical_label}"),
        })
    }
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone)]
struct ProcessInfo {
    parent_pid: u32,
    exe_name: String,
}

#[cfg(target_os = "windows")]
struct SnapshotHandle(windows::Win32::Foundation::HANDLE);

#[cfg(target_os = "windows")]
impl Drop for SnapshotHandle {
    fn drop(&mut self) {
        unsafe {
            let _ = windows::Win32::Foundation::CloseHandle(self.0);
        }
    }
}

#[cfg(target_os = "windows")]
fn focus_existing_terminal(
    bridge_process_id: Option<u32>,
    bridge_parent_process_id: Option<u32>,
    cwd_label: Option<&str>,
    window_title_hint: Option<&str>,
) -> bool {
    let Some(processes) = snapshot_processes() else {
        return false;
    };

    for terminal_pid in terminal_ancestor_pids(&processes, bridge_process_id, bridge_parent_process_id) {
        if focus_visible_top_level_window_for_pid(terminal_pid) {
            return true;
        }
    }

    let terminal_windows = visible_terminal_windows(&processes);
    let hints = terminal_window_hints(cwd_label, window_title_hint);

    if let Some(window) = best_terminal_window_title_match(&terminal_windows, &hints) {
        return focus_window(window.hwnd);
    }

    if terminal_windows.len() == 1 {
        return focus_window(terminal_windows[0].hwnd);
    }

    false
}

#[cfg(target_os = "windows")]
fn terminal_ancestor_pids(
    processes: &HashMap<u32, ProcessInfo>,
    bridge_process_id: Option<u32>,
    bridge_parent_process_id: Option<u32>,
) -> Vec<u32> {
    let mut start_pids = Vec::new();
    if let Some(pid) = bridge_process_id.filter(|pid| *pid > 0) {
        start_pids.push(pid);
    }
    if let Some(pid) = bridge_parent_process_id.filter(|pid| *pid > 0 && Some(*pid) != bridge_process_id) {
        start_pids.push(pid);
    }

    let mut windows_terminal_pids = Vec::new();
    let mut launcher_pids = Vec::new();
    let mut seen = HashSet::new();

    for start_pid in start_pids {
        let mut current_pid = start_pid;
        while current_pid != 0 && seen.insert((start_pid, current_pid)) {
            let Some(process) = processes.get(&current_pid) else {
                break;
            };

            if process.exe_name.eq_ignore_ascii_case("WindowsTerminal.exe") {
                windows_terminal_pids.push(current_pid);
            } else if process.exe_name.eq_ignore_ascii_case("wt.exe") {
                launcher_pids.push(current_pid);
            }

            current_pid = process.parent_pid;
        }
    }

    windows_terminal_pids.extend(launcher_pids);
    windows_terminal_pids
}

#[cfg(target_os = "windows")]
fn snapshot_processes() -> Option<HashMap<u32, ProcessInfo>> {
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).ok()? };
    let snapshot = SnapshotHandle(snapshot);

    let mut entry = PROCESSENTRY32W::default();
    entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

    let mut processes = HashMap::new();
    let mut has_entry = unsafe { Process32FirstW(snapshot.0, &mut entry).is_ok() };

    while has_entry {
        processes.insert(
            entry.th32ProcessID,
            ProcessInfo {
                parent_pid: entry.th32ParentProcessID,
                exe_name: process_entry_exe_name(&entry),
            },
        );

        has_entry = unsafe { Process32NextW(snapshot.0, &mut entry).is_ok() };
    }

    Some(processes)
}

#[cfg(target_os = "windows")]
fn process_entry_exe_name(entry: &windows::Win32::System::Diagnostics::ToolHelp::PROCESSENTRY32W) -> String {
    let len = entry
        .szExeFile
        .iter()
        .position(|&ch| ch == 0)
        .unwrap_or(entry.szExeFile.len());

    String::from_utf16_lossy(&entry.szExeFile[..len])
}

#[cfg(target_os = "windows")]
struct TerminalWindowMatch {
    hwnd: windows::Win32::Foundation::HWND,
    title: String,
}

#[cfg(target_os = "windows")]
fn terminal_window_hints(cwd_label: Option<&str>, window_title_hint: Option<&str>) -> Vec<String> {
    let mut hints = Vec::new();
    push_terminal_hint(&mut hints, window_title_hint);
    push_terminal_hint(&mut hints, cwd_label);

    if let Some(cwd) = cwd_label {
        push_terminal_hint(
            &mut hints,
            Path::new(cwd.trim()).file_name().and_then(|value| value.to_str()),
        );
    }

    hints
}

#[cfg(target_os = "windows")]
fn push_terminal_hint(hints: &mut Vec<String>, raw: Option<&str>) {
    let Some(value) = raw.map(str::trim).filter(|value| value.len() >= 3) else {
        return;
    };
    let normalized = value.to_ascii_lowercase();
    if !hints.iter().any(|hint| hint == &normalized) {
        hints.push(normalized);
    }
}

#[cfg(target_os = "windows")]
fn best_terminal_window_title_match<'a>(
    windows: &'a [TerminalWindowMatch],
    hints: &[String],
) -> Option<&'a TerminalWindowMatch> {
    let mut best: Option<(&TerminalWindowMatch, usize)> = None;
    let mut ambiguous = false;

    for window in windows {
        let score = terminal_title_match_score(&window.title, hints);
        if score == 0 {
            continue;
        }

        match best {
            Some((_, best_score)) if score > best_score => {
                best = Some((window, score));
                ambiguous = false;
            }
            Some((_, best_score)) if score == best_score => {
                ambiguous = true;
            }
            None => {
                best = Some((window, score));
                ambiguous = false;
            }
            _ => {}
        }
    }

    if ambiguous {
        None
    } else {
        best.map(|(window, _)| window)
    }
}

#[cfg(target_os = "windows")]
fn terminal_title_match_score(title: &str, hints: &[String]) -> usize {
    if hints.is_empty() {
        return 0;
    }

    let normalized_title = title.to_ascii_lowercase();
    hints
        .iter()
        .filter(|hint| normalized_title.contains(hint.as_str()))
        .map(|hint| hint.len())
        .max()
        .unwrap_or(0)
}

#[cfg(target_os = "windows")]
fn visible_terminal_windows(processes: &HashMap<u32, ProcessInfo>) -> Vec<TerminalWindowMatch> {
    use windows::{
        core::BOOL,
        Win32::{
            Foundation::{HWND, LPARAM},
            UI::WindowsAndMessaging::{EnumWindows, GetWindowThreadProcessId, IsWindowVisible},
        },
    };

    struct WindowCollect {
        processes: *const HashMap<u32, ProcessInfo>,
        windows: Vec<TerminalWindowMatch>,
    }

    unsafe extern "system" fn enum_window(hwnd: HWND, lparam: LPARAM) -> BOOL {
        if !unsafe { IsWindowVisible(hwnd).as_bool() } {
            return BOOL(1);
        }

        let collect = unsafe { &mut *(lparam.0 as *mut WindowCollect) };
        let mut window_pid = 0_u32;
        unsafe {
            GetWindowThreadProcessId(hwnd, Some(&mut window_pid));
        }

        let processes = unsafe { &*collect.processes };
        if !is_windows_terminal_window(hwnd, window_pid, processes) {
            return BOOL(1);
        }

        collect.windows.push(TerminalWindowMatch {
            hwnd,
            title: window_text(hwnd),
        });

        BOOL(1)
    }

    let mut collect = WindowCollect {
        processes,
        windows: Vec::new(),
    };

    unsafe {
        let _ = EnumWindows(Some(enum_window), LPARAM(&mut collect as *mut _ as isize));
    }

    collect.windows
}

#[cfg(target_os = "windows")]
fn is_windows_terminal_window(
    hwnd: windows::Win32::Foundation::HWND,
    pid: u32,
    processes: &HashMap<u32, ProcessInfo>,
) -> bool {
    if let Some(process) = processes.get(&pid) {
        if process.exe_name.eq_ignore_ascii_case("WindowsTerminal.exe")
            || process.exe_name.eq_ignore_ascii_case("wt.exe")
        {
            return true;
        }
    }

    window_class_name(hwnd).eq_ignore_ascii_case("CASCADIA_HOSTING_WINDOW_CLASS")
}

#[cfg(target_os = "windows")]
fn window_text(hwnd: windows::Win32::Foundation::HWND) -> String {
    use windows::Win32::UI::WindowsAndMessaging::{GetWindowTextLengthW, GetWindowTextW};

    let len = unsafe { GetWindowTextLengthW(hwnd) };
    if len <= 0 {
        return String::new();
    }

    let mut buffer = vec![0_u16; (len + 1) as usize];
    let copied = unsafe { GetWindowTextW(hwnd, &mut buffer) };
    if copied <= 0 {
        return String::new();
    }

    String::from_utf16_lossy(&buffer[..copied as usize])
}

#[cfg(target_os = "windows")]
fn window_class_name(hwnd: windows::Win32::Foundation::HWND) -> String {
    use windows::Win32::UI::WindowsAndMessaging::GetClassNameW;

    let mut buffer = vec![0_u16; 256];
    let copied = unsafe { GetClassNameW(hwnd, &mut buffer) };
    if copied <= 0 {
        return String::new();
    }

    String::from_utf16_lossy(&buffer[..copied as usize])
}

#[cfg(target_os = "windows")]
fn focus_window(hwnd: windows::Win32::Foundation::HWND) -> bool {
    use windows::Win32::UI::WindowsAndMessaging::{SetForegroundWindow, ShowWindow, SW_RESTORE};

    unsafe {
        let _ = ShowWindow(hwnd, SW_RESTORE);
        SetForegroundWindow(hwnd).as_bool()
    }
}

#[cfg(target_os = "windows")]
struct WindowSearch {
    target_pid: u32,
    hwnd: windows::Win32::Foundation::HWND,
}

#[cfg(target_os = "windows")]
fn focus_visible_top_level_window_for_pid(target_pid: u32) -> bool {
    use windows::{
        core::BOOL,
        Win32::{
            Foundation::{HWND, LPARAM},
            UI::WindowsAndMessaging::{
                EnumWindows, GetWindowThreadProcessId, IsWindowVisible, SetForegroundWindow,
                ShowWindow, SW_RESTORE,
            },
        },
    };

    unsafe extern "system" fn enum_window(hwnd: HWND, lparam: LPARAM) -> BOOL {
        if !unsafe { IsWindowVisible(hwnd).as_bool() } {
            return BOOL(1);
        }

        let search = unsafe { &mut *(lparam.0 as *mut WindowSearch) };
        let mut window_pid = 0_u32;
        unsafe {
            GetWindowThreadProcessId(hwnd, Some(&mut window_pid));
        }

        if window_pid == search.target_pid {
            search.hwnd = hwnd;
            return BOOL(0);
        }

        BOOL(1)
    }

    let mut search = WindowSearch {
        target_pid,
        hwnd: windows::Win32::Foundation::HWND(std::ptr::null_mut()),
    };

    unsafe {
        let _ = EnumWindows(Some(enum_window), LPARAM(&mut search as *mut _ as isize));
    }

    if search.hwnd.0.is_null() {
        return false;
    }

    unsafe {
        let _ = ShowWindow(search.hwnd, SW_RESTORE);
        SetForegroundWindow(search.hwnd).as_bool()
    }
}

#[cfg(target_os = "windows")]
fn open_windows_terminal(cwd: &Path) -> Result<(), String> {
    let candidates = windows_terminal_candidates();
    let mut errors = Vec::new();

    for candidate in candidates {
        match Command::new(&candidate).arg("-d").arg(cwd).spawn() {
            Ok(_) => return Ok(()),
            Err(error) => errors.push(format!("{}: {error}", candidate.display())),
        }
    }

    Err(format!("Failed to open Windows Terminal. Tried {}", errors.join("; ")))
}

#[cfg(target_os = "windows")]
fn windows_terminal_candidates() -> Vec<PathBuf> {
    let mut candidates = vec![PathBuf::from("wt.exe")];

    if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
        candidates.push(PathBuf::from(local_app_data).join("Microsoft").join("WindowsApps").join("wt.exe"));
    }

    if let Some(user_profile) = env::var_os("USERPROFILE") {
        candidates.push(PathBuf::from(user_profile).join("AppData").join("Local").join("Microsoft").join("WindowsApps").join("wt.exe"));
    }

    candidates
}

#[cfg(target_os = "windows")]
fn canonical_directory(raw_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(raw_path.trim());
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("Failed to resolve session directory: {error}"))?;

    if !canonical.is_dir() {
        return Err("Captured session path is not a directory.".to_string());
    }

    Ok(canonical)
}
