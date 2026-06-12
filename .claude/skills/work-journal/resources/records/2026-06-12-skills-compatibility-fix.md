# 技能文件当前工作区兼容修正

## 原始需求

- 用户说明 `.claude/skills/` 下两个技能是从另一个桌面应用开发项目复制过来的，可能有命令或路径不兼容；要求检查这些文件并按当前工作区处理，重点关注文件路径等兼容问题。

## 范围

- 本轮做：检查 `.claude/skills/` 下技能入口和相关资源文件中的项目路径、命令、项目名、索引/记录路径等引用；按当前工作区 `E:\Develop_E\claude-hud-one` 和现有目录结构修正不兼容内容；做基本验证。
- 本轮不做：重写技能方法论或改变技能职责；不处理 `.claude/skills/` 之外与本问题无关的功能代码。
- 待确认：如发现需要新增/删除长期入口，再同步更新 `.claude/workspace-index.md`。

## 计划

1. 枚举 `.claude/skills/` 下两个技能及相关资源文件。
2. 搜索旧项目路径、旧项目名、外部技能目录、Windows/PowerShell 不兼容命令等问题。
3. 按当前工作区路径与规则修正技能文件。
4. 验证修正后无明显旧路径/旧命令残留。
5. 按完成规则判断是否需要重打安装包并回写记录。

## 进展

- 已创建本次兼容修正记录，并已在工作日志索引登记。
- 已枚举 `.claude/skills/`，当前两个技能为 `work-journal` 与 `clear-thinking`；检查范围覆盖技能入口、clear-thinking 资源索引/检查清单、work-journal hook 与设置中的 hook 调用路径。
- 已修正 `work-journal` 中引用不存在的旧 clear-thinking 资料文件：将 `.claude/skills/clear-thinking/resources/METHODOLOGY.md`、`PRODUCT_RD_METHOD.md` 改为当前实际存在的 `ROUTER.md`、`MICRO_SKILLS.md`、`CHECKLISTS.md` 与 `micro-skills/*.md`。
- 已将工作记录路径提示统一为当前工作区真实路径 `.claude/skills/work-journal/resources/records/`，避免从其他项目复制后的相对 `records/` 表述造成歧义。
- 已同步修正 `clear-thinking` 中“命中记录 / 对应 record”的路径表述，明确必须通过 `.claude/skills/work-journal/resources/index.md` 后只读命中的 `.claude/skills/work-journal/resources/records/*.md`。
- 已修正 `work-journal` hook 输出的提醒文本，使 hook 注入上下文时显示当前工作区完整 records 路径。
- 未修改 Workflow 相关规则：当前 Claude Code 环境提供 Workflow 工具，且根目录 `CLAUDE.md` 明确要求大任务优先 Workflow；这不是复制残留。

## 检查

- 需求覆盖：已覆盖两个技能的路径/命令/项目迁移兼容检查，并修复发现的不兼容或易歧义点。
- 产物明确：修改 `.claude/skills/work-journal/SKILL.md`、`.claude/skills/work-journal/resources/hooks/reminder.py`、`.claude/skills/clear-thinking/SKILL.md`、`.claude/skills/clear-thinking/resources/ROUTER.md`、`.claude/skills/clear-thinking/resources/CHECKLISTS.md`、`.claude/skills/work-journal/resources/index.md`、本记录文件。
- 验证情况：已搜索确认无 `METHODOLOGY.md` / `PRODUCT_RD_METHOD.md` 等旧资源引用；hook 使用管道输入可输出当前路径提醒；`git diff --check` 无 whitespace error（仅 LF/CRLF 提示）；`npm run tauri:build` 已通过并重新生成安装包。
- 风险：`CLAUDE.md` 中提到 `.claude/skill-materials` / `.claude/work-journal` 是“不要另建旧目录”的规范说明，不是旧路径残留，已保留。
- 结论：已完成。
