use std::{
    collections::{BTreeMap, HashMap},
    env, fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Default)]
struct TokenUsage {
    input_tokens: u64,
    output_tokens: u64,
    cache_creation_input_tokens: u64,
    cache_read_input_tokens: u64,
}

#[derive(Debug, Clone, Default)]
struct ProviderAggregate {
    by_date: BTreeMap<String, TokenUsage>,
    by_model: HashMap<String, TokenUsage>,
    last_activity_at: Option<String>,
    transcript_count: u32,
    event_count: u32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowUsageStateDto {
    pub used_percent: f64,
    pub reset_at_label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderLiveStateDto {
    pub five_hour: WindowUsageStateDto,
    pub weekly: WindowUsageStateDto,
    pub stale: bool,
    pub last_updated_label: String,
    #[serde(default = "default_provider_source")]
    pub source: String,
    #[serde(default = "default_auth_status")]
    pub auth_status: String,
}

fn default_provider_source() -> String {
    "localEstimate".to_string()
}

fn default_auth_status() -> String {
    "unknown".to_string()
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelBreakdownItemDto {
    pub model: String,
    pub tokens: u64,
    pub dollars: f64,
    pub percent: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CostSummaryStateDto {
    pub today_usd: f64,
    pub month_usd: f64,
    pub today_tokens: u64,
    pub month_tokens: u64,
    pub today_billable_tokens: u64,
    pub month_billable_tokens: u64,
    pub trend: Vec<f64>,
    pub breakdown: Vec<ModelBreakdownItemDto>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyTokenBucketDto {
    pub date: String,
    pub total_tokens: u64,
    pub claude_tokens: u64,
    pub codex_tokens: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveUsageCostSnapshot {
    pub claude_provider: ProviderLiveStateDto,
    pub codex_provider: ProviderLiveStateDto,
    pub claude_cost: CostSummaryStateDto,
    pub codex_cost: CostSummaryStateDto,
    pub daily_buckets: Vec<DailyTokenBucketDto>,
    pub last_usage_sync_label: String,
    pub last_cost_sync_label: String,
    pub privacy_note: String,
}

pub fn get_live_usage_cost_snapshot() -> LiveUsageCostSnapshot {
    let claude = scan_claude().unwrap_or_default();
    let codex = scan_codex().unwrap_or_default();
    let latest_date = latest_date(&claude, &codex);
    let latest_month = latest_date.as_deref().and_then(|date| date.get(0..7)).unwrap_or_default();
    let has_local_usage = claude.event_count > 0 || codex.event_count > 0;

    let snapshot = LiveUsageCostSnapshot {
        claude_provider: provider_state(&claude, "Claude transcript", latest_date.as_deref()),
        codex_provider: provider_state(&codex, "Codex sessions", latest_date.as_deref()),
        claude_cost: cost_state(&claude, latest_date.as_deref(), latest_month, true),
        codex_cost: cost_state(&codex, latest_date.as_deref(), latest_month, false),
        daily_buckets: merge_daily_buckets(&claude, &codex),
        last_usage_sync_label: "Live local scan".to_string(),
        last_cost_sync_label: "Estimated from local logs".to_string(),
        privacy_note: "Only token/cost fields, event types and timestamps are aggregated locally. Prompt, transcript and tool-result content are not returned.".to_string(),
    };

    if has_local_usage {
        let _ = save_snapshot_cache(&snapshot);
        return snapshot;
    }

    load_snapshot_cache()
        .map(mark_cached_snapshot)
        .unwrap_or(snapshot)
}

fn load_snapshot_cache() -> Option<LiveUsageCostSnapshot> {
    let path = usage_cache_path()?;
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str::<LiveUsageCostSnapshot>(&content).ok())
}

fn save_snapshot_cache(snapshot: &LiveUsageCostSnapshot) -> Result<(), String> {
    let path = usage_cache_path().ok_or_else(|| "APPDATA is not available".to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let content = serde_json::to_string_pretty(snapshot).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())
}

fn usage_cache_path() -> Option<PathBuf> {
    env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|appdata| appdata.join("Claude HUD One").join("usage-cost-cache.json"))
}

fn mark_cached_snapshot(mut snapshot: LiveUsageCostSnapshot) -> LiveUsageCostSnapshot {
    mark_provider_cached(&mut snapshot.claude_provider);
    mark_provider_cached(&mut snapshot.codex_provider);
    snapshot.last_usage_sync_label = "Last-known usage cache".to_string();
    snapshot.last_cost_sync_label = "Last-known cost cache".to_string();
    snapshot.privacy_note = "Using a local last-known usage/cost cache because the current scan found no token usage fields. The cache only stores aggregated token/cost fields and never stores prompt, transcript, tool-result or credential content.".to_string();
    snapshot
}

fn mark_provider_cached(provider: &mut ProviderLiveStateDto) {
    provider.stale = true;
    provider.source = "cache".to_string();
    provider.last_updated_label = format!("{} · cached", provider.last_updated_label);
    if provider.five_hour.error.is_none() {
        provider.five_hour.error = Some("Using last-known usage cache; current local scan found no token usage fields".to_string());
    }
}

fn scan_claude() -> Option<ProviderAggregate> {
    let root = claude_projects_root()?;
    let current_slug = env::current_dir().ok().map(|path| project_slug_from_path(&path));
    let dir = current_slug
        .as_ref()
        .map(|slug| root.join(slug))
        .filter(|path| path.exists())
        .or_else(|| newest_project_dir(&root))?;

    scan_jsonl_files(&dir, false)
}

fn scan_codex() -> Option<ProviderAggregate> {
    let home = env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("USERPROFILE").map(|home| PathBuf::from(home).join(".codex")))?;
    let sessions = home.join("sessions");
    if !sessions.exists() {
        return None;
    }

    scan_jsonl_files(&sessions, true)
}

fn scan_jsonl_files(root: &Path, recursive: bool) -> Option<ProviderAggregate> {
    let files = collect_jsonl_files(root, recursive);
    if files.is_empty() {
        return None;
    }

    let mut aggregate = ProviderAggregate {
        transcript_count: files.len() as u32,
        ..ProviderAggregate::default()
    };

    for file in files {
        let Ok(content) = fs::read_to_string(file) else {
            continue;
        };

        for line in content.lines().filter(|line| !line.trim().is_empty()) {
            let Ok(value) = serde_json::from_str::<Value>(line) else {
                continue;
            };

            let mut usage = TokenUsage::default();
            collect_usage_fields(&value, &mut usage);
            if usage.total_tokens() == 0 {
                continue;
            }

            aggregate.event_count += 1;
            let timestamp = value.get("timestamp").and_then(Value::as_str).or_else(|| value.get("created_at").and_then(Value::as_str));
            if let Some(timestamp) = timestamp {
                replace_if_newer(&mut aggregate.last_activity_at, timestamp);
                if let Some(date) = timestamp.get(0..10) {
                    aggregate.by_date.entry(date.to_string()).or_default().add(&usage);
                }
            }

            let model = find_string_field(&value, "model").unwrap_or_else(|| "unknown".to_string());
            aggregate.by_model.entry(model).or_default().add(&usage);
        }
    }

    Some(aggregate)
}

fn collect_jsonl_files(root: &Path, recursive: bool) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let Ok(entries) = fs::read_dir(root) else {
        return files;
    };

    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if path.is_dir() && recursive {
            files.extend(collect_jsonl_files(&path, true));
        } else if path.extension().and_then(|extension| extension.to_str()) == Some("jsonl") {
            files.push(path);
        }
    }

    files
}

fn collect_usage_fields(value: &Value, usage: &mut TokenUsage) {
    match value {
        Value::Object(object) => {
            for (key, child) in object {
                match key.as_str() {
                    "input_tokens" => usage.input_tokens += child.as_u64().unwrap_or_default(),
                    "output_tokens" => usage.output_tokens += child.as_u64().unwrap_or_default(),
                    "cache_creation_input_tokens" => usage.cache_creation_input_tokens += child.as_u64().unwrap_or_default(),
                    "cache_read_input_tokens" => usage.cache_read_input_tokens += child.as_u64().unwrap_or_default(),
                    _ => collect_usage_fields(child, usage),
                }
            }
        }
        Value::Array(items) => items.iter().for_each(|item| collect_usage_fields(item, usage)),
        _ => {}
    }
}

fn find_string_field(value: &Value, field: &str) -> Option<String> {
    match value {
        Value::Object(object) => {
            if let Some(text) = object.get(field).and_then(Value::as_str) {
                return Some(text.to_string());
            }

            object.values().find_map(|child| find_string_field(child, field))
        }
        Value::Array(items) => items.iter().find_map(|item| find_string_field(item, field)),
        _ => None,
    }
}

fn provider_state(aggregate: &ProviderAggregate, source: &str, latest_date: Option<&str>) -> ProviderLiveStateDto {
    let weekly_tokens = latest_seven_day_tokens(aggregate, latest_date);
    let five_hour_percent = usage_percent(weekly_tokens, 2_500_000);
    let weekly_percent = usage_percent(month_tokens(aggregate, latest_date.unwrap_or_default().get(0..7).unwrap_or_default()), 25_000_000);
    let stale = aggregate.event_count == 0;
    let last_updated_label = aggregate
        .last_activity_at
        .as_deref()
        .map(|timestamp| format!("{source} · {} files · last event {timestamp}", aggregate.transcript_count))
        .unwrap_or_else(|| format!("{source} · {} files · no local usage fields found", aggregate.transcript_count));

    ProviderLiveStateDto {
        five_hour: WindowUsageStateDto {
            used_percent: five_hour_percent,
            reset_at_label: "local scan".to_string(),
            error: stale.then(|| "No local token usage fields found yet".to_string()),
        },
        weekly: WindowUsageStateDto {
            used_percent: weekly_percent,
            reset_at_label: "rolling logs".to_string(),
            error: None,
        },
        stale,
        last_updated_label,
        source: "localEstimate".to_string(),
        auth_status: "unknown".to_string(),
    }
}

fn cost_state(aggregate: &ProviderAggregate, latest_date: Option<&str>, latest_month: &str, claude_pricing: bool) -> CostSummaryStateDto {
    let today = latest_date
        .and_then(|date| aggregate.by_date.get(date))
        .cloned()
        .unwrap_or_default();
    let month = month_usage(aggregate, latest_month);
    let today_usd = estimate_total_cost(&today, claude_pricing, None);
    let month_usd = estimate_total_cost(&month, claude_pricing, None);
    let month_tokens = month.total_tokens();
    let breakdown = model_breakdown(aggregate, claude_pricing);

    CostSummaryStateDto {
        today_usd,
        month_usd,
        today_tokens: today.total_tokens(),
        month_tokens,
        today_billable_tokens: today.billable_tokens(),
        month_billable_tokens: month.billable_tokens(),
        trend: trend_values(aggregate, claude_pricing),
        breakdown,
    }
}

fn model_breakdown(aggregate: &ProviderAggregate, claude_pricing: bool) -> Vec<ModelBreakdownItemDto> {
    let total = aggregate.by_model.values().map(TokenUsage::total_tokens).sum::<u64>().max(1);
    let mut items = aggregate
        .by_model
        .iter()
        .map(|(model, usage)| ModelBreakdownItemDto {
            model: model.clone(),
            tokens: usage.total_tokens(),
            dollars: estimate_total_cost(usage, claude_pricing, Some(model)),
            percent: usage.total_tokens() as f64 / total as f64,
        })
        .collect::<Vec<_>>();

    items.sort_by(|left, right| right.tokens.cmp(&left.tokens));
    items.truncate(5);
    items
}

fn merge_daily_buckets(claude: &ProviderAggregate, codex: &ProviderAggregate) -> Vec<DailyTokenBucketDto> {
    let mut dates = claude
        .by_date
        .keys()
        .chain(codex.by_date.keys())
        .cloned()
        .collect::<Vec<_>>();
    dates.sort();
    dates.dedup();

    dates
        .into_iter()
        .rev()
        .take(84)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .map(|date| {
            let claude_tokens = claude.by_date.get(&date).map(TokenUsage::total_tokens).unwrap_or_default();
            let codex_tokens = codex.by_date.get(&date).map(TokenUsage::total_tokens).unwrap_or_default();
            DailyTokenBucketDto {
                date,
                total_tokens: claude_tokens + codex_tokens,
                claude_tokens,
                codex_tokens,
            }
        })
        .collect()
}

fn trend_values(aggregate: &ProviderAggregate, claude_pricing: bool) -> Vec<f64> {
    aggregate
        .by_date
        .values()
        .rev()
        .take(10)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .map(|usage| estimate_total_cost(usage, claude_pricing, None))
        .collect()
}

fn latest_date(claude: &ProviderAggregate, codex: &ProviderAggregate) -> Option<String> {
    claude
        .by_date
        .keys()
        .chain(codex.by_date.keys())
        .max()
        .cloned()
}

fn latest_seven_day_tokens(aggregate: &ProviderAggregate, _latest_date: Option<&str>) -> u64 {
    aggregate
        .by_date
        .values()
        .rev()
        .take(7)
        .map(TokenUsage::total_tokens)
        .sum()
}

fn month_usage(aggregate: &ProviderAggregate, month: &str) -> TokenUsage {
    let mut usage = TokenUsage::default();
    for (date, day) in &aggregate.by_date {
        if date.starts_with(month) {
            usage.add(day);
        }
    }
    usage
}

fn month_tokens(aggregate: &ProviderAggregate, month: &str) -> u64 {
    month_usage(aggregate, month).total_tokens()
}

fn usage_percent(value: u64, soft_cap: u64) -> f64 {
    (value as f64 / soft_cap as f64).clamp(0.0, 1.0)
}

fn estimate_total_cost(usage: &TokenUsage, claude_pricing: bool, model: Option<&str>) -> f64 {
    let (input_per_m, output_per_m) = pricing_for(model.unwrap_or("unknown"), claude_pricing);
    let billable_input = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens / 10;
    let input_cost = billable_input as f64 / 1_000_000.0 * input_per_m;
    let output_cost = usage.output_tokens as f64 / 1_000_000.0 * output_per_m;
    input_cost + output_cost
}

fn pricing_for(model: &str, claude_pricing: bool) -> (f64, f64) {
    let lower = model.to_ascii_lowercase();
    if claude_pricing {
        if lower.contains("opus") {
            return (15.0, 75.0);
        }
        if lower.contains("haiku") {
            return (0.8, 4.0);
        }
        return (3.0, 15.0);
    }

    if lower.contains("gpt-5") || lower.contains("codex") {
        return (1.25, 10.0);
    }
    (1.0, 5.0)
}

fn replace_if_newer(current: &mut Option<String>, candidate: &str) {
    if current.as_deref().is_none_or(|value| candidate > value) {
        *current = Some(candidate.to_string());
    }
}

fn newest_project_dir(projects_root: &Path) -> Option<PathBuf> {
    fs::read_dir(projects_root)
        .ok()?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| newest_jsonl_modified(&entry.path()).map(|modified| (modified, entry.path())))
        .max_by_key(|(modified, _)| *modified)
        .map(|(_, path)| path)
}

fn newest_jsonl_modified(dir: &Path) -> Option<SystemTime> {
    fs::read_dir(dir)
        .ok()?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().extension().and_then(|extension| extension.to_str()) == Some("jsonl"))
        .filter_map(|entry| entry.metadata().ok()?.modified().ok())
        .max()
}

fn claude_projects_root() -> Option<PathBuf> {
    env::var_os("CLAUDE_CONFIG_DIR")
        .and_then(|value| value.to_string_lossy().split(',').next().map(PathBuf::from))
        .map(|path| path.join("projects"))
        .filter(|path| path.exists())
        .or_else(|| env::var_os("USERPROFILE").map(|home| PathBuf::from(home).join(".claude").join("projects")))
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

impl TokenUsage {
    fn add(&mut self, other: &TokenUsage) {
        self.input_tokens += other.input_tokens;
        self.output_tokens += other.output_tokens;
        self.cache_creation_input_tokens += other.cache_creation_input_tokens;
        self.cache_read_input_tokens += other.cache_read_input_tokens;
    }

    fn total_tokens(&self) -> u64 {
        self.input_tokens + self.output_tokens + self.cache_creation_input_tokens + self.cache_read_input_tokens
    }

    fn billable_tokens(&self) -> u64 {
        self.input_tokens + self.output_tokens + self.cache_creation_input_tokens + self.cache_read_input_tokens / 10
    }
}

#[allow(dead_code)]
fn now_millis_label() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn collect_usage_fields_recurses_nested_usage_objects() {
        let value = json!({
            "message": {
                "usage": {
                    "input_tokens": 120,
                    "output_tokens": 34,
                    "cache_creation_input_tokens": 56,
                    "cache_read_input_tokens": 780
                }
            },
            "nested": [{ "usage": { "input_tokens": 10 } }]
        });
        let mut usage = TokenUsage::default();

        collect_usage_fields(&value, &mut usage);

        assert_eq!(usage.input_tokens, 130);
        assert_eq!(usage.output_tokens, 34);
        assert_eq!(usage.cache_creation_input_tokens, 56);
        assert_eq!(usage.cache_read_input_tokens, 780);
        assert_eq!(usage.total_tokens(), 1_000);
        assert_eq!(usage.billable_tokens(), 298);
    }

    #[test]
    fn estimate_total_cost_uses_billable_cache_read_discount() {
        let usage = TokenUsage {
            input_tokens: 1_000_000,
            output_tokens: 1_000_000,
            cache_creation_input_tokens: 1_000_000,
            cache_read_input_tokens: 1_000_000,
        };

        let cost = estimate_total_cost(&usage, true, Some("claude-opus-4-8"));

        assert!((cost - 106.5).abs() < f64::EPSILON);
    }

    #[test]
    fn pricing_for_recognizes_main_model_families() {
        assert_eq!(pricing_for("claude-opus-4-8", true), (15.0, 75.0));
        assert_eq!(pricing_for("claude-haiku-4-5", true), (0.8, 4.0));
        assert_eq!(pricing_for("claude-sonnet-4-6", true), (3.0, 15.0));
        assert_eq!(pricing_for("gpt-5.4-codex", false), (1.25, 10.0));
        assert_eq!(pricing_for("unknown", false), (1.0, 5.0));
    }

    #[test]
    fn merge_daily_buckets_sorts_and_combines_providers() {
        let mut claude = ProviderAggregate::default();
        claude.by_date.insert("2026-06-08".to_string(), TokenUsage { input_tokens: 100, ..TokenUsage::default() });
        claude.by_date.insert("2026-06-07".to_string(), TokenUsage { output_tokens: 50, ..TokenUsage::default() });

        let mut codex = ProviderAggregate::default();
        codex.by_date.insert("2026-06-08".to_string(), TokenUsage { output_tokens: 25, ..TokenUsage::default() });
        codex.by_date.insert("2026-06-09".to_string(), TokenUsage { input_tokens: 75, ..TokenUsage::default() });

        let buckets = merge_daily_buckets(&claude, &codex);

        assert_eq!(buckets.len(), 3);
        assert_eq!(buckets[0].date, "2026-06-07");
        assert_eq!(buckets[0].claude_tokens, 50);
        assert_eq!(buckets[0].codex_tokens, 0);
        assert_eq!(buckets[1].date, "2026-06-08");
        assert_eq!(buckets[1].total_tokens, 125);
        assert_eq!(buckets[2].date, "2026-06-09");
        assert_eq!(buckets[2].codex_tokens, 75);
    }

    #[test]
    fn provider_state_marks_local_estimate_source_and_stale_errors() {
        let aggregate = ProviderAggregate::default();

        let state = provider_state(&aggregate, "Claude transcript", None);

        assert!(state.stale);
        assert_eq!(state.source, "localEstimate");
        assert_eq!(state.auth_status, "unknown");
        assert_eq!(state.five_hour.error.as_deref(), Some("No local token usage fields found yet"));
    }
}
