# Claude HUD One

Claude HUD One 是一款面向 Windows 11 的 Claude Code 本地 HUD 套件。当前主线架构为 Tauri 2 + React/TypeScript + Rust native `hud-bridge.exe` + Android Kotlin/Compose Mobile HUD：Claude Code `statusLine` / hooks 直接调用版本化 native bridge，由 Rust runtime 完成 stdin 解析、脱敏归一化、Terminal HUD 渲染、状态/会话/pending intent 写入和 hook response；Desktop HUD、Settings、Diagnostics 与 Android Mobile HUD 只消费低敏状态 DTO。早期 `codex-island`、Claude HUD Plus、Node bridge 相关内容仅作为历史/parity 参考，不是当前生产路径。

## 当前开发状态

当前主线已经从早期桌面动态岛 MVP 收敛为本地多端 HUD 架构：

- 前端：React / TypeScript / Vite，负责 Desktop HUD、Settings、Diagnostics、Usage/Cost 聚合展示和低敏 bridge session 展示。
- 桌面壳：Tauri 2，负责窗口、托盘、Settings、capabilities、原生命令和 NSIS 打包。
- Rust 本地层：Win32 overlay / display / fullscreen / terminal jump 能力、Claude Code native bridge、Mobile HUD runtime、Local Runtime audit SQLite 基础和 schema-first 协议验证。
- Claude Code 集成：安装包写入版本化 `hud-bridge-<sha>.exe` 到 Claude Code `statusLine` / hooks；Rust runtime 直接处理 statusLine/hooks stdin，不再运行、委托或打包 Node bridge / Claude HUD Plus runtime。
- Desktop HUD：CodeIsland 风格黑色 notch、多会话列表、Clawd 三态、approval/question attention、completion、Terminal HUD 跳转和低敏状态排序。
- Android Mobile HUD：Kotlin/Compose 客户端、Deep Link 配对、WSS + SPKI pinning、前台服务/通知、Mobile-safe snapshot 展示和低敏只读 DTO；手机端不直接执行命令，不展示 raw transcript/prompt/tool input/tool result/完整路径。
- 构建产物：`src-tauri\target\release\claude-hud-one.exe`
- 安装包产物：`src-tauri\target\release\bundle\nsis\Claude HUD One_0.1.0_x64-setup.exe`

## 开发命令

```powershell
npm install
npm run dev
npm run build
npm run check:version
npm run test:rust
npm run test:ui
npm run smoke
```

`npm run test:rust` 会运行 Usage/Cost 聚合的 Rust 单元测试。`npm run test:ui` 会通过 Node 脚本自启动 Vite 页面并生成 UI 冒烟截图，覆盖 compact、expanded Usage / Cost / Overview 与 Settings 路由。`npm run check:version` 会检查 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 三处版本一致。`npm run smoke` 会串联版本一致性、前端构建、Rust check、Rust 单元测试、UI 截图、Tauri release build 和 release exe 8 秒存活冒烟。

Tauri 运行需要先安装 Rust 工具链和系统 WebView2：

```powershell
npm run tauri:dev
```

## Claude Code 实时状态桥

本工作区已在 `.claude/settings.json` 接入 Claude Code `statusLine` 与轻量 hooks。安装包会安装 native `hud-bridge.exe` 作为 Claude Code 命令入口，由 Rust bridge 直接处理 statusLine、hooks、状态文件写入和 pending intent，不再把生产路径委托给 `node claude-status-bridge.mjs`。桥接链路只写入脱敏状态摘要：活动状态、事件名、工具名、模型名、上下文 token/百分比、成本/耗时、5h/7d rate limit 百分比与 reset 时间等聚合字段；不会保存 prompt、transcript 正文、tool-result 正文或凭据。

Claude HUD One 现在直接接管并重新实现 Terminal HUD 渲染：statusLine 模式会读取 Claude Code 输入和本地状态，在 native bridge 内渲染模型、项目、上下文、token/cost、工具和 pending attention 等信息，不再运行、调用或委托原来的 Claude HUD Plus statusLine 脚本。旧 Node bridge / Claude HUD Plus 源码仅作为 parity 参考，不再作为安装包生产依赖。

HUD 读取 `%APPDATA%\Claude HUD One\claude-status.json` 与 `.claude/bridge/state/claude-status.json`，正常模式约 1 秒刷新一次状态桥，低功耗模式约 5 秒刷新一次。

## 安装、卸载、更新与发布验证

- 本地完整验证：`npm run smoke`。脚本会检查版本和 Mobile HUD 协议、构建前端、检查 Rust、运行 Rust/bridge/security/UI 测试、打包 Tauri release，并启动 release exe 做存活冒烟。
- 安装：使用 `src-tauri\target\release\bundle\nsis\Claude HUD One_*_x64-setup.exe`。当前安装/卸载清理链路以 NSIS 为准。
- 卸载：NSIS 安装后可从 Windows “设置 → 应用 → 已安装的应用”卸载；也可通过安装目录中的卸载入口卸载。
- 开机启动：Settings → General → Launch at Login 会写入/移除 HKCU Run 项，随用户开关即时持久化。
- 更新：当前不上架应用商店，也未启用自动 updater feed；Settings → Updates 提供 GitHub Releases 手动更新入口。下载新版 NSIS 后覆盖安装即可完成更新。
- Windows CI 发布草案：`.github/workflows/release.yml`，支持 `workflow_dispatch` 与 `v*` tag，构建 NSIS、生成 SHA256SUMS，并在 tag 发布时上传 GitHub Release 资源。
- 当前尚未配置代码签名证书或 SmartScreen reputation；可发布使用但首次安装可能出现 Windows 安全提示。

## 关键文档

当前架构权威入口优先读：

- `local\需求讨论\2026-06-22-claude-hud-one-架构改造执行跟踪计划.md`
- `local\需求讨论\2026-06-23-claude-hud-one-pure-rust-bridge-finalization-plan.md`
- `local\需求讨论\2026-06-22-claude-hud-one-可持续技术栈与架构改造建议.md`
- `schemas\mobile-hud\README.md`
- `schemas\hud-bridge\fixtures\statusline-basic.json`

6/8-6/18 的 `codex-island`、Claude HUD Plus、HookServer/IPC、Node bridge、Android 空壳等文档均为历史阶段材料；如需引用，必须按 6/22-6/23 纯 Rust bridge 与 Mobile-safe 协议重新复核。

## 隐私原则

默认本地优先：不做默认遥测、不做默认 crash report、不上传本地日志、不记录 access token / refresh token / raw transcript / prompt 内容。Usage/Cost cache 只保存聚合后的 token/cost 字段，不保存原始日志正文或凭据；Diagnostics 只展示路径存在性、版本和缓存/设置文件位置。
