# Android 手机 HUD 调研报告

- 需求人：Dec27-Lee <lipengyue31@163.com>
- 原始需求：为 Claude HUD One 研究新增一种 HUD 形态：电脑通过 Wi-Fi/局域网把 Claude Code 状态传输到 Android 手机，手机安装 App 后与电脑配对连接；电脑开启“手机 HUD”后，手机 App 展示接近桌面 HUD 的 Claude Code 状态信息。要求把研究报告写到 `local/需求讨论/`。
- 范围：
  - 本轮做：读取最小项目资料，研究现有状态链路、手机 HUD 架构、配对/传输方案、Android App 技术栈、信息安全与落地阶段，并输出 Markdown 研究报告。
  - 本轮不做：不实现电脑端服务、Android App、真实配对协议、UI 原型代码或打安装包。
  - 待确认：Android App 是否作为独立仓库/子项目纳入本仓库、首版是否要求公网/跨网访问、是否允许手机端执行 approval/question 交互。
- 计划：
  1. 按索引读取与 Desktop HUD、Terminal HUD、bridge、设置页相关的最小代码和文档。
  2. 并行调研现有状态数据链路、跨设备传输/配对方案、Android 端实现路径与安全边界。
  3. 汇总形成手机 HUD 产品与技术研究报告。
  4. 将报告写入 `local/需求讨论/` 并在工作日志中记录产物路径。
  5. 完成前检查是否需要更新工作区索引、是否需要构建/打包。
- 进展：
  - 已创建本记录并读取工作区索引、工作日志索引。
  - 已通过并行子代理梳理现有状态链路、手机 HUD 架构、移动端安全/隐私、既有需求文档承接关系。
  - 已输出研究报告：`local/需求讨论/2026-06-16-claude-hud-one-android-mobile-hud-研究报告.md`。
  - 已同步更新长期资料入口：`.claude/workspace-index.md`。
  - 2026-06-16 复查：用户要求再次研究并直接优化现有方案；已读取现有报告，并从架构可落地性、安全边界、Android/网络实现、阶段计划一致性、现有代码兼容性五个角度并行复核。
  - 2026-06-16 复查优化：已将报告重写为“复查优化版”，重点修正 MVP 过大、明文 WebSocket 表述矛盾、字段 allowlist 偏宽、首版只读边界不够硬、Tauri 服务生命周期缺失、协议版本/contract fixtures 缺失、Android 仓库与构建链路不明确等问题。
  - 2026-06-16 范围澄清：用户明确第一阶段必须包含桌面 HUD 现有信息完整展示、手机通知、Wi-Fi 配对连接；需要复核并调整方案，避免 Phase 1 过度收窄。
  - 2026-06-16 一期目标澄清版：已并行复核 Desktop HUD 实际展示信息、一期范围调整、通知/配对安全边界，并将报告改写为“一期目标澄清版”。新方案明确 Phase 0 只是内部前置，Phase 1 才是用户可验收的一期，必须包含 Android App、Wi-Fi 配对二维码/链接、加密连接、Desktop HUD 信息等价展示、低敏手机通知；仍禁止手机端 allow/deny/answer/terminal jump。
- 检查：
  - 需求覆盖：已覆盖“第一阶段必须有桌面 HUD 现有信息展示、手机通知、Wi-Fi 配对连接，并检查当前方案是否有问题”。
  - 产物明确：已更新原报告 `local/需求讨论/2026-06-16-claude-hud-one-android-mobile-hud-研究报告.md`，保留同一路径。
  - 验证情况：本轮只修改研究报告和工作日志，未改代码；按项目规则无需重新打安装包。
  - 风险/待确认：一期加密方案需在 WSS pinning 与成熟应用层加密之间做技术 spike；Desktop HUD 当前实际不展示但配置存在的 `usage`、`effortLevel` 是否纳入 Mobile 一期需确认；App 内项目名/cost/pending choices 的显示精度需确认。
  - 结论：已完成。