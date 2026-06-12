# Desktop HUD Completion Card 与 Smart Suppress

## 需求人

Dec27-Lee <lipengyue31@163.com>

## 原始需求

用户要求“继续”。在已完成 CodeIsland 风格 Desktop HUD V2、配置迁移、approval/question 安全队列、Terminal Jump 安全版，以及 Phase 4 安全交互地基后，继续对标 CodeIsland 的完成态卡片与智能收起体验。

## 范围

- 本轮做：新增完成态 completion card；检测 Claude Code session 从 running/waiting 进入 active/idle 的完成转场；消费 `autoExpandOnCompletion` 自动 peek；消费 `smartSuppress` 隐藏非关注 idle session；保留 Terminal HUD。
- 本轮不做：真实任务结果摘要生成、读取 transcript 内容、保存 prompt/tool input/tool result、复杂通知中心。
- 待确认：后续是否按 CodeIsland 做更精细的完成动画、音效、通知与长期历史列表。

## 计划

1. 新增 Desktop HUD completion card 组件，展示完成会话、项目名、完成时间和 Open terminal。
2. 在 DesktopHudRoot 中跟踪 session activity 转场，生成短 TTL completion item。
3. 接入 `autoExpandOnCompletion`，有新完成项时从 compact 自动 peek。
4. 接入 `smartSuppress`，peek 视图优先显示 running/waiting/error/recent completion，避免 idle session 挤占注意力。
5. 补充样式并执行 build、UI smoke、tauri build。
6. 回写工作记录和索引。

## 进展

- 2026-06-12：已创建本记录；当前 Git 身份为 `Dec27-Lee <lipengyue31@163.com>`。
- 2026-06-12：已新增 `src/components/desktopHud/CompletionCard.tsx`，展示完成态 badge、项目名、完成时间、Open terminal 和 Dismiss。
- 2026-06-12：已在 `src/components/desktopHud/DesktopHudRoot.tsx` 跟踪 session activity 转场：当 session 从 running/waiting 进入 active/idle 时，生成 90 秒 TTL 的 completion card。
- 2026-06-12：已消费 `autoExpandOnCompletion`，有 recent completion 时可从 compact 自动 peek。
- 2026-06-12：已消费 `smartSuppress`，peek 视图优先显示 running/waiting/error/recent completion，并保留 fallback，避免所有 session 被隐藏。
- 2026-06-12：已在 `src/styles.css` 补充 completion card 视觉样式，保持 CodeIsland 风格的完成态绿色卡片。
- 2026-06-12：验证通过：`npm run build`、`npm run test:ui`、`npm run tauri:build`。NSIS 安装包生成于 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。

## 检查

- 结论：已完成 Phase 6 Completion Card 与 Smart Suppress。
- 需求覆盖：已实现完成态卡片、完成后自动 peek、智能隐藏非关注 idle session；Terminal HUD 保持不变。
- 产物路径：`src/components/desktopHud/CompletionCard.tsx`；`src/components/desktopHud/DesktopHudRoot.tsx`；`src/styles.css`。
- 验证情况：`npm run build` 通过；`npm run test:ui` 通过（6 passed）；`npm run tauri:build` 通过并生成安装包。
- 索引维护：`.claude/skills/work-journal/resources/index.md` 已登记本记录；本轮新增长期入口为代码组件，入口仍由 `src/app/App.tsx` / `src/components/desktopHud/` 归属现有工作区索引，无需额外更新 `.claude/workspace-index.md`。
- 风险：completion card 只基于脱敏 session metadata 和 activity 转场，不读取 transcript、prompt、tool input 或 tool result；后续如做任务摘要，需要继续保持脱敏边界。