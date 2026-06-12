# CodeIsland 风格 Desktop HUD V2 第一阶段实现

## 需求人

Dec27-Lee <lipengyue31@163.com>

## 原始需求

用户要求按照 `local/需求讨论/2026-06-12-claude-hud-one-全面对标-codeisland-桌面hud改造方案.md` 和前面梳理的对标路径，开始执行桌面 HUD 部分修改：Claude HUD One 的 Desktop HUD 要对标 `local/参考项目/CodeIsland`，在 Windows 上用悬浮窗实现类似 Mac 刘海屏的展示效果；暂时只做 Claude Code；现有 Terminal HUD 继续保留。

## 范围

- 本轮做：优先落地 Phase 1 Desktop HUD V2 视觉骨架，包括 CodeIsland 风格顶部 capsule、Clawd 像素小人三态、多 Claude Code 会话卡片、hover 展开/收起、接入现有 sessions 数据，并保持现有 Windows overlay/click-through 能力。
- 本轮不做：真实 HookServer / blocking approval/question 回写、Windows Terminal tab/pane 精确跳转、多 provider 支持、删除或重写 Terminal HUD。
- 待确认：后续是否继续进入 Phase 2 配置迁移、Phase 3 approval/question UI 队列、Phase 4 blocking response。

## 计划

1. 并行只读梳理当前 Desktop HUD 渲染链路、配置边界和 Phase 1 实施计划。
2. 新增 `src/components/desktopHud/` 组件骨架，实现 `DesktopHudRoot`、`DesktopHudCapsule`、`ClawdMascot`、`SessionListSurface`、`SessionCard` 等第一阶段组件。
3. 接入现有 `useIslandStore` sessions/current status 数据，做 Claude-only 会话排序和状态映射。
4. 替换或包裹当前 `IslandRoot` 渲染入口，保留 overlay hit region/click-through 行为。
5. 保持 Terminal HUD 相关配置、渲染和 statusLine 输出不变。
6. 执行 `npm run build` / UI smoke（如适用）/ `npm run tauri:build`，确保修改后重新生成安装包。
7. 回写工作记录、索引和完成检查。

## 进展

- 2026-06-12：已创建本记录，并核对当前 Git 生效身份为 `Dec27-Lee <lipengyue31@163.com>`。
- 2026-06-12：已并行启动 3 个只读子代理，分别分析 Desktop HUD 当前渲染链路、Settings/Terminal HUD 边界和 Phase 1 实施计划。
- 2026-06-12：本轮未直接使用 Workflow；原因是当前工具约束要求 Workflow 需用户显式 opt-in，本轮改用多个子代理并行 + 主会话执行，后续如用户明确要求 workflow 可升级。
- 2026-06-12：已新增 `src/components/desktopHud/` 组件族：`DesktopHudRoot.tsx`、`DesktopHudCapsule.tsx`、`ClawdMascot.tsx`、`SessionCard.tsx`、`sessionFormatters.ts`。
- 2026-06-12：已把主窗口入口从 `IslandRoot` 切换到 `DesktopHudRoot`，继续复用现有 sessions/store/settings/overlay 数据链路。
- 2026-06-12：已实现 CodeIsland 风格第一阶段视觉骨架：顶部 Claude(N) capsule、Clawd 三态像素小人、会话卡片列表、hover peek/expanded、Claude-only provider 展示、usage/cost/overview 辅助面板兼容。
- 2026-06-12：已保持 overlay hit region、长按拖动、Desktop HUD 关闭后清空 hit regions 等现有行为；Terminal HUD 代码和设置页未改动。
- 2026-06-12：首次 `npm run test:ui` 有 1 个旧断言失败，原因是新 SessionCard 中 `git main*` 出现两次触发 Playwright strict mode；已移除重复 git chip 后复测通过。
- 2026-06-12：验证通过：`npm run build`、`npm run test:ui`、`npm run tauri:build`。NSIS 安装包生成于 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。

## 检查

- 结论：已完成第一阶段 Phase 1。
- 需求覆盖：已按报告路径开始执行桌面 HUD 修改，完成 CodeIsland 风格 Desktop HUD V2 视觉骨架；只做 Claude Code；Terminal HUD 保留且未改动；真实 blocking approval/question、Terminal jump 精确跳转按计划留到后续阶段。
- 产物路径：`src/components/desktopHud/`；`src/app/App.tsx`；`src/styles.css`；工作记录 `\.claude/skills/work-journal/resources/records/2026-06-12-codeisland-desktop-hud-v2-implementation.md`。
- 验证情况：`npm run build` 通过；`npm run test:ui` 通过（6 passed）；`npm run tauri:build` 通过并生成 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。
- 索引维护：`.claude/skills/work-journal/resources/index.md` 已新增本记录；本轮新增的是代码组件目录，不是长期资料入口，`.claude/workspace-index.md` 无需因 `src/components/desktopHud/` 单独更新。
- 风险：Phase 1 只是视觉和展示骨架，approval/question 目前仍未接真实 blocking response；Terminal jump 按钮目前是视觉占位，后续需实现 Windows TerminalActivator；需要继续做 Phase 2 配置迁移和设置页。