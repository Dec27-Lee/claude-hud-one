# Claude Island Win

Claude Island Win 是一款为 Windows 11 打造的 Claude/Codex 动态岛 HUD。一期目标是完整复刻 macOS 参考项目 `codex-island` 已有功能，并按正式发布产品打造。

## 当前开发状态

已启动 Tauri 2 + React + TypeScript + Rust Win32 native layer 的项目骨架，并已完成首轮可构建桌面包验证：

- 前端：React / TypeScript / Vite
- 桌面壳：Tauri 2
- Windows 原生能力：Rust 侧已接入第一层 overlay 样式，设置 `WS_EX_LAYERED` / `WS_EX_TOOLWINDOW` / `WS_EX_NOACTIVATE`，并用 `WM_MOUSEACTIVATE -> MA_NOACTIVATE` 阻止 overlay 鼠标点击激活；已加入 50ms cursor hit-test 轮询，根据前端上报的多矩形交互区域动态切换 `WS_EX_TRANSPARENT`；已加入显示器列表、目标显示器和 top offset 定位；已接入前台全屏窗口基础检测与自动隐藏 overlay；已加入当前 Claude Code 会话摘要扫描命令，仅统计事件类型、数量和时间戳；已加入本地 Usage/Cost 聚合与 last-known-good 聚合缓存、Claude Code statusLine/hook 状态桥、Settings 原生配置文件、HKCU Run 开机启动、托盘菜单、诊断目录打开、App data 诊断摘要和更新器状态预留
- 当前 UI：使用 mock 数据实现 compact / peek / expanded、Usage / Cost / Overview、Settings 独立窗口；expanded 面板已加入 Current Session 状态条，可用当前 Claude Code 会话 transcript 做真实测试模拟；Usage/Cost/Overview 已可被本地 Claude/Codex 日志聚合数据覆盖；Current Session 已优先读取 Claude Code statusLine/hook bridge，可在用户提交、工具调用、停止/等待等事件后约 1 秒内刷新；并补充 source/auth 标识、stale/error/threshold、低功耗、显示器选择、更新器占位和 diagnostics 展示；已接入 Playwright UI 冒烟截图验收
- 构建产物：`src-tauri\target\release\claude-island-win.exe`
- 安装包产物：`src-tauri\target\release\bundle\nsis\Claude Island Win_0.1.0_x64-setup.exe`、`src-tauri\target\release\bundle\msi\Claude Island Win_0.1.0_x64_en-US.msi`

## 开发命令

```powershell
npm install
npm run dev
npm run build
npm run check:version
npm run test:ui
npm run smoke
```

`npm run test:ui` 会通过 Node 脚本自启动 Vite 页面并生成 UI 冒烟截图，覆盖 compact、expanded Usage / Cost / Overview 与 Settings 路由。`npm run check:version` 会检查 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 三处版本一致。`npm run smoke` 会串联版本一致性、前端构建、Rust check、UI 截图、Tauri release build 和 release exe 8 秒存活冒烟。

Tauri 运行需要先安装 Rust 工具链和系统 WebView2：

```powershell
npm run tauri:dev
```

## Claude Code 实时状态桥

本工作区已在 `.claude/settings.json` 接入 Claude Code `statusLine` 与轻量 hooks，命令为 `node .claude/bridge/claude-status-bridge.mjs`。桥接脚本只写入脱敏状态摘要：活动状态、事件名、工具名、模型名、上下文百分比、成本/耗时等聚合字段；不会保存 prompt、transcript 正文、tool-result 正文或凭据。

HUD 读取 `%APPDATA%\Claude Island Win\claude-status.json` 与 `.claude/bridge/state/claude-status.json`，正常模式约 1 秒刷新一次状态桥，低功耗模式约 5 秒刷新一次。

## 发布验证

- 本地完整验证：`npm run smoke`
- Windows CI 发布草案：`.github/workflows/release.yml`，支持 `workflow_dispatch` 与 `v*` tag，构建 NSIS/MSI、生成 SHA256SUMS，并在 tag 发布时上传 GitHub Release 资源。
- 当前尚未配置代码签名证书、Tauri updater endpoint/signing key 或 SmartScreen reputation；正式发布前需要补齐这些外部资源。

## 关键文档

- `local\需求讨论\2026-06-08-win11-codex-island-full-replica-一期正式产品方案.md`
- `local\参考项目\codex-island\README.zh-CN.md`

## 隐私原则

默认本地优先：不做默认遥测、不做默认 crash report、不上传本地日志、不记录 access token / refresh token / raw transcript / prompt 内容。Usage/Cost cache 只保存聚合后的 token/cost 字段，不保存原始日志正文或凭据；Diagnostics 只展示路径存在性、版本和缓存/设置文件位置。
