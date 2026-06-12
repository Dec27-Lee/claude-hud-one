#!/usr/bin/env python3
"""Lightweight Claude Code hook helper for work-journal.

The hook only reminds Claude to update the work journal and workspace index. It
does not store user prompts or write requirement content automatically.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

JOURNAL_DIR = Path(".claude/skills/work-journal/resources")
INDEX_FILE = JOURNAL_DIR / "index.md"
RECORDS_DIR = JOURNAL_DIR / "records"
STATE_DIR = JOURNAL_DIR / ".state"
STATE_FILE = STATE_DIR / "reminder.json"
DEFAULT_THRESHOLD = 3

TRIGGER_RE = re.compile(
    r"(记录|需求|继续|上次|之前|进度|计划|总结|完成|检查|验收|复盘|索引|目录|todo|log|requirement|progress|done|check|review|index)",
    re.IGNORECASE,
)


def load_payload() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {"raw": raw}


def extract_prompt(payload: dict[str, Any]) -> str:
    for key in ("prompt", "message", "user_prompt"):
        value = payload.get(key)
        if isinstance(value, str):
            return value
    return ""


def latest_mtime() -> float:
    paths = [INDEX_FILE, Path(".claude/workspace-index.md")]
    if RECORDS_DIR.exists():
        paths.extend(RECORDS_DIR.glob("*.md"))
    mtimes: list[float] = []
    for path in paths:
        try:
            mtimes.append(path.stat().st_mtime)
        except FileNotFoundError:
            pass
    return max(mtimes) if mtimes else 0.0


def load_state() -> dict[str, Any]:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"prompt_count": 0, "last_mtime": 0.0}


def save_state(state: dict[str, Any]) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(STATE_FILE)


def emit_context(message: str, event_name: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": event_name,
            "additionalContext": message,
        }
    }, ensure_ascii=True))


def main() -> int:
    payload = load_payload()
    mode = sys.argv[1] if len(sys.argv) > 1 else "prompt"
    threshold = int(os.environ.get("WORK_JOURNAL_REMINDER_THRESHOLD", DEFAULT_THRESHOLD))

    if not JOURNAL_DIR.exists():
        return 0

    state = load_state()
    mtime = latest_mtime()
    if mtime and mtime != state.get("last_mtime"):
        state = {"prompt_count": 0, "last_mtime": mtime}

    state["prompt_count"] = int(state.get("prompt_count", 0)) + 1
    save_state(state)

    if mode == "precompact":
        emit_context(
            "work-journal 提醒：上下文即将压缩。请先读 .claude/skills/work-journal/resources/index.md；如需历史记录，只读取索引命中的 .claude/skills/work-journal/resources/records/<文件>.md，不要全量读取 .claude/skills/work-journal/resources/records/。如本轮新增/移动/删除长期资料入口，也要更新 .claude/workspace-index.md。",
            "PreCompact",
        )
        return 0

    prompt = extract_prompt(payload)
    looks_relevant = bool(TRIGGER_RE.search(prompt))
    overdue = state["prompt_count"] >= threshold and state["prompt_count"] % threshold == 0

    if looks_relevant or overdue:
        reason = "当前提示疑似需求/记录/完成检查/复盘/索引维护" if looks_relevant else f"已经约 {state['prompt_count']} 轮未更新工作日志"
        emit_context(
            f"work-journal 提醒：{reason}。先读 .claude/skills/work-journal/resources/index.md；如需历史记录，只读取索引命中的 .claude/skills/work-journal/resources/records/<文件>.md，不要全量读取 .claude/skills/work-journal/resources/records/；如发现长期资料入口变化，请同步更新 .claude/workspace-index.md；回复完成前做完成检查。",
            "UserPromptSubmit",
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
