# Claude HUD One 可持续技术栈与架构改造建议

- 需求人：Dec27-Lee <lipengyue31@163.com>
- 原始需求：结合前面对 Claude Code 终端/桌面/移动端架构的分析，为 Claude HUD One 在不考虑重构成本的情况下确定后续可持续发展的技术框架；项目当前涉及 Windows、终端、Android 移动端，后续可能扩展到 macOS、iOS；在 `local/需求讨论/` 下写一份重点结论型分析报告。
- 范围：
  - 本轮做：基于现有 Claude HUD One 形态与前序 Claude Code 架构研究，给出推荐技术栈、架构分层、现有项目改造方向和不建议路线。
  - 本轮不做：立即重构代码、调整现有实现、输出完整实施排期或详细任务拆分。
  - 待确认：后续是否按报告进入实际重构/迁移阶段。
- 计划：
  1. 提炼当前项目的长期约束：Windows/终端/Android、未来 macOS/iOS、本地系统能力、移动远程控制。
  2. 明确技术选型结论：共享核心与协议优先，UI 不强行一套代码覆盖所有端。
  3. 输出重点型报告到 `local/需求讨论/`。
  4. 更新工作区索引和本记录。
- 进展：
  - 2026-06-22：已输出报告 `local/需求讨论/2026-06-22-claude-hud-one-可持续技术栈与架构改造建议.md`。
  - 2026-06-22：已根据复审继续优化报告：将长期终端 bridge 从 TS/Node 主线修正为自包含 Rust/native `hud-bridge` 主线；补充 `hud-core` / `hud-local-runtime` / `hud-platform-*` 分层；强化 hooks/statusLine 边界、安全模型、Relay 边界、Android/iOS 后台与推送约束。
  - 2026-06-22：已更新 `.claude/workspace-index.md`，将新报告加入 `local/需求讨论/` 入口索引。
- 检查：
  - 需求覆盖：已覆盖技术栈选择、现有项目如何改造、Windows/macOS/Android/iOS/终端的分层建议。
  - 产物路径：`local/需求讨论/2026-06-22-claude-hud-one-可持续技术栈与架构改造建议.md`。
  - 验证情况：本轮为架构分析文档，基于前序公开资料研究和当前项目索引信息整理；未执行代码测试。
  - 风险：报告是不考虑重构成本的目标架构建议，落地时仍需按阶段拆分和回归验证。
  - 是否需要打包：本轮只新增/更新文档、索引和工作日志，不涉及代码文件修改，不需要执行 `npm run tauri:build`。
  - 结论：已完成
