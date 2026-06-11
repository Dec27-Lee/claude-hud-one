# 启动后自动打开设置页

## 原始需求

用户要求：点击应用后，除了启动悬浮窗，还需要直接打开设置页面。

## 范围

- 本轮做：修改桌面应用启动流程，让主悬浮窗启动后同时显示设置窗口。
- 本轮不做：新增偏好开关、安装包重构、托盘菜单交互改版。
- 待确认：如果后续只希望首次启动打开设置页，需要再增加持久化标记。

## 计划

1. 按工作区索引定位前端/Tauri 入口与设置窗口实现。
2. 找到启动时窗口初始化逻辑。
3. 在 Tauri setup 阶段显示并聚焦 settings 窗口。
4. 运行可用构建/类型检查验证。
5. 回写记录与索引并给出完成检查。

## 进展

- 已确认设置窗口在 `src-tauri/tauri.conf.json` 中默认 `visible: false`，现有打开设置页命令和托盘菜单均通过 `show + set_focus` 实现。
- 已修改 `src-tauri/src/lib.rs`：应用 setup 阶段注册设置窗口关闭隐藏逻辑后，立即 `show()` 并 `set_focus()` 设置窗口。
- 已运行 `npm run build`，TypeScript 与 Vite 生产构建通过。
- 已运行 `cargo check --manifest-path src-tauri/Cargo.toml`，Rust/Tauri crate 检查通过。
- 应用户要求重新打包，已运行 `npm run tauri:build`，release 可执行文件与 NSIS 安装包生成成功：
  - `src-tauri/target/release/claude-hud-one.exe`
  - `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`
- 用户反馈：应用已运行时再次点击应用图标/任务栏固定图标无法打开设置页，只有右键托盘菜单 Settings 可打开。
- 已定位原因：`main.rs` 单实例保护发现已有进程后直接 `return`，不会通知已有进程打开 Settings；托盘左键点击也只执行 `show_main_window`，不会打开 Settings。
- 已修改：
  - `src-tauri/src/main.rs`：第二次启动检测到已有实例时，发送 `Local\\ClaudeHUDOne.OpenSettings` 事件，并用 Settings 窗口标题做直接唤起兜底。
  - `src-tauri/src/window/single_instance.rs`：新增已有实例事件监听，收到二次启动信号后在主线程显示悬浮窗并打开设置页。
  - `src-tauri/src/window/tray.rs`：托盘图标左键/双击改为同时显示悬浮窗与设置页。
  - `src-tauri/src/window/mod.rs`、`src-tauri/src/lib.rs`：注册单实例信号模块与监听器。
- 已再次运行 `cargo check --manifest-path src-tauri/Cargo.toml`，Rust 检查通过。
- 已再次运行 `npm run tauri:build`，新安装包生成成功：`src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`

## 检查

- 需求覆盖：已覆盖“点击应用后，除了启动悬浮窗，还需要直接打开设置页面”。
- 产物路径：`src-tauri/src/lib.rs`；`src-tauri/src/main.rs`；`src-tauri/src/window/mod.rs`；`src-tauri/src/window/tray.rs`；`src-tauri/src/window/single_instance.rs`；工作记录 `records/2026-06-11-open-settings-on-launch.md`；索引 `.claude/skills/work-journal/resources/index.md`；安装包 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。
- 验证情况：`npm run build` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；`npm run tauri:build` 通过并生成 NSIS 安装包。
- 风险：当前行为是每次应用进程启动、应用已运行时再次点击应用图标、托盘图标左键/双击都会打开设置页；如需仅首次启动打开，需要再加持久化开关。
- 工作区索引：未新增长期入口，不需要更新 `.claude/workspace-index.md`。
- 结论：done。
