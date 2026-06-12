# Desktop HUD Approval / Question 安全队列

## 需求人

Dec27-Lee <lipengyue31@163.com>

## 原始需求

用户要求“一直继续，不用停”。在已完成 Desktop HUD V2 视觉骨架和配置迁移后，继续按全面对标 CodeIsland 路线推进 Phase 3：在 Desktop HUD 内展示 Claude Code approval/question 等待项队列，但先不做真实 blocking response，确保不误批准工具调用。

## 范围

- 本轮做：扩展 Claude Code bridge 状态 JSON，生成 sanitized pending queue；扩展 Rust/TS 类型和 mapper；在 Desktop HUD 内展示 approval/question 安全提示队列。
- 本轮不做：Allow/Deny/Answer 真实回写、HookServer/IPC、自动批准、展示 raw prompt/tool input/tool result。
- 待确认：后续 Phase 4 是否实现 blocking response 安全协议。

## 计划

1. 扩展 `ClaudeStatusBridgeState` / `CurrentSessionState` 类型，增加 pending queue 可选字段。
2. 扩展 `.claude/bridge/claude-status-bridge.mjs` 与 `src-tauri/resources/claude-status-bridge.mjs`，从 hook/status 生成并保留 sanitized pending queue。
3. 扩展 `src-tauri/src/window/claude_status.rs`，让 pending queue 从 JSON 透传到前端。
4. 扩展 `src/providers/claudeCodeSummary.ts`，把 pending queue 映射到 session。
5. 新增 Desktop HUD pending surface/summary，展示 approval/question 队列，按钮只做提示/占位不执行权限决策。
6. 构建、UI smoke、Tauri 打包并回写记录。

## 进展

- 2026-06-12：已创建本记录；沿用当前 Git 身份 `Dec27-Lee <lipengyue31@163.com>`。
- 2026-06-12：已扩展 `.claude/bridge/claude-status-bridge.mjs` 和 `src-tauri/resources/claude-status-bridge.mjs`，新增 sanitized pending queue 生成、TTL、merge、prune 逻辑。
- 2026-06-12：Approval item 仅由 `PreToolUse` + 安全 toolName 生成，Question item 仅由 `Notification` / `Stop` 生成；均只保存 toolName、permissionMode、projectSlug/cwdSlug、标题和安全摘要，不保存 prompt、tool input、tool result、命令参数或凭据。
- 2026-06-12：已扩展 `src/app/types.ts` 的 `PendingQueueChoice`、`PendingQueueItem`、`PendingQueueState`，并挂到 `ClaudeStatusBridgeState` / `CurrentSessionState`。
- 2026-06-12：已扩展 `src-tauri/src/window/claude_status.rs`，让 pending queue 从 JSON 透传到前端。
- 2026-06-12：已扩展 `src/providers/claudeCodeSummary.ts`，将 bridge pendingQueue 映射到 session。
- 2026-06-12：已新增 `src/components/desktopHud/PendingQueueSurface.tsx`，并在 `DesktopHudRoot` 中展示 approval/question 安全队列。
- 2026-06-12：PendingQueueSurface 只展示 `Open terminal` / `HUD only` 安全占位，不执行 Allow / Deny / Answer。
- 2026-06-12：验证通过：`npm run build`、`npm run test:ui`、`npm run tauri:build`。NSIS 安装包生成于 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。

## 检查

- 结论：已完成 Phase 3 安全展示版。
- 需求覆盖：已继续推进 approval/question 队列展示；Desktop HUD 能从 Claude Code hook/status bridge 读取 pendingQueue 并显示脱敏 approval/question 提醒；未实现真实权限回写，符合本阶段安全边界。
- 产物路径：`.claude/bridge/claude-status-bridge.mjs`；`src-tauri/resources/claude-status-bridge.mjs`；`src/app/types.ts`；`src-tauri/src/window/claude_status.rs`；`src/providers/claudeCodeSummary.ts`；`src/components/desktopHud/PendingQueueSurface.tsx`；`src/components/desktopHud/DesktopHudRoot.tsx`；`src/styles.css`。
- 验证情况：`npm run build` 通过；`npm run test:ui` 通过（6 passed）；`npm run tauri:build` 通过并生成 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。
- 索引维护：`.claude/skills/work-journal/resources/index.md` 已登记本记录；本轮未新增长期资料入口，`.claude/workspace-index.md` 无需更新。
- 风险：此阶段仍只是 HUD 安全提醒队列，不会真正响应 Claude Code permission/question；后续若做 blocking response，必须单独设计 nonce、session binding、TTL、来源校验、审计日志和 fail-safe。