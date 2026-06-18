# 2026-06-10 全局 Bridge、安装清理与 Settings 稳定性

## 原始需求

- 用户希望本机所有 Claude Code 项目自动接入 Claude HUD One 状态采集，同时避免破坏 Claude HUD Plus 等既有 statusLine。
- 用户后续反馈安装、卸载和 Settings 页面存在问题：statusLine 未接管或兼容不清、卸载不清理、Settings 空白/字段崩溃/布局混乱/语言不切换。

## 范围

- 本轮做：全局 bridge 安装/修复策略、hooks-only/owner 模式调整、安装/卸载清理脚本、Settings 多页入口、显示器字段兼容、Settings UI 信息架构和 i18n、NSIS 打包钩子。
- 本轮不做：不读取 token/base url/权限等敏感配置；不删除 Claude HUD Plus 或其他插件配置；MSI WiX 自定义卸载清理后置。
- 约束：只输出脱敏配置状态；用户级 Claude settings 修改前备份。

## 计划

1. 识别 Claude Code `~/.claude/settings.json` 中 statusLine/hooks 的冲突边界。
2. 建立 AppData bridge 安装、hooks 安装、statusLine owner/restore/remove 维护命令。
3. 为 NSIS 增加安装前停止旧进程、安装后修复 bridge、卸载前清理脚本。
4. 修复生产环境 Settings 窗口加载与字段序列化问题。
5. 重设计 Settings 为固定宽度 tab 设置窗口，并接入语言切换。
6. 执行构建、UI smoke 和打包验证。

## 进展

- 全局接入：实现 AppData bridge 写入、用户级 hooks 安装、statusLine owner/compatibility 状态检测和 Settings 维护按钮。
- 兼容策略：曾从 owner 模式调整为 hooks-only，再按产品方向支持 Claude HUD One owner；保留恢复/移除自身配置的维护能力。
- 安装卸载：新增 `install-claude-hud-one-bridge.ps1`、`cleanup-claude-hud-one.ps1` 和 NSIS hooks；卸载时清理 Claude HUD One hooks/env/statusLine、AppData 和开机启动项，不删除 Claude HUD Plus 或其他敏感配置。
- Settings 稳定性：改为 `index.html` / `settings.html` 双 HTML 入口，使用 meta/window label 识别窗口；增加错误边界；修复 Rust snake_case 与前端 camelCase `workArea` 不一致导致的 `reading width` 崩溃。
- Settings 体验：参考 CC Switch 改为 960px 固定宽度、顶部 6 个 tab、内容纵向滚动且禁止横向滚动；接入中英文即时切换。

## 检查

- 需求覆盖：已覆盖全局 bridge 安装/兼容、安装卸载清理、Settings 白屏/崩溃/布局/语言问题。
- 产物路径：`src-tauri/src/window/claude_global.rs`、`src-tauri/resources/install-claude-hud-one-bridge.ps1`、`src-tauri/resources/cleanup-claude-hud-one.ps1`、`src-tauri/installer-hooks.nsh`、`src-tauri/tauri.conf.json`、`src/app/App.tsx`、`src/app/overlayBridge.ts`、`src/components/settings/SettingsView.tsx`、`src/styles.css`、`tests/ui.spec.ts`。
- 验证情况：多轮执行 `node --check`、PowerShell parser check、`npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml -j 1`、`npm run test:ui` 和 `npm run smoke`；多轮低资源 NSIS 打包成功。
- 风险：MSI 卸载清理未接入 WiX CustomAction，历史上曾临时收敛为 NSIS-only；真实安装/卸载仍需人工确认。
- 工作区索引：未新增长期资料入口；无需更新 `.claude/workspace-index.md`。
- 结论：阶段完成。
