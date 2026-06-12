# CodeIsland 源码级 Desktop HUD Parity Pass

## 需求人

Dec27-Lee <lipengyue31@163.com>

## 原始需求

用户明确纠偏：桌面 HUD 不是“参考 CodeIsland 风格”，而是要按照 `local/参考项目/CodeIsland` 实现，展示和交互直接照抄；不能继续用主观重新设计或只做功能骨架。用户要求“好，开始吧”，并通过 `/work-journal 要按照技能工作流程执行` 要求先按工作日志流程定位和记录，再推进实现。

## 范围

- 本轮做：建立源码级 parity pass，按 CodeIsland 源码逐模块翻译 Desktop HUD：NotchPanelView / NotchPanelShape / NotchAnimation / IslandSurface / ClawdView / SessionList / SessionCard / ApprovalBar / QuestionBar / Completion surface；优先修正主面板形状、surface 状态机、session card、pending card 和 Clawd 动画的不一致。
- 本轮不做：继续主观设计新样式；引入其他 AI provider；破坏现有 Terminal HUD；未经安全协议启用真实 Allow / Deny / Answer；提交或推送。
- 待确认：是否需要后续使用截图 diff 做逐像素验收；如果任务规模继续扩大，需按项目规则升级为 Workflow，但当前工具调用需遵守会话权限与用户许可。

## 计划

1. 按索引读取必要历史和 CodeIsland 源码入口，不全量遍历 records。
2. 建立 CodeIsland SwiftUI/AppKit 到 React/Tauri/Win32 的逐模块翻译表，明确每个 Swift 文件对应的目标 TS/CSS/Rust 文件。
3. 先做 P0：主面板形状与 surface 状态机，从 compact/peek/expanded 混合模型改为更接近 CodeIsland 的 collapsed/sessionList/approvalCard/questionCard/completionCard。
4. 再做 P1：SessionList/SessionCard/ApprovalBar/QuestionBar/CompletionCard 的布局和文案照抄式翻译，移除桌面 HUD 主视图里的旧 Usage/Cost/Context 干扰。
5. 再做 P2：Clawd 像素动画以 CodeIsland 坐标/周期为准继续收敛，必要时改 React Canvas/SVG，而不是普通 CSS 近似。
6. 每阶段执行 `npm run build`、`npm run test:ui`，只要改代码，完成声明前必须执行 `npm run tauri:build` 重新打包。
7. 回写本记录和索引，明确完成/部分完成/未完成。

## 进展

- 2026-06-12：已创建本记录；当前 Git 身份为 `Dec27-Lee <lipengyue31@163.com>`。
- 2026-06-12：已按技能流程先读取 `.claude/workspace-index.md` 和 `.claude/skills/work-journal/resources/index.md`；没有全量读取 records。
- 2026-06-12：用户已明确要求按 work-journal 工作流程执行；此前尝试直接并行分析被中断，因此先补齐记录与索引，再继续实现。
- 2026-06-12：完成第一轮源码级 parity pass：`DesktopHudRoot.tsx` 从旧 Usage/Cost/Overview dashboard 改为 CodeIsland 式单一 surface 状态机，按 `approvalCard > questionCard > completionCard > sessionList > collapsed` 展示；主面板改为黑色 notch surface、虚线 divider、工具栏和 session surface。
- 2026-06-12：重写 `PendingQueueSurface.tsx` 为 CodeIsland `ApprovalBar` / `QuestionBar` 结构；显示 `!` / `?`、项目、过期信息、1/N 队列位置、安全 choices 占位、pixel buttons；真实 Deny/Allow/Always/Submit 仍保持 disabled，只允许 HUD-local Dismiss/Skip 与 Terminal。
- 2026-06-12：重写 `SessionCard.tsx` 为更接近 CodeIsland 的 mascot + identity + activity + one-line status + tags + terminal action；补充 terminal jump 失败 shake。
- 2026-06-12：重构 `DesktopHudCapsule.tsx` 为 left/main/right wing compact bar：左侧 Clawd + tool/model，中间 session/ticker，右侧 attention bell、会话计数和 terminal glyph；样式改为更接近 CodeIsland 的纯黑 notch shell。
- 2026-06-12：expanded session list 改为滚动列表，不再按 `maxVisibleSessions` 直接丢弃会话；加入 ALL/STA/CLI 分组按钮骨架，STA 按状态分组，CLI 按 source label 分组。
- 2026-06-12：同步更新 `tests/ui.spec.ts`，把 UI smoke 从旧 Usage/Cost/Overview 主面板断言改为 CodeIsland session surface 断言。
- 2026-06-12：继续补齐 CodeIsland `ApprovalToolDetailView` / `QuestionBar` 的安全版结构：新增脱敏 tool detail 区、question option/input 视觉、choices 分类渲染；坚持不保存 tool input、命令参数、prompt、transcript 或凭据。
- 2026-06-12：在 `SessionCard.tsx` 增加 inline pending attention summary，卡片内可直接看到当前 approval/question 的脱敏摘要；ticker 动画改为更接近 CodeIsland `MorphText` 的 blur morph。
- 2026-06-12：根据用户截图反馈修复 Desktop HUD 新增 CodeIsland 组件未跟随简体中文设置的问题：`DesktopHudRoot`、`DesktopHudCapsule`、`PendingQueueSurface`、`SessionCard`、`CompletionCard` 和 `sessionFormatters` 已接入 `settings.language`，翻译 waiting/needs attention、pending 标题/摘要、按钮、终端跳转错误和 completion 文案；UI smoke 同步兼容中文 aria。
- 2026-06-12：根据用户反馈检查 `wt.exe` 报错：本机确已安装 Windows Terminal（`Microsoft.WindowsTerminal 1.24.11321.0`），且 `C:\Users\Yue\AppData\Local\Microsoft\WindowsApps\wt.exe` 存在；根因是当前进程 PATH 未包含 WindowsApps，导致 `Command::new("wt.exe")` 找不到。已修复 `src-tauri/src/window/terminal_jump.rs`：先尝试 PATH 中的 `wt.exe`，失败后尝试 `LOCALAPPDATA\Microsoft\WindowsApps\wt.exe` 和 `USERPROFILE\AppData\Local\Microsoft\WindowsApps\wt.exe`。
- 2026-06-12：用户明确指出“点击后应该跳转到已有终端里回复，不是打开新终端”。已修正 Terminal Jump 语义：`overlayBridge.ts` 传递 bridge 采集到的 `bridgeProcessId` / `bridgeParentProcessId`；`terminal_jump.rs` 使用 Toolhelp32 进程快照沿 bridge 进程祖先查找 `WindowsTerminal.exe` / `wt.exe`，再通过 `EnumWindows`、`ShowWindow(SW_RESTORE)`、`SetForegroundWindow` 聚焦已有 Windows Terminal；只有找不到已有终端窗口时才 fallback 新开 Windows Terminal 到 cwd。

## 检查

- 结论：部分完成。
- 验证情况：`npm run build` 通过；`npm run test:ui` 6 项通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`npm run tauri:build` 通过并重新生成 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`；Terminal Jump 已从“直接新开终端”改为“优先聚焦已有 Windows Terminal，找不到才新开”。
- 已覆盖：本轮已把 Desktop HUD 主面板、surface 状态机、session list/card、approval/question card、compact bar、脱敏 tool detail、question option/input 视觉、inline pending summary、ticker blur morph、简体中文本地化进一步按 CodeIsland 源码结构翻译；Terminal HUD 未移除，Approval/Question 危险回写未启用。
- 剩余缺口：仍未做到逐像素 parity；CodeIsland 的真实 tool input diff/command preview、Question 真实 answer/multi-question wizard、Always Allow 安全协议、macOS terminal foreground/auto-collapse、haptic/notch 物理检测不在本轮启用；Clawd 仍是 CSS DOM 像素实现，不是 SwiftUI Canvas 坐标级复刻。
- 风险：当前是 Windows floating overlay 对 CodeIsland macOS notch 的源码结构翻译，不能声称 100% 等价；后续若继续追求“直接照抄”，应优先做截图 diff 验收或单独设计真实安全回写协议。