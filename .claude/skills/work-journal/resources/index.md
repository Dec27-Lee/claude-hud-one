# 工作日志索引

| 日期 | 标题 | 状态 | 关键词/适用场景 | 记录文件 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 2026-06-08 | Win11 Claude HUD One 产品基座与一期复刻 | done | 产品方案、codex-island、Win11 动态岛、Tauri/React/Rust、Usage/Cost/Overview、基础 overlay、Settings、release smoke | `records/2026-06-08-win11-claude-code-status-hud.md` | 旧超长总记录已重写为产品基座主题记录；后续独立需求不再追加到此文件。 |
| 2026-06-10 | Claude HUD One 命名统一与构建产物清理 | done | 命名统一、旧名残留、构建产物、target、dist、AppData、README、安装包 | `records/2026-06-10-rename-and-artifact-cleanup.md` | 统一 `Claude HUD One` / `claude-hud-one`，清理并重建构建产物，旧品牌残留扫描为 0。 |
| 2026-06-10 | 全局 Bridge、安装清理与 Settings 稳定性 | done | Claude Code settings、statusLine、hooks、HUD Plus 兼容、NSIS、卸载清理、Settings 白屏、显示器字段、设置页 UI | `records/2026-06-10-global-bridge-installer-settings.md` | 记录全局 bridge 策略、安装/卸载脚本、Settings 多页入口和设置页重设计。 |
| 2026-06-10 | Terminal HUD Plus 内置集成与 Settings Studio | done | Claude HUD Plus 内置、Terminal HUD、Settings Studio、display item registry、field schema、Desktop HUD 可配置 | `records/2026-06-10-terminal-hud-integration.md` | 记录从外部 HUD Plus 兼容转向 Claude HUD One 内置 Terminal/Desktop HUD 套件的阶段实现。 |
| 2026-06-11 | Terminal HUD parity、上下文窗口配置与默认配置 | done | Terminal HUD parity、activityLine、sessionTokens、颜色、sessionTime、Todo、CLAUDE_HUD_CONTEXT_WINDOW_SIZE、默认 terminalHud | `records/2026-06-11-terminal-hud-parity-and-config.md` | 记录多轮 HUD Plus parity 复核、context window 同步链路和安装初始化默认配置。 |
| 2026-06-11 | 扩展屏透明遮罩吞点击根因级修复 | done | 扩展屏、透明遮罩、点击穿透、Window Region、overlay hit-test、hover 抖动、Win32、Tauri | `records/2026-06-11-overlay-click-through-root-fix.md` | 主 overlay 从大透明窗口改为固定槽位/内容包围盒 + 原生 Window Region；hover 抖动已解决。 |
| 2026-06-11 | 工作日志结构纠偏与全量重整 | done | work-journal、工作日志、索引整理、records 拆分、记录重写、规范纠偏 | `records/2026-06-11-work-journal-structure-correction.md` | 本次按技能要求全量重整 records 目录和二级索引。 |
| 2026-06-11 | Claude Code rust-analyzer LSP 报错修复 | done | /doctor、LSP、rust-analyzer-lsp、rustup、rust-analyzer、Claude Code 插件 | `records/2026-06-11-claude-code-rust-analyzer-lsp-fix.md` | 已补装 rustup 的 rust-analyzer 与 rust-src 组件，语言服务器可执行文件恢复可用。 |
| 2026-06-11 | 启动后自动打开设置页 | done | 启动、设置窗口、悬浮窗、Tauri setup、open settings on launch | `records/2026-06-11-open-settings-on-launch.md` | 点击应用启动时除显示悬浮窗外，同时打开并聚焦 Settings 页面。 |
| 2026-06-11 | 设置页面 Tab 重组 | done | Settings、设置页、tab、通用、桌面HUD、终端HUD、Claude、关于、配置项合并 | `records/2026-06-11-settings-tabs-reorganization.md` | 将设置页从多 tab 收敛为 5 个主 tab，并重新归类非终端 HUD 配置；构建、UI smoke、重新打包安装已通过。 |
| 2026-06-11 | 提交并推送 main | in_progress | git、commit、push、origin/main、Claude 协作者署名 | `records/2026-06-11-commit-push-main.md` | 用户确认使用当前 Git 身份并带 Claude 协作者署名提交当前工作区改动后推送到远程 main。 |

## 状态说明

- `in_progress`：正在推进。
- `blocked`：等待用户或外部条件。
- `partial`：部分完成，仍有剩余事项。
- `done`：已完成并检查。
- `archived`：历史归档。
