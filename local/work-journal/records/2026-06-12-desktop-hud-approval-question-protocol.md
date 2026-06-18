# Desktop HUD Approval / Question 安全交互协议

## 需求人

Dec27-Lee <lipengyue31@163.com>

## 原始需求

用户要求“继续”。在已完成 Desktop HUD V2 视觉、配置、approval/question 安全展示队列和 Terminal Jump 安全版后，继续按 CodeIsland 对标路径推进 Phase 4：让 Desktop HUD 的 approval/question 从只读提醒逐步走向可交互，但必须先建立安全协议，避免误批准、误答复或泄露敏感内容。

## 范围

- 本轮做：查证 Claude Code hook blocking response 官方协议；建立 Phase 4 安全交互最小模型；先实现不会回写 Claude Code 的本地安全操作地基，如 Open terminal、Dismiss HUD reminder、过期/处理中/错误状态、session-scoped item identity。
- 本轮谨慎做：只有在协议确认后，才接真实 Allow / Deny / Answer 回写；默认 fail-safe 不自动允许。
- 本轮不做：静默自动批准、Always allow、保存 raw prompt/tool input/tool result、执行任意命令、模拟键盘、绕过 Claude Code 原生权限模型。
- 待确认：Claude Code hook 对 PreToolUse / Notification / Stop 的最新 blocking response 格式和 timeout 行为。

## 计划

1. 并行查证 Claude Code hooks blocking response 官方协议，确认 stdout JSON、stderr、exit code、timeout 和各 hook 事件能力。
2. 梳理现有 bridge pendingQueue 与 Desktop HUD UI，明确只读提醒和真实安全操作之间的差距。
3. 创建本地安全操作地基：session-scoped pending item key、Dismiss HUD reminder 状态、Open terminal 复用 Terminal Jump、安全错误/处理中反馈。
4. 扩展 PendingQueueSurface props/state/样式，让 approval/question 能渲染 choices，但默认只执行 HUD-local 安全动作。
5. 协议确认后再设计 blocking response：nonce、session binding、TTL、来源校验、审计日志、fail-safe timeout。
6. 验证 build、UI smoke、tauri build 并回写记录。

## 进展

- 2026-06-12：已创建本记录；当前 Git 身份为 `Dec27-Lee <lipengyue31@163.com>`。
- 2026-06-12：已启动只读子代理查证 Claude Code hooks blocking response 协议；在协议确认前不实现真实 Allow / Deny / Answer 回写。
- 2026-06-12：已确认官方协议要点：`PreToolUse` 支持 `hookSpecificOutput.permissionDecision = allow / deny / ask / defer`；`Notification` 不支持 decision 阻塞；`Stop` 支持顶层 `decision: "block"`；只有 exit 0 时 Claude Code 才解析 stdout JSON，exit 2 会忽略 stdout JSON 并用 stderr 作为阻塞原因。
- 2026-06-12：已把 PendingQueueSurface 从纯占位升级为 HUD-local 安全动作层：支持 session-scoped `displayKey`、Open terminal、Dismiss HUD、处理中/错误反馈、overflow 提示和未来协议按钮的禁用态展示。
- 2026-06-12：已修正 DesktopHudRoot 的 pending item 聚合，不再只按 `item.id` 跨 session 去重，而是使用 session-scoped key，降低多会话串线风险。
- 2026-06-12：已让 `.claude/bridge/claude-status-bridge.mjs` 和 `src-tauri/resources/claude-status-bridge.mjs` 在 hook 模式下只在有明确 hook response 对象时写 stdout；`PreToolUse` 当前显式返回 `permissionDecision: "defer"`，即 HUD 只记录脱敏提醒，最终权限仍交给 Claude Code 原生流程。
- 2026-06-12：验证通过：`npm run build`、`npm run test:ui`、`npm run tauri:build`。NSIS 安装包生成于 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。

## 检查

- 结论：部分完成。Phase 4 的安全地基已完成，真实 Allow / Deny / Answer 回写尚未启用。
- 需求覆盖：已从只读提醒推进到 HUD-local 可交互地基；Open terminal 和 Dismiss HUD 可操作；协议按钮仍禁用，避免误批准。
- 安全边界：不保存 raw prompt、tool input、tool result；不自动允许；`PreToolUse` 只返回 `defer`；`Notification` 不尝试阻塞；真实 `allow/deny/answer` 需要后续 HookServer/IPC、nonce、session binding、TTL、审计和 fail-safe 设计后再接。
- 产物路径：`.claude/bridge/claude-status-bridge.mjs`；`src-tauri/resources/claude-status-bridge.mjs`；`src/components/desktopHud/PendingQueueSurface.tsx`；`src/components/desktopHud/DesktopHudRoot.tsx`；`src/styles.css`。
- 验证情况：`npm run build` 通过；`npm run test:ui` 通过（6 passed）；`npm run tauri:build` 通过并生成安装包。
- 风险：真实权限回写仍是高风险阶段，不能在没有 HookServer/IPC 绑定和过期保护时启用 Allow / Deny / Answer。