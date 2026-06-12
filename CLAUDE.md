# 工作区 Claude 规则

Claude HUD One 是一款为 Windows 打造的 Claude Code 动态岛 HUD，将当前会话状态、工具调用、上下文用量与任务进展。默认用中文沟通，低风险本地操作可直接执行。

## 上下文读取顺序

1. 需要了解工作区资料时，先读 `.claude/workspace-index.md`。
2. `.claude/workspace-index.md` 只记录工作区索引，不放使用规则和维护规则。
3. 只读取索引中与当前任务相关的文件；不要为了“熟悉项目”全量遍历仓库。
4. 如果任务落在子项目内，再读取该子项目自己的 `CLAUDE.md` 或 `.claude` 规则。
5. 如果索引缺失或过期，先最小范围搜索并回写索引建议，不要扩大到全仓扫描。

## 工作日志读取链路

历史记录采用两级索引，不能跳过索引直接读 `records/`：

1. 先读 `.claude/workspace-index.md`，确认工作日志的二级索引入口是 `.claude/skills/work-journal/resources/index.md`。
2. 再读 `.claude/skills/work-journal/resources/index.md`，根据日期、标题、状态、关键词/适用场景、备注判断是否命中历史记录。
3. 只有命中时，才读取索引表中对应的 `.claude/skills/work-journal/resources/records/*.md`。
4. 新需求默认和历史记录无关；除非用户明确说“继续/上次/之前那个”，或 `.claude/skills/work-journal/resources/index.md` 显示强相关，否则新建记录。

## 工作日志

- 当用户提出新需求、继续历史需求、要求记录沟通内容、要求检查完成情况，或任务会跨多轮推进时，优先使用 `.claude/skills/work-journal/SKILL.md`。
- 工作记录统一落在 `.claude/skills/work-journal/resources/records/`，总索引在 `.claude/skills/work-journal/resources/index.md`。
- `.claude/skills/work-journal/resources/records/` 下的历史记录必须按需访问：先读 `.claude/skills/work-journal/resources/index.md`，根据标题、关键词、状态、备注定位相关记录，只读取命中的记录文件。
- 不要默认遍历或全量读取 `.claude/skills/work-journal/resources/records/`；后续需求和历史需求默认不相关，除非用户明确说“继续/上次/之前那个”，或索引显示强相关。
- 新需求默认新建一条记录；只有确认与已有记录相关时，才追加到已有记录。
- 用户明确要求“只读检查/只给建议/不要修改文件/不要落盘”时，不创建或更新工作记录；仅在回复中说明检查结论。
- 轻任务只写一条记录；只有跨项目、长周期、强验证任务才升级为多文件工作台。

## 思考辅助技能

- 当需求复杂，涉及产品/研发/文档/经营/人生化判断、多目标冲突，或用户说“帮我想清楚/分析/判断/规划/复盘”时，可使用 `.claude/skills/clear-thinking/SKILL.md` 做轻量思考拆解。
- `clear-thinking` 只辅助判断真实目标、主要卡点、约束、最小行动和验证方式，不替代 `work-journal`；跨多轮推进、继续历史需求、记录、复盘、检查完成情况仍按 work-journal 规则处理。
- 使用 `clear-thinking` 时保持低噪声：只读取与当前任务相关的最小材料，不全量遍历素材；若可拆分为独立子任务，再按 Workflow/子代理规则并行。
- `work-journal` 需要借助 `clear-thinking` 时，先由 `work-journal` 通过索引定位并判断是否需要创建/更新记录，再传递压缩后的 `thinking-brief`；轻量判断可在主会话处理，多材料/多历史记录/需展开方法论时优先用独立子代理，跨阶段任务升级 Workflow。

## 大任务 Workflow 与子代理编排

- 如果任务属于大任务（跨仓库/跨项目/跨阶段、涉及多个业务线或多份材料、需要多轮实现与验证、单个对话难以稳定协调），必须优先使用 Claude Workflow / Dynamic workflows 管理流程；Workflow 优先级高于计划模式，不能用计划模式替代 Workflow。
- 如果用户输入同时满足计划模式和 Workflow 条件，应先按 `.claude/skills/work-journal/SKILL.md` 定位并记录需求，再直接进入 Workflow 编排；不要先进入计划模式来替代 Workflow。
- 只有明确不满足 Workflow 条件的中小任务，才允许在 work-journal 之后进入计划模式；低风险小任务仍可按本文件规则直接执行。
- 如果因为任何原因未自动触发 work-journal，但任务符合记录、继续、检查、复盘或大任务编排场景，必须在开始读代码、写计划、进入计划模式或修改文件前主动说明并按该技能补做记录/定位。
- 当任务可拆为相互独立、并行收益明显的专项工作时，优先发起多个子代理 subagent 并行处理，并在主会话汇总整合；适用于代码搜索、项目识别、方案设计、风险审查、验证方案、文档梳理等。
- 子代理和 Workflow 都服务于任务完成，不为形式而滥用：简单单点修改、一次性短答、强上下文耦合且无法拆分的任务，不强行升级。

### 调度决策表

| 场景 | 默认处理方式 |
| --- | --- |
| 单点明确、低风险、无需跨轮追踪 | 主会话直接处理 |
| 需要记录、续接、复盘或完成检查 | 先用 `work-journal` 定位并判断是否创建/更新记录 |
| 目标不清、多目标冲突、需要取舍判断 | 用 `clear-thinking` 输出短结论；需要多材料时交给子代理 |
| 可拆成多个独立专项且并行收益明显 | 多个子代理并行，主会话汇总 |
| 跨项目/跨阶段/多材料/多轮执行验证/需要交叉检查 | Workflow 编排，必要时把 `clear-thinking` 或子代理作为节点 |
| 用户明确只读审查、只给建议、不修改文件或不落盘 | 只读检查并回复结论，不创建/更新工作记录 |

## Claude 技能目录结构

- 所有技能相关文件统一放在 `.claude/skills/` 下，不再另建 `.claude/skill-materials/` 或 `.claude/work-journal/` 这类外部技能目录。
- `.claude/skills/<skill-name>/SKILL.md` 是技能入口；该技能的配套资料、方法论、模板、检查清单、hooks、records 等放在 `.claude/skills/<skill-name>/resources/` 下。
- 修改技能资料目录结构时，同步更新技能内引用、工作区索引、hook 配置和相关工作记录。

## 工作区索引维护

- `.claude/workspace-index.md` 是入口级导航索引，不是完整文件树。
- 后续新增、删除、移动、重命名长期资料入口时，必须同步更新 `.claude/workspace-index.md`。
- 发现某目录下更权威的 `README.md`、`INDEX.md`、`CLAUDE.md` 时，也应更新索引。
- 临时产物、一次性脚本输出、普通中间文件不写入索引，避免索引变重。
- 更新索引时，只写路径、用途和入口文件，不在索引文件中写使用方法或维护规则。
- 历史工作记录的具体路径和描述不直接写进 `.claude/workspace-index.md`，而是写进二级索引 `.claude/skills/work-journal/resources/index.md`。

## 完成声明规则

在回复“完成/已做好”前，至少确认：

1. 用户本轮要做的事项是否都覆盖。
2. 文件修改或产物路径是否明确。
3. 能验证的内容是否已验证；不能验证的原因是否说明。
4. 当前工作区只要完成过文件修改，必须重新打安装包；默认使用 `npm run tauri:build`，若无法打包必须明确说明原因，不能把“已修改但未打包”说成“已完成”。
5. 是否需要更新 `.claude/workspace-index.md`；如果需要，是否已经更新。
6. 是否需要读取历史工作记录；如果需要，是否只通过 `.claude/skills/work-journal/resources/index.md` 定位并按需读取。
7. 未完成、待确认、风险点是否写清。

不要把“已修改但未验证/未按需打包”说成“已完成”。
