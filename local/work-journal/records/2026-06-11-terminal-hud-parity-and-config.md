# 2026-06-11 Terminal HUD parity、上下文窗口配置与默认配置

## 原始需求

- 用户多轮实机复核 Claude HUD One 内置 Terminal HUD 与旧 Claude HUD Plus 的差异，指出 token 总数、activityLine、颜色联动、Settings Builder、sessionTime、Todo/工具统计、当前自定义配置和默认配置等问题。
- 用户还要求在 model 组件中配置 `CLAUDE_HUD_CONTEXT_WINDOW_SIZE`，并最终要求安装后的初始化默认配置使用其提供的 `terminalHud` JSON。

## 范围

- 本轮做：按旧 Claude HUD Plus 只读参考，持续修正 Terminal renderer、bridge 状态聚合、Settings preview/Builder、颜色/区间/inspector、activityLine、sessionTokens、sessionTime、git stats、Todo/Task 安全计数、context window settings 同步和默认配置。
- 本轮不做：不运行旧 Claude HUD Plus；不读取 prompt/tool result/transcript 正文或凭据；不展示 Todo/Agent 描述正文，除非用户后续明确放宽隐私边界。
- 约束：Claude settings 写入只处理顶层 `env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE`，不输出敏感配置。

## 计划

1. 对照旧 Claude HUD Plus rows、renderer、activityLine 和 Settings Builder 行为。
2. 修正 session token 与 context token 口径，恢复默认四行结构。
3. 补齐 Settings Builder 的实时 preview、palette/canvas/inspector、颜色 workbench 与 bands。
4. 根据用户自定义配置修复 labelValue、sessionTime、git `+/-` 颜色和 Todo/Task 安全计数。
5. 增加 `CLAUDE_HUD_CONTEXT_WINDOW_SIZE` 输入、即时同步、保存链路兜底和 bridge 兜底同步。
6. 将用户给定 `terminalHud` JSON 写入 TS/Rust/bridge/packaged bridge 默认配置。
7. 执行 bridge 样例、构建、UI、Rust test 和完整 smoke。

## 进展

- Parity 修复：恢复 HUD Plus 默认四行 `model/contextBar/contextValue`、`project/addedDirs/git`、`sessionTokens`、`activity`；sessionTokens 改为 transcript assistant usage 四元组累计，不再误用当前 context。
- ActivityLine：排除 `Task/Agent/TodoWrite/TodoRead/TaskCreate/TaskUpdate` 作为普通工具；按 running/error/completed 输出 details/summary；Todo/Task 仅聚合安全 status 计数。
- Settings Builder：重构为实时预览 + 组件 palette + rows canvas + inspector + color workbench；支持 contextBands/usageBands、ANSI named/256 色 picker fallback、labelTitle/labelValue、git stats 分段颜色。
- 自定义配置差异：修复 `labelValue`、独立 `sessionTime`、`git:(main* +N -N)` 中 `+/-` 颜色、activity 中 Todo/Agents/Tools/sessionTime 展示。
- Context window：新增 model 组件 `CLAUDE_HUD_CONTEXT_WINDOW_SIZE` 输入；经历按钮同步、输入即同步、同步失败提示、保存链路兜底、bridge 读取 AppData managed override 并反向同步 Claude settings；最终本机脱敏复核从 `270000` 同步到用户输入值 `250000`。
- 默认配置：TS 默认配置、Rust AppSettings 默认配置、项目 bridge 和 packaged bridge 默认配置均对齐用户提供的 `terminalHud` JSON；已有用户配置不会自动覆盖。

## 检查

- 需求覆盖：已覆盖用户多轮 Terminal HUD parity 反馈、当前自定义配置差异、context window 配置同步和安装初始化默认配置。
- 产物路径：`.claude/bridge/claude-status-bridge.mjs`、`src-tauri/resources/claude-status-bridge.mjs`、`src/hud/config.ts`、`src/hud/types.ts`、`src/hud/normalize.ts`、`src/hud/fieldSchema.ts`、`src/hud/parityMatrix.ts`、`src/hud/terminalRenderer.ts`、`src/providers/claudeCodeSummary.ts`、`src/providers/mockData.ts`、`src/components/settings/TerminalHudPanel.tsx`、`src/components/settings/SettingsView.tsx`、`src-tauri/src/lib.rs`、`src-tauri/src/window/claude_global.rs`、`src-tauri/src/window/settings.rs`、`src-tauri/resources/install-claude-hud-one-bridge.ps1`、`tests/ui.spec.ts`。
- 验证情况：多轮通过 `node --check`、手工 bridge stdin 样例、`npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml -j 1`、`cargo test --manifest-path src-tauri\Cargo.toml -j 1 claude_global`、`npm run test:ui` 和完整 `npm run smoke`；最终默认配置调整安装包 SHA256 为 `8E8A3CC3388AE7FE9D4537B6BA360AC228D6F05F1EA20AAACAA1DE6784EA7232`。
- 风险：完整 Todo/Agent 描述 parity 受隐私边界限制；Settings Builder 的完全像素级 HUD Plus parity 仍可继续打磨；已有 AppData 用户配置不会自动覆盖为新默认。
- 工作区索引：未新增长期资料入口；无需更新 `.claude/workspace-index.md`。
- 结论：阶段完成。
