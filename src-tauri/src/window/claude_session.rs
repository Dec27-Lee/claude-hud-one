use std::{
    env,
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptEventCounts {
    pub assistant: u32,
    pub user: u32,
    pub system: u32,
    pub attachment: u32,
    pub ai_title: u32,
    pub mode: u32,
    pub permission_mode: u32,
    pub queue_operation: u32,
    pub file_history_snapshot: u32,
    pub last_prompt: u32,
    pub other: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCodeSummary {
    pub mode: String,
    pub project_slug: String,
    pub project_source: String,
    pub transcript_count: u32,
    pub total_events: u32,
    pub tool_call_record_count: u32,
    pub tool_result_file_count: u32,
    pub last_activity_at: Option<String>,
    pub scanned_at: String,
    pub counts: TranscriptEventCounts,
    pub privacy_note: String,
}

#[derive(Debug, Clone)]
struct ProjectCandidate {
    slug: String,
    dir: PathBuf,
    source: String,
}

pub fn get_claude_code_summary() -> Result<ClaudeCodeSummary, String> {
    let claude_root = claude_root().ok_or_else(|| "Claude data root not found".to_string())?;
    let projects_root = claude_root.join("projects");
    let current_dir = env::current_dir().map_err(|error| error.to_string())?;
    let current_slug = project_slug_from_path(&current_dir);
    let project = project_candidate(&projects_root, current_slug)?;
    let mut summary = scan_project(&project)?;
    summary.scanned_at = now_millis_label();
    Ok(summary)
}

pub fn open_diagnostics_dir(kind: Option<String>) -> Result<String, String> {
    let path = diagnostics_dir(kind)?;
    open_path(&path)?;
    Ok(path.display().to_string())
}

fn diagnostics_dir(kind: Option<String>) -> Result<PathBuf, String> {
    let root = claude_root().ok_or_else(|| "Claude data root not found".to_string())?;
    match kind.as_deref().unwrap_or("currentProject") {
        "root" => Ok(root),
        "sessions" => Ok(root.join("sessions")),
        "projects" => Ok(root.join("projects")),
        "currentProject" => {
            let current_dir = env::current_dir().map_err(|error| error.to_string())?;
            let current_slug = project_slug_from_path(&current_dir);
            project_candidate(&root.join("projects"), current_slug).map(|project| project.dir)
        }
        other => Err(format!("unknown diagnostics directory kind: {other}")),
    }
}

fn project_candidate(projects_root: &Path, current_slug: String) -> Result<ProjectCandidate, String> {
    let current_dir = projects_root.join(&current_slug);
    if current_dir.exists() {
        return Ok(ProjectCandidate {
            slug: current_slug,
            dir: current_dir,
            source: "current working directory".to_string(),
        });
    }

    newest_project_candidate(projects_root).ok_or_else(|| {
        format!(
            "No Claude Code project transcript directory found for {}",
            projects_root.display()
        )
    })
}

fn scan_project(project: &ProjectCandidate) -> Result<ClaudeCodeSummary, String> {
    let mut counts = TranscriptEventCounts::default();
    let mut transcript_count = 0_u32;
    let mut total_events = 0_u32;
    let mut tool_call_record_count = 0_u32;
    let mut last_activity_at: Option<String> = None;

    let entries = fs::read_dir(&project.dir).map_err(|error| error.to_string())?;
    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("jsonl") {
            continue;
        }

        transcript_count += 1;
        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };

        for line in content.lines().filter(|line| !line.trim().is_empty()) {
            let Ok(value) = serde_json::from_str::<Value>(line) else {
                continue;
            };

            total_events += 1;
            count_event_type(&mut counts, value.get("type").and_then(Value::as_str));

            if value.get("toolUseResult").is_some() {
                tool_call_record_count += 1;
            }

            if let Some(timestamp) = value.get("timestamp").and_then(Value::as_str) {
                replace_if_newer(&mut last_activity_at, timestamp);
            }
        }
    }

    Ok(ClaudeCodeSummary {
        mode: "live".to_string(),
        project_slug: project.slug.clone(),
        project_source: project.source.clone(),
        transcript_count,
        total_events,
        tool_call_record_count,
        tool_result_file_count: count_tool_result_files(&project.dir),
        last_activity_at,
        scanned_at: String::new(),
        counts,
        privacy_note: "Only event types, counts and timestamps are scanned. Prompt, transcript and tool-result content are not returned.".to_string(),
    })
}

fn count_event_type(counts: &mut TranscriptEventCounts, event_type: Option<&str>) {
    match event_type {
        Some("assistant") => counts.assistant += 1,
        Some("user") => counts.user += 1,
        Some("system") => counts.system += 1,
        Some("attachment") => counts.attachment += 1,
        Some("ai-title") => counts.ai_title += 1,
        Some("mode") => counts.mode += 1,
        Some("permission-mode") => counts.permission_mode += 1,
        Some("queue-operation") => counts.queue_operation += 1,
        Some("file-history-snapshot") => counts.file_history_snapshot += 1,
        Some("last-prompt") => counts.last_prompt += 1,
        _ => counts.other += 1,
    }
}

fn count_tool_result_files(project_dir: &Path) -> u32 {
    let mut count = 0_u32;
    let Ok(entries) = fs::read_dir(project_dir) else {
        return count;
    };

    for entry in entries.filter_map(Result::ok) {
        let tool_results_dir = entry.path().join("tool-results");
        let Ok(files) = fs::read_dir(tool_results_dir) else {
            continue;
        };

        count += files.filter_map(Result::ok).filter(|file| file.path().is_file()).count() as u32;
    }

    count
}

fn newest_project_candidate(projects_root: &Path) -> Option<ProjectCandidate> {
    let entries = fs::read_dir(projects_root).ok()?;
    entries
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| {
            let dir = entry.path();
            let slug = entry.file_name().to_string_lossy().to_string();
            newest_jsonl_modified(&dir).map(|modified| (modified, slug, dir))
        })
        .max_by_key(|(modified, _, _)| *modified)
        .map(|(_, slug, dir)| ProjectCandidate {
            slug,
            dir,
            source: "newest Claude Code project transcript".to_string(),
        })
}

fn newest_jsonl_modified(dir: &Path) -> Option<SystemTime> {
    fs::read_dir(dir)
        .ok()?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().extension().and_then(|extension| extension.to_str()) == Some("jsonl"))
        .filter_map(|entry| entry.metadata().ok()?.modified().ok())
        .max()
}

fn replace_if_newer(current: &mut Option<String>, candidate: &str) {
    if current.as_deref().is_none_or(|value| candidate > value) {
        *current = Some(candidate.to_string());
    }
}

fn open_path(path: &Path) -> Result<(), String> {
    Command::new("explorer")
        .arg(path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn claude_root() -> Option<PathBuf> {
    env::var_os("CLAUDE_CONFIG_DIR")
        .and_then(|value| value.to_string_lossy().split(',').next().map(PathBuf::from))
        .filter(|path| path.exists())
        .or_else(|| env::var_os("USERPROFILE").map(|home| PathBuf::from(home).join(".claude")))
        .filter(|path| path.exists())
}

fn project_slug_from_path(path: &Path) -> String {
    path.to_string_lossy()
        .chars()
        .map(|character| if character.is_ascii_alphanumeric() { character } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

fn now_millis_label() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
