# Codex Island 桌面 HUD 展示与交互参考分析

## 需求人

Dec27-Lee <lipengyue31@163.com>

## 原始需求

研究参考项目 `local\参考项目\codex-island` 的桌面悬浮窗/HUD 展示效果：执行任务时 Claude 小人动画、多会话展示、悬浮窗点击交互（选择、确认等），分析 Claude HUD One 桌面 HUD 如何直接参考甚至照抄，并在 `local\需求讨论` 下写分析报告。

## 范围

- 本轮做：读取参考项目与本项目相关代码/文档，梳理 Codex Island HUD 的窗口、动画、多会话、交互承载与事件链路；对照 Claude HUD One 当前实现，输出可落地的参考/复刻分析报告。
- 本轮不做：直接改造桌面 HUD 功能代码；提交或推送 Git；制作安装包之外的发行发布动作。
- 待确认：后续是否进入实现阶段，以及“照抄”范围是视觉优先、交互优先还是底层架构也对齐。

## 计划

1. 按索引读取参考项目入口与已有需求讨论资料，避免重复结论。
2. 并行分析 `codex-island` 的 HUD UI/动画/多会话/交互链路与本项目 Desktop HUD 当前架构。
3. 汇总差距、可直接借鉴点、Windows/Tauri 适配风险与分阶段落地方案。
4. 在 `local\需求讨论` 新增分析报告。
5. 按项目完成规则进行必要验证与打包，并回写工作记录检查结论。

## 进展

- 2026-06-12：已创建本记录，并更新工作日志索引。
- 2026-06-12：已并行只读分析参考项目 `local\参考项目\codex-island` 的 HUD 视觉/窗口/动效、多会话/交互链路，本项目 Desktop HUD/Tauri/Rust/Bridge 现状，以及既有 `local\需求讨论` 资料。
- 2026-06-12：已新增分析报告 `local\需求讨论\2026-06-12-codex-island-desktop-hud-展示交互复刻分析.md`。
- 2026-06-12：已更新 `.claude\workspace-index.md`，把新增报告加入 `local/需求讨论/` 入口。
- 2026-06-12：已按完成规则执行 `npm run tauri:build`，构建与 NSIS 安装包生成通过，产物为 `src-tauri\target\release\bundle\nsis\Claude HUD One_0.1.0_x64-setup.exe`。
- 2026-06-12：用户补充截图并指出橙色小人确实存在；已核对旧本地参考 `codex-island` remote 为 `ericjypark/codex-island`，不是截图项目。
- 2026-06-12：已按用户提供的 `git@github.com:wxtsky/CodeIsland.git` 克隆到 `local\参考项目\CodeIsland`，确认其中包含 `ClawdView` 像素小人、多会话 `SessionCard`、approval/question、Ghostty/iTerm2 click-to-jump、HookServer/bridge 等能力。
- 2026-06-12：已修正分析报告口径：Desktop HUD 主参考切换为 `local\参考项目\CodeIsland`，`codex-island` 退为 usage/cost/dashboard 补充参考；并更新 `.claude\workspace-index.md` 新增 CodeIsland 入口。

## 检查

- 结论：已完成。
- 需求覆盖：已覆盖远程 CodeIsland 重新拉取、截图橙色 mascot 事实纠偏、多会话卡片、悬浮窗 approval/question、终端跳转、Claude HUD One 当前承接能力和分阶段复刻方案。
- 产物路径：`local\需求讨论\2026-06-12-codex-island-desktop-hud-展示交互复刻分析.md`；新增参考项目 `local\参考项目\CodeIsland`。
- 验证情况：CodeIsland 已成功克隆并核对 remote/最新提交；报告和索引已更新；本轮文件收尾后执行 `npm run tauri:build` 作为最终打包验证。
- 索引维护：已更新 `.claude\workspace-index.md`；`.claude\skills\work-journal\resources\index.md` 已同步为 done。
- 风险：CodeIsland 是 macOS/SwiftUI/AppKit/AppleScript/CoreBluetooth 实现，Windows/Tauri 需改写 HookServer IPC、TerminalActivator、窗口层和权限确认安全策略；不能直接复制第三方 mascot 图像资源，建议复刻像素风格和状态语义。
