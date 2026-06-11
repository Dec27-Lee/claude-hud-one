# 2026-06-10 Terminal HUD Plus 内置集成与 Settings Studio

## 原始需求

- 用户希望把本机 `E:\Develop_E\claude-hud-plus` 的终端 HUD 能力内置到 Claude HUD One，解决两个独立 statusLine 产品同时安装的兼容复杂度。
- 用户要求：HUD Plus 支持的展示信息和配置颗粒度都应在新项目中支持；Settings 中需要独立 Terminal HUD 配置页；不考虑历史迁移，配置冲突直接覆盖；桌面 HUD 字段也应可配置。

## 范围

- 本轮做：分析并规划内置方案，建立 Normalized HUD State、Terminal/Desktop config、display item registry、field schema、parity matrix、Terminal renderer、Settings Studio 基础能力和 Desktop item-driven 展示。
- 本轮不做：不在运行时调用旧 Claude HUD Plus；不读取 prompt、tool input、tool result、transcript 正文或凭据；不追求第一阶段逐字符 1:1。
- 约束：statusLine 热路径不能依赖桌面 GUI；桌面端只消费脱敏 allowlist 字段。

## 计划

1. 只读研究 Claude HUD Plus 展示项、配置项、renderer 和 UI 配置控制台。
2. 将产品方向确定为 `Claude HUD One`：Terminal & Desktop HUD Suite for Windows。
3. 落地 Phase 0 类型基座、默认配置、持久化、registry、field schema 和 Settings 入口。
4. 接入内置 Terminal renderer 与 Settings preview。
5. 增强 rows builder、JSON validate、preset、diagnostics、color workbench、overflow/separator 和基础 parity item。
6. 让 Desktop ticker/panel 消费 display item registry。
7. 执行轻量验证和阶段 smoke/打包。

## 进展

- 分析文档：已写入并修订 `local/需求讨论/2026-06-10-claude-hud-one-内置claude-hud-plus终端hud集成分析.md`，最终推荐产品名 `Claude HUD One`。
- Phase 0：新增 `src/hud/types.ts`、`config.ts`、`displayItemRegistry.ts`、`fieldSchema.ts`、`parityMatrix.ts`、`normalize.ts` 等基座；Settings 增加 Terminal HUD 与 Desktop HUD tab。
- Terminal renderer：bridge 与前端 preview 接入内置 renderer，支持 model/context/project/tools/activity/sessionTokens/usage/cost/duration/outputStyle/version/effort/customLine 等基础项。
- Settings Studio：新增 rows builder、JSON editor/validate/apply/reset、preset 应用、诊断摘要、Color Workbench、bar 字符、row overflow/maxWidth/separator、context/usage 显示选项。
- Parity 基础项：补齐 addedDirs、git、promptCache、agents、todos、sessionTime、speed、memory、environment 等安全投影字段。
- Desktop HUD：compact/peek ticker 与 expanded session metrics 改为按 `desktopHud.tickerItems` / `panelItems` 渲染，支持 project/activity/model/tools/context/sessionTokens/cost/git/addedDirs/agents/todos/speed。

## 检查

- 需求覆盖：已完成 Terminal HUD 内置基座、Settings Studio 基础能力、Desktop item-driven 展示和主要安全 parity 字段；严格逐字符 HUD Plus parity 仍在后续修复记录中继续。
- 产物路径：`local/需求讨论/2026-06-10-claude-hud-one-内置claude-hud-plus终端hud集成分析.md`、`.claude/bridge/claude-status-bridge.mjs`、`src/hud/*`、`src/components/settings/TerminalHudPanel.tsx`、`src/components/settings/DesktopHudPanel.tsx`、`src/components/settings/HudParityMatrixView.tsx`、`src/components/island/IslandRoot.tsx`、`src/components/island/CurrentSessionStrip.tsx`、`src-tauri/src/window/settings.rs`、`tests/ui.spec.ts`。
- 验证情况：阶段内多次通过 `node --check`、`npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml -j 1`、`npm run test:ui`、`npm run test:rust`；阶段 smoke 与 NSIS 打包见后续 parity/default config 记录。
- 风险：HUD Plus 的 OSC8 hyperlink、复杂 grapheme/CJK 宽度、完整 transcript 元信息、Settings 完整自动表单和排序器仍需后续补齐；隐私边界不能突破。
- 工作区索引：分析文档已作为长期资料入口写入 `.claude/workspace-index.md`。
- 结论：阶段完成；后续 Terminal HUD 细节 parity 拆入独立记录。
