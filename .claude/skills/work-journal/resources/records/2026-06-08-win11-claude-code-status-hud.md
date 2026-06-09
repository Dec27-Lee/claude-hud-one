# Win11 Claude Island Win 需求讨论与一期复刻方案

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
- 2026-06-08：已为本地 Usage/Cost 聚合增加 last-known-good 聚合缓存：当当前扫描找不到 token usage 字段时，会回退到 `%APPDATA%\Claude Island Win\usage-cost-cache.json` 中的上次聚合结果并标记 stale/cache；缓存只保存聚合 token/cost/provider 状态，不保存 prompt、transcript、tool-result 或凭据正文。本轮已执行 `npm run smoke`，前端 build、Rust check、UI 截图、Tauri release build 和 release exe 8 秒存活冒烟全部通过。
- 2026-06-08：已明确 Usage provider 的数据来源/认证状态字段：Rust snapshot 增加 `source` 与 `authStatus`，当前 local scan 返回 `localEstimate/unknown`，缓存回退返回 `cache/unknown`；Usage UI 增加 source/auth pill，避免把本地估算误展示为官方 endpoint usage。本轮已执行 `npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml -j 1`、`npm run test:ui`（3 passed）。
- 2026-06-08：已新增版本一致性检查 `scripts/check-version.mjs` 与 `npm run check:version`，并把该检查接入 `npm run smoke`，用于约束 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 的版本一致。最新 `npm run smoke` 已完整通过版本检查、前端 build、Rust check、UI 截图、Tauri release build 和 release exe 8 秒存活冒烟。
- 2026-06-08：已新增 Windows CI 发布 workflow 草案 `.github/workflows/release.yml`：支持 `workflow_dispatch` 与 `v*` tag，安装依赖与 Playwright Chromium，执行版本检查、前端 build、Rust check、UI smoke、Tauri NSIS/MSI build，生成 SHA256SUMS，上传 artifacts，并在 tag 发布时发布 GitHub Release；尚未配置签名证书、Tauri updater endpoint/signing key 或 SmartScreen reputation。
- 2026-06-08：已新增 App 诊断摘要模块 `src-tauri/src/window/diagnostics.rs` 与 Settings 展示：返回 app version、AppData/settings/cache 路径及存在性、Claude projects/Codex sessions 路径存在性和隐私说明，并新增 Open app data 按钮；诊断不读取或返回 prompt、transcript、tool-result 或凭据内容。最新 `npm run smoke` 已完整通过版本检查、前端 build、Rust check、UI 截图、Tauri release build 和 release exe 8 秒存活冒烟。
- 2026-06-08：根据用户反馈“提问后 HUD 状态没变化”，已接入 Claude Code `statusLine`/hook 状态桥：新增 `.claude/bridge/claude-status-bridge.mjs`，更新 `.claude/settings.json`，通过 statusLine 与 UserPromptSubmit/PreToolUse/PostToolUse/Stop/Notification 等 hooks 写入脱敏状态 JSON 到 `%APPDATA%\\Claude Island Win\\claude-status.json` 和 `.claude/bridge/state/claude-status.json`；Rust 新增 `claude_status` 读取命令，前端 Current Session 正常模式约 1 秒读取 bridge patch，显示 Prompt submitted、Tool running、Waiting 等实时状态和模型/context 信息。桥接脚本只保存事件名、工具名和聚合指标，不保存 prompt、tool input、tool result、transcript 正文或凭据。本轮已执行脚本样例验证、settings JSON 校验、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run build`、`npm run test:ui`（3 passed）、`npm run smoke` 全部通过，并重启 release 版 PID 12888。
- 2026-06-08：用户要求“记录当前工作状态，停止修改，提交并推送远程 main”。当前已停止继续功能修改；本轮在 `npm run smoke` 通过后又开始补 compact/peek 状态可视反馈（`IslandRoot` 与 `styles.css` 的 live dot/peek 文案），该小段 UI 反馈尚未单独复跑 smoke。Git 身份已核对：remote `origin git@github.com:Dec27-Lee/claude-island-win.git`，分支 `main`，user `Dec27-Lee <lipengyue31@163.com>`；接下来按用户要求提交并推送整个工作区。
- 2026-06-08：用户要求“回顾任务完成记录，继续执行没有完成的任务”。已根据记录缺口继续补正式产品验证与设置持久化：新增 `usage_cost.rs` 单元测试 5 个，覆盖嵌套 token 解析、cache-read 计费折扣、模型价格分支、Claude/Codex daily buckets 合并和 provider source/stale 状态；新增 `npm run test:rust`，并接入 `scripts/smoke.ps1` 与 `.github/workflows/release.yml`。同时把 provider visibility 纳入 native Settings SSOT：`SettingsState.visibleProviders`、Rust `AppSettings.visible_providers` 默认值、store 深合并兼容旧 localStorage，并在 Settings/主面板切换 provider 时同步保存原生配置。最新 `npm run smoke` 已完整通过版本检查、前端 build、Rust check、Rust usage/cost tests（5 passed）、UI 截图（3 passed）、Tauri release build 和 release exe 8 秒存活冒烟。
- 2026-06-08：继续补发布链路中不依赖外部资源的 updater 骨架：`UpdateState` 扩展 `configured/canCheck/downloadAvailable/errorCode/endpoint` 字段，Settings Updates 区块明确显示未配置原因并在 `canCheck=false` 时禁用 Check for updates，避免把占位功能误导为真实自动更新；真实 endpoint、签名 key、下载/安装仍待外部资源。最新 `npm run smoke` 已完整通过版本检查、前端 build、Rust check、Rust usage/cost tests（5 passed）、UI 截图（3 passed）、Tauri release build 和 release exe 8 秒存活冒烟。
- 2026-06-09：根据用户反馈 claude-island-win 项目级 `statusLine` 覆盖全局 `claude-hud-plus`，已把 `.claude/bridge/claude-status-bridge.mjs` 改为兼容委托模式：statusLine 执行时仍先写入 Claude Island 脱敏状态 JSON，再自动检测 `%USERPROFILE%\\.claude\\plugins\\claude-hud-plus\\statusline.ps1` 并把原 stdin 传给 HUD Plus 输出多行状态；若 HUD Plus 不存在、超时或失败，则回退 `Claude Island · ...`。保留 hooks 状态采集，不保存 prompt/tool input/tool result/transcript/凭据内容。已执行 `node --check .claude/bridge/claude-status-bridge.mjs` 通过，并用样例 stdin 验证输出恢复为 HUD Plus 多行状态。
- 2026-06-09：按用户要求整理当前对标 `local\\参考项目\\codex-island` 的阶段进展、问题和正式使用缺口，已新建阶段性复盘文档 `local\\需求讨论\\2026-06-09-claude-island-win-对标codex-island-当前进展与正式使用缺口.md`。结论为：当前已具备本地试用和 pre-release 工程基础，但完整对标仍需补官方 Usage endpoint/认证链路、Codex Windows 实测、真实 updater/signing/发布链路、多屏 DPI 与全屏实机矩阵、手动刷新和 alerts 等产品闭环。本轮为文档整理，未执行新的 smoke。
- 2026-06-09：用户确认范围修订后继续推进：Usage 改为优先使用 Claude Code statusLine 自身估算；Codex 本轮后置且前端不展示；发布目标改为不进应用商店但满足安装、卸载、手动更新、开机启动等常规流程。已接入 statusLine `rate_limits` 5h/7d 百分比与 reset 时间到 bridge/Rust/TS provider 状态，前端 `ProviderSource` 新增 `claudeCode`；`displayedProviderOrder` 改为只展示 Claude，mock/native settings 默认 codex false，Overview/Usage/Cost/Settings/Diagnostics 不展示 Codex；新增 expanded footer 和 Settings 手动刷新、防并发刷新状态、alerts 阈值派生与 header pill；Updates 改为 manual update only 并提供 GitHub Releases 打开入口；README、需求讨论文档、Tauri bundle 描述和 smoke installer artifact 校验已同步更新。已执行 `node --check .claude\\bridge\\claude-status-bridge.mjs`、`npm run build`、`cargo check --manifest-path src-tauri\\Cargo.toml -j 1`、`npm run test:rust`、`npm run test:ui` 通过；随后完整 `npm run smoke` 通过，包含版本一致性、前端 build、Rust check、Rust usage/cost tests、UI screenshots、Tauri release build、NSIS/MSI 产物 SHA256 校验和 release exe 8 秒存活；本机显示器检测到 `DISPLAY1 2048x1280` 与 `DISPLAY2 2560x1440 primary`，release exe 在双屏环境启动 15 秒未退出。

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
- 验证情况：已成功写入新方案文档；已更新旧文档范围提示；已更新工作区索引；已执行 `npm install`、`npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml -j 1`、`npm run tauri -- info`、`npm run tauri:build`，前端与 Tauri release 构建通过；已产出 `src-tauri\target\release\claude-island-win.exe`、`src-tauri\target\release\bundle\nsis\Claude Island Win_0.1.0_x64-setup.exe`、`src-tauri\target\release\bundle\msi\Claude Island Win_0.1.0_x64_en-US.msi`；release exe 冒烟启动后保持运行；Win32 overlay 样式、动态点击穿透、显示器基础命令、多区域 hit-test、Settings 独立窗口、全屏避让基础检测、当前 Claude Code 会话摘要扫描、原生配置、开机启动、托盘、诊断目录打开、本地 Usage/Cost 聚合与 last-known-good 缓存、`WM_MOUSEACTIVATE` 鼠标激活守卫、target display/top offset 生效、updater 状态预留、Playwright UI 冒烟截图验收接入后均已重新构建并通过验证；最新 `npm run smoke` 已完整通过前端 build、Rust check、UI 截图、Tauri release build 和 release exe 8 秒存活冒烟。
- 风险：hit-test 仍采用 50ms cursor polling，`WM_MOUSEACTIVATE` 已接 subclass 但仍需真实前台应用交互人工验收；多 DPI 已做前端 `devicePixelRatio` 基础修正和显示器列表/offset 定位，但仍需实机矩阵；全屏避让当前是前台窗口矩形覆盖显示器 bounds 的基础启发式，需对游戏独占全屏、无边框全屏、多屏不同 DPI 继续验证；本地 Usage/Cost 聚合当前从日志结构化 token 字段推导，成本是本地估算值，官方 Claude/Codex usage endpoint、凭据刷新和账单对账仍需后续实测；Codex session 路径已按 Windows 常见目录扫描，但真实 Codex 字段结构仍需实测；updater 目前是状态预留，真实自动更新仍需要 endpoint、签名 key 和发布源；代码签名、SmartScreen 需要外部证书和发布阶段验证。
- 结论：部分完成但已具备可本地试用的 release 产物。Rust/Tauri 构建阻断已解除，开发骨架、mock UI、release exe 与 NSIS/MSI 打包已通过，并已接入第一层 Win32 overlay 样式、动态点击穿透、多区域 hit-test、显示器定位、Settings 独立窗口、全屏避让基础检测、当前 Claude Code 会话脱敏摘要、本地 Usage/Cost 聚合、原生配置持久化、开机启动、托盘、诊断目录打开、`WM_MOUSEACTIVATE` 鼠标激活守卫、target display/top offset 生效、updater 预留、UI 自动化截图验收和完整 smoke 验证；下一步继续做官方 Usage API/凭据链路、多屏 DPI 实机矩阵、真实自动更新/签名发布链路。
