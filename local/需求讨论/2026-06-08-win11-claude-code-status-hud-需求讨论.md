# Win11 Claude Code 状态动态岛 HUD 需求讨论

> 日期：2026-06-08  
> 目标：参考 macOS `codex-island` 的动态岛式状态展示能力，规划 Windows 11 版本 Claude Code 状态 HUD。  
> 本文重点：UI 展示效果、实时性、低 CPU/内存、可视化 UI 配置、Claude Code 集成边界。
>
> **范围修订（2026-06-08）：** 用户已明确要求一期按正式发布产品打造，并完整复刻参考项目 `codex-island` 已有功能。本文中“简化 MVP / 暂不做完整 Usage、Cost、Codex、发布更新链路”等判断已不再作为一期范围依据。正式一期范围以新文档 `local\需求讨论\2026-06-08-win11-codex-island-full-replica-一期正式产品方案.md` 为准。

---

## 1. 背景与结论摘要

当前工作区的目标是做一个 **Windows 11 上的 Claude Code 动态岛 HUD**，常驻桌面顶部或用户指定位置，实时展示 Claude Code 当前会话状态、工具调用、上下文用量、费用估算和任务进度。

本地参考项目是：

- `local\参考项目\codex-island`

它不是 Windows 项目，而是一个 macOS 原生 Swift/SwiftUI/AppKit 悬浮层应用。它的核心定位是“把 MacBook 刘海变成类似 Dynamic Island 的 Claude Code / Codex 用量与费用面板”。项目 README 明确说明其能力包括：悬停预览 5 小时窗口、点击展开 Usage / Cost / Overview 面板、从本地 Claude Code 和 Codex 日志估算费用和 token 吞吐量、低功耗模式、安全轮询间隔、无遥测等（`local\参考项目\codex-island\README.zh-CN.md:10`、`local\参考项目\codex-island\README.zh-CN.md:20`、`local\参考项目\codex-island\README.zh-CN.md:25`、`local\参考项目\codex-island\README.zh-CN.md:27`、`local\参考项目\codex-island\README.zh-CN.md:30`）。

对 Win11 版本来说，最重要的判断是：

1. **UI 形态可借鉴 codex-island，但数据目标要升级。**  
   codex-island 主要展示 Claude/Codex 用量与费用；Win11 版本应面向 Claude Code 当前会话状态，增加工具调用、等待权限、任务进度、上下文窗口实时百分比等。

2. **Claude Code 集成不应侵入进程。**  
   推荐通过官方入口组合状态：`statusLine` 提供会话快照，hooks 提供事件流，`transcript_path` 只读补充，OpenTelemetry 后续用于长期监控。不要修改 Claude Code 安装文件，不要注入进程，不要把 transcript 当唯一实时源。

3. **首选架构建议：Tauri 2 + Rust 后端 + React/Svelte 前端。**  
   如果低 CPU/低内存是硬要求，Tauri 更适合；如果想最快做出高质量可演示 UI，可先用 Electron MVP，再根据资源占用决定是否迁移。

4. **第一版要先做“状态标准模型”。**  
   UI 不直接解析 Claude Code 原始 JSON、hook 或 transcript，而是消费统一状态模型。这样后续替换数据源、增加 Win32 窗口能力、改 UI 框架都不会推倒重来。

5. **性能策略必须从第一天设计。**  
   用事件驱动、状态 diff、文件增量读取、动画停机、低功耗模式，避免高频轮询和常驻 60fps 动画。

6. **可视化配置界面不是附属功能，而是核心功能。**  
   Win11 上显示器、DPI、置顶、点击穿透、全屏应用、任务栏位置差异很大，必须让用户可视化调整位置、主题、显示项、集成方式和性能模式。

---

## 2. macOS 参考项目 codex-island 分析

### 2.1 项目定位

codex-island 是一个 macOS native overlay 应用：

- 把 MacBook 刘海区域变成动态岛式状态面板。
- 支持 Claude Code 和 Codex。
- 悬停时显示 5 小时窗口用量。
- 点击展开完整 Usage / Cost / Overview 面板。
- 从本地 Claude Code / Codex 会话日志估算美元成本、token 吞吐量和趋势。
- 本地优先，不做应用遥测、崩溃上报、第三方分析或代理服务。

证据：`local\参考项目\codex-island\README.zh-CN.md:10`、`local\参考项目\codex-island\README.zh-CN.md:12`、`local\参考项目\codex-island\README.zh-CN.md:20`、`local\参考项目\codex-island\README.zh-CN.md:30`。

### 2.2 技术栈与应用结构

参考项目采用：

- Swift / SwiftUI / AppKit 混合。
- AppKit 自定义透明置顶窗口承载 SwiftUI UI。
- accessory app 模式，无 Dock 图标。
- Sparkle 自动更新。
- UserDefaults 存储偏好。
- 本地 JSONL 会话日志扫描 + 用量接口请求。

对 Win11 的启发：

- macOS 的 `NSWindow + SwiftUI` 可对应到 Windows 的 `Tauri/WebView2 + Win32 window`、`Electron BrowserWindow + Win32 flags` 或 `.NET WPF Window + Win32 interop`。
- accessory app / 无 Dock 图标可对应 Windows 的系统托盘 + 不在任务栏显示。
- SwiftUI 的 compact / peek / expanded 状态机可对应前端状态机。
- UserDefaults 可对应 `%APPDATA%` / `%LOCALAPPDATA%` 下的 JSON 配置与缓存。

### 2.3 动态岛窗口机制

codex-island 创建一个透明、无边框、置顶的宿主窗口：

- `BorderlessFloatingWindow` 创建无边框窗口。
- contentRect 是固定 `900 x 360` 的宿主画布。
- `window.isOpaque = false`、`backgroundColor = .clear`、`hasShadow = false`。
- `window.level = .popUpMenu`，并设置 `canJoinAllSpaces / stationary / ignoresCycle`。

证据：`local\参考项目\codex-island\Sources\Window\IslandWindowController.swift:22`、`local\参考项目\codex-island\Sources\Window\IslandWindowController.swift:28`、`local\参考项目\codex-island\Sources\Window\IslandWindowController.swift:34`、`local\参考项目\codex-island\Sources\Window\IslandWindowController.swift:37`、`local\参考项目\codex-island\Sources\Window\IslandWindowController.swift:38`。

Win11 等价需求：

- 无边框透明窗口。
- 常驻置顶。
- 不出现在任务栏。
- 尽量不抢焦点。
- 可以切换点击穿透。
- 支持多显示器和 DPI。
- 全屏应用时可自动隐藏或降低打扰。

### 2.4 UI 状态机

codex-island 的 `IslandModel` 只有三种核心状态：

- `compact`
- `peek`
- `expanded`

证据：`local\参考项目\codex-island\Sources\Model\IslandModel.swift:5`。

尺寸规则也很清晰：

- compact：刘海宽度 + 两侧 logo tab。
- peek：增加左右百分比 pill slot。
- expanded：固定 800 宽，高度随页面变化。

证据：`local\参考项目\codex-island\Sources\Model\IslandModel.swift:164`、`local\参考项目\codex-island\Sources\Model\IslandModel.swift:166`、`local\参考项目\codex-island\Sources\Model\IslandModel.swift:171`、`local\参考项目\codex-island\Sources\Model\IslandModel.swift:176`。

Win11 版本建议延续这个状态机，但把状态扩展为 Claude Code 语义：

```text
compact-idle          空闲小胶囊
compact-working       正在思考/响应
tool-running          工具调用中
waiting-permission    等待权限
context-warning       上下文接近阈值
expanded-detail       展开详情
error                 错误/失败
```

### 2.5 点击穿透与低打扰

codex-island 的窗口比可见岛大，为避免遮挡后方应用，它做了两层处理：

- `hitTest` 只在岛形区域内响应。
- 全局 / 本地 mouseMoved 监听动态切换 `window.ignoresMouseEvents`。
- 启动时 10Hz timer 兜底检查鼠标是否已经在岛内，收到真实 mouseMoved 后自停。

证据：`local\参考项目\codex-island\Sources\Window\IslandWindowController.swift:79`、`local\参考项目\codex-island\Sources\Window\IslandWindowController.swift:87`、`local\参考项目\codex-island\Sources\Window\IslandWindowController.swift:97`、`local\参考项目\codex-island\Sources\Window\IslandWindowController.swift:103`、`local\参考项目\codex-island\Sources\Window\IslandWindowController.swift:107`。

Win11 对应实现需要 Win32 扩展样式：

- `WS_EX_LAYERED`
- `WS_EX_TRANSPARENT`
- `WS_EX_TOOLWINDOW`
- `WS_EX_NOACTIVATE`
- `SetWindowLongPtr`
- `SetWindowPos`

建议做三种模式：

1. **交互模式**：可 hover、可点击、可展开。
2. **穿透模式**：收起态不拦截鼠标，避免挡终端或浏览器。
3. **智能模式**：默认穿透，通过快捷键或 hover 热区进入交互态。

### 2.6 性能与低功耗策略

codex-island 参考价值很高的一点是，它不只是做 UI，还显式控制性能：

- 对不可见 / 遮挡窗口暂停 LoadingSweep。
- 注释中明确 30Hz TimelineView 是主要 idle CPU 成本，遮挡时暂停可把 idle 降到约 0。
- 锁屏时隐藏，解锁后淡入。
- 低功耗模式会减少常驻光晕和 sweep。
- 日志解析使用 per-file cache 和 64KB chunk 流式读取。

证据：`local\参考项目\codex-island\Sources\Window\IslandWindowController.swift:169`、`local\参考项目\codex-island\Sources\Window\IslandWindowController.swift:172`、`local\参考项目\codex-island\Sources\Window\IslandWindowController.swift:177`、`local\参考项目\codex-island\Sources\Cost\LogParseCache.swift:42`、`local\参考项目\codex-island\Sources\Cost\LogParseCache.swift:44`、`local\参考项目\codex-island\Sources\Cost\LogParseCache.swift:79`、`local\参考项目\codex-island\Sources\Cost\LogParseCache.swift:141`。

Win11 版本应把这些作为硬性设计原则：

- 默认不运行无限动画。
- 动画只在状态变化、工具运行、hover 展开、告警时启用。
- 状态稳定后停止 spinner 或降级为静态指示。
- 文件监听增量读取，不反复全量解析。
- 配置页和 HUD 分窗口，配置页关闭后释放资源。
- 对全屏、锁屏、睡眠恢复、显示器变化做事件驱动处理，而不是死循环轮询。

---

## 3. 参考项目的数据来源与可复用性

### 3.1 Claude Code 本地 JSONL 日志

codex-island 的 Claude 成本数据来自本地 Claude Code session JSONL：

- `~/.claude/projects/**/*.jsonl`
- `~/.config/claude/projects/**/*.jsonl`
- `CLAUDE_CONFIG_DIR` 指定目录下的 `projects`

证据：`local\参考项目\codex-island\Sources\Cost\ClaudeLogReader.swift:2`、`local\参考项目\codex-island\Sources\Cost\ClaudeLogReader.swift:4`、`local\参考项目\codex-island\Sources\Cost\ClaudeLogReader.swift:5`、`local\参考项目\codex-island\Sources\Cost\ClaudeLogReader.swift:48`、`local\参考项目\codex-island\Sources\Cost\ClaudeLogReader.swift:55`。

解析字段：

- top-level `type == "assistant"`
- `message.usage`
- `message.model`
- `message.id`
- top-level `requestId`
- top-level `timestamp`
- token 字段：`input_tokens`、`output_tokens`、`cache_creation_input_tokens`、`cache_read_input_tokens`

证据：`local\参考项目\codex-island\Sources\Cost\ClaudeLogReader.swift:94`、`local\参考项目\codex-island\Sources\Cost\ClaudeLogReader.swift:98`、`local\参考项目\codex-island\Sources\Cost\ClaudeLogReader.swift:100`、`local\参考项目\codex-island\Sources\Cost\ClaudeLogReader.swift:101`、`local\参考项目\codex-island\Sources\Cost\ClaudeLogReader.swift:122`。

可复用到 Win11：

- 费用估算、历史 token 趋势、最近会话统计可以复用类似扫描方式。
- Windows 默认路径可先适配：
  - `%USERPROFILE%\.claude\projects`
  - `%USERPROFILE%\.config\claude\projects`
  - `CLAUDE_CONFIG_DIR` 下的 `projects`
- 但它不应作为主实时状态源，只适合成本与历史补充。

### 3.2 Claude usage 接口

codex-island 通过 Claude Code 使用的 OAuth usage endpoint 读取用量：

```text
GET https://api.anthropic.com/api/oauth/usage
Authorization: Bearer <token>
anthropic-beta: oauth-2025-04-20
User-Agent: claude-code/2.1.121
```

证据：`local\参考项目\codex-island\Sources\Usage\UsageFetcher.swift:69`、`local\参考项目\codex-island\Sources\Usage\UsageFetcher.swift:89`、`local\参考项目\codex-island\Sources\Usage\UsageFetcher.swift:90`、`local\参考项目\codex-island\Sources\Usage\UsageFetcher.swift:91`、`local\参考项目\codex-island\Sources\Usage\UsageFetcher.swift:96`。

重要边界：

- 这不是面向所有 end-user 的正式公开 API，而是 Claude Code 自身使用的接口形态。
- User-Agent 可能被服务端 gate。
- token scope 不足会 403，refresh 不一定能修复，需要重新登录。
- Windows 凭据存储和 macOS Keychain 不同，不能直接移植。

Win11 版本建议：

- MVP 不要把这个 endpoint 作为核心实时状态依赖。
- 如果做账号用量面板，可放到后续增强。
- 先支持 `CLAUDE_CODE_OAUTH_TOKEN` 或用户显式授权；不要破坏 Claude Code / Desktop 的 refresh token。
- 刷新间隔至少 5 分钟，避免触发 rate limit。

### 3.3 日志解析缓存

codex-island 的性能关键是 per-file cache：

- 用 `(path, mtime, size)` 判断缓存命中。
- 使用 64KB chunk 流式读取 JSONL，避免 50MB+ 文件一次性加载。
- cache version 不匹配就丢弃。
- 文件消失或滚出 cutoff 后清理缓存。

证据：`local\参考项目\codex-island\Sources\Cost\LogParseCache.swift:42`、`local\参考项目\codex-island\Sources\Cost\LogParseCache.swift:44`、`local\参考项目\codex-island\Sources\Cost\LogParseCache.swift:52`、`local\参考项目\codex-island\Sources\Cost\LogParseCache.swift:79`、`local\参考项目\codex-island\Sources\Cost\LogParseCache.swift:92`、`local\参考项目\codex-island\Sources\Cost\LogParseCache.swift:141`、`local\参考项目\codex-island\Sources\Cost\LogParseCache.swift:153`。

Win11 版本应直接继承这个思路：

```text
%LOCALAPPDATA%\ClaudeHUDOne\cache\parse-cache.v1.json
```

但实时 HUD 不应该因为历史日志首扫而卡住：

- 启动先显示上次状态快照。
- 历史日志后台低优先级扫描。
- 扫描中显示“历史统计刷新中”，不影响工具调用实时态。

---

## 4. Claude Code 官方集成边界

### 4.1 没有单一实时状态 API

Claude Code CLI 目前没有一个专门面向外部 HUD 的单一完整状态 API。可用的是多种官方入口组合：

| 来源 | 官方支持程度 | 实时性 | 适合 HUD 的内容 |
| --- | --- | --- | --- |
| `statusLine` | 高 | 中高 | 模型、上下文、费用、目录、会话 ID、transcript 路径、rate limits |
| Hooks | 高 | 高 | 工具开始/结束、权限请求、通知、停止、失败、compact、子代理事件 |
| `transcript_path` | 间接支持 | 中 | 当前会话 transcript 只读 tail，历史补充 |
| OpenTelemetry | 高 | 中 | usage、cost、tool activity、metrics/events/traces |

推荐事实表述：

> Claude Code 没有一个官方“HUD 状态流 API”，但 `statusLine`、hooks、`transcript_path` 和 OpenTelemetry 足够组成低侵入状态系统。HUD 应构建本地状态机合成 UI 状态，而不是依赖 Claude Code 私有内部状态。

### 4.2 statusLine：会话快照源

`statusLine` 是最适合做快照的入口。它通过 settings 配置一个命令，Claude Code 将 session data JSON 通过 stdin 传给该命令，命令输出文本给 Claude Code 底部状态栏。

关键字段包括：

- `model.id`
- `model.display_name`
- `cwd`
- `workspace.current_dir`
- `workspace.project_dir`
- `cost.total_cost_usd`
- `cost.total_duration_ms`
- `cost.total_api_duration_ms`
- `context_window.used_percentage`
- `context_window.remaining_percentage`
- `context_window.context_window_size`
- `context_window.current_usage.*`
- `rate_limits.*`
- `session_id`
- `session_name`
- `transcript_path`
- `version`
- `effort.level`
- `thinking.enabled`
- `agent.name`
- `pr.*`
- `worktree.*`

更新时机通常包括：

- 新 assistant message 后。
- `/compact` 完成后。
- permission mode 变化时。
- vim mode 切换时。
- 配置 `refreshInterval` 后按间隔刷新。

Win11 HUD 的建议：

- statusLine 脚本继续 stdout 输出 Claude Code 原状态栏文本。
- 同时把 stdin JSON 通过 side-channel 发给 HUD。
- 第一版可写原子 JSON 文件，后续升级为 Named Pipe / WebSocket。

示例：

```text
Claude Code statusLine
  ├─ stdout：显示在 Claude Code 底部
  └─ side-channel：写入 HUD 最新快照
```

### 4.3 Hooks：实时事件源

对 HUD 最重要的 hooks：

| Hook | HUD 语义 |
| --- | --- |
| `SessionStart` | 初始化会话、模型、标题 |
| `UserPromptSubmit` | 用户提交输入，进入工作态 |
| `PreToolUse` | 工具即将调用，显示工具名和参数摘要 |
| `PostToolUse` | 工具成功结束 |
| `PostToolUseFailure` | 工具失败 |
| `PostToolBatch` | 工具批量完成 |
| `PermissionRequest` | 等待用户授权 |
| `PermissionDenied` | 授权被拒绝 |
| `Notification` | Claude Code 通知 |
| `Stop` | 本轮完成 |
| `StopFailure` | 本轮异常 |
| `PreCompact` | 开始压缩上下文 |
| `PostCompact` | 压缩完成 |
| `SubagentStart` / `SubagentStop` | 子代理运行状态 |
| `TaskCreated` / `TaskCompleted` | 任务进度 |
| `ConfigChange` | 配置变化 |

hooks 输入通常包含：

- `session_id`
- `transcript_path`
- `cwd`
- `permission_mode`
- `hook_event_name`
- `tool_name`
- `tool_input`
- `agent_id` / `agent_type`（部分场景）

边界：

- hooks 可能并行运行，HUD 端要处理乱序、重复和缺失。
- hook 不能做重逻辑，必须短超时、快速退出。
- command hook stdout 如果要给 Claude Code 返回 JSON，不能混入调试日志。
- hooks 不是安全边界，权限控制要用 Claude Code permissions。

### 4.4 Transcript：只读补充源

Claude Code 会在 statusLine / hooks 输入中给出 `transcript_path`。这使 HUD 可以定位当前 session transcript 文件。

可做：

- HUD 重启后恢复最近状态。
- 只读 tail 当前 session 的 JSONL。
- 补充最近用户输入、assistant 消息、工具调用历史。
- 为展开详情提供“最近事件”。

不建议：

- 修改 transcript。
- 把 transcript 当唯一实时数据源。
- 全量扫描所有 project transcript。
- 展示完整 prompt 或工具输出。

隐私提醒：transcript 可能包含用户 prompt、文件内容、命令参数、路径、密钥样式字符串。默认应只做状态恢复，不展示正文。

### 4.5 OpenTelemetry：后续监控增强

Claude Code 支持 OpenTelemetry，可导出 metrics、logs/events、traces。默认 metrics 约 60 秒，logs 约 5 秒。

适合：

- 长期 usage 报表。
- 团队监控。
- 工具活动统计。
- 后续 Dashboard。

不适合：

- 作为第一版 HUD 主实时源。
- 驱动 100-300ms 的动态岛状态变化。

---

## 5. Win11 推荐产品形态

### 5.1 HUD 收起态

收起态目标：低打扰、一眼看懂、几乎不耗 CPU。

建议显示：

- Claude 图标或项目图标。
- 当前状态点：空闲 / 工作中 / 工具中 / 等待权限 / 错误。
- 当前模型简称。
- 上下文百分比小环或小条。

尺寸建议：

```text
宽度：160-260 px
高度：34-44 px
位置：默认顶部居中，Y 偏移 8-16 px
```

### 5.2 工作态

当 `UserPromptSubmit` 后进入工作态，展示：

- `Thinking...` 或 `Working...`
- 模型名。
- 已耗时。
- 呼吸点或轻量 spinner。

不要持续大面积 blur、阴影或 60fps 动画。

### 5.3 工具态

由 `PreToolUse` 到 `PostToolUse` / `PostToolUseFailure` 推导：

- `Bash: npm test`
- `Read: src/main.ts`
- `Edit: package.json`
- `Grep: "statusLine"`

工具参数必须做摘要和脱敏：

- Bash 命令最多显示前 80-120 字符。
- path 只显示末尾 2-3 段。
- 对 `token`、`key`、`password`、`secret`、`authorization` 等字段脱敏。

### 5.4 等待权限态

当收到 `PermissionRequest`：

- 动态岛变为橙色/黄色。
- 显示 `Waiting for permission`。
- 展开后显示工具名和操作摘要。
- 可引导用户回到 Claude Code 窗口处理。

不建议 HUD 自己替 Claude Code 做授权，避免权限边界混乱。

### 5.5 上下文告警态

从 `statusLine.context_window.used_percentage` 获取：

- `>= 70%`：轻提醒。
- `>= 85%`：警告。
- `>= 95%`：紧急。

compact 后如果 `current_usage == null`，不要显示为 0，应显示：

```text
Compacted · waiting for next API update
```

### 5.6 展开态

展开态建议分 3 个 tab：

1. **Session**
   - 当前会话名 / 项目名。
   - 模型。
   - 状态机状态。
   - 当前工具。
   - 最近 5-10 个事件。

2. **Context**
   - context used / remaining。
   - input/cache/output 明细。
   - compact 状态。
   - rate limits（如果有）。

3. **Cost / Stats**
   - statusLine 会话估算成本。
   - 本地 JSONL 历史成本（可选）。
   - 今日 / 本月 / 最近会话 token。

---

## 6. Windows 技术选型

### 6.1 方案对比

| 方案 | UI 效果 | 实时性 | CPU/内存 | Win11 窗口能力 | 开发效率 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| Electron + React | 很强 | 强 | 偏高 | 成熟但需 Win32 辅助 | 最高 | 最快 MVP |
| Tauri + React/Svelte | 很强 | 强 | 低 | 需要 Rust/Win32 调试 | 中 | 推荐长期主方案 |
| WPF/.NET | 中高 | 强 | 低中 | 成熟 | 中 | Windows-only 可选 |
| WinUI 3 | 高 | 强 | 中 | 需 Win32 补齐 | 中低 | 不建议第一版 |
| AutoHotkey | 低 | 中 | 低 | 快速验证 | 高 | 只适合 spike |

### 6.2 推荐主架构

```text
Tauri 2
  ├─ Rust Core
  │   ├─ Claude Code statusLine bridge
  │   ├─ Claude Code hooks bridge
  │   ├─ transcript tailer（可选）
  │   ├─ state aggregator
  │   ├─ config manager
  │   ├─ local IPC / Named Pipe
  │   ├─ tray / global shortcuts
  │   └─ Win32 window controls
  │
  └─ Web UI
      ├─ DynamicIsland HUD
      ├─ Settings UI
      ├─ Debug Event Panel
      ├─ Theme tokens
      └─ Animation system
```

如果想尽快演示，可先 Electron：

```text
Electron MVP
  ├─ main process：文件/IPC/窗口/托盘
  └─ renderer：React 动态岛 + 配置界面
```

后续如果 Electron 内存超过目标，再把状态模型和 UI 迁移到 Tauri。

---

## 7. 推荐系统架构

### 7.1 总体分层

```text
Claude Code Integration Layer
        ↓
State Aggregator / Normalizer
        ↓
Runtime Event Bus
        ↓
HUD Renderer + Settings UI
        ↓
Window/System Shell Layer
```

### 7.2 集成层

输入源：

- statusLine snapshot。
- hook events。
- transcript tail（可选）。
- 本地日志成本扫描（可选）。
- OpenTelemetry（后续）。

### 7.3 统一状态模型

建议第一版就定义稳定状态模型：

```ts
type ClaudeHudState = {
  session: {
    id?: string
    name?: string
    cwd?: string
    projectDir?: string
    transcriptPath?: string
    modelId?: string
    modelDisplayName?: string
    claudeVersion?: string
  }
  state:
    | 'unknown'
    | 'idle'
    | 'thinking'
    | 'tool_running'
    | 'waiting_permission'
    | 'compacting'
    | 'done'
    | 'error'
  activeTool?: {
    name: string
    summary?: string
    startedAt: number
  }
  context?: {
    usedPercentage?: number
    remainingPercentage?: number
    windowSize?: number
    inputTokens?: number
    outputTokens?: number
    cacheCreationTokens?: number
    cacheReadTokens?: number
    isStale?: boolean
  }
  cost?: {
    sessionUsd?: number
    totalDurationMs?: number
    apiDurationMs?: number
    linesAdded?: number
    linesRemoved?: number
  }
  rateLimits?: {
    fiveHourUsed?: number
    weeklyUsed?: number
    resetAt?: string
  }
  recentEvents: HudEvent[]
  updatedAt: number
}
```

UI 只消费 `ClaudeHudState`，不直接消费原始 hook JSON。

### 7.4 本地通信通道

推荐演进路线：

#### MVP：原子 JSON + JSONL

```text
statusline.ps1  -> latest-status.json
hook-event.ps1  -> events.jsonl
HUD             -> watch / tail 文件
```

优点：简单、可调试、无需本地 server。  
缺点：实时性和并发一般，需要处理半写入。

写最新快照时必须原子替换：

```powershell
$tmp = "$target.tmp"
$json | Set-Content -LiteralPath $tmp -Encoding UTF8
Move-Item -LiteralPath $tmp -Destination $target -Force
```

#### 正式版：Named Pipe

```text
bridge CLI -> Named Pipe -> HUD daemon -> UI event bus
```

优点：低延迟、低开销、Windows 原生、安全边界更好。  
缺点：实现复杂度更高。

#### 调试版：localhost WebSocket

```text
statusLine / hooks -> localhost HTTP POST -> HUD WebSocket event bus
```

优点：前端调试方便。  
缺点：端口管理、安全和防火墙体验要处理。

---

## 8. 状态机设计

### 8.1 事件到状态的推导

| 输入 | 推导状态 |
| --- | --- |
| `SessionStart` | `idle` / `unknown` 初始化 |
| `UserPromptSubmit` | `thinking` |
| `PreToolUse` | `tool_running` |
| `PostToolUse` | 若无其他活跃工具，回到 `thinking` |
| `PostToolUseFailure` | `error` 或 `tool_failed` 后回到 `thinking` |
| `PermissionRequest` | `waiting_permission` |
| `PermissionDenied` | `error` / `permission_denied` |
| `PreCompact` | `compacting` |
| `PostCompact` | `thinking`，context 标记 stale |
| `Stop` | `done`，短暂停留后 `idle` |
| `StopFailure` | `error` |

### 8.2 容错规则

hooks 不是可靠队列，HUD 必须容错：

- 工具开始后长时间没有结束：显示 `running too long` 或 `unknown`。
- 收到 `Stop` 时清空 active tools。
- 收到新 `UserPromptSubmit` 时清理上一轮残留状态。
- event ts 乱序时按 session_id + event type + local receive time 做合并。
- statusLine snapshot 永远可以覆盖 session/model/context/cost 快照字段。
- transcript tail 只补充，不反向覆盖 hook 状态。

---

## 9. 实时性目标

| 场景 | MVP 目标 | 优化目标 |
| --- | ---: | ---: |
| 工具开始/结束 | < 500ms | 100-300ms |
| 用户提交后进入工作态 | < 500ms | 100-300ms |
| 权限等待提示 | < 500ms | 100-300ms |
| statusLine 快照更新 | < 1s | 300-500ms |
| context 百分比 | < 2s | 500ms-1s |
| 历史费用统计 | < 10s | 1-5s |
| 配置变更 | 即时 | 即时 |

注意：上下文 token 不是逐 token 实时，它来自最近 API 响应后的快照。不能承诺“每个 token 实时变化”。

---

## 10. CPU / 内存预算

### 10.1 性能预算

| 指标 | MVP 目标 | 优化目标 |
| --- | ---: | ---: |
| Idle CPU | < 1% | < 0.2% |
| Working CPU | < 3% | < 1% |
| 常驻内存 Electron | < 180MB | < 150MB |
| 常驻内存 Tauri | < 100MB | < 80MB |
| 状态延迟 | < 500ms | < 200ms |
| 启动时间 | < 2s | < 1s |

### 10.2 关键策略

- 不做高频全局 polling。
- 文件变化使用 watcher + debounce。
- JSONL tail 记录 offset，不重复全量读。
- 历史日志扫描后台低优先级。
- 状态对象 diff，无变化不 emit。
- UI 动画只用 `transform` / `opacity`。
- 没有状态变化时不触发前端 re-render。
- 配置页关闭时销毁窗口或释放重组件。
- 全屏 / 隐藏 / 锁屏时暂停动画。

---

## 11. 可视化配置界面需求

### 11.1 外观配置

- 主题：深色、浅色、系统、自定义。
- 背景：纯色、半透明、亚克力感、低功耗无模糊。
- 圆角。
- 阴影强度。
- 字体大小。
- 状态颜色。
- 动画强度。
- 减少动画。

### 11.2 布局配置

- 显示器选择：主屏、鼠标所在屏、指定屏。
- 锚点：顶部居中、顶部左侧、顶部右侧、自定义。
- X/Y 偏移。
- HUD 宽度限制。
- 展开方向。
- 任务栏避让。
- 全屏应用时行为：隐藏 / 保留 / 降透明度 / 只显示告警。

### 11.3 状态显示配置

可开关显示：

- 模型。
- 当前工具。
- 最近工具。
- context 百分比。
- token 明细。
- 费用估算。
- 项目名。
- 会话名。
- 耗时。
- rate limits。

阈值：

- context 70% 提醒。
- context 85% 警告。
- context 95% 紧急。

### 11.4 Claude Code 集成配置

配置界面应提供安装向导：

- 检测用户 Claude Code settings 路径。
- 显示当前是否已有 statusLine。
- 一键安装 / 卸载 HUD statusLine side-channel。
- 一键安装 / 卸载 HUD hooks。
- 提供全局安装和项目安装两种模式。
- 修改前展示 diff，自动备份，支持恢复。
- 显示最近收到的 raw snapshot / event，方便排查。

集成级别建议：

1. **基础**：statusLine。
2. **标准**：statusLine + hooks。
3. **高级**：statusLine + hooks + transcript tail。
4. **监控**：再加 OpenTelemetry。

### 11.5 性能配置

- 低功耗模式。
- 减少动画。
- 禁用 transcript tail。
- 历史日志扫描频率。
- history cache 最大大小。
- 最大事件保留条数。
- Debug raw event 是否保存。

### 11.6 快捷键

- 显示 / 隐藏 HUD。
- 展开 / 收起。
- 打开设置。
- 切换点击穿透。
- 切换勿扰模式。
- 临时固定显示当前状态。

---

## 12. Windows 窗口层关键风险

### 12.1 always-on-top 不稳定

Windows 上 topmost 可能被这些因素影响：

- 全屏游戏或视频。
- UAC 安全桌面。
- 其他 topmost 窗口。
- Explorer 重启。
- 睡眠恢复。
- 多显示器热插拔。
- DPI 改变。

策略：

- 启动时设置 topmost。
- 监听显示器变化、resume、Explorer 重启。
- 事件触发时重新 apply flags。
- 不要每秒循环 SetWindowPos。

### 12.2 点击穿透与不抢焦点

HUD 默认不应抢走 Claude Code 终端输入焦点。

策略：

- 默认 no-activate。
- 收起态 click-through。
- 展开态才进入交互。
- 配置窗口是独立 focusable window。
- 托盘和快捷键作为逃生通道。

### 12.3 多显示器 / DPI

必须在 M0 阶段验证：

- 100% / 125% / 150% 缩放。
- 主屏变化。
- 外接显示器断开。
- 任务栏位于顶部。
- 多显示器不同 DPI。
- 窗口坐标从逻辑像素到物理像素的换算。

---

## 13. 推荐里程碑

### M0：窗口与 UI Spike（约 1 周）

目标：验证 Win11 动态岛窗口是否可稳定实现。

范围：

- Tauri 和 Electron 各做一个最小 spike。
- 透明无边框置顶窗口。
- 顶部居中胶囊。
- hover 展开。
- 点击穿透。
- 不抢焦点。
- 托盘退出。
- 全局快捷键。
- 多显示器和 DPI 验证。

输出：

- 技术选型结论。
- CPU/内存对比。
- Win32 窗口风险清单。

### M1：Claude Code 基础集成（1-2 周）

目标：statusLine 快照驱动 HUD。

范围：

- 定义 `ClaudeHudState`。
- 实现 statusLine side-channel。
- HUD 显示 session/model/context/cost。
- state cache。
- 基础设置页。

输出：

- 可用 MVP。
- 状态延迟 < 500ms。

### M2：Hooks 实时增强（1-2 周）

目标：工具调用和权限等待实时显示。

范围：

- `PreToolUse` / `PostToolUse` / `PostToolUseFailure`。
- `PermissionRequest` / `PermissionDenied`。
- `Stop` / `StopFailure`。
- `PreCompact` / `PostCompact`。
- 事件去重、节流、超时恢复。
- Debug raw event panel。

输出：

- 工具态稳定。
- hook 失败不影响 Claude Code。

### M3：可视化配置中心（约 2 周）

目标：不用手改 JSON。

范围：

- 外观配置。
- 布局配置。
- 显示项配置。
- 集成安装向导。
- 快捷键配置。
- 性能模式配置。
- 配置导入/导出。

输出：

- 完整 Settings UI。
- 配置实时预览。

### M4：性能与稳定性（1-2 周）

目标：长时间常驻可用。

范围：

- CPU profiling。
- 内存 profiling。
- 动画停机。
- 文件 watcher debounce。
- transcript 增量解析。
- 全屏应用自动隐藏。
- Explorer 重启恢复。
- sleep/resume 恢复。

输出：

- idle CPU < 1%。
- 内存稳定。
- 连续 8 小时无明显泄漏。

### M5：产品化发布（1-2 周）

范围：

- 安装包。
- 自动更新。
- 代码签名。
- 崩溃日志。
- 诊断包。
- README / FAQ。
- 卸载与配置恢复。

---

## 14. MVP 范围建议

第一版建议只做：

1. Win11 顶部动态岛 HUD。
2. statusLine 集成。
3. hooks 工具态集成。
4. 展示当前状态、模型、context 百分比、当前工具、会话耗时。
5. 托盘菜单。
6. 设置页：位置、主题、显示项、低功耗、集成状态。
7. Debug 页：最近 snapshot / hook event。
8. 状态 cache，HUD 重启后可恢复最近状态。

暂不做：

- 完整历史费用报表。
- Claude OAuth usage endpoint 深度集成。
- OpenTelemetry collector。
- 插件市场。
- 跨平台。
- AI 自动总结任务。
- 远程同步。

---

## 15. 主要风险与应对

### 风险 1：Claude Code 状态源不是完整实时 API

应对：

- statusLine 做快照。
- hooks 做事件。
- transcript 只补充。
- 本地状态机容错。
- 不承诺逐 token 实时。

### 风险 2：Windows 悬浮窗细节复杂

应对：

- M0 先验证窗口层。
- 做 Tauri/Electron 双 spike。
- 保留托盘和快捷键逃生。
- 全屏时行为可配置。

### 风险 3：CPU/内存过高

应对：

- Tauri 优先。
- 事件驱动。
- 空闲停动画。
- 增量解析。
- 状态 diff。
- 低功耗模式。

### 风险 4：隐私泄露

应对：

- 默认不展示 prompt 正文。
- tool_input 摘要化。
- 敏感字段脱敏。
- 数据默认仅本地保存。
- 不默认上传 telemetry。

### 风险 5：自动修改 Claude Code settings 引发冲突

应对：

- 修改前展示 diff。
- 自动备份。
- 支持撤销。
- 区分全局和项目级配置。
- 支持手动复制配置。

---

## 16. 验收标准

### 功能验收

- Claude Code 未运行时 HUD 不报错。
- Claude Code 运行后可显示 session/model/cwd/context。
- 用户提交 prompt 后 HUD 进入 working 状态。
- 工具调用时显示工具名和摘要。
- 权限等待时显示 waiting permission。
- Stop 后回到 done/idle。
- HUD 可隐藏、可通过托盘恢复。
- 设置页能修改位置、主题、显示项。

### 性能验收

- idle CPU < 1%。
- Tauri 常驻内存目标 < 100MB，优化目标 < 80MB。
- Electron MVP 常驻内存目标 < 180MB。
- hooks 到 HUD 状态延迟 < 500ms。
- 无状态变化时不持续写磁盘。
- 连续运行 8 小时无明显内存泄漏。

### Windows 兼容验收

- Windows 11 单屏正常。
- Windows 11 多屏正常。
- 125% / 150% DPI 正常。
- 任务栏顶部/底部场景可配置避让。
- 全屏应用下行为可配置。
- Explorer 重启后可恢复或自动重启。

---

## 17. 最终建议

本项目建议按以下路线推进：

1. **先做 M0 双 spike，不急着写完整功能。**  
   Win11 HUD 最大不确定性在窗口层：透明、置顶、点击穿透、不抢焦点、多屏 DPI。先验证 Tauri 和 Electron 哪个更稳。

2. **若 Tauri 窗口行为稳定，选择 Tauri 作为主架构。**  
   它更符合低 CPU/低内存目标，Rust 后端也适合做状态采集、Named Pipe、文件监听和 Win32 interop。

3. **若 Tauri 早期踩坑过多，用 Electron 快速做 MVP。**  
   Electron 更适合高质量 UI 快速迭代，但要接受较高内存。状态模型和前端组件设计好后，后续迁移成本可控。

4. **Claude Code 集成优先走官方入口。**  
   第一阶段 `statusLine + hooks + 本地 side-channel`；transcript 只读补充；OpenTelemetry 后续增强。

5. **把 UI 效果和性能同时作为一等需求。**  
   动态岛要好看，但不能靠持续高频动画堆效果；需要状态驱动的克制动画、低功耗模式、空闲停机。

6. **可视化配置界面从早期就做。**  
   因为 Win11 显示器、DPI、全屏、点击穿透差异非常大，配置 UI 是可用性的关键，不是锦上添花。

---

## 18. 下一步建议

建议下一步直接进入 M0：

- 建立 Tauri spike。
- 建立 Electron spike。
- 两者都只做：透明置顶胶囊、hover 展开、点击穿透、托盘、快捷键、多屏 DPI。
- 记录 CPU/内存和窗口稳定性。
- 再决定主技术栈。

同时可以并行准备：

- `ClaudeHudState` schema。
- statusLine side-channel 脚本原型。
- hook-event 脚本原型。
- 配置文件 schema。
