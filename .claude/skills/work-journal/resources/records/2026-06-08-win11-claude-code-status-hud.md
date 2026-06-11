# 2026-06-08 Win11 Claude HUD One 产品基座与一期复刻

## 原始需求

- 用户希望分析 macOS Claude/Codex 动态岛参考项目，并规划/实现 Windows 11 版本 Claude Code 状态 HUD。
- 用户后续明确：一期不是简化 MVP，而是按正式发布产品打造；参考 `codex-island` 已有能力能借鉴的都要借鉴到 Win11。
- 用户要求不做工期评估表达，全程由 AI 开发推进到可本地试用/安装验证。

## 范围

- 本轮做：完成需求讨论文档、Tauri/React/Rust 产品骨架、动态岛主 UI、基础 Win32 overlay、Settings 独立窗口、本地 Usage/Cost/Overview、Claude Code 当前会话脱敏状态、托盘/开机启动/诊断/更新占位、UI/Smoke 验证和 Windows release 草案。
- 本轮不做：官方 Usage API、Codex Windows 真实实测、真实 updater endpoint/signing、代码签名和 SmartScreen reputation。
- 约束：本地优先；不读取 prompt、tool input、tool result、transcript 正文或凭据；只保存脱敏聚合状态。

## 计划

1. 通过工作区索引定位参考资料和历史记录。
2. 并行分析 `codex-island` 功能、数据源、Windows 技术实现和旧方案冲突点。
3. 写入正式一期完整复刻方案，并更新工作区索引。
4. 创建 Tauri 2 + React + TypeScript + Rust 产品骨架。
5. 实现动态岛 UI、Settings、Win32 overlay、显示器定位和全屏避让基础。
6. 接入本地 Usage/Cost 聚合、Claude Code statusLine/hooks 脱敏状态桥和多会话状态池。
7. 补齐验证脚本、UI smoke、版本一致性检查、release 打包和 GitHub Actions 草案。

## 进展

- 文档产物：已写入 `local/需求讨论/2026-06-08-win11-codex-island-full-replica-一期正式产品方案.md`，并把旧需求讨论文档标记为 MVP 结论失效。
- 产品骨架：已建立 Vite/React/TypeScript/Tauri/Rust 结构，完成 compact/peek/expanded 动态岛、Usage/Cost/Overview、provider 可见性和 Settings 基础面板。
- 原生能力：已接入 Win32 layered/toolwindow/noactivate overlay、多矩形 hit-test、Settings 独立窗口、显示器列表/定位、全屏避让、托盘、开机启动、AppData settings、诊断目录打开和 updater 占位。
- 数据与状态：已接入本地 Usage/Cost 聚合与 last-known-good 缓存、Claude Code statusLine/hooks 脱敏状态桥、当前会话摘要、多会话状态池与 4s/5s 状态条轮播。
- 发布验证：已新增 Playwright UI smoke、`scripts/smoke.ps1`、版本一致性检查、usage_cost Rust 单元测试和 GitHub Actions Windows release 草案。
- 重要用户反馈闭环：已处理 GUI 静默启动、Claude Code running 状态保留、长按拖拽与位置持久化、context token 口径改为 K token、截图遮罩/飞书截图双 HUD、原生 tooltip 移除、动态 Claude Code 图标、多会话身份展示和单实例 mutex。

## 检查

- 需求覆盖：已完成 Win11 动态岛 HUD 产品基座与一期主路径能力，可本地运行、打包、冒烟验证；官方 Usage API、Codex Windows 实测、真实 updater/signing 等外部依赖仍后置。
- 产物路径：`local/需求讨论/2026-06-08-win11-codex-island-full-replica-一期正式产品方案.md`、`src/`、`src-tauri/`、`tests/ui.spec.ts`、`scripts/smoke.ps1`、`.github/workflows/release.yml`、`README.md`。
- 验证情况：阶段内多次通过 `npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml -j 1`、`npm run test:ui`、`npm run test:rust` 和完整 `npm run smoke`；release exe 与 NSIS/MSI/NSIS-only 安装包曾多轮生成用于本机验证。
- 风险：多屏 DPI、截图遮罩、点击穿透等真实桌面交互需持续实机验证；后续 overlay 透明遮罩复发已拆到专门记录 `2026-06-11-overlay-click-through-root-fix.md`。
- 工作区索引：已将 `local/参考项目/codex-island/`、`local/需求讨论/`、源码/测试/脚本入口写入 `.claude/workspace-index.md`。
- 历史记录读取：本次整理由用户明确指定全量 records 范围；已通过索引定位后处理。
- 结论：阶段完成；后续独立问题不再追加到本总记录，改写入对应主题 record。
