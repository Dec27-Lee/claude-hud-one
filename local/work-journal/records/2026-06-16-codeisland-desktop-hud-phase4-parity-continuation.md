# CodeIsland Desktop HUD 真实交互与验收补齐

## 需求人

Dec27-Lee <lipengyue31@163.com>

## 原始需求

用户在检查 `local\需求讨论\2026-06-12-claude-hud-one-全面对标-codeisland-桌面hud改造方案.md` 的对标复刻进度后，确认“第五个不做，前四个都做，继续”。这里第五个指 Usage/Cost 辅助页不做；前四个指继续补齐 Phase 4 真实安全回写协议、逐像素/截图 diff 验收、真实 Question 流程、修正 Terminal Jump 配置语义。

## 范围

- 本轮做：
  1. Phase 4：实现 Desktop HUD approval/question 的真实安全回写协议，至少覆盖可审计、可过期、session 绑定、fail-safe，不自动允许。
  2. 建立逐像素/截图 diff 验收能力，用于对 CodeIsland 风格 Desktop HUD 进行可重复视觉检查。
  3. 实现真实 Question 流程，支持选项/文本输入从 HUD 产生可回传的 answer intent，并保留安全边界。
  4. 修正 Terminal Jump 配置语义，让 `focus` / `openCwd` / `disabled` 行为与设置一致。
- 本轮不做：Usage/Cost 辅助页；多 provider；自动 Always Allow；保存 raw prompt/tool input/tool result/命令参数/凭据；绕过 Claude Code 原生权限模型；提交或推送。
- 待确认：真实 hook blocking response 的端到端能力受 Claude Code hook 调用时序限制；如无法安全闭环，只能落地协议地基和 fail-safe 行为并说明限制。

## 计划

1. 按索引读取命中的历史记录，不全量读取 records；核验当前 Git 身份和工作区状态。
2. 并行审查现有 bridge hook、Desktop HUD pending/question UI、Terminal Jump、测试/截图能力，形成最小改造清单。
3. 先实现安全 intent 协议和 queue 状态：nonce/TTL/session key/action 状态/审计事件/fail-safe；保持无 raw 敏感数据。
4. 接入 PendingQueueSurface 的真实可操作 question/approval 控件，并保证未被安全协议覆盖的动作不可用。
5. 修正 Terminal Jump strategy 透传到 Rust，区分 focus/openCwd/disabled。
6. 新增或更新截图 diff/Playwright 验收脚本与 UI smoke。
7. 执行 `npm run build`、`npm run test:ui`、必要截图/差异验收、`cargo check`、`npm run tauri:build`，并回写记录和索引。

## 进展

- 2026-06-16：已创建本记录；当前 Git 身份为 `Dec27-Lee <lipengyue31@163.com>`。
- 2026-06-16：已通过 `.claude/workspace-index.md` 和 `local/work-journal/index.md` 定位，只读取强相关历史记录：`2026-06-12-codeisland-source-level-desktop-hud-parity-pass.md`、`2026-06-12-desktop-hud-approval-question-protocol.md`、`2026-06-12-desktop-hud-terminal-jump.md`。
- 2026-06-16：完成 Phase 4 安全 intent 地基：bridge 为 `PreToolUse` approval 生成 `intentId`、`allowedIntents`、TTL 和私有 nonce request 文件；Tauri 新增 `resolve_claude_pending_intent`，校验 request、写 response 与 audit；hook 在 timeout 内等待 response，验证 nonce/TTL/session/action 后输出 `allow` / `deny`，否则 fail-safe `defer`。
- 2026-06-16：同步更新 `.claude/bridge/claude-status-bridge.mjs` 与 `src-tauri/resources/claude-status-bridge.mjs`；项目 `.claude/settings.json` 的 `PreToolUse` hook timeout 调整为 30 秒，安装器侧 `claude_global.rs` 也为 PreToolUse 设置 30 秒并会修正既有 bridge hook timeout。
- 2026-06-16：完成 Desktop HUD approval/question UI 接入：`PendingQueueSurface` 启用安全允许一次/拒绝按钮，`DesktopHudRoot` 调用 Tauri command 并显示提交状态；Question 增加自由输入框和 `answerIntent` 提交路径。由于当前 Claude Code `Notification` / `Stop` 不是通用 answer blocking 协议，Question 回写目前按安全 intent/audit 记录，不伪造键盘或剪贴板注入。
- 2026-06-16：完成 Terminal Jump 配置语义修正：`terminalJumpBehavior` 运行时校验；前端把 `focus` / `openCwd` / `disabled` 传给 Rust；Rust `focus` 只聚焦已有 Windows Terminal，找不到返回 `notFound`，`openCwd` 才在找不到时打开 cwd，`disabled` 前后端均不执行跳转。
- 2026-06-16：完成截图 diff 验收地基：新增 `tests/visual.spec.ts`、Playwright `toHaveScreenshot` 配置、`test:visual` / `test:visual:update` 脚本，并生成 `tests/__screenshots__/visual.spec.ts/*.png` baseline，覆盖 compact capsule、expanded session surface、Desktop HUD 设置页、Terminal HUD 设置页。
- 2026-06-16：验证通过：`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run test:visual:update`、`npm run test:visual`、`npm run test:ui`、`npm run tauri:build`。NSIS 安装包生成于 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。
- 2026-06-16：用户截图反馈当前 UI 看起来奇怪，并质疑是否真的按 CodeIsland 参考项目做。复核 `local/参考项目/CodeIsland/docs/images/notch-panel.png` 与 `NotchPanelView.swift` 后确认此前视觉验收不充分：当前实现偏“功能结构对齐”，没有严格复刻 CodeIsland 的紧凑 notch 比例、monospace 低对比风格和 session card 密度。
- 2026-06-16：已返工 Desktop HUD 外观：expanded 宽度从 820px 收敛到约 620px，top bar 从 48px 降到 34px；compact 隐藏 tool/status/terminal 防止 `活跃/2` 竖排；面板改为纯黑、弱阴影、低对比；分组按钮改为 CodeIsland 风格绿色选中态；session card 降低厚度、减小 Clawd card 尺寸到 32px、弱化 terminal button；Clawd 降低橙色饱和、隐藏部分腿、降低 alert 手臂大幅旋转，减少“螃蟹感”；mock model 文案从 `gpt-5.5[1m]` 改为 `gpt-5.5`。
- 2026-06-16：已重新生成 visual baseline，并通过 `npm run build`、`npm run test:visual:update`、`npm run test:visual`、`npm run test:ui`、`npm run tauri:build`。NSIS 安装包仍生成于 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。
- 2026-06-16：用户反馈点击终端跳转时提示“没有找到这个 Claude Code 会话对应的已有 Windows Terminal”。复核后确认原因是此前默认 `terminalJumpBehavior` 为严格 `focus`，只能在进程祖先链能确认对应 `WindowsTerminal.exe` 时聚焦；statusLine/hook bridge 进程可能是短生命周期子进程，点击时 PID/PPID 已失效，导致即使用户确实在 Windows Terminal 中运行也无法匹配。曾短暂将默认策略调整为 `openCwd`。
- 2026-06-16：用户进一步反馈 `openCwd` 会打开新终端/输入地址，不符合“跳到已有终端入口”的交互预期。已纠偏：Desktop HUD 配置版本升至 v4，默认终端跳转恢复为 `focus`，并把 v3 的错误默认 `openCwd` 迁移回 `focus`；Rust 侧 `focus_existing_terminal` 在 PID 祖先链匹配失败后，会按 Windows Terminal 窗口类/进程枚举已有窗口，优先用项目名/cwd/title hint 匹配窗口标题，若只有一个可见 Windows Terminal 则聚焦该窗口；只有用户显式选择 `openCwd` 时才允许“找不到则打开 cwd”。
- 2026-06-16：用户指出多 Windows Terminal 窗口下仍需要定位对应窗口，且 Claude Code 可能来自 Windows Terminal、Trae 或 VS Code 终端；本轮只针对 Windows Terminal 多窗口增强，不处理 Trae/VS Code 内嵌终端。已让 statusLine bridge 在 Windows Terminal 环境中输出 OSC title 序列，把当前 WT tab/window 标题标记为 `Claude Code · 项目 · session短ID`，并同步保存 `windowTitleHint`；Rust 窗口枚举改为对 title hint 进行加权匹配，优先匹配带 session 短 ID 的完整标题，避免多个窗口只因同项目名误匹配；同分歧义时不强行选择。已通过 bridge 语法检查、前端构建、Rust 检查、视觉/UI 测试和重新打包。

## 检查

- 结论：部分完成。
- 需求覆盖：第五项 Usage/Cost 辅助页未做；前四项均已落地代码与验证：真实 approval allow/deny 安全回写协议、Question HUD 输入/answer intent、安全截图 diff 验收、Terminal Jump 配置语义。
- 产物路径：`.claude/bridge/claude-status-bridge.mjs`；`.claude/settings.json`；`src-tauri/resources/claude-status-bridge.mjs`；`src-tauri/src/lib.rs`；`src-tauri/src/window/claude_global.rs`；`src-tauri/src/window/claude_status.rs`；`src-tauri/src/window/terminal_jump.rs`；`src/app/overlayBridge.ts`；`src/app/types.ts`；`src/components/desktopHud/*`；`src/hud/config.ts`；`src/styles.css`；`playwright.config.ts`；`package.json`；`tests/visual.spec.ts`；`tests/__screenshots__/visual.spec.ts/*.png`。
- 验证情况：前端构建、Rust 检查、UI smoke、视觉截图 diff、Tauri release build 和 NSIS 打包均通过；Terminal Jump 多 Windows Terminal 窗口增强后已重新通过 `node --check .claude/bridge/claude-status-bridge.mjs`、`node --check src-tauri/resources/claude-status-bridge.mjs`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run test:visual`、`npm run test:ui`、`npm run tauri:build`。
- 风险/限制：真实 approval allow/deny 已走 hook blocking response；真实 Question 仍受 Claude Code 官方 hook 能力限制，目前 `Notification` / `Stop` 不支持通用 answer 注入，所以本轮只实现 HUD 侧真实输入与安全 answer intent，不做模拟键盘、剪贴板注入或保存 prompt/tool input。Terminal Jump 默认 `focus` 会优先聚焦已确认或可推断的已有 Windows Terminal；Windows Terminal 多窗口会通过 statusLine 写入的 title hint 做更精确匹配，但如果用户关闭应用改标题能力、窗口标题未更新，或多个窗口同分匹配，仍会安全失败而不是乱跳。Trae/VS Code 内嵌终端暂不处理。尚未做真实 Claude Code 会话中的人工端到端点击验收。
