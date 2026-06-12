# Desktop HUD Windows Terminal Jump 安全版

## 需求人

Dec27-Lee <lipengyue31@163.com>

## 原始需求

用户要求“一直继续，不用停”。在已完成 Desktop HUD V2 视觉、配置和 approval/question 安全队列后，继续按 CodeIsland 对标路径推进 Terminal Jump：从 Desktop HUD 会话卡片跳转到对应 Claude Code 会话的终端上下文。Windows 版先实现安全打开 cwd，不做不可靠的 tab/pane 精确恢复。

## 范围

- 本轮做：bridge 采集 terminal metadata；TS/Rust 类型透传；新增 Tauri command 安全打开 Windows Terminal 到 session cwd；SessionCard 按钮调用该命令并给出反馈。
- 本轮不做：模糊匹配窗口标题、模拟键盘、执行任意命令、恢复 Windows Terminal tab/pane、运行 `claude` 命令。
- 待确认：后续是否做可信窗口级 focus 或 Windows Terminal tab/pane 识别。

## 计划

1. 扩展 bridge 状态，采集 cwd、WT_SESSION/PROFILE、shell、bridge pid/ppid、windowTitleHint 等安全 terminal metadata。
2. 扩展 `src/app/types.ts`、`src-tauri/src/window/claude_status.rs`、`src/providers/claudeCodeSummary.ts` 透传 metadata。
3. 新增 `src-tauri/src/window/terminal_jump.rs`，实现 Windows-only `wt.exe -d <canonical cwd>` 安全打开。
4. 注册 Tauri command 并在 `src/app/overlayBridge.ts` 封装调用。
5. 修改 SessionCard / DesktopHudRoot，把 Jump 按钮接到 Tauri command。
6. 验证 build、UI smoke、tauri build 并回写记录。

## 进展

- 2026-06-12：已创建本记录。
- 2026-06-12：已扩展 `.claude/bridge/claude-status-bridge.mjs` 与 `src-tauri/resources/claude-status-bridge.mjs`，为 statusLine / hook 状态采集 `terminal` metadata，包括 cwd、WT_SESSION/PROFILE、shell、bridge pid/ppid、windowTitleHint 和 capturedAt。
- 2026-06-12：已扩展 `src/app/types.ts`，新增 `SessionTerminalMetadata`，并挂到 `CurrentSessionState` 与 `ClaudeStatusBridgeState`。
- 2026-06-12：已扩展 `src-tauri/src/window/claude_status.rs`，新增 Rust 侧 `SessionTerminalMetadata` 并透传 bridge JSON 的 `terminal` 字段。
- 2026-06-12：已扩展 `src/providers/claudeCodeSummary.ts`，在 bridge patch/full session mapper 中同步 `terminal: bridge.terminal`。
- 2026-06-12：已新增 `src-tauri/src/window/terminal_jump.rs`，实现 Windows-only 安全打开 Windows Terminal 到 canonical cwd；只调用 `wt.exe -d <cwd>`，不经过 shell、不执行用户命令、不模拟键盘。
- 2026-06-12：已在 `src-tauri/src/window/mod.rs` 与 `src-tauri/src/lib.rs` 注册 `jump_to_claude_session_terminal` Tauri command。
- 2026-06-12：已在 `src/app/overlayBridge.ts` 封装 `jumpToClaudeSessionTerminal()`，并在 `src/components/desktopHud/SessionCard.tsx` / `DesktopHudRoot.tsx` 将会话卡片 Jump 按钮接到 command，支持成功/失败反馈和 `terminalJumpBehavior: disabled` 禁用。
- 2026-06-12：验证通过：`npm run build`、`npm run test:ui`、`npm run tauri:build`。NSIS 安装包生成于 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。

## 检查

- 结论：已完成 Phase 5 Terminal Jump 安全版。
- 需求覆盖：已实现从 Desktop HUD 会话卡片安全打开 Windows Terminal 到对应 Claude Code session cwd；已采集并透传 terminal metadata；已保留 Terminal HUD，不影响 statusLine 输出。
- 安全边界：只打开 canonical cwd；不做模糊窗口标题匹配；不模拟键盘；不执行任意命令；不恢复 Windows Terminal tab/pane；找不到 cwd 或 wt.exe 失败时返回错误反馈，不假装成功。
- 产物路径：`.claude/bridge/claude-status-bridge.mjs`；`src-tauri/resources/claude-status-bridge.mjs`；`src/app/types.ts`；`src-tauri/src/window/claude_status.rs`；`src/providers/claudeCodeSummary.ts`；`src-tauri/src/window/terminal_jump.rs`；`src-tauri/src/window/mod.rs`；`src-tauri/src/lib.rs`；`src/app/overlayBridge.ts`；`src/components/desktopHud/SessionCard.tsx`；`src/components/desktopHud/DesktopHudRoot.tsx`。
- 验证情况：`npm run build` 通过；`npm run test:ui` 通过（6 passed）；`npm run tauri:build` 通过并生成 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。
- 索引维护：`.claude/skills/work-journal/resources/index.md` 已登记本记录；本轮未新增长期资料入口，`.claude/workspace-index.md` 无需因 Phase 5 额外更新。
- 后续可选：若要继续对标 CodeIsland，可进入可信窗口级 focus / Windows Terminal tab-pane 识别，或先做 Phase 4 blocking response 安全协议。