# 2026-06-11 扩展屏透明遮罩吞点击根因级修复

## 原始需求

- 用户反馈 Win11 扩展屏透明遮罩/部分区域吞点击问题在前一轮 DPI/hit region 修复后仍存在。
- 新现象：问题发生后，只要点击一下悬浮窗，底层界面又能正常操作。
- 用户要求结合本机情况深度定位根因，直接执行最合理方案，而不是继续表层补丁。
- 后续用户反馈：透明遮罩方案升级后，鼠标挪到悬浮窗会明显抖动；修复后用户确认抖动问题已解决。

## 范围

- 本轮做：重构 overlay 原生窗口覆盖策略，消除大透明 WebView 遮罩的系统层命中条件；修复 hover 抖动。
- 本轮不做：不改 HUD 视觉风格；不拆分 island/panel 多窗口；不新增长期资料入口。
- 待确认：用户安装最新包后继续验证扩展屏真实点击场景。

## 计划

1. 复盘上一轮 DPI/hit region 修复为何仍会复发。
2. 只读审查 Win32 overlay 状态机、前端 hit region/hover/drag 时序和成熟 Windows 悬浮窗方案。
3. 将主 overlay 从固定大透明窗口改为内容包围盒驱动的原生窗口尺寸。
4. 增加 Win32 原生 Window Region，避免透明 padding 属于 HUD 窗口命中区域。
5. 修复 hover 触发 compact/peek 过渡时的窗口 resize/move 抖动。
6. 执行构建、UI、完整 smoke 和本机 Win32 探针验证。

## 进展

- 根因判断：此前 `900x520` 透明 Tauri/WebView2 主窗口长期覆盖桌面，实际 HUD 只有 compact/peek/expanded 内容区域；一旦 `WS_EX_TRANSPARENT`、`WM_NCHITTEST`、DOMRect 上报或 CSS transition 时序不同步，透明区域就可能吞底层点击。点击悬浮窗后恢复，是因为前端状态、hit regions 和原生样式重新收敛。
- 主要实现：
  - `src-tauri/tauri.conf.json`：主窗口初始宽度改为 `644x90`，compact/peek 使用固定原生槽位。
  - `src/components/island/IslandRoot.tsx`：新增 `shellRef`，上报 HUD 内容包围盒和真实交互 regions。
  - `src/app/overlayBridge.ts`：新增 `updateOverlayLayout`，用 latest-wins 队列串行化 layout 更新。
  - `src-tauri/src/lib.rs`：新增 `update_overlay_layout` 命令；清空 regions 时同步清掉 HWND region。
  - `src-tauri/src/window/display.rs`：新增 `fit_overlay_to_content`，按 slot 宽度计算宿主窗口尺寸，并转换 hit regions；compact/peek 固定为 `596 + 24*2 = 644px`，expanded 使用 `808 + 24*2`。
  - `src-tauri/src/window/overlay.rs`：新增 no-activate rect 更新与 `SetWindowRgn` 原生窗口区域；`SetWindowSubclass` 失败时 fail-open；click-through 命令同步 tracker 状态。
  - `src-tauri/Cargo.toml`：增加 `Win32_Graphics_Gdi` feature。
- hover 抖动修复：不再让原生窗口跟随 compact→peek 的 220ms CSS width transition 逐帧移动/缩放；hover 只改变内部 HUD、Window Region 和 hit regions。
- 最新安装包：`src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`，SHA256 `AC5AF9C96E7CD6217D0A3B270DF7E681C1EB4B7A57C0BFDD3E1725DB2BAEBC76`。

## 检查

- 需求覆盖：已覆盖透明遮罩吞点击复发的根因级修复，并覆盖 hover 抖动补修；用户已确认抖动问题解决。
- 产物路径：`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、`src-tauri/src/lib.rs`、`src-tauri/src/window/display.rs`、`src-tauri/src/window/overlay.rs`、`src/app/overlayBridge.ts`、`src/components/island/IslandRoot.tsx`。
- 验证情况：`npm run build` 通过；`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 通过；`npm run test:ui` 通过（5 passed）；完整 `npm run smoke` 通过，含 version check、frontend build、Rust check、usage_cost tests（5 passed）、UI smoke（5 passed）、Tauri release build、NSIS 打包和 release exe 8 秒存活。
- 本机探针：Win32 窗口矩形曾验证主 HUD 不再是 `900x520` 大透明遮罩；Window Region 探针验证外圈 padding 不在 HWND region 内、内容中心在 region 内。
- 风险：自动化无法完全模拟用户扩展屏 + 目标软件真实点击链路；若仍复现，下一步应拆分 `island` 与 `panel` 为两个真实小窗口，不再回到 DPI 小修。
- 工作区索引：未新增长期资料入口，不需要更新 `.claude/workspace-index.md`。
- 历史记录读取：按工作日志索引命中历史总记录后续接；本次已拆出独立 record，后续同类需求优先更新本文件。
- 结论：已完成。
