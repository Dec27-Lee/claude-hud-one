# CodeIsland Desktop HUD V2 配置迁移与设置页

## 需求人

Dec27-Lee <lipengyue31@163.com>

## 原始需求

用户在完成 CodeIsland 风格 Desktop HUD V2 第一阶段视觉骨架后要求“一直继续，不用停”。按既定全面对标 CodeIsland 路线，继续推进下一阶段：Desktop HUD V2 配置迁移和设置页能力，使 Phase 1 的视觉骨架变成可配置、可迁移、与 Terminal HUD 明确隔离的产品功能。

## 范围

- 本轮做：实现 DesktopHudConfig V2 version/zones/itemOptions 基础结构；兼容旧 V1 `panelItems`/`tickerItems`；重写/增强 Desktop HUD 设置页以控制 compact/peek/panel/ticker zones、hover/collapse/auto-expand 等配置；让 DesktopHudRoot 优先消费 V2 zones；保持 Terminal HUD 配置完全不动。
- 本轮不做：真实 approval/question blocking response、HookServer、Terminal Jump 原生命令、多 provider 支持、删除旧 IslandRoot。
- 待确认：后续继续进入 approval/question UI 队列和 Windows Terminal Jump。

## 计划

1. 在 `src/hud/config.ts` 增加 DesktopHudConfig V2 类型、默认值、normalize/migrate/merge。
2. 更新 `src-tauri/src/window/settings.rs` 的 `default_desktop_hud()`，保持 Rust 默认 JSON 与 TS 默认配置一致。
3. 更新 `src/components/settings/DesktopHudPanel.tsx`，从 Phase 0 可见项开关升级为 V2 基础设置页。
4. 更新 `src/components/desktopHud/DesktopHudRoot.tsx`，优先消费 normalized `zones.panel` / `zones.ticker`，兼容旧字段。
5. 保持 Terminal HUD 相关类型、默认值、设置页和 renderer 不改。
6. 执行 `npm run build`、`npm run test:ui`、`npm run tauri:build` 并回写结果。

## 进展

- 2026-06-12：已创建本记录；本轮继续沿用前一阶段已核对的 Git 身份 `Dec27-Lee <lipengyue31@163.com>`。
- 2026-06-12：已在 `src/hud/config.ts` 增加 Desktop HUD V2 配置结构：`version: 2`、`zones`、`itemOptions`、hover/collapse、max sessions、mascot/motion、auto expand、smart suppress、terminal jump behavior，并保留 V1 `panelItems`/`tickerItems` 兼容字段。
- 2026-06-12：已实现 `normalizeDesktopHudConfig()` 和 V1 -> V2 兼容合并，旧 localStorage/native settings 缺少 `version/zones` 时会补默认值。
- 2026-06-12：已更新 `src-tauri/src/window/settings.rs` 的 `default_desktop_hud()`，让 Rust 默认 settings JSON 与 TS V2 默认配置一致。
- 2026-06-12：已重写 `src/components/settings/DesktopHudPanel.tsx`，新增 V2 设置控制：预设、默认页、密度、hover/collapse 延迟、最多会话数、自动展开、完成提醒、智能抑制、Clawd 速度、动效强度、终端跳转策略、可见项和 zones 勾选。
- 2026-06-12：已更新 `src/components/desktopHud/DesktopHudRoot.tsx`，优先消费 `desktopHud.zones.panel` / `desktopHud.zones.ticker` 和 `maxVisibleSessions`，并让 `autoExpandOnWaiting` 控制运行/等待自动 peek。
- 2026-06-12：首次 `npm run test:ui` 失败 1 项，原因是旧 UI smoke 仍检查 `Desktop HUD parity matrix` 文案；已保留兼容文案后复测通过。
- 2026-06-12：验证通过：`npm run build`、`npm run test:ui`、`npm run tauri:build`。NSIS 安装包生成于 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。

## 检查

- 结论：已完成 Phase 2。
- 需求覆盖：已继续推进 Desktop HUD V2 配置迁移与设置页；实现 V2 schema、旧配置兼容、Settings 控制和 DesktopHudRoot 消费新 zones；Terminal HUD 配置和设置页未改动。
- 产物路径：`src/hud/config.ts`；`src-tauri/src/window/settings.rs`；`src/components/settings/DesktopHudPanel.tsx`；`src/components/desktopHud/DesktopHudRoot.tsx`；`src/styles.css`。
- 验证情况：`npm run build` 通过；`npm run test:ui` 通过（6 passed）；`npm run tauri:build` 通过并生成 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。
- 索引维护：`.claude/skills/work-journal/resources/index.md` 已登记本记录；本轮未新增长期资料入口，`.claude/workspace-index.md` 无需更新。
- 风险：Phase 2 仍未实现 approval/question 队列和真实 blocking response；Terminal jump 仍只有配置与视觉占位，后续进入 Phase 3/5。
