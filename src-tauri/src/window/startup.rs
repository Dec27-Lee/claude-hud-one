use std::{env, path::PathBuf, process::Command};

const APP_NAME: &str = "Claude HUD One";
const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn get_launch_at_login() -> bool {
    #[cfg(windows)]
    {
        run_reg_command(["query", RUN_KEY, "/v", APP_NAME])
            .map(|output| output.status.success())
            .unwrap_or(false)
    }

    #[cfg(not(windows))]
    {
        false
    }
}

pub fn set_launch_at_login(enabled: bool) -> Result<bool, String> {
    #[cfg(windows)]
    {
        let output = if enabled {
            let exe = current_exe_command()?;
            run_reg_command(["add", RUN_KEY, "/v", APP_NAME, "/t", "REG_SZ", "/d", &exe, "/f"])
        } else {
            run_reg_command(["delete", RUN_KEY, "/v", APP_NAME, "/f"])
        }
        .map_err(|error| error.to_string())?;

        if output.status.success() || !enabled && !get_launch_at_login() {
            Ok(enabled)
        } else {
            Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
        }
    }

    #[cfg(not(windows))]
    {
        let _ = enabled;
        Ok(false)
    }
}

fn current_exe_command() -> Result<String, String> {
    let exe = env::current_exe().map_err(|error| error.to_string())?;
    Ok(quote_path(exe))
}

fn quote_path(path: PathBuf) -> String {
    format!("\"{}\"", path.display())
}

#[cfg(windows)]
fn run_reg_command<const N: usize>(args: [&str; N]) -> std::io::Result<std::process::Output> {
    use std::os::windows::process::CommandExt;

    Command::new("reg")
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
}
