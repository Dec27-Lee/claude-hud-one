# 设置页面 Tab 重组

## 原始需求

用户要求优化设置页面：

1. 设置页面配置项按 tab 划分为：通用、桌面HUD、终端HUD、Claude、关于。
2. 划分好 tab 后，根据不同配置项重新归类合并；终端HUD不需要动，主要优化其他几个 tab 中可合并的配置项。

## 范围

- 本轮做：调整 Settings 页 tab 数量与命名，合并外观/位置/更新等分散页面，并重新归类非终端 HUD 配置项。
- 本轮不做：重写 Terminal HUD Builder 内部交互；新增后端配置字段；改变设置持久化结构。
- 待确认：后续如需把“桌面HUD”拆成动态岛/浮窗两个子页，可在本轮基础上继续细分。

## 计划

1. 按工作区索引定位 Settings 页组件与样式。
2. 将 Settings 顶层 tab 收敛为通用、桌面HUD、终端HUD、Claude、关于。
3. 通用页保留应用级设置；桌面HUD页合并外观、位置、用量提醒/provider 与 Desktop HUD 配置；Claude 页保留 Bridge；关于页合并更新与诊断。
4. 保持 Terminal HUD 面板实现不变。
5. 运行构建验证并回写记录。

## 进展

- 已读取 `.claude/workspace-index.md` 与工作日志索引，确认 Settings 入口在 `src/components/settings/SettingsView.tsx`。
- 已用只读子代理复核配置项归类建议：顶层保留 5 个 tab；终端 HUD 内部保持不动；外观/位置/provider/提醒合并进桌面 HUD；更新与诊断合并进关于。
- 已修改 `src/components/settings/SettingsView.tsx`：顶层 tab 收敛为 `通用 / 桌面 HUD / 终端 HUD / Claude / 关于`。
- 已重新归类配置项：
  - 通用：语言、开机启动、低功耗、刷新频率。
  - 桌面 HUD：动态岛展示、位置/显示器/拖拽位置、全屏隐藏、用量提醒、provider 可见性、Token 口径、Desktop HUD 面板。
  - 终端 HUD：继续使用原 `TerminalHudPanel`，内部 Builder 不重组。
  - Claude：保留 Claude Code Bridge/statusLine/hooks 接管状态与操作。
  - 关于：合并原更新页与诊断页。
- 已修改 `src/styles.css`：顶层 tab grid 从 8 列改为 5 列，适配新 tab 数量。
- 已修改 `tests/ui.spec.ts`：更新 Settings smoke test 对 5 个新 tab 和“关于”中更新/诊断合并后的断言。
- 已运行 `npm run build`，TypeScript 与 Vite 构建通过。
- 初次 `npm run test:ui` 失败，原因为测试仍断言旧“更新”tab；已更新测试。
- 已再次运行 `npm run test:ui`，5 个 Playwright UI smoke 全部通过。
- 应用户要求重新打包并安装：先停止正在运行的 `claude-hud-one` 进程，再运行 `npm run tauri:build` 生成新版 NSIS 安装包。
- 已执行静默安装 `Claude HUD One_0.1.0_x64-setup.exe /S`，安装器退出码为 `0`。

## 检查

- 需求覆盖：已覆盖 5 个顶层 tab 划分，并完成非终端 HUD 配置项合并重组；终端 HUD 内部保持不动。
- 产物路径：`src/components/settings/SettingsView.tsx`；`src/styles.css`；`tests/ui.spec.ts`；工作记录 `records/2026-06-11-settings-tabs-reorganization.md`；索引 `.claude/skills/work-journal/resources/index.md`。
- 验证情况：`npm run build` 通过；`npm run test:ui` 通过（5 passed）；`npm run tauri:build` 通过；NSIS 静默安装退出码 `0`。
- 风险：用户习惯旧“外观/位置/更新”tab 后需要适应新归类；当前用分组标题在桌面 HUD 与关于页中保留原配置语义。
- 工作区索引：未新增长期入口，不需要更新 `.claude/workspace-index.md`。
- 结论：done。
