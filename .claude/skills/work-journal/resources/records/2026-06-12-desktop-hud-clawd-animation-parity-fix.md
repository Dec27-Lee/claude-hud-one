# Desktop HUD Clawd 动画对标修正

## 需求人

Dec27-Lee <lipengyue31@163.com>

## 原始需求

用户反馈：“这样式看着不对啊，动画都不一样，没按照人家的动画直接抄过来吗”。这是对前面 Desktop HUD V2 的关键纠偏：此前实现只是 CodeIsland 风格功能骨架和静态近似，不是 PixelCharacterView / ClawdView 的动画 parity。

## 范围

- 本轮做：重新读取 `local/参考项目/CodeIsland` 的 `PixelCharacterView.swift`、`MascotView.swift`、`IslandSurface.swift`、`NotchPanelView.swift`、`NotchAnimation.swift` 相关动画；重写 Claude 小人 DOM/CSS，使 sleep/work/alert 三态接近 CodeIsland 的像素块动画；接入 hover 展开/收起延迟和 spring/blur-fade 面板动效。
- 本轮不做：直接移植 Swift Canvas 代码、读取 transcript 内容、真实权限回写、复杂多 provider mascot。
- 待确认：后续是否继续做更严格的逐帧截图对比和像素级宽高/间距 parity。

## 计划

1. 对比 CodeIsland 的 Clawd 三态动画：sleep sploot + z、work typing + 双臂敲键盘、alert startle + 衰减跳跃。
2. 重写 `src/components/desktopHud/ClawdMascot.tsx`，从圆角小猫结构改为三套像素块场景。
3. 重写 `src/styles.css` 中 `.clawd-*` 样式和 keyframes，按 CodeIsland 的主要周期和关键帧复刻。
4. 消费 hover/collapse delay，让 Desktop HUD 展开/收起接近 CodeIsland 的 0.5s hover 和 0.15s collapse。
5. 补充 panel spring/blur-fade 过渡。
6. 执行 build、UI smoke、tauri build。

## 进展

- 2026-06-12：已确认差距：旧实现是圆角 body + ears + 简单 breathe/work/shake CSS，并非 CodeIsland 的 Canvas 像素块动画。
- 2026-06-12：已读取 CodeIsland `PixelCharacterView.swift`：sleep 使用趴姿呼吸 + 3 个 stagger z；work 使用 0.35s bounce、0.15s 左臂、0.12s 右臂、键位闪烁和眼睛 scan/blink；alert 使用 3.5s startle → 多次衰减跳跃 → rest，并带 `!` 标记。
- 2026-06-12：已重写 `src/components/desktopHud/ClawdMascot.tsx`，按 sleep/work/alert 分场景渲染像素块 DOM。
- 2026-06-12：已重写 `src/styles.css` 中 Clawd mascot 样式和 keyframes，包含 sleep torso puff、z float、work bounce/typing arms/key flash、alert jump/squash/arms/bang/glow。
- 2026-06-12：已调整 Desktop HUD hover 行为，使用 `hoverDelayMs` / `collapseDelayMs`，从即时 hover 改为延迟展开/收起，接近 CodeIsland 防误触逻辑。
- 2026-06-12：已补充 panel open 的 spring-like transition 和 blur-fade 内容进入动画。
- 2026-06-12：验证通过：`npm run build`、`npm run test:ui`、`npm run tauri:build`。NSIS 安装包生成于 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。

## 检查

- 结论：已完成本轮动画 parity 修正。
- 需求覆盖：已承认并修正前一版“只是骨架，不是直接动画对标”的问题；Clawd 三态和面板展开/收起动画已按 CodeIsland 关键节奏重写。
- 产物路径：`src/components/desktopHud/ClawdMascot.tsx`；`src/components/desktopHud/DesktopHudRoot.tsx`；`src/styles.css`。
- 验证情况：`npm run build` 通过；`npm run test:ui` 通过（6 passed）；`npm run tauri:build` 通过并生成安装包。
- 索引维护：`.claude/skills/work-journal/resources/index.md` 已登记本记录；未新增长期资料入口，`.claude/workspace-index.md` 无需额外更新。
- 风险：当前是 React/CSS 复刻 CodeIsland Swift Canvas 动画的关键帧和节奏，不是逐像素截图回归；若要继续逼近“完全一样”，下一步应做截图对比和尺寸/间距/曲线微调。