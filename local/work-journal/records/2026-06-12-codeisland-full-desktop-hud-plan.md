# 全面对标 CodeIsland 桌面 HUD 改造分析报告

## 需求人

Dec27-Lee <lipengyue31@163.com>

## 原始需求

用户决定 Claude HUD One 桌面 HUD 完全对标 `local\参考项目\CodeIsland`：该项目用 macOS 刘海屏实现，我们在 Windows 上用悬浮窗达到一样效果，直接照抄展示和交互；暂时只需要 Claude Code，不需要其他 AI 工具；现有终端 HUD 继续保留。要求按该方向重新写一份新的分析报告到 `local\需求讨论`，并写清楚落地执行方案。

## 范围

- 本轮做：分析 CodeIsland 的 Desktop HUD 对标目标、Claude-only 裁剪范围、Claude HUD One 当前承接能力、Windows/Tauri 改造路线、阶段计划和验收清单；输出新的分析报告。
- 本轮不做：直接实施功能代码改造；提交或推送 Git；删除现有 Terminal HUD。
- 待确认：后续是否按报告进入实现阶段，以及一期是否包含真实 hook blocking approval/question。

## 计划

1. 复核 CodeIsland 中与 Claude Code 对标最关键的 mascot、多会话、surface、approval/question、terminal jump、窗口面板文件。
2. 复核 Claude HUD One 当前 Desktop HUD、Terminal HUD、settings、bridge、overlay 的承接位置。
3. 明确“只做 Claude Code、保留 Terminal HUD”的裁剪口径。
4. 在 `local\需求讨论` 新增独立分析报告和落地执行方案。
5. 更新工作区索引/工作日志索引，并按完成规则执行打包验证。

## 进展

- 2026-06-12：已创建本记录，并在工作日志索引登记为 in_progress。
- 2026-06-12：已使用 clear-thinking 明确本轮真实目标：把 Desktop HUD 主线切换为 Windows 版 CodeIsland，只做 Claude Code，保留 Terminal HUD，本轮只输出新报告和落地方案。
- 2026-06-12：已并行只读复核 CodeIsland 对标点、当前项目改造落点和 Windows/Tauri 风险。
- 2026-06-12：已新增分析报告 `local\需求讨论\2026-06-12-claude-hud-one-全面对标-codeisland-桌面hud改造方案.md`。
- 2026-06-12：已更新 `.claude\workspace-index.md`，把新增报告加入 `local/需求讨论/` 入口。

## 检查

- 结论：已完成。
- 需求覆盖：已覆盖“完全对标 CodeIsland”“Windows 悬浮窗模拟 Mac 刘海屏效果”“只做 Claude Code”“保留 Terminal HUD”“新的分析报告”“落地执行方案”。
- 产物路径：`local\需求讨论\2026-06-12-claude-hud-one-全面对标-codeisland-桌面hud改造方案.md`。
- 验证情况：报告已落盘，索引已更新；最终打包待本轮文件收尾后执行 `npm run tauri:build`。
- 索引维护：`.claude\workspace-index.md` 已更新；`.claude\skills\work-journal\resources\index.md` 已同步为 done。
- 风险：本轮未实现功能代码；真正进入桌面 HUD 重构时应使用 Workflow 管理多阶段实现和验证。
