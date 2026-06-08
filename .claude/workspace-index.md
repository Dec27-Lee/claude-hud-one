<!--
 * @Description: 
 * @LastEditors: 他们叫我跃总 Dec27-Lee
 * @Date: 2026-06-08 14:42:08
 * @LastEditTime: 2026-06-08 14:43:44
 * @FilePath: \claude-island-win\.claude\workspace-index.md
-->
# 工作区索引

## 顶层入口

| 路径 | 类型 | 用途 | 入口文件 |
| --- | --- | --- | --- |
| `CLAUDE.md` | 工作区规则 | Claude 使用和维护工作区索引、工作日志、完成检查的规则 | `CLAUDE.md` |
| `.claude/` | Claude 配置 | skills、hooks、工作日志、索引 | `.claude/workspace-index.md` |


## 二级索引入口

| 索引路径 | 管理范围 | 包含信息 | 下一步入口 |
| --- | --- | --- | --- |
| `.claude/skills/work-journal/resources/index.md` | 工作日志历史记录 | 每条记录的日期、标题、状态、关键词/适用场景、记录文件路径、备注 | 命中的 `.claude/skills/work-journal/resources/records/*.md` |

## 工作文件索引

| 路径 | 用途 | 入口文件 |
| --- | --- | --- |
| `local/参考项目/codex-island/` | macOS Claude/Codex 动态岛参考项目，用于分析 UI、窗口、用量/费用数据与性能策略 | `local/参考项目/codex-island/README.zh-CN.md` |
| `local/需求讨论/` | Win11 Claude Island Win 需求讨论、技术分析、正式一期完整复刻方案和方案结论 | `local/需求讨论/2026-06-08-win11-codex-island-full-replica-一期正式产品方案.md` |
| `package.json` | 前端/Tauri npm 脚本与依赖入口 | `package.json` |
| `src/` | React/TypeScript 前端 UI、状态模型、mock 数据与动态岛组件 | `src/app/App.tsx` |
| `src-tauri/` | Tauri 2 桌面壳、Rust 原生窗口能力与打包配置 | `src-tauri/tauri.conf.json` |
| `tests/` | Playwright UI 冒烟与截图验收 | `tests/ui.spec.ts` |
| `scripts/` | 本地验证与 smoke 脚本入口 | `scripts/smoke.ps1` |
| `.github/workflows/` | GitHub Actions Windows 发布构建草案 | `.github/workflows/release.yml` |


## Claude 工作区资产索引

| 路径 | 用途 |
| --- | --- |
| `.claude/settings.json` | 项目级 hook/statusLine 配置 |
| `.claude/bridge/claude-status-bridge.mjs` | Claude Code statusLine/hook 脱敏状态桥脚本 |
| `.claude/skills/work-journal/SKILL.md` | 工作日志技能入口 |
| `.claude/skills/work-journal/resources/index.md` | 工作日志历史记录二级索引，记录每条历史记录的路径和适用场景 |
| `.claude/skills/work-journal/resources/hooks/reminder.py` | 工作日志提醒 hook |
| `.claude/skills/work-journal/resources/records/` | 需求、任务、复盘记录文件存放目录；具体记录路径见 `.claude/skills/work-journal/resources/index.md` |
| `.claude/skills/clear-thinking/SKILL.md` | 思考方法论技能入口；复杂判断、规划、复盘前按需使用 |
| `.claude/skills/clear-thinking/resources/` | clear-thinking 运行资料目录；路由器、微技能索引、分类微技能目录、检查清单 |
