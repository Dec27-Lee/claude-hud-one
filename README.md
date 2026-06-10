# Claude HUD One

Claude HUD One 是一款为 Windows 11 打造的 Claude Code 动态岛 HUD。一期按 macOS 参考项目 `codex-island` 的核心体验做 Windows 复刻；本轮先面向 Claude Code 发布使用，Codex 代码保留但前端默认不展示，后续按需补齐。

## 当前开发状态

已启动 Tauri 2 + React + TypeScript + Rust Win32 native layer 的项目骨架，并已完成首轮可构建桌面包验证：

- 前端：React / TypeScript / Vite
- 桌面壳：Tauri 2
- Windows 原生能力：Rust 侧已接入第一层 overlay 样式，设置 `WS_EX_LAYERED` / `WS_EX_TOOLWINDOW` / `WS_EX_NOACTIVATE`，并用 `WM_MOUSEACTIVATE -> MA_NOACTIVATE` 阻止 overlay 鼠标点击激活；已加入 50ms cursor hit-test 轮询，根据前端上报的多矩形交互区域动态切换 `WS_EX_TRANSPARENT`；已加入显示器列表、目标显示器和 top offset 定位；已接入前台全屏窗口基础检测与自动隐藏 overlay；已加入当前 Claude Code 会话摘要扫描命令，仅统计事件类型、数量和时间戳；已加入本地 Usage/Cost 聚合与 last-known-good 聚合缓存、Claude Code statusLine/hook 状态桥、Settings 原生配置文件、HKCU Run 开机启动、托盘菜单、诊断目录打开、App data 诊断摘要和更新器状态预留
- 当前 UI：使用 mock 数据实现 compact / peek / expanded、Usage / Cost / Overview、Settings 独立窗口；expanded 面板已加入 Current Session 状态条，可用当前 Claude Code 会话 transcript 做真实测试模拟；Usage/Cost/Overview 可被本地 Claude Code 聚合数据覆盖，其中 Usage 优先读取 Claude Code statusLine 自带的 rate limit 估算字段；Current Session 已优先读取 Claude Code statusLine/hook bridge，可在用户提交、工具调用、停止/等待等事件后约 1 秒内刷新；并补充 source/auth 标识、stale/error/threshold alerts、手动刷新、低功耗、显示器选择、手动更新入口和 diagnostics 展示；Codex 数据结构保留但前端默认不展示；已接入 Playwright UI 冒烟截图验收
- 构建产物：`src-tauri\target\release\claude-hud-one.exe`
- 安装包产物：`src-tauri\target\release\bundle\nsis\Claude HUD One_0.1.0_x64-setup.exe`、`src-tauri\target\release\bundle\msi\Claude HUD One_0.1.0_x64_en-US.msi`

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

本工作区已在 `.claude/settings.json` 接入 Claude Code `statusLine` 与轻量 hooks，命令为 `node .claude/bridge/claude-status-bridge.mjs`。桥接脚本只写入脱敏状态摘要：活动状态、事件名、工具名、模型名、上下文百分比、成本/耗时、5h/7d rate limit 百分比与 reset 时间等聚合字段；不会保存 prompt、transcript 正文、tool-result 正文或凭据。

为避免覆盖用户全局 `claude-hud-plus` 底部状态栏，statusLine 模式会先写入 Claude HUD One 状态文件，再自动检测并委托 `%USERPROFILE%\.claude\plugins\claude-hud-plus\statusline.ps1` 输出原 HUD Plus 多行状态；如果本机没有 HUD Plus 或委托超时，则回退显示 `Claude HUD One · ...`。可通过 `CLAUDE_HUD_PLUS_STATUSLINE` 覆盖 HUD Plus 脚本路径。

HUD 读取 `%APPDATA%\Claude HUD One\claude-status.json` 与 `.claude/bridge/state/claude-status.json`，正常模式约 1 秒刷新一次状态桥，低功耗模式约 5 秒刷新一次。

## 安装、卸载、更新与发布验证

- 本地完整验证：`npm run smoke`。脚本会构建前端、检查 Rust、运行 Rust/UI 测试、打包 Tauri release，并启动 release exe 做存活冒烟。
- 安装：优先使用 `src-tauri\target\release\bundle\nsis\Claude HUD One_0.1.0_x64-setup.exe`；也可用 MSI `src-tauri\target\release\bundle\msi\Claude HUD One_0.1.0_x64_en-US.msi`。
- 卸载：NSIS/MSI 安装后可从 Windows “设置 → 应用 → 已安装的应用”卸载；也可通过安装目录中的卸载入口卸载。
- 开机启动：Settings → General → Launch at Login 会写入/移除 HKCU Run 项，随用户开关即时持久化。
- 更新：当前不上架应用商店，也未启用自动 updater feed；Settings → Updates 提供 GitHub Releases 手动更新入口。下载新版 NSIS/MSI 后覆盖安装即可完成更新。
- Windows CI 发布草案：`.github/workflows/release.yml`，支持 `workflow_dispatch` 与 `v*` tag，构建 NSIS/MSI、生成 SHA256SUMS，并在 tag 发布时上传 GitHub Release 资源。
- 当前尚未配置代码签名证书或 SmartScreen reputation；可发布使用但首次安装可能出现 Windows 安全提示。

## 关键文档

- `local\需求讨论\2026-06-08-win11-codex-island-full-replica-一期正式产品方案.md`
- `local\需求讨论\2026-06-09-claude-hud-one-对标codex-island-当前进展与正式使用缺口.md`
- `local\参考项目\codex-island\README.zh-CN.md`

## 隐私原则

默认本地优先：不做默认遥测、不做默认 crash report、不上传本地日志、不记录 access token / refresh token / raw transcript / prompt 内容。Usage/Cost cache 只保存聚合后的 token/cost 字段，不保存原始日志正文或凭据；Diagnostics 只展示路径存在性、版本和缓存/设置文件位置。
