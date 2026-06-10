# Win11 Claude HUD One 需求讨论与一期复刻方案

## 原始需求

用户希望详细分析一个用于 macOS 展示 Claude Code 状态信息的项目，并在本工作区规划 Windows 11 版本实现方案。需要把分析结论写入 `local\需求讨论`。

## 范围

- 初始范围：分析可参考的 macOS Claude Code 状态展示思路、Windows 11 可行实现路径、架构与数据来源、UI 展示效果、实时性、CPU/内存控制、可视化配置界面，并落盘需求讨论文档。
- 2026-06-08 范围变更：用户明确要求一期不是简化 MVP，而是按正式发布产品打造；参考项目 `codex-island` 已有功能一期都要支持，能借鉴的都借鉴到 Win11。
- 当前一期范围：完整复刻 `codex-island` 已有能力，包括 Claude/Codex 双 provider、Usage/Cost/Overview、5h/7d 用量、日志成本扫描、图表样式、成本样式、token 统计口径、设置页、低功耗、告警、开机启动、语言、显示器选择、隐私、本地优先、安装包、自动更新与发布验收；Claude Code 当前会话状态作为 Windows 增强模块保留，但不能替代参考项目复刻主线。
- 2026-06-09 本轮范围修订：Usage 直接使用 Claude Code 自身 statusLine 估算信息；Codex 本次不实现，代码保留但前端不展示；发布不上架应用商店，先满足安装、卸载、手动更新/覆盖安装、开机启动、诊断和本地 release 验证；产品交互闭环继续补齐，全部完成后再提交。
- 本轮不做：接入真实生产自动 updater endpoint/signing key、代码签名证书、SmartScreen reputation、Codex Windows 真实 usage/session 实测、官方 Claude/Codex usage endpoint 闭环。
- 2026-06-08 开发启动范围：用户说明不需要工期评估、全程 AI 开发；本轮去除/弱化方案中的工期表达，并启动 Tauri/React 开发骨架与 mock UI。
- 待确认：Windows 上 Claude Code / Claude Desktop OAuth 凭据实际存储位置、Codex Windows auth/session 路径、Tauri WebView2 透明不抢焦点行为需进一步实测；Rust/Cargo 已安装并完成 Tauri 构建验证。

## 计划

1. 通过索引续接历史记录，并确认旧文档中与最新范围冲突的 MVP 结论。
2. 并行分析参考项目功能、数据源、Windows 技术实现、旧文冲突点。
3. 新增正式一期完整复刻方案文档到 `local\需求讨论`。
4. 在旧文档顶部追加范围修订提示，避免后续误用旧 MVP 结论。
5. 更新工作区索引入口和工作日志。
6. 完成检查：覆盖范围、产物路径、验证方式、风险和下一步。
7. 按用户最新要求移除工期评估表达，只保留 AI 开发执行序列。
8. 启动 Tauri 2 + React + TypeScript + Rust 目录骨架，先用 mock 数据复刻动态岛 UI 主路径。
9. 修复 Rust/Tauri 构建环境，完成 `cargo check`、`npm run tauri:build`、release exe 与 NSIS/MSI 安装包产物验证。
10. 实现 overlay hit-test 基础：前端上报视觉岛体命中区域，Rust 50ms 轮询 cursor + window rect，按区域动态切换 `WS_EX_TRANSPARENT`。
11. 实现显示器基础能力：列出 displays、按主屏/指定显示器顶部居中定位 overlay。

## 进展

- 2026-06-08：已创建本工作记录。
- 2026-06-08：并行完成 4 个专项分析：macOS 参考项目架构、状态/费用数据源、Win11 HUD 技术方案、Claude Code `statusLine`/hooks/transcript 集成边界。
- 2026-06-08：已输出初版需求讨论文档：`local\需求讨论\2026-06-08-win11-claude-code-status-hud-需求讨论.md`。
- 2026-06-08：发现并沉淀长期资料入口，已更新 `.claude\workspace-index.md`，加入 `local\参考项目\codex-island\` 与 `local\需求讨论\`。
- 2026-06-08：用户纠正一期范围，要求参考项目已有功能全部支持，按正式发布产品打造，不再采用简化 MVP 范围。
- 2026-06-08：并行补充 4 个专项复核：参考项目完整功能清单、Usage/Cost/凭据/日志数据源、Win11 Tauri/Win32 正式实现方案、旧文档冲突点与修订结构。
- 2026-06-08：已新增正式一期完整复刻方案：`local\需求讨论\2026-06-08-win11-codex-island-full-replica-一期正式产品方案.md`。
- 2026-06-08：已在旧文档顶部加入范围修订提示，明确旧文中的简化 MVP 结论不再作为一期依据。
- 2026-06-08：已更新 `.claude\workspace-index.md`，将 `local\需求讨论\` 入口指向正式一期完整复刻方案。
- 2026-06-08：根据用户反馈，已将正式一期方案中的“约 3-5 天 / 1 周 / 2 周”等工期评估移除，改为 M0-M6 AI 开发执行序列。
- 2026-06-08：已创建 Tauri/React/TypeScript 开发骨架：`package.json`、`vite.config.ts`、`tsconfig*.json`、`index.html`、`src/`、`src-tauri/`。
- 2026-06-08：已实现第一版 mock UI：compact / peek / expanded 动态岛、Usage / Cost / Overview 三页、图表样式雏形、provider 可见性、Settings 面板雏形。
- 2026-06-08：已安装 npm 依赖并通过 `npm run build` 前端构建；`npm run tauri -- info` 显示 WebView2 与 MSVC 可用，但 Rust/Cargo/rustup 未安装，Tauri 原生构建暂阻断。
- 2026-06-08：已更新 `README.md` 与 `.claude\workspace-index.md`，补充开发入口和新增代码目录。
- 2026-06-08：用户允许代为安装 Rust；首次 rustup 安装因 `memory allocation failed` 中断，随后改为 `--profile minimal` 重装 stable 工具链并把 `%USERPROFILE%\.cargo\bin` 加入用户 PATH，`cargo`/`rustc`/`rustup` 验证通过。
- 2026-06-08：`cargo check` 初次被 Tauri Windows resource 阶段阻断，原因是缺少 `src-tauri\icons\icon.ico`；已生成应用图标并在 `tauri.conf.json` 中显式配置 `bundle.icon`。
- 2026-06-08：已将 Tauri 入口拆为 `src-tauri\src\lib.rs` + `src-tauri\src\main.rs`，修复 `Cargo.toml` lib target 解析错误。
- 2026-06-08：`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 通过；`npm run tauri:build` 通过，产出 release exe、NSIS setup 和 MSI 安装包。
- 2026-06-08：已启动 release exe 做冒烟验证，进程可运行 4 秒未退出，随后手动停止。
- 2026-06-08：已继续实现第一层 Win32 overlay 样式：在 Rust 侧对主窗口应用 `WS_EX_LAYERED`、`WS_EX_TOOLWINDOW`、`WS_EX_NOACTIVATE`，并预留 `set_overlay_click_through` 命令用于后续动态切换 `WS_EX_TRANSPARENT`。
- 2026-06-08：Win32 overlay 样式接入后重新执行 `cargo check` 与 `npm run tauri:build` 均通过，release exe 再次冒烟启动成功。
- 2026-06-08：已实现 overlay hit-test 基础：`src/app/overlayBridge.ts` 封装 Tauri invoke；`IslandRoot` 用 `ResizeObserver` 上报岛体/面板 DOM rect；Rust 侧 `OverlayTracker` 保存命中区域并用 cursor/window rect 轮询切换 `WS_EX_TRANSPARENT`。
- 2026-06-08：Settings 打开时会临时把 hit region 扩展为整个 WebView，避免设置面板因 click-through 无法点击；后续应拆成独立 Settings window。
- 2026-06-08：已补充 `list_displays` 与 `center_overlay_on_display` Tauri 命令，启动时默认按主屏 work area 顶部居中定位 overlay。
- 2026-06-08：hit-test 与显示器基础能力接入后，已执行 `npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml -j 1`、`npm run tauri:build`，并完成 release exe 冒烟启动。
- 2026-06-08：已将 overlay hit-test 从单矩形升级为多矩形：前端按 capsule / expanded panel 分别上报交互区域，Rust `OverlayTracker` 保存 `Vec<HitRegion>` 并对任一区域命中时关闭 `WS_EX_TRANSPARENT`；前端上报时按 `devicePixelRatio` 转换为物理像素，作为多 DPI 基础修正。
- 2026-06-08：已把 Settings 从主 overlay 的同 WebView 临时浮层拆为独立 Tauri `settings` 窗口，新增打开/隐藏命令和关闭拦截；前端按窗口 label 渲染 main island 或 settings app，并通过 localStorage + Tauri event 同步 mock 设置状态。
- 2026-06-08：已实现全屏避让基础检测：Rust 后台 tracker 轮询前台窗口矩形，若覆盖显示器 bounds 则隐藏 main overlay，退出全屏或关闭避让时恢复显示；Settings 中的 `Hide on fullscreen apps` 开关已联动原生命令。
- 2026-06-08：本轮改造后已执行 `npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml -j 1`、`npm run tauri:build`，并完成 release exe 冒烟启动 4 秒未退出后手动停止。
- 2026-06-08：根据用户说明“测试可以用当前会话模拟实际情况”，已新增当前 Claude Code 会话摘要扫描：Rust `claude_session` 模块只统计项目 transcript 的事件类型、数量、工具记录数、tool-result 文件数和最近活动时间，不返回 prompt/transcript/tool-result 正文；前端新增 `CurrentSessionStrip`，expanded 面板展示 live/mock 会话状态，Settings Diagnostics 展示脱敏摘要。
- 2026-06-08：当前会话摘要接入后已执行 `npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml -j 1`、`npm run tauri:build`，并完成 release exe 冒烟启动 6 秒未退出后手动停止。
- 2026-06-08：用户要求“继续，一直到全都做完”。本轮继续补正式产品基础设施：新增原生 Settings JSON 配置读写、HKCU Run 开机启动开关、系统托盘菜单（Show Island / Settings / Hide Island / Quit）、诊断目录打开命令、overlay 恢复显示 no-activate 路径、本地 Claude/Codex 日志 Usage/Cost 聚合命令；前端接入 live Usage/Cost 轮询并覆盖 Usage/Cost/Overview，Settings 补齐语言、宽度、显示器、top offset、告警阈值，Usage 补 stale/error/threshold 状态，Cost 四种样式增强。
- 2026-06-08：本轮正式产品基础设施和本地 Usage/Cost 聚合接入后已执行 `npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml -j 1`、`npm run tauri:build`，并完成 release exe 冒烟启动 8 秒未退出后手动停止。
- 2026-06-08：继续补齐 Windows 交互与发布预留：overlay 已安装 `WM_MOUSEACTIVATE -> MA_NOACTIVATE` subclass，进一步降低点击抢焦点；显示器定位命令支持 `topOffsetPx`，Settings 可列出真实显示器并在 target/top offset 变化时立即重定位；启动时会按原生 settings 恢复显示器位置；新增 updater 状态预留命令和 Settings 更新区块，当前明确显示 updater endpoint/signing key 未配置。
- 2026-06-08：本轮 WM_MOUSEACTIVATE、target display/top offset、updater 预留接入后已执行 `npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml -j 1`、`npm run tauri:build`，并完成 release exe 冒烟启动 8 秒未退出后手动停止。
- 2026-06-08：根据用户要求“不用停下来，一直继续到可以使用”，已新增 Playwright UI 冒烟截图验收：新增 `playwright.config.ts`、`tests/ui.spec.ts`、`npm run test:ui`，浏览器预览支持 `?view=expanded&page=...` 和 `?window=settings`，测试覆盖 compact、expanded Usage/Cost/Overview、Settings，并生成截图到 `artifacts/screenshots/`。
- 2026-06-08：UI 自动化验收接入后已执行 `npm run build`、`npm run test:ui`（3 passed）、`npm run tauri:build`，并完成 release exe 冒烟启动 8 秒未退出后手动停止。
- 2026-06-08：已修复 `npm run test:ui` 自启动 Vite 的可靠性问题：将 UI 测试驱动改为 `scripts/test-ui.mjs`，并让 Playwright config 在外部 Vite 模式下跳过内置 `webServer`；随后 `npm run test:ui` 通过（3 passed），`npm run smoke` 串联前端 build、Rust check、UI 截图、Tauri release build 和 release exe 8 秒存活冒烟全部通过。
- 2026-06-08：已为本地 Usage/Cost 聚合增加 last-known-good 聚合缓存：当当前扫描找不到 token usage 字段时，会回退到 `%APPDATA%\Claude HUD One\usage-cost-cache.json` 中的上次聚合结果并标记 stale/cache；缓存只保存聚合 token/cost/provider 状态，不保存 prompt、transcript、tool-result 或凭据正文。本轮已执行 `npm run smoke`，前端 build、Rust check、UI 截图、Tauri release build 和 release exe 8 秒存活冒烟全部通过。
- 2026-06-08：已明确 Usage provider 的数据来源/认证状态字段：Rust snapshot 增加 `source` 与 `authStatus`，当前 local scan 返回 `localEstimate/unknown`，缓存回退返回 `cache/unknown`；Usage UI 增加 source/auth pill，避免把本地估算误展示为官方 endpoint usage。本轮已执行 `npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml -j 1`、`npm run test:ui`（3 passed）。
- 2026-06-08：已新增版本一致性检查 `scripts/check-version.mjs` 与 `npm run check:version`，并把该检查接入 `npm run smoke`，用于约束 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 的版本一致。最新 `npm run smoke` 已完整通过版本检查、前端 build、Rust check、UI 截图、Tauri release build 和 release exe 8 秒存活冒烟。
- 2026-06-08：已新增 Windows CI 发布 workflow 草案 `.github/workflows/release.yml`：支持 `workflow_dispatch` 与 `v*` tag，安装依赖与 Playwright Chromium，执行版本检查、前端 build、Rust check、UI smoke、Tauri NSIS/MSI build，生成 SHA256SUMS，上传 artifacts，并在 tag 发布时发布 GitHub Release；尚未配置签名证书、Tauri updater endpoint/signing key 或 SmartScreen reputation。
- 2026-06-08：已新增 App 诊断摘要模块 `src-tauri/src/window/diagnostics.rs` 与 Settings 展示：返回 app version、AppData/settings/cache 路径及存在性、Claude projects/Codex sessions 路径存在性和隐私说明，并新增 Open app data 按钮；诊断不读取或返回 prompt、transcript、tool-result 或凭据内容。最新 `npm run smoke` 已完整通过版本检查、前端 build、Rust check、UI 截图、Tauri release build 和 release exe 8 秒存活冒烟。
- 2026-06-08：根据用户反馈“提问后 HUD 状态没变化”，已接入 Claude Code `statusLine`/hook 状态桥：新增 `.claude/bridge/claude-status-bridge.mjs`，更新 `.claude/settings.json`，通过 statusLine 与 UserPromptSubmit/PreToolUse/PostToolUse/Stop/Notification 等 hooks 写入脱敏状态 JSON 到 `%APPDATA%\\Claude HUD One\\claude-status.json` 和 `.claude/bridge/state/claude-status.json`；Rust 新增 `claude_status` 读取命令，前端 Current Session 正常模式约 1 秒读取 bridge patch，显示 Prompt submitted、Tool running、Waiting 等实时状态和模型/context 信息。桥接脚本只保存事件名、工具名和聚合指标，不保存 prompt、tool input、tool result、transcript 正文或凭据。本轮已执行脚本样例验证、settings JSON 校验、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run build`、`npm run test:ui`（3 passed）、`npm run smoke` 全部通过，并重启 release 版 PID 12888。
- 2026-06-08：用户要求“记录当前工作状态，停止修改，提交并推送远程 main”。当前已停止继续功能修改；本轮在 `npm run smoke` 通过后又开始补 compact/peek 状态可视反馈（`IslandRoot` 与 `styles.css` 的 live dot/peek 文案），该小段 UI 反馈尚未单独复跑 smoke。Git 身份已核对：remote `origin git@github.com:Dec27-Lee/claude-hud-one.git`，分支 `main`，user `Dec27-Lee <lipengyue31@163.com>`；接下来按用户要求提交并推送整个工作区。
- 2026-06-08：用户要求“回顾任务完成记录，继续执行没有完成的任务”。已根据记录缺口继续补正式产品验证与设置持久化：新增 `usage_cost.rs` 单元测试 5 个，覆盖嵌套 token 解析、cache-read 计费折扣、模型价格分支、Claude/Codex daily buckets 合并和 provider source/stale 状态；新增 `npm run test:rust`，并接入 `scripts/smoke.ps1` 与 `.github/workflows/release.yml`。同时把 provider visibility 纳入 native Settings SSOT：`SettingsState.visibleProviders`、Rust `AppSettings.visible_providers` 默认值、store 深合并兼容旧 localStorage，并在 Settings/主面板切换 provider 时同步保存原生配置。最新 `npm run smoke` 已完整通过版本检查、前端 build、Rust check、Rust usage/cost tests（5 passed）、UI 截图（3 passed）、Tauri release build 和 release exe 8 秒存活冒烟。
- 2026-06-08：继续补发布链路中不依赖外部资源的 updater 骨架：`UpdateState` 扩展 `configured/canCheck/downloadAvailable/errorCode/endpoint` 字段，Settings Updates 区块明确显示未配置原因并在 `canCheck=false` 时禁用 Check for updates，避免把占位功能误导为真实自动更新；真实 endpoint、签名 key、下载/安装仍待外部资源。最新 `npm run smoke` 已完整通过版本检查、前端 build、Rust check、Rust usage/cost tests（5 passed）、UI 截图（3 passed）、Tauri release build 和 release exe 8 秒存活冒烟。
- 2026-06-09：根据用户反馈 claude-hud-one 项目级 `statusLine` 覆盖全局 `claude-hud-plus`，已把 `.claude/bridge/claude-status-bridge.mjs` 改为兼容委托模式：statusLine 执行时仍先写入 Claude HUD One 脱敏状态 JSON，再自动检测 `%USERPROFILE%\\.claude\\plugins\\claude-hud-plus\\statusline.ps1` 并把原 stdin 传给 HUD Plus 输出多行状态；若 HUD Plus 不存在、超时或失败，则回退 `Claude HUD One · ...`。保留 hooks 状态采集，不保存 prompt/tool input/tool result/transcript/凭据内容。已执行 `node --check .claude/bridge/claude-status-bridge.mjs` 通过，并用样例 stdin 验证输出恢复为 HUD Plus 多行状态。
- 2026-06-09：按用户要求整理当前对标 `local\\参考项目\\codex-island` 的阶段进展、问题和正式使用缺口，已新建阶段性复盘文档 `local\\需求讨论\\2026-06-09-claude-hud-one-对标codex-island-当前进展与正式使用缺口.md`。结论为：当前已具备本地试用和 pre-release 工程基础，但完整对标仍需补官方 Usage endpoint/认证链路、Codex Windows 实测、真实 updater/signing/发布链路、多屏 DPI 与全屏实机矩阵、手动刷新和 alerts 等产品闭环。本轮为文档整理，未执行新的 smoke。
- 2026-06-09：用户确认范围修订后继续推进：Usage 改为优先使用 Claude Code statusLine 自身估算；Codex 本轮后置且前端不展示；发布目标改为不进应用商店但满足安装、卸载、手动更新、开机启动等常规流程。已接入 statusLine `rate_limits` 5h/7d 百分比与 reset 时间到 bridge/Rust/TS provider 状态，前端 `ProviderSource` 新增 `claudeCode`；`displayedProviderOrder` 改为只展示 Claude，mock/native settings 默认 codex false，Overview/Usage/Cost/Settings/Diagnostics 不展示 Codex；新增 expanded footer 和 Settings 手动刷新、防并发刷新状态、alerts 阈值派生与 header pill；Updates 改为 manual update only 并提供 GitHub Releases 打开入口；README、需求讨论文档、Tauri bundle 描述和 smoke installer artifact 校验已同步更新。已执行 `node --check .claude\\bridge\\claude-status-bridge.mjs`、`npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run test:rust`、`npm run test:ui` 通过；随后完整 `npm run smoke` 通过，包含版本一致性、前端 build、Rust check、Rust usage/cost tests、UI screenshots、Tauri release build、NSIS/MSI 产物 SHA256 校验和 release exe 8 秒存活；本机显示器检测到 `DISPLAY1 2048x1280` 与 `DISPLAY2 2560x1440 primary`，release exe 在双屏环境启动 15 秒未退出。
- 2026-06-09：用户询问启动是否必须拉起终端弹窗。已确认不是必须，原因是 `src-tauri/src/main.rs` 缺少 Windows GUI subsystem 声明；已加入 `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`，使 release 版静默 GUI 启动。已重新执行 `npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run tauri:build`，并用 PE header 验证 `src-tauri\\target\\release\\claude-hud-one.exe` 的 `Subsystem=2 (Windows GUI)`，release exe 启动 8 秒未退出。NSIS/MSI 安装包已重新生成。
- 2026-06-09：用户反馈 Claude Code 正在处理问题时 HUD 顶部没有实时动态变化。已确认原因是 1 秒一次的 statusLine 会覆盖 `UserPromptSubmit`/tool hook 写入的 `running` 状态，且 compact 态只显示绿点导致变化不明显。已修改 `.claude/bridge/claude-status-bridge.mjs`：`UserPromptSubmit` 显示 `Generating response`，`PostToolUse` 也视为 running，statusLine 会在 running hook 后最多保留 hook activity/statusText 15 分钟，Stop/Notification/error 等终态保留 8 秒后再恢复 active；仍只保存脱敏事件名、工具名和聚合指标。已修改 `IslandRoot`：compact 态在 running/waiting/error 时自动进入 peek 显示状态文案。已新增 `activityStartedAt` 类型/Rust DTO 字段。验证：bridge hook→statusLine 保持测试通过，`node --check`、`npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run smoke` 均通过，NSIS/MSI 安装包已重新生成。
- 2026-06-09：用户提出“长按支持拖拽悬浮窗位置”。已在 `IslandRoot` 胶囊上实现 420ms 长按后调用 Tauri `startDragging()`，普通点击仍展开；拖拽中监听主窗口 moved 事件，防抖保存物理坐标到 `settings.overlayPosition`，并写入 `%APPDATA%\\Claude HUD One\\settings.json`；启动时 Rust setup 和前端加载都会优先恢复 `overlayPosition`，若用户在 Settings 中调整 target display/top offset 或点击 Reset，则清空自定义位置并重新按显示器居中。Settings Placement 已显示当前 dragged 坐标、说明长按拖拽，并提供 Reset to target display。新增 Rust `set_overlay_position` 命令、`OverlayPosition` DTO 和对应 TS 类型/bridge。已执行 `npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run test:ui` 通过；随后 `npm run smoke` 完整通过，包含版本一致性、前端 build、Rust check、Rust usage/cost tests、UI screenshots、Tauri release build、NSIS/MSI SHA256 校验和 release exe 8 秒存活，安装包已重新生成。
- 2026-06-09：用户反馈长按有反应但拖不动，并询问 `Claude 100% · local scan` 的含义。已判断 Tauri `startDragging()` 延迟调用在 Windows/noactivate overlay 下不可靠，改为手动拖拽实现：长按后读取 Tauri 全局 cursor physical position 与窗口 outerPosition，pointer move 期间持续调用 `set_overlay_position` 移动窗口，pointer end 保存最终坐标。另将 Usage 语义调整为不再把本地日志扫描 localEstimate 用作 Claude rate limit 百分比：当 Claude Code statusLine 没有 `rate_limits` 字段时显示 `Claude Code estimate / rate limits unavailable / Waiting for Claude Code rate limits`，避免误导为 `Claude 100% local scan`。本地扫描仍只用于 Cost/Overview 聚合。已执行 `npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run test:ui`、`npm run smoke` 全部通过，安装包已重新生成。
- 2026-06-09：用户重新安装后反馈 3 个问题：`ctx 18%` 命名不清、长按拖拽仍未生效、收缩/peek 文案从左侧溢出。已继续修正：拖拽不再使用 `startDragging()`，改为 pointer capture + 全局 cursor/outerPosition 手动计算，长按后即使继续移动也不会取消；pointer move 时直接调用 `setOverlayPosition`，松手保存。`ctx` 文案统一改为 `context`，说明该值来自 Claude Code statusLine 的 `context_window.used_percentage`，即上下文窗口占用百分比；不再显示缩写 `ctx`。peek 文本增加 `overflow: hidden`、ellipsis、flex 收缩和更小 gap，Usage 无 rate limit 时显示较短的 `Claude usage unavailable`，避免左侧溢出。已执行 `node --check`、`npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run test:ui`、`npm run smoke` 全部通过，安装包已重新生成。
- 2026-06-09：用户进一步说明上下文百分比受 1M 配置模型影响，与实际 270K 口径不匹配，要求不显示百分比、直接显示多少 K；同时拖拽时鼠标与按钮位置相差很远。已修改状态桥和前端：bridge 从 `context_window.current_usage` 的 input/output/cache creation/cache read token 求和，缺失时再用 total/percent fallback，写入 `contextUsedTokens` 并显示如 `179K context`；前端 CurrentSessionStrip/source label 也只展示 K token，不再展示百分比。拖拽改为按“全局 cursor physical position - 鼠标在 WebView 内的 physical anchor”计算窗口左上角，并用 16ms loop 持续移动，避免多屏/DPI/透明大 WebView 下 delta 方案产生偏移。已用样例验证 context label 为 `179K context`，并执行 `node --check`、`npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run test:ui`、`npm run smoke` 全部通过，NSIS/MSI 安装包已重新生成。
- 2026-06-09：用户反馈截图状态下会出现两个 HUD（截图工具冻结画面里一个、截图遮罩上方实时 HUD 又一个），且 hover/peek 文案不需要 `Claude Code` 字样。已修复：peek 文案从 `Claude Code Running ...` 改为 `Running ...`，节省空间；Rust fullscreen tracker 改为每 250ms 检测，并且即使用户关闭 fullscreen avoidance，也会检测 Windows 截图/屏幕裁剪叠层；通过枚举可见顶层窗口，匹配 `ScreenClippingHost.exe`、`SnippingTool.exe`、`SnipAndSketch.exe`、Snipping Tool/截图/截屏标题或 screenclipping class，且窗口覆盖显示器时临时隐藏主 HUD，截图结束后恢复。已执行 `npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run test:ui`、`npm run smoke` 全部通过，安装包已重新生成。
- 2026-06-09：用户说明飞书截图工具仍会出现两个 HUD，不能按截图工具逐个白名单优化，并进一步澄清截图时应保留“冻结背景里的 HUD”，只是不能再出现第二个实时 HUD。已按公共逻辑重修：HUD 切换点击穿透时不再用 `HWND_TOPMOST` 重新抬升 z-order，而是使用 `SWP_NOZORDER` 保持现有层级，避免截图遮罩创建后被 HUD 抢回最上层；取消 `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`，让截图工具冻结背景时仍能捕获 HUD；截图检测从白名单扩展为通用顶层全屏遮罩规则，枚举可见顶层窗口并按非本进程、覆盖显示器、topmost、borderless popup、layered/transparent/toolwindow/空标题等特征打分判断，命中时不再 `hide()`，而是 `HWND_NOTOPMOST + SWP_SHOWWINDOW + SWP_NOACTIVATE` 临时降级 live HUD 到截图遮罩后方，截图结束后恢复 topmost。已执行 `cargo check --manifest-path src-tauri\\Cargo.toml -j 1` 与 `npm run smoke` 全部通过，安装包已重新生成。
- 2026-06-09：用户反馈鼠标悬浮在悬浮窗上会出现白底黑框气泡，不需要展示。已移除主 HUD 胶囊按钮的 `title="Click to expand; long-press and drag to move"`，并移除 compact live-dot 的动态 `title`，避免浏览器/系统原生 tooltip；保留 `aria-label` 以维持可访问性。首次 smoke 暴露 JSX 闭合错误后已修复，随后 `npm run smoke` 完整通过并重新生成安装包。
- 2026-06-09：用户要求重新设计悬浮状态图标，参考项目的动态 Claude Code logo。已只读对照 `local/参考项目/codex-island`，确认参考项目的高级感主要来自“稳定品牌 logo + 外围 glow/sweep/live dot + 容器形变”，不是让 logo 大幅乱动。当前项目已把左右 `C`/`AI` 文本圆点替换为 Claude Code 双图标：左侧为品牌土橙色 Claude 星形 mark（六瓣 petal + core），右侧为 code/terminal cursor mark；两者按 idle/active/running/waiting/error 切换状态色、呼吸 glow 和 sweep，running 加快动效，error 使用红色警示，low-power 下关闭持续动画。已用 Playwright 截图检查 compact/expanded 视觉，并执行 `npm run build` 与 `npm run smoke` 全部通过，安装包已重新生成。
- 2026-06-09：用户澄清“滚动所有会话状态”是指悬浮窗状态条本身每 3-5 秒上下翻页，整条横向文字向上滚出并替换为另一个会话，而不是横向跑马灯。已实现多会话基础闭环：bridge 仍保留兼容单文件，同时按 `sessionId/transcriptPath/project` 生成 `sessionKey` 并写入 `%APPDATA%\\Claude HUD One\\sessions\\*.json` 与 `.claude\\bridge\\state\\sessions\\*.json`；Rust 新增 `get_claude_status_bridge_sessions` 读取、去重、按 `updatedAt` 排序并截断最近 24 个；前端 `IslandAppState` 增加 `sessions`，provider 映射增加 `loadLiveSessions`，store 增加 `setSessions`，App 轮询改为拉多会话；IslandRoot 中央状态条按 4s（低功耗 5s）垂直 roll-up 切换会话，compact/peek 都显示当前轮播会话，expanded 中 CurrentSessionStrip 展示当前轮播会话并列出最多 6 个监控会话。仍保持隐私边界：只保存 session/project/status/tool/model/context/rate-limit 聚合，不保存 prompt、tool input、tool result 或 transcript 正文。已执行 `node --check`、`npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run smoke` 全部通过，安装包已重新生成。
- 2026-06-09：用户进一步明确需要“本电脑所有项目都自动接入”。已新增全局 Claude Code bridge 安装/修复逻辑：Tauri 启动时将当前 bridge 脚本写入 `%APPDATA%\\Claude HUD One\\bridge\\claude-status-bridge.mjs`，并合并用户级 `~\\.claude\\settings.json`，把全局 `statusLine` 指向该 AppData bridge，同时给 `UserPromptSubmit/PreToolUse/PostToolUse/Notification/Stop/StopFailure/PreCompact` 追加全局 hook；若原用户级 statusLine 存在且不是 Claude HUD One bridge，会写入 `%APPDATA%\\Claude HUD One\\bridge\\upstream-statusline.json`，bridge 输出时先委托该 upstream，再回退 claude-hud-plus 自动检测，避免覆盖既有 HUD Plus 输出。Settings 新增 Claude Code Global Bridge 状态区和 Install/Repair 按钮。该安装逻辑在 app 启动时 fail-safe 执行，不阻塞主程序；只改 Claude Code 用户级 settings 和 AppData bridge 文件，不触碰凭据/日志正文。已执行 `node --check`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run build`、`npm run smoke` 全部通过，release smoke 已实际启动并执行全局 bridge 安装/修复，安装包已重新生成。
- 2026-06-09：用户反馈多会话状态已经能展示，但无法辨认是哪个工作区/哪个会话，并要求去掉右侧橙色 Usage 文案以节省空间。已补齐多工作区/多会话身份展示：bridge 和前端项目名优先取 `projectDir/cwd` basename，保留 `sessionId/transcriptPath/sessionKey` 短码作为会话标识；compact/peek 状态条显示 `Activity · workspace / session · status`，多会话时显示 `1/N`，expanded `CurrentSessionStrip` 和 session list 同步展示 `workspace / #session`、workspace path、tool/status、context K token；顶部右侧 provider Usage 文案已移除，Usage 详情仍保留在展开页。已执行 `node --check .claude\\bridge\\claude-status-bridge.mjs`、`npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1` 通过；完整 smoke 因资源压力中断后停止，未再重复重型 smoke。
- 2026-06-09：按用户确认“继续打包”后，采用低资源参数重新打包：`CARGO_BUILD_JOBS=1`、`CARGO_PROFILE_RELEASE_OPT_LEVEL=1`、`CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16`，`npm run tauri:build` 已完成并产出 NSIS/MSI 安装包。产物：`src-tauri\\target\\release\\bundle\\nsis\\Claude HUD One_0.1.0_x64-setup.exe`（SHA256 `D2C2604CC08CDC81109CFAB355D54ED5975CD05DD091D7D28F701643CD6B7CB3`）和 `src-tauri\\target\\release\\bundle\\msi\\Claude HUD One_0.1.0_x64_en-US.msi`（SHA256 `61CD5CCED716FEE65089DD2D0CFDE9B197F976BEE3746C8DE48956327741A6DF`）。本次为用户本机验证用低优化 release 包，未再执行完整 smoke。
- 2026-06-09：用户安装验证时反馈桌面偶发出现两个 HUD，点击两次启动程序后更容易复现，并伴随偶发闪退。已确认当前版本缺少单实例保护，重复启动会创建两个独立 Tauri/WebView 进程，各自显示 HUD，并可能并发读写同一份 AppData settings/global bridge 状态。已在 `src-tauri/src/main.rs` 入口最前面增加 Windows 命名 mutex `Local\\ClaudeHUDOne.SingleInstance`，并在 `src-tauri/Cargo.toml` 为 `windows` crate 补充 `Win32_Security` feature；后续重复启动会在 Tauri/WebView 初始化前直接退出，不再创建第二个 HUD。本轮执行 `cargo check --manifest-path src-tauri\\Cargo.toml -j 1` 通过；随后采用低资源参数 `CARGO_BUILD_JOBS=1`、`CARGO_PROFILE_RELEASE_OPT_LEVEL=1`、`CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16` 重新运行 `npm run tauri:build`，已产出单实例修复版 NSIS/MSI。新产物：`src-tauri\\target\\release\\bundle\\nsis\\Claude HUD One_0.1.0_x64-setup.exe`（SHA256 `6CE9C0CE0846D2760DCB6A44DC9C61CF9157209AD54EDA9CB9DF3EDB4F061D82`）和 `src-tauri\\target\\release\\bundle\\msi\\Claude HUD One_0.1.0_x64_en-US.msi`（SHA256 `6E853F3C2F33A05BDDFFE4BCC7E1963178A1695A1A5B67336D14314C743442B5`）。未再执行完整 smoke；需要用户安装新版后人工验证双击两次只保留一个 HUD。
- 2026-06-09：用户反馈 Claude Code 会话底部 `claude-hud-plus` 不显示，并询问是否改动。已确认确实为了全局接入 Claude HUD One 改过用户级 `~/.claude/settings.json` 的 `statusLine`：由直接调用 HUD Plus 改为调用 `%APPDATA%\\Claude HUD One\\bridge\\claude-status-bridge.mjs`，并把原 HUD Plus 命令保存到 `%APPDATA%\\Claude HUD One\\bridge\\upstream-statusline.json`；设计目标是先采集 Claude HUD One 状态，再透传 HUD Plus 输出。排查结果：HUD Plus 脚本存在且直接执行正常；AppData 全局 bridge 与项目级 `.claude\\bridge\\claude-status-bridge.mjs` 均能用样例 stdin 正常输出 HUD Plus statusLine。为降低冷启动/PowerShell+Node 链路偶发超时导致底部不显示的概率，已将 project bridge 与 AppData bridge 默认 `CLAUDE_HUD_ONE_HUD_PLUS_TIMEOUT_MS` 从 2200ms 放宽到 4000ms；hooks 仍由 Claude Code settings 中的 2s timeout 约束，不改变工具调用 fail-safe。已执行两个 bridge 的 `node --check` 和样例输出验证通过。随后用户执行 `/reload-plugins` 成功，并触发 `/claude-hud-plus:setup`；按 HUD Plus setup 诊断确认插件缓存/注册表正常、无临时残留、Node `v24.12.0` 可用、最新插件版本目录为 `0.2.4`。为避免直接把 statusLine 改回 HUD Plus-only 导致 Claude HUD One 全局采集失效，已保留组合 wrapper，并在用户级 `~/.claude/settings.json` 备份后写入 `env.CLAUDE_HUD_ONE_HUD_PLUS_TIMEOUT_MS=4000`、确认 `enabledPlugins.claude-hud-plus@claude-hud-plus=true`；这样即使安装版 app 以后重写 AppData bridge，bridge 也会继承 4s 委托超时。已用当前全局 settings statusLine 命令验证 bridge 能输出 HUD Plus。未重新打包；下一次打包会因项目 bridge 默认值已改为 4000ms 而固化该默认值。
- 2026-06-10：用户要求按推荐方案改造 Claude HUD One 与 Claude HUD Plus/其他 statusLine 的兼容方式：默认不抢占 Claude Code 唯一 `statusLine`，只用 hooks-only 旁路采集；Settings 需要能检查 Claude settings 内容，并支持添加/修复、启用增强 multiplexer、恢复原 statusLine、移除配置。已重构 `src-tauri/src/window/claude_global.rs`：`ensure_global_bridge()` 改为只写 AppData bridge 脚本并安装 hooks，保留已有 `statusLine`；新增 `enable_status_line_bridge()`、`restore_status_line()`、`remove_global_bridge_hooks()`；状态 DTO 增加 compatibility mode、statusLine owner/current command、enhanced capture、hooksInstalled、upstream command、canRestore 等字段。`src-tauri/src/lib.rs` 已注册对应 Tauri commands。前端 `src/app/overlayBridge.ts` 增加新类型字段和 invoke wrappers；`src/components/settings/SettingsView.tsx` 将原 Global Bridge 区升级为 Claude Code Compatibility 面板，可检查 settings、安装/修复 hooks-only、启用增强采集、恢复原 statusLine、移除 Claude HUD One hooks，并展示 owner/mode/upstream/backup 等信息。项目级 `.claude/settings.json` 已移除 `statusLine`，只保留 hooks，避免本仓库继续覆盖用户级 Claude HUD Plus；同时已即时把用户级 `C:\Users\Yue\.claude\settings.json` 恢复为 HUD Plus statusLine + Claude HUD One hooks-only（备份 `settings.json.bak-20260610-091444`），不修改凭据/连接环境变量。已执行 `node --check .claude\\bridge\\claude-status-bridge.mjs`、`npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1` 通过。用户确认测试流程后，已采用低资源参数 `CARGO_BUILD_JOBS=1`、`CARGO_PROFILE_RELEASE_OPT_LEVEL=1`、`CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16` 重新运行 `npm run tauri:build`，产出 hooks-only 兼容版安装包：`src-tauri\\target\\release\\bundle\\nsis\\Claude HUD One_0.1.0_x64-setup.exe`（SHA256 `B59810693CF99E22F254C624AEA2B16879342ED9323133CF6FDE85038D4AFDFA`）和 `src-tauri\\target\\release\\bundle\\msi\\Claude HUD One_0.1.0_x64_en-US.msi`（SHA256 `4DA8CA5A8F22D9156F0221CD8089ED542F1ABCE123FA06DAF1393A002BA45A56`）。未跑完整 smoke；建议用户先退出旧版 Claude HUD One，再运行 `/claude-hud-plus:setup`，安装新版后验证 Settings 的 Claude Code Compatibility 显示 hooks-only / HUD Plus owner / 7 hooks。
- 2026-06-10：用户转述 Gemini 排查结果，指出 Win11 扩展显示器模式下某些软件的某些区域点击无反应，复制模式正常，怀疑 Claude HUD One 悬浮窗偶发透明遮罩。已定位当前实现风险：主 overlay 是 900×520 透明 always-on-top WebView，依赖 JS hit region + 50ms 轮询 cursor 动态切换 `WS_EX_TRANSPARENT`；在扩展屏/混合 DPI/虚拟桌面坐标下，如果 hit region 错位、为空、过期或轮询状态滞后，就可能让透明 WebView 保持非穿透并吞掉底层点击。已在 `src-tauri/src/window/overlay.rs` 做最小可靠修复：默认 hit regions 为空、默认 click-through=true，配置窗口时先应用穿透；轮询间隔改为 25ms，任何无法确认命中/锁失败/Win32 查询失败都 fail-open 穿透；移除固定默认 hit region 兜底；在 Win32 subclass 中新增 `WM_NCHITTEST` 处理，非命中 UI 区域返回 `HTTRANSPARENT`，命中区域返回 `HTCLIENT`，保留 `WM_MOUSEACTIVATE -> MA_NOACTIVATE`。`src-tauri/src/lib.rs` 已把 `OverlayTracker` 传入 overlay 配置。已执行 `cargo check --manifest-path src-tauri\\Cargo.toml -j 1` 通过。未重新打包；若用户验证仍有少量错位阻挡，下一步再做动态缩小主窗口尺寸和统一 DPI 坐标换算。
- 2026-06-10：用户要求检查并先清理 `C:\Users\Yue\.claude\settings.json` 中属于 Claude HUD One/本项目的配置，方便重新安装后测试。已识别并仅移除两类 Claude HUD One 项：`env.CLAUDE_HUD_ONE_HUD_PLUS_TIMEOUT_MS` 和 7 个 hooks 中指向 `%APPDATA%\\Claude HUD One\\bridge\\claude-status-bridge.mjs --hook` 的命令；保留 Claude HUD Plus statusLine、`enabledPlugins.claude-hud-plus@claude-hud-plus`、token/base url、模型、代理、权限和其他插件配置。清理前已备份到 `C:\Users\Yue\.claude\settings.json.bak-claude-hud-one-clean-20260610-094358`。清理后确认 `settings.json` 不包含 `claude-status-bridge.mjs` 或 `CLAUDE_HUD_ONE_HUD_PLUS_TIMEOUT_MS`，当前 `statusLine` 仍为 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Yue\.claude\plugins\claude-hud-plus\statusline.ps1"`。
- 2026-06-10：用户追问 Windows 卸载程序是否会清理 Claude HUD One 写入的 hooks/settings/AppData bridge/session/settings 文件。已确认旧版卸载程序没有该清理能力。已新增 `src-tauri/resources/cleanup-claude-hud-one.ps1`，卸载时备份并清理 `~/.claude/settings.json` 中 Claude HUD One hooks、`CLAUDE_HUD_ONE_HUD_PLUS_TIMEOUT_MS`，若 statusLine 仍指向 Claude HUD One bridge 则优先恢复 `%APPDATA%\\Claude HUD One\\bridge\\upstream-statusline.json` 中保存的原命令，否则移除 Claude HUD One statusLine；同时删除 HKCU Run 启动项 `Claude HUD One` 与 `%APPDATA%\\Claude HUD One` 应用数据目录。脚本不删除 Claude HUD Plus、token/base url/model/proxy/其他插件或 Claude transcripts。已新增 `src-tauri/installer-hooks.nsh`，通过 NSIS `NSIS_HOOK_PREUNINSTALL` 调用清理脚本；`src-tauri/tauri.conf.json` 已把 `resources/cleanup-claude-hud-one.ps1` 打包进安装目录并接入 `bundle.windows.nsis.installerHooks`。由于 MSI 尚未接入 WiX CustomAction，当前 bundle targets 临时收敛为 `['nsis']`，`scripts/smoke.ps1` 和 `.github/workflows/release.yml` 也同步改为只校验 NSIS，避免用户误用旧 MSI。已执行清理脚本语法解析、`npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1` 通过；随后低资源 `npm run tauri:build` 成功，仅产出 NSIS：`src-tauri\\target\\release\\bundle\\nsis\\Claude HUD One_0.1.0_x64-setup.exe`（SHA256 `9882C41AC78A236DB8A867D0FB1919D6C91A10B81604F2A322E9597F72889933`）。`bundle/msi` 目录中仍有旧 MSI 文件但本次未更新，不能用于卸载清理测试。
- 2026-06-10：用户重新安装后反馈 Settings 设置页点击后空白，找不到 Claude Code Compatibility 配置。已定位第一轮根因是 settings 窗口与浏览器测试路径不一致：测试使用 `?window=settings`，但打包后的 Tauri settings 窗口没有显式 URL，只依赖前端模块加载时读取 `getCurrentWindow().label`；真实多窗口加载时该判断不够稳，可能误判为 main 并渲染透明主 HUD，表现为设置窗口白屏/空白。第一轮已修复 `src-tauri/tauri.conf.json`、`src/app/App.tsx` 和 `src/components/settings/SettingsView.tsx`，并产出 NSIS（SHA256 `31A72BAAEA884F93B6050E70E5A4A3DA9B2F899924C4DF66565A4C08E6C642C2`）。用户再次验证仍为空白后继续复核，发现更直接的问题：Tauri v2 的 `WebviewUrl::App` 是 `PathBuf`，`index.html?window=settings` 会被当作文件路径而不是 URL query，生产包可能加载不到页面；同时当前本机仍有安装目录 `D:\software_in\Claude HUD One\claude-hud-one.exe` 进程在运行，单实例会导致重新点击新版时仍使用旧进程。已改为真正的多页入口：新增 `settings.html`，Vite `base: './'` 并配置 `index.html/settings.html` 双入口，dist 产物使用相对资源路径；Tauri main/settings 窗口分别加载 `index.html` 和 `settings.html`，不再使用 query；`index.html/settings.html` 通过 `meta[name=claude-hud-one-window]` 明确声明窗口类型，前端按 meta/query/path/Tauri label 顺序判定；根组件增加错误边界，Settings 即使渲染异常也显示错误而非纯白；Settings CSS 增加高度兜底。NSIS hook 也新增 `NSIS_HOOK_PREINSTALL`，安装/卸载前先停止仍在运行的 `claude-hud-one.exe`，避免旧进程驻留导致新包没有生效。已执行 `npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run check:version`、`npm run test:ui`（3 passed）通过，并确认 `dist/index.html` 与 `dist/settings.html` 都生成且资源路径为 `./assets/...`；随后低资源 `npm run tauri:build` 成功，仅产出 NSIS：`src-tauri\\target\\release\\bundle\\nsis\\Claude HUD One_0.1.0_x64-setup.exe`（SHA256 `8678A37B7B94EF0E7C63D3F3E69070568C1077A0B4300BA925A6444DCF8BE74A`）。
- 2026-06-10：用户截图显示 Settings 已不再纯白，而是错误边界提示 `Cannot read properties of undefined (reading 'width')`。已定位根因是 Rust `DisplayInfo` 默认按 snake_case 序列化，`list_displays` 返回 `work_area/scale_factor/is_primary`，而前端 Settings 按 camelCase 读取 `display.workArea.width/display.scaleFactor/display.isPrimary`，导致显示器下拉选项渲染崩溃。已在 `src-tauri/src/window/display.rs` 给 `DisplayInfo` 加 `#[serde(rename_all = "camelCase")]`，并在 `src/app/overlayBridge.ts` 增加 `RawDisplayInfo` 归一化，兼容旧的 snake_case 与新的 camelCase 输出，`workArea` 缺失时回退 `bounds`，避免再次因字段缺失白屏。已执行 `npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run check:version`、`npm run test:ui`（3 passed）通过；随后低资源 `npm run tauri:build` 成功，仅产出 NSIS：`src-tauri\\target\\release\\bundle\\nsis\\Claude HUD One_0.1.0_x64-setup.exe`（SHA256 `3A1B64F6DD05F585C6454C6DDF41CF8055A8082E8C3D1E2F11D54844A748058C`）。
- 2026-06-10：用户反馈 Settings 页面布局拥挤混乱，且切换语言后设置页文案不变化。已重设计 `src/components/settings/SettingsView.tsx` 与 `src/styles.css`：将设置页改为偏好设置、外观、位置、提醒与数据源、Claude Code 兼容配置、更新、诊断等卡片化信息架构；语言入口前置到第一屏；select 改为整行布局，按钮/胶囊组和操作区支持自动换行，增加小宽度 media query，去除横向滚动；高级诊断信息压缩为更规整的 key-value 卡片。已接入轻量 Settings i18n：根据 `state.settings.language` 解析 `auto/en/zh-CN`，设置页标题、分组、按钮、说明、状态标签会在中英文间即时切换，不引入第三方依赖，不改变 settings 存储结构。UI 测试同步改为访问 `settings.html` 并验证中文默认文案与切换英文后的 `Updates/Refresh now`。已执行 `npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run check:version`、`npm run test:ui`（3 passed）通过；随后低资源 `npm run tauri:build` 成功，仅产出 NSIS：`src-tauri\\target\\release\\bundle\\nsis\\Claude HUD One_0.1.0_x64-setup.exe`（SHA256 `F747F55431EF7302497CA5E1F4ADC4CE9390D0A7EED4F67F57F56BB218D13DF9`）。
- 2026-06-10：用户进一步要求 Settings 不要像网页一样横向滑动，参考开源 CC Switch 的设置窗口风格，改为固定宽度、可调高度、顶部 tab、内容区纵向滚动。已通过 WebSearch/WebFetch 定位 CC Switch 项目 `farion1231/cc-switch`，确认其 Settings 使用 Tauri + React + 顶部 6 tab + `overflow-y-auto overflow-x-hidden` 的结构。已将 `src/components/settings/SettingsView.tsx` 改为 6 个顶部 tab：通用、外观、位置、Claude、更新、关于；每个 tab 只渲染当前面板，内容区 `settings-content` 纵向滚动且隐藏横向溢出；语言切换改为类似 CC Switch 的分段按钮；`src/styles.css` 按 CC Switch 参考图改为深色桌面设置窗口、顶部标题/返回按钮/tab 条、扁平 section 与 option pill；`src-tauri/tauri.conf.json` 将 settings 窗口改为固定宽度 960px（`minWidth=maxWidth=960`）、高度 660px 且可调高度（`minHeight=560`）。UI 测试已更新为验证 tab 导航、中文/英文切换和 About/Updates 内容。已执行 `npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run check:version`、`npm run test:ui`（3 passed）通过；随后低资源 `npm run tauri:build` 成功，仅产出 NSIS：`src-tauri\\target\\release\\bundle\\nsis\\Claude HUD One_0.1.0_x64-setup.exe`（SHA256 `7432F44DA9D7051B972398472F9F59446A2396DD224134C98CAA3F1CC9765541`）。
- 2026-06-10：用户提出把自己开发的 `E:\\Develop_E\\claude-hud-plus` 终端 HUD 能力内置到 Claude HUD One，以解决两个独立 statusLine 产品同时安装时的兼容复杂度。已按工作日志续接后并行只读研究当前 Island bridge/global settings/状态池、Claude HUD Plus 终端渲染/配置/控制台能力，以及两者的集成边界；未读取 prompt、tool-result、transcript 正文或凭据。已新增分析文档 `local\\需求讨论\\2026-06-10-claude-hud-one-内置claude-hud-plus终端hud集成分析.md`，结论为：值得做，但推荐“Claude HUD One Bridge Core 统一 statusLine owner + 内置/复用 HUD Plus terminal renderer + 桌面悬浮窗消费脱敏 shared state + shared/terminal/desktop 分层配置”，不建议全量硬合并或重写终端渲染。已同步更新 `.claude\\workspace-index.md` 的 `local/需求讨论/` 入口。
- 2026-06-10：用户对上一版报告提出 6 条新约束：HUD Plus 现在支持展示的所有信息新项目都要支持；HUD Plus 的 UI 可视化样式配置要进入新项目 Settings 独立 tab；不考虑历史迁移，配置冲突直接覆盖；不考虑恢复 Claude HUD Plus；shared 给桌面端字段也要可配置，未来支持自定义桌面悬浮窗展示项；项目需改成带 HUD 的新名字。已再次并行只读研究 HUD Plus 全量展示项/配置项、当前 Island 固定桌面展示模型与可配置 schema、项目命名方案；已将分析文档改写为 v2：推荐新产品名 `Claude HUD One`（副标题 `HUD Suite for Claude Code on Windows`），目标架构调整为 Terminal HUD parity + Settings Studio 独立 Terminal HUD tab + Desktop HUD display item registry + Claude HUD One 直接接管 statusLine/hooks/default config，不再设计历史迁移或外部 HUD Plus 恢复。未修改产品代码，未执行构建。
- 2026-06-10：用户进一步确认项目名必须同时包含 `Claude` 与 `HUD`，因为工具专注 Claude Code 使用。已修订分析文档命名章节和标题，最终推荐从 `Claude HUD One Desk` 调整为 `Claude HUD One`，副标题改为 `Terminal & Desktop HUD Suite for Windows`，仓库名建议 `claude-hud-one`，备选调整为 `Claude HUD Suite`、`Claude HUD Desk`、`Claude HUD Plus Desk`；同时将文档内 `Claude HUD One Bridge/owner` 统一改为 `Claude HUD One Bridge/owner`。
- 2026-06-10：用户要求了解 `local\\需求讨论\\2026-06-10-claude-hud-one-内置claude-hud-plus终端hud集成分析.md` 并按工作区技能要求开始开发处理。已确认本轮从只读方案进入实现阶段，续接本记录而非新建记录；计划先并行侦察当前仓库与 `E:\\Develop_E\\claude-hud-plus`，再落地 Phase 0 技术基座：Normalized HUD State、Field Schema、Display Item Registry、Terminal/Desktop config、Terminal HUD parity matrix 与 Settings Studio 首批入口；暂不读取 prompt/tool-result/transcript 正文或凭据。

## 2026-06-10 HUD Plus 内置集成 clear-thinking 摘要

- 真实目标：把当前项目从“桌面动态岛 + 外部 HUD Plus 兼容”升级为一个新 HUD 套件：完整内置 Claude HUD Plus 的 Terminal HUD 能力，同时让 Desktop HUD 展示项也可配置。
- 主要矛盾：上一版为了安全兼容保留迁移/恢复/外部委托，但用户现在要新产品直接接管、覆盖冲突、完整复刻 HUD Plus 展示与配置能力；报告必须从兼容策略转向一体化产品架构。
- 本轮最小行动：补齐 HUD Plus 全量展示项/配置项、桌面可配置字段 schema 和命名方案研究，并把原分析文档改写为 v2。
- 验收方式：文档逐条回应 6 个新约束，明确 Terminal HUD parity、Settings 独立 Terminal HUD tab、配置冲突覆盖、无恢复路径、Desktop HUD display item registry、项目命名建议。
- 风险/失败信号：若仍强调历史迁移/恢复、只支持 HUD Plus 部分展示项、或桌面端仍固定信息项，就偏离用户新方向；若字段配置绕过隐私 allowlist，也会带来隐私风险。
- 是否需要 Workflow：本轮仍是分析文档修订，用户未显式要求 workflow，未使用 Workflow。
- 是否需要子代理：已使用 3 个只读子代理，分别盘点 HUD Plus 全量展示/配置、设计桌面可配置字段 schema、提出新项目命名。
- 是否需要更新索引/沉淀资产：沿用同一长期分析文档，路径未变；工作区索引已覆盖该入口，无需再次调整。

## clear-thinking 摘要

- 真实目标：不是做一个轻量 HUD 原型，而是在 Win11 上正式发布 `codex-island` 的完整复刻版，并保留 Claude Code 实时状态增强。
- 主要矛盾：旧方案为了降低一期风险做了 MVP 裁剪，但用户现在明确要求参考项目已有功能一期全覆盖；需要把“降范围”改为“完整复刻 + 风险分阶段验证”。
- 本轮最小行动：新增一份正式一期复刻方案作为主依据，同时标注旧文档的 MVP 结论已失效。
- 验收方式：文档必须覆盖参考项目功能矩阵、Windows 等价实现、数据源、UI/设置、性能、隐私、发布、里程碑和验收标准。
- 风险/失败信号：若仍把 Usage/Cost/Codex/OAuth usage/自动更新放到后续，就与用户范围冲突；若不标注 Windows 凭据和窗口层实测风险，会误导开发排期。
- 是否需要 Workflow：任务具备多材料与多阶段特征，但用户未明确授权 workflow 工具；本轮采用多个子代理并行分析。
- 是否需要子代理：已使用多个子代理并行补全功能盘点、数据源、Windows 实现和旧文冲突复核。
- 是否需要更新索引/沉淀资产：已新增长期方案文档并更新工作区索引。

## 检查

- 需求覆盖：已按最新要求覆盖参考项目已有功能一期完整复刻、正式产品发布标准、Win11 等价实现、UI 展示效果、实时性、CPU/内存控制、可视化设置、Claude/Codex 数据源、成本扫描、低功耗、告警、隐私和自动更新。
- 产物路径：
  - 新主文档：`local\需求讨论\2026-06-08-win11-codex-island-full-replica-一期正式产品方案.md`
  - 已加范围修订提示的旧文档：`local\需求讨论\2026-06-08-win11-claude-code-status-hud-需求讨论.md`
  - 已更新索引：`.claude\workspace-index.md`
- 验证情况：已成功写入新方案文档；已更新旧文档范围提示；已更新工作区索引；已执行 `npm install`、`npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml -j 1`、`npm run tauri -- info`、`npm run tauri:build`，前端与 Tauri release 构建通过；已产出 `src-tauri\target\release\claude-hud-one.exe`、`src-tauri\target\release\bundle\nsis\Claude HUD One_0.1.0_x64-setup.exe`、`src-tauri\target\release\bundle\msi\Claude HUD One_0.1.0_x64_en-US.msi`；release exe 冒烟启动后保持运行；Win32 overlay 样式、动态点击穿透、显示器基础命令、多区域 hit-test、Settings 独立窗口、全屏避让基础检测、当前 Claude Code 会话摘要扫描、原生配置、开机启动、托盘、诊断目录打开、本地 Usage/Cost 聚合与 last-known-good 缓存、`WM_MOUSEACTIVATE` 鼠标激活守卫、target display/top offset 生效、updater 状态预留、Playwright UI 冒烟截图验收接入后均已重新构建并通过验证；最新 `npm run smoke` 已完整通过前端 build、Rust check、UI 截图、Tauri release build 和 release exe 8 秒存活冒烟。
- 风险：hit-test 仍采用 50ms cursor polling，`WM_MOUSEACTIVATE` 已接 subclass 但仍需真实前台应用交互人工验收；多 DPI 已做前端 `devicePixelRatio` 基础修正和显示器列表/offset 定位，但仍需实机矩阵；全屏避让当前是前台窗口矩形覆盖显示器 bounds 的基础启发式，需对游戏独占全屏、无边框全屏、多屏不同 DPI 继续验证；本地 Usage/Cost 聚合当前从日志结构化 token 字段推导，成本是本地估算值，官方 Claude/Codex usage endpoint、凭据刷新和账单对账仍需后续实测；Codex session 路径已按 Windows 常见目录扫描，但真实 Codex 字段结构仍需实测；updater 目前是状态预留，真实自动更新仍需要 endpoint、签名 key 和发布源；代码签名、SmartScreen 需要外部证书和发布阶段验证。
- 结论：部分完成但已具备可本地试用的 release 产物。Rust/Tauri 构建阻断已解除，开发骨架、mock UI、release exe 与 NSIS/MSI 打包已通过，并已接入第一层 Win32 overlay 样式、动态点击穿透、多区域 hit-test、显示器定位、Settings 独立窗口、全屏避让基础检测、当前 Claude Code 会话脱敏摘要、本地 Usage/Cost 聚合、原生配置持久化、开机启动、托盘、诊断目录打开、`WM_MOUSEACTIVATE` 鼠标激活守卫、target display/top offset 生效、updater 预留、UI 自动化截图验收和完整 smoke 验证；下一步继续做官方 Usage API/凭据链路、多屏 DPI 实机矩阵、真实自动更新/签名发布链路。

## 2026-06-10 HUD Plus 内置集成检查

- 需求覆盖：已按用户 6 条新约束修订报告：HUD Plus 全量展示能力必须覆盖；HUD Plus UI 可视化样式配置整合到 Settings 独立 Terminal HUD tab；不做历史迁移，配置冲突直接覆盖；不做外部 HUD Plus 恢复；shared 给桌面端的字段按 field schema / display item registry / layout slots 支持配置；项目名推荐改为 `Claude HUD One`。
- 产物路径：`local\\需求讨论\\2026-06-10-claude-hud-one-内置claude-hud-plus终端hud集成分析.md` 已覆盖为 v2；已更新本工作记录。`.claude\\workspace-index.md` 此前已包含该文档入口，本轮路径未变。
- 验证情况：本轮是只读研究与文档修订，未修改产品代码，未执行构建或 smoke；通过 3 个只读子代理补齐 HUD Plus 展示/配置清单、Desktop HUD 可配置 schema、项目命名建议，文档已成功写入。
- 风险与下一步：后续若进入实现，需先写 `NormalizedHudState` / `HudFieldSchema`、Terminal HUD parity matrix、Settings Studio tab 信息架构、Claude HUD One Bridge ownership/卸载清理策略；仍需避免桌面 GUI 进入 statusLine 热路径，并保持 desktop-safe field allowlist。
- 是否更新索引：本轮未新增新路径，`.claude\\workspace-index.md` 无需再次调整。
- 结论：已完成本轮报告修订；实现阶段未开始。

## 2026-06-10 Claude HUD One 命名统一

- 原始需求：用户最终确定项目名为 `Claude HUD One`，远程仓库将改为 `claude-hud-one`，要求修改当前工作区里相关的所有名称。
- 范围：本轮已统一产品显示名、包名/仓库 slug、Tauri product/identifier/window title、Rust crate/lib、Windows 单实例 mutex、AppData 目录、Bridge fallback/status/env 前缀、NSIS installer hook、卸载清理脚本、启动项名称、Release URL、前端标题/Settings 文案、UI 测试断言、README、工作区索引、工作日志索引与需求讨论文档路径；未重命名当前本地仓库根目录，等用户修改远程仓库信息后可按需本地重命名目录。
- 关键路径：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、`.claude/bridge/claude-status-bridge.mjs`、`src-tauri/src/window/claude_global.rs`、`src-tauri/resources/cleanup-claude-hud-one.ps1`、`src/components/settings/SettingsView.tsx`、`local/需求讨论/2026-06-10-claude-hud-one-内置claude-hud-plus终端hud集成分析.md`。
- 索引更新：已同步 `.claude/workspace-index.md` 中本地需求讨论入口；`.claude/skills/work-journal/resources/index.md` 已统一标题与备注中的新名称。
- 验证情况：已用全仓搜索确认旧名/候选名无残留；`npm run check:version` 通过；`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 通过；`npm run build` 通过；`npm run test:ui` 3 个 Playwright 用例通过。
- 复核情况：只读子代理复核关键配置与旧名残留，确认文件内容和关键命名整体一致；指出本地物理目录仍为旧 slug，以及 `.claude/workspace-index.md` 注释里的路径与实际目录不一致。已将 workspace-index 注释路径改为相对路径，避免元数据与目录名冲突；本地仓库目录名仍需在 Claude Code 进程外按需重命名。
- 本地目录重命名：用户表示无法手动操作后，曾尝试把旧物理目录改名为 `E:\Develop_E\claude-hud-one`，因 Windows 目录锁创建过临时延迟重命名脚本；用户确认目录已改好后，临时脚本与日志已删除。
- 结论：命名统一已完成并通过可执行验证；本地物理目录改名已进入自动重试等待状态，待当前目录锁释放后完成；后续若需要可重新打包 release 安装包。

## 2026-06-10 构建产物命名复查与清理

- 原始需求：用户已完成本地目录重命名后，要求继续检查所有文件和构建产物里是否还有旧品牌命名未改，特别关注 build / target 产物；无用旧产物可以删除。
- 范围：扫描仓库内容、忽略目录之外的构建产物、`dist`、`src-tauri/target`、`.claude/bridge/state` 运行状态文件；不删除源码、配置、文档或依赖目录。
- 清理：已执行 `cargo clean --manifest-path src-tauri\Cargo.toml` 清理旧 Rust/Tauri target 产物；已删除 `dist` 与 `.claude/bridge/state` 下旧运行状态，随后重新生成需要的构建产物。
- 验证：清理后首次全仓扫描 201 个文件，旧品牌命名残留为 0；重新执行 `npm run check:version`、`npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 均通过；随后执行 `npm run tauri:build` 成功生成 release exe 与 NSIS 安装包；重新扫描 6637 个文件、约 2269MB 内容，旧品牌命名残留为 0。
- 新产物：`src-tauri\target\release\claude-hud-one.exe`，SHA256 `76361B8BF23417693C07CB4E472B09872E254EB9442CCDE8E9BEE2090E71B114`；`src-tauri\target\release\bundle\nsis\Claude HUD One_0.1.0_x64-setup.exe`，SHA256 `B32ACF74A45ED6EE883E1078C7A844E0E1033C51905506FF4A245708875FC75A`。
- 结论：已完成构建产物级清理、重建和命名残留复查；当前仓库与重新生成的 build/target 产物中未发现旧品牌命名残留。

## 2026-06-10 HUD Plus 内置 Phase 0 开发处理

- 原始需求：用户要求了解 `local\\需求讨论\\2026-06-10-claude-hud-one-内置claude-hud-plus终端hud集成分析.md`，参考历史记录，按工作区技能要求开始开发处理。
- 范围：本轮不直接搬完整 HUD Plus renderer，不读取 prompt/tool-result/transcript 正文或凭据；先落地 Phase 0 技术基座和 Settings 入口，为后续 Terminal HUD parity、Desktop display registry、Settings Studio 继续开发提供稳定类型与配置承载。
- 计划执行：已通过工作区索引和工作日志索引续接本记录；并行只读侦察当前项目 Bridge/Settings/状态模型、`E:\\Develop_E\\claude-hud-plus` row item/config/schema/preview 能力，以及 Phase 0 文件落点；随后实现类型基座、默认配置、持久化和 UI 入口。
- 产物路径：新增 `src/hud/types.ts`、`src/hud/config.ts`、`src/hud/displayItemRegistry.ts`、`src/hud/fieldSchema.ts`、`src/hud/parityMatrix.ts`、`src/hud/normalize.ts`、`src/hud/index.ts`；新增 `src/components/settings/TerminalHudPanel.tsx`、`src/components/settings/DesktopHudPanel.tsx`、`src/components/settings/HudParityMatrixView.tsx`；修改 `src/app/types.ts`、`src/providers/mockData.ts`、`src/stores/useIslandStore.ts`、`src/app/App.tsx`、`src-tauri/src/window/settings.rs`、`src/components/settings/SettingsView.tsx`、`src/styles.css`、`tests/ui.spec.ts`。
- 关键实现：`SettingsState` 新增 `terminalHud` / `desktopHud`；前端 store 增加嵌套 settings 深合并，避免旧 localStorage 或 partial patch 丢默认值；Rust `AppSettings` 以 `serde_json::Value` 保存 `terminalHud` / `desktopHud`，降低 TS/Rust schema 漂移风险；Settings 新增 `终端 HUD` 与 `桌面 HUD` tab，展示默认 rows、首批 config schema 数量、display item registry 数量与 parity matrix；UI 测试覆盖新增 tab。
- 验证情况：`npm run build` 通过；`cargo check --manifest-path src-tauri\\Cargo.toml -j 1` 通过；`npm run test:ui` 通过（3 passed）；`npm run check:version` 通过；`npm run test:rust` 通过（usage_cost 5 passed）。本轮未执行完整 `npm run smoke`，也未重新生成 NSIS 安装包。
- 风险与下一步：当前只是 Phase 0 基座，Terminal HUD 真实 statusLine renderer 尚未内置接管；Desktop HUD 仍未按 registry 动态生成主 UI；后续应继续把 `NormalizedHudState` 转换为 HUD Plus `RenderContext`、迁入/适配 terminal renderer 与 preview、补 rows builder/color/activity/git schema，并保持 desktop-safe allowlist 与 statusLine 热路径不依赖 GUI。
- 是否更新索引：本轮新增的是源码与 Settings 面板，不是长期资料入口；`.claude/workspace-index.md` 无需更新。
- 结论：部分完成。Phase 0 技术基座和首批 Settings 入口已完成并通过轻量验证；完整内置 Claude HUD Plus terminal renderer 与可配置 Desktop HUD 生成仍待后续阶段。

## 2026-06-10 HUD Plus 内置 Phase 1/2 持续开发

- 原始需求：用户要求继续执行直到整个任务完成，中途遇问题自行找解决方案、规划并处理。
- 范围：继续在不读取 prompt/tool-result/transcript 正文或凭据的前提下推进内置 Terminal HUD 和 Desktop registry 消费；本轮优先让 statusLine 热路径具备内置 renderer，让 Settings 能预览 Terminal HUD，并让 Desktop HUD 配置实际影响 compact/peek/expanded 展示。
- 产物路径：修改 `.claude/bridge/claude-status-bridge.mjs`；新增 `src/hud/terminalRenderer.ts` 并从 `src/hud/index.ts` 导出；修改 `src/components/settings/TerminalHudPanel.tsx`、`src/components/settings/SettingsView.tsx`、`src/components/island/IslandRoot.tsx`、`src/components/island/CurrentSessionStrip.tsx`、`src/styles.css`、`tests/ui.spec.ts`。
- 关键实现：bridge 新增内置 Terminal HUD renderer，直接从脱敏 `nextState` 渲染 model/context/project/tools/activity/sessionTokens/usage/cost/duration/outputStyle/version/effort/customLine，默认优先输出内置 Terminal HUD，renderer 失败或 `terminalHud.enabled=false` 时回退 upstream/HUD Plus/compact fallback；保留 `CLAUDE_HUD_ONE_PREFER_UPSTREAM_STATUSLINE=1`、`CLAUDE_HUD_ONE_TERMINAL_HUD=0`、`CLAUDE_HUD_ONE_NO_COLOR=1`、`CLAUDE_HUD_ONE_TERMINAL_MAX_WIDTH` 调试开关；Terminal Settings 增加安全预览和常用信息项开关；Desktop HUD 消费 `desktopHud.defaultPage` 与 `desktopHud.visibleItems`，可控制 Usage/Cost 页可见性、默认展开页、compact/peek ticker 与 CurrentSessionStrip 中 activity/project/tools/model/context/sessionTokens 字段。
- 验证情况：`node --check .claude\\bridge\\claude-status-bridge.mjs` 通过；bridge 样例 stdin 可输出内置 Terminal HUD 多行状态；`npm run build` 通过；`cargo check --manifest-path src-tauri\\Cargo.toml -j 1` 通过；`npm run test:ui` 通过（4 passed，覆盖 Desktop defaultPage/visibleItems 与 Terminal preview）；`npm run check:version` 通过；`npm run test:rust` 通过（usage_cost 5 passed）。本轮未执行完整 `npm run smoke`，未重新打包 NSIS。
- 风险与下一步：当前内置 renderer 仍是安全最小版，未完全迁入 HUD Plus 的 git/addedDirs/promptCache/memory/environment/agents/todos/sessionTime/ANSI 宽度与 color workbench 全能力；Terminal Settings 仍未实现 rows builder、color workbench、JSON/diff/validate；Desktop HUD 已消费部分 registry，但主 UI 还不是完全由 registry 动态生成。下一步应继续补 rows builder/preview validate、迁入更多 HUD Plus renderer 能力和配置项，并在稳定后执行完整 smoke 与打包验证。
- 是否更新索引：本轮新增的是源码能力与测试，不是长期资料入口；`.claude/workspace-index.md` 无需更新。
- 结论：部分完成。内置 Terminal HUD statusLine 最小闭环、Terminal Settings 预览和 Desktop registry 初步消费已完成并通过轻量验证；全量 HUD Plus parity 和完整 Settings Studio 仍需继续推进。

## 2026-06-10 Bridge ownership 策略调整

- 原始需求：继续推进完整任务，按新产品方向不再把 Claude HUD Plus 视为外部主 statusLine，需要 Claude HUD One 作为统一 Bridge owner。
- 范围：调整全局 bridge 安装/修复策略、Settings 文案和卸载清理边界；本轮不直接修改当前用户级 `C:\\Users\\Yue\\.claude\\settings.json`，只修改产品代码，待安装/启动或用户点击修复时生效。
- 产物路径：`src-tauri/src/window/claude_global.rs`、`src-tauri/resources/cleanup-claude-hud-one.ps1`、`src/components/settings/SettingsView.tsx`。
- 关键实现：`ensure_global_bridge()` 从 hooks-only preserved statusLine 改为直接写入 Claude HUD One statusLine owner + hooks，并将旧 statusLine 仅作为内部诊断备份保存；`enable_status_line_bridge()` 改为修复 statusLine owner；`restore_status_line()` 改为仅移除 Claude HUD One statusLine，不再恢复外部 upstream；状态模式新增/切换为 `owner` / `statusline-owner`；Settings 文案从 Compatibility 改为 Claude Code Bridge/owner；卸载脚本命中 Claude HUD One statusLine 时只移除自身 statusLine，不恢复 HUD Plus 或其他外部 statusLine。
- 验证情况：`npm run build` 通过；`cargo check --manifest-path src-tauri\\Cargo.toml -j 1` 通过；卸载脚本 PowerShell 语法解析通过；`npm run test:ui` 通过（4 passed）；`npm run check:version` 通过；`npm run test:rust` 通过（usage_cost 5 passed）；`node --check .claude\\bridge\\claude-status-bridge.mjs` 通过。
- 风险与下一步：当前代码方向已切为 Claude HUD One owner，但 UI 仍保留“移除 Claude HUD One statusLine/移除 hooks”维护按钮，便于清理自身配置；还需继续补 Terminal HUD 完整 rows builder、color workbench、JSON/diff/validate，以及更多 HUD Plus row item 的真实渲染 parity。
- 是否更新索引：本轮未新增长期资料入口，`.claude/workspace-index.md` 无需更新。
- 结论：部分完成。Bridge owner 代码路径、Settings 文案和卸载边界已按新产品方向调整并通过验证；Terminal HUD parity 和 Settings Studio 全量能力继续推进。

## 2026-06-10 Terminal Settings Studio 增强

- 原始需求：继续推进直到完整任务完成，Terminal HUD Settings 需要从静态入口升级为可配置工作台。
- 范围：本轮补 Terminal HUD 的基础 rows builder、JSON 编辑/validate/apply/reset default、预览与常用 item 开关；不实现拖拽排序、不实现颜色工作台、不实现完整 HUD Plus preview parity。
- 产物路径：`src/components/settings/TerminalHudPanel.tsx`、`src/styles.css`、`tests/ui.spec.ts`。
- 关键实现：Terminal HUD tab 支持添加/删除 row、在 row 内添加/移除已登记 terminal display item；新增 JSON editor，可 validate `rows` 和 `display` 基本结构后应用到 `terminalHud`，并支持重置 `DEFAULT_TERMINAL_HUD_CONFIG`；预览继续使用 `renderTerminalHudPreviewLines` 从 `NormalizedHudState` 和当前 config 生成安全文本；UI 测试新增 rows builder 与 JSON editor 断言。
- 验证情况：`npm run build` 通过；`npm run test:ui` 通过（4 passed）；`npm run check:version` 通过；`cargo check --manifest-path src-tauri\\Cargo.toml -j 1` 通过。
- 风险与下一步：rows builder 仍是基础按钮/select 版本，不支持拖拽；JSON validate 只做结构级校验，未做全 schema 诊断；下一步应补 color workbench、config diff、更多 HUD Plus item 的 renderer parity 与 Terminal diagnostics。
- 是否更新索引：本轮未新增长期资料入口，`.claude/workspace-index.md` 无需更新。
- 结论：部分完成。Terminal Settings 已具备 rows builder、JSON validate/apply/reset 和安全预览；完整 HUD Plus UI 配置工作台仍需继续推进。

## 2026-06-10 Terminal Color Workbench 基础接入

- 原始需求：继续推进直到完整任务完成，Terminal HUD Settings 需要补齐 Claude HUD Plus 风格配置能力，先让颜色和进度条字符可配置并进入 bridge/preview 热路径。
- 范围：本轮接入 Terminal HUD 基础 color config、Settings Color Workbench UI、bridge 内置 renderer 颜色输出和安全预览进度条字符；不读取 prompt/tool-result/transcript 正文或凭据，不实现完整 HUD Plus theme/band/ANSI 宽度 parity。
- 产物路径：`src/hud/config.ts`、`src-tauri/src/window/settings.rs`、`.claude/bridge/claude-status-bridge.mjs`、`src/hud/terminalRenderer.ts`、`src/components/settings/TerminalHudPanel.tsx`、`src/styles.css`、`tests/ui.spec.ts`。
- 关键实现：`TerminalHudConfig` 新增 `colors`，覆盖 model/project/context/usage/warning/critical/label 颜色和 barFilled/barEmpty 字符；前端 merge、Rust 默认 settings 和 bridge 默认 config 同步；bridge 通过 `#RRGGBB` 转 ANSI truecolor，并按 context/usage/warning/critical/label 应用主题色；Settings Terminal HUD tab 新增 Color Workbench，可用 color input 修改主题色，用文本框修改进度条填充/空位字符；preview renderer 使用配置后的 bar 字符。
- 验证情况：`node --check .claude\bridge\claude-status-bridge.mjs` 通过；bridge 样例 stdin 在 `CLAUDE_HUD_ONE_NO_COLOR=1` 下可输出内置 Terminal HUD 多行状态且使用配置后的 bar 字符；`npm run build` 通过；`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 通过；`npm run test:ui` 通过（4 passed，覆盖 Color Workbench 入口）。本轮未执行完整 `npm run smoke`，未重新打包 NSIS。
- 风险与下一步：Color Workbench 仍是基础版，尚未实现 HUD Plus 完整 theme palette、usage/context bands、颜色预设导入导出、ANSI/CJK display width 细节和 runtime diagnostics；下一步继续补更多 HUD Plus item parity 与 Settings 诊断/差异化配置。
- 是否更新索引：本轮新增的是源码、测试和既有工作记录更新，不是长期资料入口；`.claude/workspace-index.md` 无需更新。
- 结论：部分完成。Terminal Color Workbench 基础能力已接入配置、Settings、bridge 输出和 preview，并通过轻量验证；完整 HUD Plus UI 配置 parity 仍需继续推进。

## 2026-06-10 Terminal parity 基础项补齐

- 原始需求：继续推进完整内置 Claude HUD Plus 终端 HUD 能力，优先缩小 display registry/parity matrix 与实际 renderer 之间的差距。
- 范围：本轮补齐不依赖敏感正文读取的基础项：`addedDirs`、`git`、`promptCache`、`agents`、`todos`、`sessionTime`、`speed` 的 bridge/normalize/preview/terminal renderer 通路；继续不读取 prompt、tool input、tool result、transcript 正文或凭据。`git` 只通过短超时 `git` 元信息命令读取 branch/dirty/ahead/behind，不读取文件内容。
- 产物路径：`.claude/bridge/claude-status-bridge.mjs`、`src/app/types.ts`、`src/providers/claudeCodeSummary.ts`、`src/hud/types.ts`、`src/hud/normalize.ts`、`src/hud/terminalRenderer.ts`、`src/components/settings/TerminalHudPanel.tsx`。
- 关键实现：bridge 写入脱敏 added dir basename、git summary、session start/last response、output speed、agents/todos 聚合计数字段；前端 `NormalizedHudState` 增加 workspace/session/activity 扩展字段；Terminal preview renderer 补齐新增 item case；Settings Terminal HUD 常用开关扩展到 addedDirs、agents、todos、promptCache、duration、speed、outputStyle、version、session time 等；bridge 内置 renderer 默认 rows 与 TS/Rust 默认 rows 对齐为 `model/context`、`project/addedDirs/git`、`sessionTokens`、`activity`。
- 验证情况：`node --check .claude\bridge\claude-status-bridge.mjs` 通过；bridge 样例 stdin 输出包含 `dirs claude-hud-plus, other`、`git main*`、agents/todos summary；`npm run build` 通过；`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 通过；`npm run test:ui` 通过（4 passed）；`npm run check:version` 通过；`npm run test:rust` 通过（usage_cost 5 passed）。本轮未执行完整 `npm run smoke`，未重新打包 NSIS。
- 风险与下一步：agents/todos 仍以 hooks/statusLine 已提供的聚合字段或当前工具事件推断为主，尚未实现 HUD Plus 通过 transcript 元信息聚合的完整 parity；promptCache 依赖可用的 last assistant response timestamp；git 命令设置了短超时但仍需关注极慢仓库。下一步继续补完整 ANSI/CJK 宽度、usage/context bands、theme presets、Terminal diagnostics 和 Desktop item-driven layout。
- 是否更新索引：本轮新增的是源码与既有工作记录更新，不是长期资料入口；`.claude/workspace-index.md` 无需更新。
- 结论：部分完成。Terminal parity 基础项的安全数据通路与 renderer 已补齐并通过轻量验证；完整 HUD Plus parity、Settings diagnostics 和打包 smoke 仍需继续推进。

## 2026-06-10 HUD Field Schema 扩展

- 原始需求：继续把 HUD Plus 的可视化配置能力整合到 Claude HUD One Settings Studio，避免只停留在少量首批字段。
- 范围：扩展配置字段 schema 和 Settings 统计口径，覆盖 Terminal rows/layout/display/color/json 与 Desktop visible items；同步 registry/parity notes 以反映已补的安全投影字段。
- 产物路径：`src/hud/fieldSchema.ts`、`src/components/settings/TerminalHudPanel.tsx`、`src/components/settings/DesktopHudPanel.tsx`、`src/hud/displayItemRegistry.ts`、`src/hud/parityMatrix.ts`。
- 关键实现：`HUD_FIELD_SCHEMA` 新增 rows builder、row overflow/maxWidth/showSeparators、context/usage select、terminal display switches、color fields、bar chars、terminal JSON editor、desktop visibleItems 等条目；新增 `fieldSchemaBySurface()`，Terminal/Desktop Settings 面板按 surface 统计字段总数；display registry fieldKeys 更新为当前 `NormalizedHudState` 实际字段；parity matrix notes 更新 git/addedDirs/promptCache/agents/todos/sessionTime 的当前状态。
- 验证情况：`npm run build` 通过；`npm run test:ui` 通过（4 passed）；`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 通过。本轮未执行完整 `npm run smoke`，未重新打包 NSIS。
- 风险与下一步：field schema 已覆盖更多字段，但还没有自动生成完整表单；Terminal Settings 仍是手写 rows/color/json 区块。下一步应补 diagnostics、预设应用逻辑、config diff 和更完整的 Desktop item-driven layout。
- 是否更新索引：本轮新增的是源码与既有工作记录更新，不是长期资料入口；`.claude/workspace-index.md` 无需更新。
- 结论：部分完成。HUD Field Schema 已从首批字段扩展为较完整的 Terminal/Desktop 配置元数据；完整可视化表单生成和诊断闭环仍需继续推进。

## 2026-06-10 Terminal 配置诊断增强

- 原始需求：继续把 Terminal HUD Settings 从静态配置面板升级为可用的配置工作台，减少 rows/preset/JSON 配置误用。
- 范围：补 preset 实际应用、JSON rows unknown item 校验、colors object 校验、Terminal diagnostics 摘要；不引入拖拽排序或完整自动表单生成。
- 产物路径：`src/components/settings/TerminalHudPanel.tsx`、`tests/ui.spec.ts`。
- 关键实现：点击 `hud-plus-default` preset 会恢复默认 rows/display，点击 `minimal` preset 会切换为极简 rows 并关闭部分非必要信息项，`custom` 仅保留当前配置并标记 preset；JSON validate 增加 unknown row item 检查和 colors object 结构检查；Terminal tab 新增诊断区，展示 configured rows、configured items、unknown items、preview lines；UI 测试补充 Terminal 诊断区断言。
- 验证情况：`npm run build` 通过；`npm run test:ui` 通过（4 passed）；`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 通过。本轮未执行完整 `npm run smoke`，未重新打包 NSIS。
- 风险与下一步：preset 目前只内置 HUD Plus default/minimal/custom 三类，尚未支持用户自定义 preset 管理、配置 diff、schema 级所有字段校验和 runtime owner/bridge 诊断。
- 是否更新索引：本轮新增的是源码与测试，不是长期资料入口；`.claude/workspace-index.md` 无需更新。
- 结论：部分完成。Terminal Settings 已具备基础 preset 应用、unknown item 校验和诊断摘要；更完整的 Settings Studio 仍需继续推进。

## 2026-06-10 Desktop ticker/panel item 驱动接入

- 原始需求：shared 给桌面端的字段也要可配置，后续支持自定义桌面悬浮窗展示项；继续从固定 UI 过渡到 Display Item Registry 驱动。
- 范围：本轮让 `desktopHud.tickerItems` 和 `desktopHud.panelItems` 实际影响 compact/peek 文案与 expanded session metrics；接入已脱敏的 git/addedDirs/agents/todos/speed 字段展示。不改 Usage/Cost/Overview 主页面结构，不读取 prompt/tool-result/transcript 正文或凭据。
- 产物路径：`src/components/island/IslandRoot.tsx`、`src/components/island/CurrentSessionStrip.tsx`、`src/hud/config.ts`、`src-tauri/src/window/settings.rs`、`src/components/settings/DesktopHudPanel.tsx`、`src/hud/displayItemRegistry.ts`、`src/hud/parityMatrix.ts`、`src/providers/mockData.ts`、`tests/ui.spec.ts`。
- 关键实现：compact/peek ticker 改为按 `desktopHud.tickerItems` 顺序渲染可见 item；expanded `CurrentSessionStrip` metrics 改为按 `desktopHud.panelItems` 渲染；新增桌面 item label 支持 project/activity/model/tools/context/sessionTokens/cost/git/addedDirs/agents/todos/speed；默认 Desktop config 增加 git/addedDirs/agents/todos/speed 可见性，并默认 panelItems 为 context/tools/model/git/agents/todos；Desktop Settings 可见项清单扩展对应 item；mock data 和 UI 测试加入 `git main*` 验证。
- 验证情况：初次 `npm run build` 暴露 fallback item 类型推断问题，已修复；最终 `npm run build` 通过；`npm run test:ui` 通过（4 passed）；`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 通过。本轮未执行完整 `npm run smoke`，未重新打包 NSIS。
- 风险与下一步：Desktop 主面板仍不是完全自动布局生成，Usage/Cost/Overview 仍为固定页面；panelItems/tickerItems 尚缺 Settings 可视化排序器。下一步可补 Desktop layout builder、item ordering UI、更多 item 组件和完整 smoke/打包。
- 是否更新索引：本轮新增的是源码、测试和既有工作记录更新，不是长期资料入口；`.claude/workspace-index.md` 无需更新。
- 结论：部分完成。Desktop HUD 已从单纯 visibleItems 迈向 ticker/panel item-driven 展示；完整 Desktop layout builder 和自动化布局生成仍需继续推进。

## 2026-06-10 Terminal memory/environment parity 基础接入

- 原始需求：继续补齐 Claude HUD Plus 终端 HUD 展示项，优先实现不依赖 prompt/tool-result/transcript 正文读取的 memory 与 environment 基础能力。
- 范围：bridge 只采集系统内存聚合值和配置文件存在/数量统计，不读取文件正文、不读取 Claude settings 内容、不读取凭据；environment 统计范围包括全局/项目 `CLAUDE.md`、rules 目录条目、`.mcp.json` 和 settings 文件存在数量。
- 产物路径：`.claude/bridge/claude-status-bridge.mjs`、`src/app/types.ts`、`src/providers/claudeCodeSummary.ts`、`src/hud/types.ts`、`src/hud/normalize.ts`、`src/hud/config.ts`、`src-tauri/src/window/settings.rs`、`src/hud/terminalRenderer.ts`、`src/hud/fieldSchema.ts`、`src/hud/displayItemRegistry.ts`、`src/components/settings/TerminalHudPanel.tsx`、`src/providers/mockData.ts`。
- 关键实现：bridge 通过 Node `os.totalmem/freemem` 写入 memoryUsedPercent/Bytes/Total；通过 existence/readdir 统计 claudeMd/rules/mcp/hooks(settings 文件存在数)；Terminal renderer 增加 `memory` 与 `environment` item；`TerminalHudConfig.display` 新增 `showEnvironment`，Settings display switches 和 field schema 同步；NormalizedHudState 增加 `system` 分组；前端 preview 与 bridge statusLine renderer 均支持该 item。
- 验证情况：`node --check .claude\bridge\claude-status-bridge.mjs` 通过；bridge 样例 stdin 可继续输出内置 Terminal HUD，且未破坏 git/addedDirs/agents/todos 输出；`npm run build` 通过；`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 通过；`npm run test:ui` 通过（4 passed）；`npm run check:version` 通过。本轮未执行完整 `npm run smoke`，未重新打包 NSIS。
- 风险与下一步：environment 仍是安全基础统计，不读取 settings JSON，因此 hooks/MCP 不是 HUD Plus 的完整语义统计；memory/environment 默认关闭，需要用户在 Terminal Settings rows/display 中启用。下一步继续补 ANSI/CJK width、context/usage bands、theme presets、Desktop layout builder 和完整 smoke/打包。
- 是否更新索引：本轮新增的是源码与既有工作记录更新，不是长期资料入口；`.claude/workspace-index.md` 无需更新。
- 结论：部分完成。Terminal memory/environment 的安全基础 parity 已接入并通过轻量验证；完整 HUD Plus 语义统计和发布级 smoke 仍需继续推进。

## 2026-06-10 Terminal overflow/separator 基础接入

- 原始需求：继续补齐 HUD Plus terminal renderer parity，特别是 rows layout 的 overflow、宽度和 separator 行为。
- 范围：本轮让 bridge statusLine renderer 和 Settings preview 都消费 `showSeparators`、`maxWidth`、`rowOverflow=truncate|wrap`；改进 bridge 侧 ANSI/CJK 计宽截断，避免截断时直接丢掉颜色控制序列。未完整迁入 HUD Plus 的 OSC8 hyperlink 保留/闭合、grapheme cluster 和复杂 wrap 分段算法。
- 产物路径：`.claude/bridge/claude-status-bridge.mjs`、`src/hud/terminalRenderer.ts`。
- 关键实现：bridge 新增 ANSI-aware `truncateToWidth()` 与基础 `wrapLineToWidth()`，按 `terminalHud.showSeparators` 使用 ` │ ` 分隔 item；preview renderer 增加 CJK-aware width、truncate/wrap 和 separator；`CLAUDE_HUD_ONE_TERMINAL_MAX_WIDTH`/`terminalHud.maxWidth` 可控制输出宽度。
- 验证情况：`node --check .claude\bridge\claude-status-bridge.mjs` 通过；bridge 样例设置 `CLAUDE_HUD_ONE_TERMINAL_MAX_WIDTH=28` 后多行输出按宽度截断；`npm run build` 通过；`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 通过；`npm run test:ui` 通过（4 passed）；`npm run check:version` 通过。本轮未执行完整 `npm run smoke`，未重新打包 NSIS。
- 风险与下一步：当前 wrap 仍是基础空白分词，不具备 HUD Plus 对 OSC8、emoji ZWJ、复杂 grapheme 和 preferred separator wrapping 的完整实现；后续若要 1:1 parity 应继续迁入 HUD Plus 的 `render/width.ts` 核心算法。
- 是否更新索引：本轮新增的是源码与既有工作记录更新，不是长期资料入口；`.claude/workspace-index.md` 无需更新。
- 结论：部分完成。Terminal row overflow/separator 基础行为已接入 bridge 与 preview；完整 HUD Plus 宽度算法 parity 仍需继续推进。

## 2026-06-10 完整 smoke 与打包验证

- 原始需求：持续执行直到整体任务可用，阶段性改造完成后需要发布级验证和安装包产物。
- 范围：运行完整 `npm run smoke`，覆盖版本一致性、前端构建、Rust check、Rust usage/cost tests、UI screenshots、Tauri release build、NSIS 安装包校验和 release exe 8 秒存活冒烟。
- 产物路径：`scripts/smoke.ps1`、`src-tauri/target/release/claude-hud-one.exe`、`src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。
- 关键处理：首次 smoke 在 release exe 存活检查处失败，release exe 以 code 0 提前退出；结合当前单实例 mutex 行为判断为已有 `claude-hud-one.exe` 进程占用单实例导致。已更新 `scripts/smoke.ps1`，在 release smoke 前停止已有同名 `claude-hud-one` 进程并短暂等待，再启动新 release exe 验证。
- 验证情况：第二次 `npm run smoke` 完整通过：`npm run check:version` 通过；`npm run build` 通过；`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 通过；`npm run test:rust` 通过（usage_cost 5 passed）；`npm run test:ui` 通过（4 passed）；`npm run tauri:build` 通过；NSIS 安装包生成并校验 SHA256 `34157F62E870709874FF3C5164B0EA246C64088173D0572FC2C287731B958F6F`；release exe PID 5960 存活 8 秒后由 smoke 脚本停止。
- 风险与下一步：本轮已重新生成 NSIS，但未执行真实安装/卸载人工验证；完整 HUD Plus parity 中 OSC8/复杂 grapheme width、完整 transcript 元信息聚合、Desktop layout builder 仍可继续优化。
- 是否更新索引：本轮修改的是验证脚本和构建产物，不是长期资料入口；`.claude/workspace-index.md` 无需更新。
- 结论：阶段完成。当前代码与安装包已通过完整 smoke；可进入最终复核、必要的 git diff 检查和用户安装验证说明。

## 2026-06-10 复核修复：Desktop HUD enabled 开关

- 原始需求：最终复核当前 HUD 内置改造，修复明显用户可见问题。
- 范围：只读子代理复核发现 `desktopHud.enabled=false` 时主 HUD 容器仍渲染，只是 item 不显示；本轮修复该开关语义，不改托盘/Settings 入口。
- 产物路径：`src/components/island/IslandRoot.tsx`、`tests/ui.spec.ts`。
- 关键实现：当 `desktopHud.enabled=false` 时，`IslandRoot` 在所有 hooks 之后返回空的 `desktop-stage`，不再渲染胶囊/expanded panel；同时调用 `updateOverlayHitRegions([])` 清空点击命中区域，避免隐藏后仍残留交互区；UI 测试新增关闭 Desktop HUD 后找不到 `Open Claude HUD One` 按钮的断言。
- 验证情况：`npm run build` 通过；`npm run test:ui` 通过（5 passed）；`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 通过。由于这是完整 smoke 后的新改动，后续需要再跑一次完整 `npm run smoke` 并更新最终安装包 SHA256。
- 风险与下一步：关闭 Desktop HUD 后需要通过系统托盘/外部入口重新打开 Settings；这符合桌面悬浮窗关闭语义，但后续可在 Settings 文案中明确。
- 是否更新索引：本轮修改的是源码与测试，不是长期资料入口；`.claude/workspace-index.md` 无需更新。
- 结论：复核问题已修复。Desktop HUD enabled 开关现在能真正隐藏主 HUD，轻量验证通过，待最终 smoke。

## 2026-06-10 最终 smoke 重跑

- 原始需求：Desktop HUD enabled 修复后重新执行完整发布级验证，确保最终安装包与当前源码一致。
- 范围：重跑完整 `npm run smoke`，覆盖版本一致性、前端构建、Rust check、Rust usage/cost tests、UI screenshots、Tauri release build、NSIS 安装包校验和 release exe 存活冒烟。
- 产物路径：`src-tauri/target/release/claude-hud-one.exe`、`src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。
- 验证情况：最终 `npm run smoke` 完整通过：`npm run check:version` 通过；`npm run build` 通过；`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 通过；`npm run test:rust` 通过（usage_cost 5 passed）；`npm run test:ui` 通过（5 passed）；`npm run tauri:build` 通过；NSIS 安装包生成并校验 SHA256 `56EB8097DE304AD78BFF6A9852F5B5DC99D39FCFF5E85C9F5E0CCCADD3D17EA4`；release exe PID 31372 存活 8 秒后由 smoke 脚本停止。
- 风险与下一步：未做真实安装/卸载人工点击验证；未提交/推送 git；完整 HUD Plus parity 仍有高级细节（OSC8/复杂 grapheme width、完整 transcript 元信息聚合、Desktop layout builder）可继续迭代，但当前阶段已具备完整 smoke 通过的安装包。
- 是否更新索引：本轮未新增长期资料入口；`.claude/workspace-index.md` 无需更新。
- 结论：阶段完成。当前源码和安装包均通过最终完整 smoke，可交给用户安装验证或进入提交流程。

## 2026-06-10 安装阶段 bridge 接管修复

- 原始问题：用户重新安装后发现 `C:\Users\Yue\.claude\settings.json` 的 `statusLine` 仍指向 `claude-hud-plus\statusline.ps1`，没有被 Claude HUD One 替代。
- 根因判断：产品代码中的 `ensure_global_bridge()` 已是 owner 模式，但它只在 App 启动时执行；NSIS 安装阶段只停止旧进程和安装文件，没有在安装完成时修复用户级 Claude Code settings。因此“只重新安装但未真正启动新版 App/ensure 未跑到”会让 `statusLine` 仍保持旧 Claude HUD Plus。
- 范围：新增 NSIS postinstall 修复路径，并即时修复当前用户级 Claude settings；只读取/输出 `statusLine`、Claude HUD One hook 数量和相关存在性，不输出 token/base url/权限/其他敏感配置。
- 产物路径：新增 `src-tauri/resources/install-claude-hud-one-bridge.ps1`、`src-tauri/resources/claude-status-bridge.mjs`；修改 `src-tauri/installer-hooks.nsh`、`src-tauri/tauri.conf.json`。
- 关键实现：安装包资源中打入 bridge 脚本与 install 修复脚本；`NSIS_HOOK_POSTINSTALL` 调用 `install-claude-hud-one-bridge.ps1`，将 bridge 复制到 `%APPDATA%\Claude HUD One\bridge\claude-status-bridge.mjs`，备份 `~\.claude\settings.json`，把 `statusLine.command` 设置为 `node "%APPDATA%\Claude HUD One\bridge\claude-status-bridge.mjs"`，安装 7 个 Claude HUD One hooks，并把原 Claude HUD Plus statusLine 保存到 `%APPDATA%\Claude HUD One\bridge\upstream-statusline.json`。
- 当前机器修复：已运行源码中的 install 修复脚本。复核结果：当前 `statusLineCommand` 为 `node "C:\Users\Yue\AppData\Roaming\Claude HUD One\bridge\claude-status-bridge.mjs"`；`statusLineType=command`；`refreshInterval=1`；Claude HUD One hook 数量为 7；`CLAUDE_HUD_ONE_HUD_PLUS_TIMEOUT_MS` 已存在；AppData bridge 存在；upstream backup 存在。
- 验证情况：install/cleanup PowerShell 脚本 parser check 通过；项目 bridge 与资源 bridge `node --check` 通过；`npm run build` 通过；`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 通过；完整 `npm run smoke` 通过，包含版本检查、前端构建、Rust check、Rust usage/cost tests、UI smoke（5 passed）、Tauri release build、NSIS 安装包 SHA256 校验和 release exe 8 秒存活冒烟。新 NSIS 安装包 SHA256：`90C1B9FCCE7CD9DC3806A58934E3E0D8E2A0462331175F4A17ADCAC1856C2925`。
- 风险与下一步：当前已解决“安装后未替代 Claude HUD Plus”的问题；后续用户重新安装新版 NSIS 后，即使未手动启动 App，安装完成阶段也会接管 statusLine/hooks。仍建议重开 Claude Code 会话或执行 `/reload-plugins` 后观察底部 statusLine 输出。
- 是否更新索引：本轮新增的是安装资源脚本和打包资源，不是长期资料入口；`.claude/workspace-index.md` 无需更新。
- 结论：已修复。当前本机 Claude Code 配置已由 Claude HUD One 接管，安装包也已补 postinstall 自动接管能力并通过完整 smoke。

## 2026-06-10 Terminal HUD Plus 1:1 parity 澄清

- 原始问题：用户反馈 Claude HUD One 当前终端底部显示效果不如原 Claude HUD Plus，展示信息不足，要求“直接按照原来的项目把所有展示信息和配置颗粒度同步过来，保证切换后的效果和之前完全一致”。
- 关键澄清：不能在运行时继续依赖、调用或委托原 `E:\\Develop_E\\claude-hud-plus`/Claude HUD Plus statusLine；旧项目只作为参考源码。Claude HUD One 必须在自身 bridge、renderer、Settings 和统一配置文件中重新实现同等展示和配置能力。
- 范围：补齐 Terminal HUD config shape、默认 rows/layout、activityLine、gitStatus、display 粒度、colors/bands、width/truncate/wrap/hyperlink 行为、Settings UI schema 与 preview；继续保持隐私边界，不读取 prompt/tool input/tool result/transcript 正文或凭据。
- 已确认差距：当前 `terminalHud` 缺少 `activityLine`、`pathLevels`、`elementOrder`、`gitStatus`；display 缺少 `addedDirsLayout`、`showConfigCounts`、`usageCompact`、`promptCacheTtlSeconds`、`mergeGroups`、阈值、external usage、`modelFormat/modelOverride/timeFormat` 等；colors 缺少 `usageWarning/git/gitBranch/labelTitle/labelValue/custom/contextBands/usageBands`；renderer 与 preview 对 model badge、context/usage 语义、activityLine、git、addedDirs、OSC8/grapheme/CJK width 仍未达到 HUD Plus parity。
- 实施原则：先在 Claude HUD One 内扩展配置模型与默认值，再迁入/重写 HUD Plus renderer 语义；AppData 仍只使用 `%APPDATA%\\Claude HUD One\\settings.json` 作为软件主配置，Claude Code `~/.claude/settings.json` 只作为 statusLine/hooks 注册点。
- 本轮实现：已将 `src/hud/config.ts` 的 `TerminalHudConfig` 扩展到 HUD Plus 主要 config shape，补 `activityLine`、`pathLevels`、`elementOrder`、`gitStatus`、`addedDirsLayout`、`showConfigCounts`、`usageCompact`、`promptCacheTtlSeconds`、`mergeGroups`、阈值、external usage、`modelFormat/modelOverride/timeFormat`、`usageWarning/git/gitBranch/labelTitle/labelValue/custom/contextBands/usageBands` 等字段；Rust 默认 settings 改为同等 JSON shape；`.claude/bridge/claude-status-bridge.mjs` 与 `src-tauri/resources/claude-status-bridge.mjs` 同步扩展默认 config 和 merge 逻辑。
- Renderer 处理：bridge 和 Settings preview 已改为 Claude HUD One 内部渲染，不再执行 upstream/HUD Plus statusLine；bridge 中已移除 `HUD_PLUS_STATUSLINE`、`PREFER_UPSTREAM`、`hudPlusStatusLine()`、`upstreamStatusLine()` 运行时调用路径。Terminal renderer 已补 model badge/modelFormat/modelOverride、context `82% (222K/270K)` 语义、usage bar/remaining/compact/reset、gitStatus toggles、activityLine mode/items/warnings、promptCache TTL、timeFormat、custom color、named/256/hex 颜色解析等基础 parity。
- Settings 处理：Terminal HUD tab 已把 `showSessionName` 和更多 boolean display 开关纳入 UI，并增加 HUD Plus 颗粒度配置区，支持 contextValue、usageValue、addedDirsLayout、modelFormat、timeFormat、activityLine.mode、toolNameFormat、modelOverride、gitStatus 开关；Color Workbench 改为支持 `#hex`、命名色和 256 色值文本输入，覆盖新增颜色键。
- 安装/文档处理：安装脚本和 Rust 全局 bridge 安装逻辑不再写入 `CLAUDE_HUD_ONE_HUD_PLUS_TIMEOUT_MS`；README 已改为说明 Claude HUD One 自身重实现 Terminal HUD，不再运行或委托旧 Claude HUD Plus。
- 验证情况：`node --check .claude\bridge\claude-status-bridge.mjs`、`node --check src-tauri\resources\claude-status-bridge.mjs` 通过；样例 stdin 输出 Claude HUD One 内部 Terminal HUD 多行：model/context/project/git/session tokens/activity；`npm run build` 通过；`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 通过；`npm run test:rust` 通过（5 passed）；`npm run test:ui` 通过（5 passed）；最终 `npm run smoke` 完整通过，NSIS 安装包 SHA256 `9AE538C98839C2999E3046B6056A688574F6EA8AF5BC16CF28CB0019D20684FF`，release exe 存活 8 秒后停止。
- 风险与下一步：本轮已去掉旧 HUD Plus 运行时依赖并补齐主要配置 shape/基础语义，但若要求严格逐字符 1:1，还需要继续迁入 HUD Plus 的完整 OSC8 hyperlink 保留/闭合、Intl.Segmenter grapheme/emoji ZWJ/CJK ambiguous width 算法、完整 tools/agents/todos transcript 元信息聚合、context/usage bands 的精确阈值行为和 Settings 自动表单/排序器。仍需保持不读取 prompt/tool input/tool result/transcript 正文或凭据。
- 是否更新索引：本轮继续修改已有源码、README 和既有记录，未新增长期资料入口；`.claude/workspace-index.md` 暂无需更新。
- 结论：阶段完成。Claude HUD One Terminal HUD 已转为在本项目内重实现 HUD Plus 主要展示与配置能力，不再依赖旧 Claude HUD Plus 执行，并通过完整 smoke；严格逐字符 parity 的高级渲染细节可继续作为下一阶段收尾。
