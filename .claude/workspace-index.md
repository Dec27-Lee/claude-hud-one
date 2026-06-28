# 工作区索引

## 顶层入口

| 路径 | 类型 | 用途 | 入口文件 |
| --- | --- | --- | --- |
| `CLAUDE.md` | 工作区规则 | Claude 使用和维护工作区索引、工作日志、完成检查的规则 | `CLAUDE.md` |
| `.claude/` | Claude 配置 | skills、hooks、工作日志、索引 | `.claude/workspace-index.md` |


## 二级索引入口

| 索引路径 | 管理范围 | 包含信息 | 下一步入口 |
| --- | --- | --- | --- |
| `local/work-journal/index.md` | 工作日志历史记录 | 每条记录的日期、标题、状态、关键词/适用场景、记录文件路径、备注 | 命中的 `local/work-journal/records/*.md` |

## 工作文件索引

| 路径 | 用途 | 入口文件 |
| --- | --- | --- |
| `local/参考项目/codex-island/` | macOS Claude/Codex 用量动态岛参考项目，用于补充分析 usage/cost/dashboard、三态窗口和性能策略；不是用户截图中的多会话 mascot 项目 | `local/参考项目/codex-island/README.zh-CN.md` |
| `local/参考项目/CodeIsland/` | macOS Claude Code / 多 agent notch 参考项目，用于视觉/交互 parity 参考；其 HookServer/bridge 等实现不代表 Claude HUD One 当前架构，当前生产链路以 Rust native `hud-bridge.exe` 为准 | `local/参考项目/CodeIsland/README.zh-CN.md` |
| `local/需求讨论/` | Win11 Claude HUD One 需求讨论、技术分析和架构改造资料。当前架构权威入口优先读 2026-06-22 架构改造执行跟踪、2026-06-23 纯 Rust Bridge 最终化计划、2026-06-22 可持续技术栈建议；6/8-6/18 的 codex-island、Claude HUD Plus、HookServer/IPC、Node bridge、Android 空壳等描述均为历史阶段材料，引用前必须按最新纯 Rust bridge / Mobile-safe 协议复核 | `local/需求讨论/2026-06-22-claude-hud-one-架构改造执行跟踪计划.md`；`local/需求讨论/2026-06-23-claude-hud-one-pure-rust-bridge-finalization-plan.md`；`local/需求讨论/2026-06-22-claude-hud-one-可持续技术栈与架构改造建议.md`；历史背景可按需读 `local/需求讨论/2026-06-22-claude-code-terminal-desktop-mobile-architecture-analysis.md`、`local/需求讨论/2026-06-17-claude-hud-one-android-mobile-hud-一期开发执行计划.md` |
| `apps/android/` | Android 手机 HUD App 子工程，包含 Kotlin/Compose 客户端、Deep Link 配对、WSS/SPKI 连接、前台服务/通知、低敏 Mobile DTO 展示、fixture/安全/通知单测和 APK 构建入口 | `apps/android/settings.gradle.kts` |
| `schemas/mobile-hud/` | Mobile HUD 跨端协议 schema、fixtures 和契约样例，供 Rust/TypeScript/Android/未来 iOS/联调测试共用 | `schemas/mobile-hud/README.md` |
| `schemas/hud-core/` | HUD Core 归一化状态与隐私红线 schema，供跨端低敏 DTO、安全审查和协议验证共用 | `schemas/hud-core/privacy-denylist.json` |
| `schemas/hud-bridge/` | Claude Code statusLine/hooks native bridge 契约 fixtures，供纯 Rust bridge parity 和回归测试使用 | `schemas/hud-bridge/fixtures/statusline-basic.json` |
| `package.json` | 前端/Tauri npm 脚本与依赖入口 | `package.json` |
| `src/` | React/TypeScript 前端 UI、状态模型、mock 数据与动态岛组件 | `src/app/App.tsx` |
| `src-tauri/` | Tauri 2 桌面壳、Rust 原生窗口能力与打包配置 | `src-tauri/tauri.conf.json` |
| `tests/` | Playwright UI 冒烟与截图验收 | `tests/ui.spec.ts` |
| `scripts/` | 本地验证与 smoke 脚本入口 | `scripts/smoke.ps1` |
| `.github/workflows/` | GitHub Actions Windows 发布构建草案 | `.github/workflows/release.yml` |


## Claude 工作区资产索引

| 路径 | 用途 |
| --- | --- |
| `.claude/settings.json` | 项目级 hook/statusLine 配置 |
| `.claude/skills/work-journal/SKILL.md` | 工作日志技能入口 |
| `local/work-journal/index.md` | 工作日志历史记录二级索引，记录每条历史记录的路径和适用场景 |
| `.claude/skills/work-journal/resources/hooks/reminder.py` | 工作日志提醒 hook |
| `local/work-journal/records/` | 需求、任务、复盘记录文件存放目录；具体记录路径见 `local/work-journal/index.md` |
| `.claude/skills/clear-thinking/SKILL.md` | 思考方法论技能入口；复杂判断、规划、复盘前按需使用 |
| `.claude/skills/clear-thinking/resources/` | clear-thinking 运行资料目录；路由器、微技能索引、分类微技能目录、检查清单 |
