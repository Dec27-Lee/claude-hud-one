# Win11 Claude HUD One 一期正式产品方案：完整复刻 codex-island

> 日期：2026-06-08  
> 状态：正式一期需求与实现方案草案  
> 适用范围：Windows 11 版本 Claude HUD One，一期按正式发布产品打造，完整复刻 macOS 参考项目 `codex-island` 已有功能，并保留 Windows/Claude Code 实时状态增强空间。

## 0. 范围修正声明

上一版文档以“Win11 Claude Code 状态 HUD / MVP”为主线，曾建议第一阶段暂不做完整 Usage / Cost / Codex / 发布更新链路。根据用户最新要求，本方案正式修正为：

1. **一期不是简化 MVP，而是正式发布产品的一期完整复刻。**
2. **参考项目 `codex-island` 已有功能默认全部进入一期范围。**
3. **macOS 能借鉴的设计、数据源、缓存、设置、低功耗、告警、发布机制，都要迁移到 Win11 等价实现。**
4. **Windows 版要完成正式产品闭环：安装包、自动更新、版本规则、日志诊断、隐私说明、卸载策略、发布验收。**
5. **Claude Code 当前会话状态 HUD 能力仍保留为 Windows 增强模块，但不能替代参考项目已有的 Usage / Cost / Overview / Claude + Codex 双 provider 主线。**

因此，旧文中的“暂不做完整历史费用报表”“暂不做 Claude OAuth usage endpoint 深度集成”“MVP 后再产品化”等结论不再适用。本文件作为一期正式复刻范围的主依据。

### 0.1 2026-06-09 本轮发布范围修订

用户已进一步确认本轮交付口径：

1. Usage 直接使用 Claude Code 自身 statusLine 估算信息，可参考 `E:\Develop_E\claude-hud-plus` 的采集经验；本轮不优先接官方 usage endpoint。
2. Codex 本次不考虑实现，已有代码保留，但前端默认不展示；后续需要时再恢复并补 Windows 实测。
3. 发布目标不上架应用商店，但需要满足常规桌面应用使用：安装、卸载、手动更新/覆盖安装、开机启动、本地诊断和 release 验证。
4. Windows 原生交互通过本机双屏环境验证。
5. 产品交互闭环要补齐：手动刷新、alerts 阈值反馈、手动更新入口、settings 持久化一致性。

因此，本文件中关于 Codex、官方 usage endpoint、自动 updater/signing 的内容保留为完整对标方向；当前可发布使用版本以 Claude Code 单 provider、Claude Code estimate Usage、手动更新闭环为验收口径。

## 1. 一期产品定位

### 1.1 产品一句话

Claude HUD One 是 Windows 11 上的 Claude/Codex 动态岛桌面 HUD：常驻屏幕顶部，实时展示 Claude 与 Codex 的用量窗口、成本估算、年度 Overview，并提供完整设置、低功耗、告警、托盘、自动更新与正式发布能力。

### 1.2 一期目标

- 在 Win11 上复刻 `codex-island` 的核心产品体验：compact / peek / expanded 三态动态岛。
- 支持 Claude 与 Codex 双 provider。
- 支持 Usage / Cost / Overview 三页。
- 支持 5 小时与 7 天用量窗口。
- 支持本地日志成本估算、token 统计口径、图表样式、成本展示样式、provider 可见性、低功耗、告警、刷新间隔、语言、显示器选择、开机启动。
- 支持正式产品发布：安装包、自动更新、签名、版本规则、诊断日志、隐私说明、README / FAQ。
- 在 Windows 上实现透明置顶、不抢焦点、点击穿透、多屏 DPI、全屏避让、托盘等原生桌面能力。

### 1.3 一期非目标

这些不属于一期必须复刻的参考项目功能，可后续增强：

- 云同步、多设备同步。
- 默认遥测、默认崩溃上报、第三方 analytics。
- 低于 5 分钟的 usage endpoint 轮询。
- 插件市场、主题市场。
- Microsoft Store 首发。
- 覆盖独占全屏游戏或反作弊游戏上层显示。
- 官方账单对账级精确成本；一期仍定位为本地日志估算成本。

## 2. 参考项目功能总清单与 Windows 一期映射

| 参考项目功能 | macOS 实现 | Win11 一期映射 | 一期要求 | 主要风险 / 验证 |
| --- | --- | --- | --- | --- |
| 顶部动态岛 | `NSWindow` 透明无边框置顶，贴合刘海/菜单栏 | Tauri 透明 overlay + Rust Win32 HWND 控制 | 必做 | 透明黑底、DPI、置顶稳定性 |
| compact / peek / expanded | `IslandModel.State` 三态 | React 状态机 + Rust 命中区域同步 | 必做 | 动画与点击穿透一致性 |
| hover 预览 | 鼠标进入岛体显示 5h pill | Win32 鼠标命中 + 前端 hover 动画 | 必做 | 不抢焦点、hover 边界 |
| 点击展开 | 点击岛体展开 Usage/Cost/Overview | overlay 局部可交互，面板外穿透 | 必做 | `WS_EX_NOACTIVATE` 与 WebView 事件兼容 |
| Usage 页 | Claude/Codex 5h + 7d 用量 | 完整复刻 | 必做 | endpoint 与凭据兼容 |
| Cost 页 | 本地日志估算 today / MTD 成本 | Windows 路径扫描 + cache | 必做 | 路径、日志格式、性能 |
| Overview 页 | 年度 contribution grid | Canvas/SVG grid | 必做 | 大数据渲染性能 |
| Claude provider | OAuth usage endpoint + Keychain 凭据 | Windows Credential Manager / Claude 配置 / env token | 必做 | 凭据位置与 refresh 写回 |
| Codex provider | `~/.codex/auth.json` + ChatGPT usage endpoint | `%USERPROFILE%\.codex\auth.json` / `CODEX_HOME` | 必做 | Windows Codex 路径需实测 |
| Chart styles | Ring / Bar / Stepped / Numeric / Sparkline | React 图表组件 | 必做 | 样式一致性与低 DOM 成本 |
| Cost styles | USD / VALUE / TOKENS / TREND | React CostBlock + sparkline | 必做 | 估算口径解释 |
| Token count mode | all / billable | 设置项 + 聚合双口径 | 必做 | 与 cost scan 数据一致 |
| Provider visibility | Claude/Codex 隐藏与布局重排 | 设置项 + 状态保留 | 必做 | 隐藏不停止刷新 |
| Refresh interval | 5m / 15m / 30m | scheduler 同步 Usage/Cost | 必做 | 禁止低于 5m |
| Manual refresh | footer refresh | footer + 托盘 refresh | 必做 | 防并发、错误保留旧值 |
| Low power mode | 用户设置 + 系统低功耗 | 用户设置 + Windows 电池/省电模式 | 必做 | 动画 gating |
| Approaching-limit alerts | 5h warning/critical glow/pulse | amber/red glow + peek pulse | 必做 | reset cycle 去重 |
| Launch at login | `SMAppService` | HKCU Run / Tauri autostart | 必做 | 状态读取和权限 |
| Language | Auto / English / 简体中文 | i18n + 重启提示 | 必做 | 字符串覆盖 |
| Target display | Auto / 指定显示器 | 多屏枚举 + display id 持久化 | 必做 | 热插拔和 DPI |
| Settings window | 自定义无 Dock 设置窗口 | 普通 Settings window + 任务栏策略 | 必做 | 设置即时生效 |
| No telemetry | 本地优先 | 默认无遥测/无 crash report | 必做 | 隐私说明与日志脱敏 |
| Auto update | Sparkle | Tauri updater 或等价签名更新 | 必做 | key、manifest、签名 |
| Release package | DMG / Homebrew / GitHub Release | NSIS/MSI + GitHub Release + checksum | 必做 | 签名与 SmartScreen |

## 3. 一期产品信息架构

### 3.1 主界面层级

```text
Claude HUD One
├─ Overlay Island
│  ├─ Compact：顶部胶囊/岛体
│  ├─ Peek：左右 5h usage pill
│  └─ Expanded
│     ├─ Usage 页
│     ├─ Cost 页
│     └─ Overview 页
├─ Settings Window
│  ├─ General
│  ├─ Display
│  ├─ Providers
│  └─ About / Diagnostics
├─ Tray Menu
│  ├─ Show / Hide Island
│  ├─ Open Settings
│  ├─ Refresh Now
│  ├─ Check for Updates
│  ├─ Launch at Login
│  ├─ Diagnostics
│  └─ Quit
└─ Release / Update Flow
   ├─ Update available
   ├─ Download / install prompt
   ├─ Restart to apply
   └─ Failure fallback
```

### 3.2 主状态模型建议

旧版文档中 `ClaudeHudState` 太窄，一期建议改为更通用的 `IslandAppState`：

```ts
type IslandAppState = {
  ui: {
    islandState: 'compact' | 'peek' | 'expanded'
    activePage: 'usage' | 'cost' | 'overview'
    targetDisplayId: string | 'auto' | 'primary'
    isHovering: boolean
    isFullscreenHidden: boolean
    lowPowerEffective: boolean
  }
  providers: {
    claude: ProviderState
    codex: ProviderState
  }
  cost: {
    claude: CostSummaryState
    codex: CostSummaryState
    tokenCountMode: 'all' | 'billable'
    unknownModels: string[]
    lastUpdated?: string
    isLoading: boolean
  }
  settings: SettingsState
  alerts: AlertState
  update: UpdateState
  claudeCodeSession?: ClaudeCodeSessionState
}
```

`ProviderState` 统一包含：

```ts
type ProviderState = {
  visible: boolean
  plan?: string
  fiveHour: WindowUsageState
  weekly: WindowUsageState
  error?: ProviderError
  stale: boolean
  lastUpdated?: string
}

type WindowUsageState = {
  usedPercent: number // 0..1
  resetAt?: string
  error?: string
}
```

## 4. UI 与交互复刻规格

### 4.1 Compact

- 位于目标显示器顶部中央。
- Windows 没有物理刘海，默认以“顶部中央胶囊”模拟。
- 胶囊两侧显示 Claude / Codex provider 标识。
- 默认不抢焦点，不阻挡岛外点击。
- 在全屏应用中默认隐藏。

### 4.2 Peek

触发方式：

- 鼠标进入岛体。
- 开启 Always show usage 时常驻。
- Usage alert 跨阈值时自动 pulse 展开约 4 秒。

展示内容：

- Claude 5h 用量百分比与 reset 剩余时间。
- Codex 5h 用量百分比与 reset 剩余时间。
- warning / critical 颜色状态。
- provider 被隐藏时按设置隐藏对应 pill，但内部数据继续刷新。

### 4.3 Expanded

触发方式：

- 点击 compact / peek 岛体。
- 不应激活或抢走当前工作应用焦点。

面板结构：

- Header：provider 标识、标题与关键状态。
- PagedContent：Usage / Cost / Overview。
- Footer：同步状态、手动刷新、样式 chip、page dots、设置按钮。

交互：

- 横向滚动/拖拽切换页面。
- page dots 指示当前页。
- 首次展开可保留轻微 discoverability peek。
- 点击设置齿轮打开 Settings window。
- 页面切换持久化。

### 4.4 Usage 页

必须展示：

- Claude 与 Codex 双 provider。
- 每个 provider 的 5h / 7d usage。
- reset time。
- plan badge。
- provider 错误态。
- Claude 403 scope insufficient 时提示重新登录。
- Codex 无 auth 时提示 codex login。
- per-model breakdown：单 provider 模式下显示。

图表样式：

- Ring。
- Bar。
- Stepped。
- Numeric。
- Sparkline。

### 4.5 Cost 页

必须展示：

- Claude today cost。
- Claude month-to-date cost。
- Codex today cost。
- Codex month-to-date cost。
- token throughput。
- all / billable token 口径。
- trend sparkline。
- unknown model warning。
- per-model cost/token breakdown。

Cost view：

- USD。
- VALUE。
- TOKENS。
- TREND。

文案要求：

- 明确标注为 estimated cost。
- 说明成本来自本地日志与内置 pricing snapshot，不等同官方账单。

### 4.6 Overview 页

必须展示：

- 当前年份 contribution grid。
- 每日 token 活动强度。
- provider 主导色：Claude / Codex / Mixed / None。
- 年度 total tokens。
- active days。
- Claude / Codex split。
- 点击某日显示详情条：total、Claude、Codex、split meter。
- 选中日期后面板高度动态增加。
- 离开 Overview 清除选中。

### 4.7 动画与低功耗

默认动画：

- compact → peek morph。
- peek → expanded morph。
- 内容 fade / slide。
- loading sweep。
- alert glow。
- 数字 count-up。

低功耗模式：

- 用户手动开启或 Windows 电池/省电模式触发时生效。
- ambient glow 默认关闭。
- loading sweep 只在刷新时显示。
- hover / alert 时允许短时动画。
- overlay 隐藏、全屏避让、锁屏、不可见时暂停动画。

## 5. 设置界面完整规格

### 5.1 General

| 设置项 | 值 | 默认 | 要求 |
| --- | --- | --- | --- |
| Launch at Login | on/off | off | 写入/读取 HKCU Run 或 Tauri autostart 状态 |
| Refresh interval | 5m / 15m / 30m | 5m | 禁止低于 5m，修改后重建 scheduler |
| Language | Auto / English / 简体中文 | Auto | 修改后提示重启或热更新语言 |
| Always show usage | on/off | off | 开启后 rest state 使用 peek |
| Low Power Mode | on/off | off | 与系统省电模式取 OR |
| Fullscreen avoidance | on/off | on | 全屏应用时隐藏岛 |
| Alerts enabled | on/off | off | 默认关闭 |
| Warning threshold | 50..98 | 80 | 必须小于 critical |
| Critical threshold | 51..99 | 95 | 必须大于 warning |
| Auto check updates | on/off | on | 对接 updater |
| Check now | button | - | 手动检查更新 |

### 5.2 Display

| 设置项 | 值 | 默认 | 要求 |
| --- | --- | --- | --- |
| Target display | Auto / Primary / 指定显示器 | Auto | 热插拔后自动回退 |
| Top offset | px | 0 | 避让任务栏/工具栏 |
| Island spacing/width | Compact / Notch-style / Custom | Notch-style | Windows 无刘海默认胶囊宽度 |
| Panel scale | 90%..120% | 100% | 适配高 DPI |
| Chart style | Ring / Bar / Stepped / Numeric / Sparkline | Ring | Usage 默认样式 |
| Cost view | USD / VALUE / TOKENS / TREND | USD | Cost 默认样式 |

### 5.3 Providers

| 设置项 | 值 | 默认 | 要求 |
| --- | --- | --- | --- |
| Claude visible | on/off | on | 只影响 UI，不停止刷新 |
| Codex visible | on/off | on | 只影响 UI，不停止刷新 |
| Token counting | all / billable | all | 切换无需重扫日志 |
| Claude status | read-only | - | 显示 auth、plan、last sync、错误 |
| Codex status | read-only | - | 显示 auth、plan、last sync、错误 |
| Cost scan status | read-only | - | 显示 last scan、unknown models、pricing snapshot |
| Refresh cost | button | - | 触发 CostStore scan |
| Re-auth Claude | button | 条件显示 | 调用 Claude CLI 登录流程 |

### 5.4 About / Diagnostics

一期正式产品建议新增 About/Diagnostics，作为 Windows 发布产品必备入口：

- Version。
- GitHub / License。
- Privacy note。
- Update status。
- Open logs folder。
- Export diagnostics（脱敏）。
- Copy diagnostic summary（不含 token / prompt / raw transcript）。
- Quit。

## 6. 数据源与凭据迁移方案

### 6.1 Usage 与 Cost 两条数据链路

```text
Usage：远程 usage endpoint
├─ Claude：api.anthropic.com/api/oauth/usage
└─ Codex：chatgpt.com/backend-api/wham/usage

Cost：本地日志估算
├─ Claude Code JSONL：projects/**/*.jsonl
└─ Codex sessions：sessions/YYYY/MM/DD/rollout-*.jsonl
```

Usage 负责 provider quota window，Cost 负责本地成本估算与 model breakdown。两者不要混为一条链路。

### 6.2 Claude Usage

请求：

- URL：`https://api.anthropic.com/api/oauth/usage`
- Header：
  - `Authorization: Bearer <token>`
  - `anthropic-beta: oauth-2025-04-20`
  - `User-Agent: claude-code/<version>`
  - `Accept: application/json`
  - `Content-Type: application/json`

解析：

- `five_hour` → 5h window。
- `seven_day` → weekly window。
- `utilization` / `used_percent` 归一化为 0..1。
- `resets_at` 支持 Unix seconds / ISO8601。
- plan 优先来自本地 Claude credentials 中的 `subscriptionType`。

错误语义：

| 错误 | UI 文案 | 行为 |
| --- | --- | --- |
| 401 | auth expired / re-login | 尝试 refresh；失败后提示登录 |
| 403 | re-login: claude /login | 不无限 retry，提示 scope 不足 |
| 429 | rate limited | 保留旧好值 |
| parse error | parse error | 保留旧好值 |
| network error | network error | 保留旧好值 |

### 6.3 Claude 凭据 Windows 适配

macOS 参考项目使用 Keychain；Windows 必须实测 Claude Code / Claude Desktop 的实际存储方式。建议抽象：

```text
ClaudeCredentialProvider
├─ EnvProvider：CLAUDE_CODE_OAUTH_TOKEN
├─ WindowsCredentialManagerProvider：CredRead / CredWrite
├─ ClaudeConfigFileProvider：如 Claude Code Windows 使用配置文件
└─ ClaudeCliReauthProvider：调用 claude auth login / claude /login
```

必须遵守：

- 不在日志中打印 access token / refresh token。
- refresh token 轮换后必须写回原凭据来源。
- 写回失败要提示风险，不能静默破坏 Claude Code / Claude Desktop 登录态。
- 如果凭据来源无法安全写回，则不要自动 refresh；改为提示用户重新登录。

### 6.4 Codex Usage

请求：

- URL：`https://chatgpt.com/backend-api/wham/usage`
- Header：`Authorization: Bearer <access_token>`

token 路径：

- `%CODEX_HOME%\auth.json`（若设置）。
- `%USERPROFILE%\.codex\auth.json`。

读取字段：

- `tokens.access_token`。
- `rate_limit.primary_window`。
- `rate_limit.secondary_window`。
- `plan_type`。

错误语义：

- no codex auth。
- auth expired — codex login。
- http `<status>`。
- parse error。
- network error。

### 6.5 Claude Cost 日志扫描

Windows 路径：

- `%USERPROFILE%\.claude\projects\**\*.jsonl`
- `%USERPROFILE%\.config\claude\projects\**\*.jsonl`
- `CLAUDE_CONFIG_DIR=<dir>[,<dir>]` → `<dir>\projects`

解析规则：

- 顶层 `type == "assistant"`。
- `message.usage` 存在。
- `message.model` 存在。
- 跳过 synthetic / noop。
- 跳过全 0 usage。
- 提取 input / output / cache_creation / cache_read tokens。
- `message.id + ':' + requestId` 去重；缺任一 ID 则不去重。
- timestamp 支持 ISO8601 fractional / non-fractional。

### 6.6 Codex Cost 日志扫描

Windows 路径：

- `%CODEX_HOME%\sessions\YYYY\MM\DD\rollout-*.jsonl`
- `%USERPROFILE%\.codex\sessions\YYYY\MM\DD\rollout-*.jsonl`

解析规则：

- 跟踪 `turn_context.payload.model` 作为 active model。
- 只解析 `event_msg` 且 `payload.type == "token_count"`。
- 使用 `payload.info.last_token_usage`，不用 total diff。
- Codex input_tokens 包含 cached tokens，需拆分为：
  - nonCachedInput = max(0, input_tokens - cached_input_tokens)
  - cacheReadTokens = cached_input_tokens

### 6.7 Cache 设计

Windows cache 目录：

- `%LOCALAPPDATA%\Claude HUD One\Cache\`

缓存文件：

- `claude-parse-cache.v1.json`
- `codex-parse-cache.v1.json`

缓存 key：

- normalized absolute path。
- mtime。
- size。

要求：

- 64KB chunk 流式读取 JSONL。
- 大文件不整文件读入内存。
- mtime/size 命中跳过解析。
- 文件删除或滚出 cutoff 后 prune。
- cache 写失败不影响 UI。
- cache 中不保存 prompt、tool result、raw JSON line。

### 6.8 Pricing 与成本声明

一期复刻参考项目内置 pricing snapshot 的策略：

- 按 model 计算 input/output/cache creation/cache read 成本。
- Unknown model cost = 0，但必须进入 unknown model warning。
- UI 必须标注 estimated cost。
- 需要在 About / FAQ 说明：成本估算不等同官方账单。

建议在实现时把 pricing snapshot 与版本分离，后续可单独更新。

## 7. Windows Shell 与系统能力

### 7.1 推荐技术栈

建议一期主栈：

> Tauri 2 + Rust Win32 native layer + React / TypeScript UI + WebView2。

理由：

- 常驻桌面工具需要较低内存和 CPU。
- React/TypeScript 便于快速复刻高度定制 UI、图表和设置。
- Rust 侧可直接处理 Win32 窗口样式、DPI、托盘、文件扫描、凭据与 updater。
- Tauri 打包、更新器、NSIS/MSI 支持较适合正式发布。

Electron 作为 Plan B，仅在 Tauri/WebView2 透明窗口、不抢焦点或点击穿透无法稳定实现时启用。

### 7.2 Overlay Window

必须实现：

- transparent。
- frameless。
- topmost。
- tool window，不进入 Alt-Tab。
- no activate。
- click-through。
- per-monitor DPI aware。
- show without activation。

Win32 样式建议：

- `WS_EX_LAYERED`
- `WS_EX_TRANSPARENT`（按命中区域动态切换）
- `WS_EX_TOOLWINDOW`
- `WS_EX_NOACTIVATE`
- `SetWindowPos(HWND_TOPMOST, ..., SWP_NOACTIVATE)`

### 7.3 点击穿透与命中区域

策略：

- overlay 实际窗口可以覆盖 compact/expanded 动画范围。
- 只有 island/expanded panel 可见区域接收鼠标。
- 其他区域必须穿透到后方应用。
- 前端状态变化时把当前 hit rect 同步给 Rust。
- Rust 用物理像素做最终命中判断，避免 CSS px 与 DPI 缩放错位。

验收：

- 岛外点击后方应用按钮可触发。
- 岛外拖拽可拖动后方窗口。
- 岛外滚轮可滚动后方页面。
- 岛体 hover/click 正常。

### 7.4 不抢焦点

要求：

- 点击岛展开后，原 Windows Terminal / VS Code / Browser 仍保持键盘焦点。
- 只有打开 Settings window 时才激活应用。

实现：

- overlay 使用 `WS_EX_NOACTIVATE`。
- `WM_MOUSEACTIVATE` 返回 no-activate 结果。
- 显示与 resize 使用 `SWP_NOACTIVATE`。
- 避免任何会激活 overlay 的 API 调用。

### 7.5 多屏与 DPI

必须支持：

- 单屏 100/125/150/200%。
- 双屏不同缩放比例。
- 主屏在左/右/上/下。
- 外接屏热插拔。
- DPI 改变后不重启恢复。
- RDP 场景。

显示器选择：

- Auto：优先当前鼠标所在屏或主屏。
- Primary：固定主屏。
- 指定显示器：基于 display id 持久化；断开时回退 Auto，重连后恢复。

### 7.6 全屏避让

默认策略：目标显示器存在全屏前台窗口时隐藏岛。

检测：

- `GetForegroundWindow`。
- `MonitorFromWindow`。
- `GetWindowRect`。
- 与 monitor bounds 覆盖率超过阈值（如 95%）判定全屏。

行为：

- 真全屏隐藏。
- 普通最大化不隐藏。
- 退出全屏恢复。
- 默认不追求覆盖独占全屏游戏。

### 7.7 托盘

托盘是 Windows 版必需入口。

右键菜单：

- Show / Hide Island。
- Open Settings。
- Refresh Now。
- Check for Updates。
- Launch at Login。
- Diagnostics。
- Quit。

tooltip：

- 应用名。
- Claude 5h usage。
- 最近同步时间。

## 8. Claude Code 当前会话增强模块

该模块来自用户最初“Claude Code 状态信息”目标，不是 `codex-island` 的全部主线。为避免偏离“完整复刻”，建议作为一期增强模块独立验收：

### 8.1 数据入口

- Claude Code `statusLine`：获取当前模型、cwd、session、cost、context、transcript_path 等。
- Claude Code Hooks：SessionStart、PreToolUse、PostToolUse、PermissionRequest、Stop、SubagentStart/Stop 等事件。
- transcript tail：只读增量解析，不修改 transcript。
- OpenTelemetry：可作为后续增强，不阻塞一期复刻。

### 8.2 展示方式

建议不替代 Usage / Cost / Overview 三页，而是在 Windows 版中提供：

- Overview 详情区增加 Current Session card。
- Tray tooltip 增加当前 Claude Code session 状态。
- 可选新增 Session 子页，但不影响参考项目三页复刻。

### 8.3 边界

- 不注入 Claude Code 进程。
- 不修改 transcript。
- hook bridge 必须短超时、失败不阻塞 Claude Code。
- 不默认展示完整 prompt / tool input。
- token、key、password、secret、authorization 等字段必须脱敏。

## 9. 性能与实时性目标

| 指标 | 一期目标 | 说明 |
| --- | --- | --- |
| 冷启动到岛可见 | < 1.5s | 不含首次网络刷新 |
| 空闲 CPU | < 0.5% | 无 hover、无刷新、无动画 |
| hover/展开 CPU | < 5% | 中端 Win11 设备 |
| 常驻内存 | < 120MB | Tauri 目标 |
| Usage 刷新间隔 | 5/15/30m | 不低于 5m |
| 手动刷新响应 | < 300ms 进入 loading | 网络完成另计 |
| 常规日志增量解析 | < 200ms | cache 命中为主 |
| 大日志重建 | 后台 < 3s 优先 | 不阻塞 UI |
| UI 动画 | 60fps 目标 | 低功耗可降级 |
| Overlay 隐藏/全屏 | 动画暂停 | idle 接近 0 动画成本 |

关键策略：

- 事件驱动优先，避免高频全局 polling。
- usage endpoint 严格限流，最低 5 分钟。
- 日志扫描 per-file cache + streaming read。
- 前端只消费聚合后的状态，不处理 raw JSONL。
- UI 状态 diff 更新，避免全局重渲染。
- 动画只在 hover、loading、alert、transition 时运行。
- 全屏/锁屏/overlay 不可见时暂停 Timeline/RAF。

## 10. 隐私与安全要求

### 10.1 默认隐私承诺

一期必须延续参考项目本地优先原则：

- 不做默认遥测。
- 不做默认 crash reporting。
- 不接入第三方 analytics。
- 不使用自有代理服务转发 usage。
- 不要求用户输入 API key 或密码。
- 只读取本机已有 Claude / Codex 凭据和日志。
- Usage 请求只发给 Claude / Codex 对应服务。
- Cost 只扫描本地日志估算。

### 10.2 敏感数据处理

禁止写入日志：

- access token。
- refresh token。
- authorization header。
- raw credential JSON。
- raw transcript line。
- prompt 内容。
- tool_input 原文。
- secret/password/key 等字段。

诊断导出必须脱敏：

- 路径可选择保留 basename 或 hash。
- 错误码可保留。
- provider 状态可保留。
- token、prompt、raw log 禁止导出。

### 10.3 凭据 refresh 风险

Claude refresh token 会轮换。Windows 版必须在凭据 provider 支持安全写回时才自动 refresh，否则宁可提示用户重新登录，不可把新 token 只存在内存导致 Claude Code / Claude Desktop 后续失效。

## 11. 发布与更新方案

### 11.1 安装包

一期建议产物：

- P0：NSIS `.exe` 安装器。
- P1：MSI 安装包。
- P2：winget / Microsoft Store 后续。

默认 per-user 安装：

- 程序：`%LOCALAPPDATA%\Programs\Claude HUD One\`
- 设置：`%APPDATA%\Claude HUD One\settings.json`
- 日志：`%LOCALAPPDATA%\Claude HUD One\Logs\`
- 缓存：`%LOCALAPPDATA%\Claude HUD One\Cache\`

卸载：

- 默认删除程序。
- 用户数据默认保留。
- 卸载器可提供“同时清理设置和缓存”选项。

### 11.2 自动更新

建议使用 Tauri updater：

- GitHub Releases 托管安装包与 update manifest。
- CI 使用私钥签名 update manifest。
- 应用内置 updater public key。
- 启动后延迟检查。
- 每日自动检查一次。
- 设置页提供 Check now。
- 用户确认后安装更新。

硬规则：

- 版本号 semver 单调递增。
- updater public key 不可随意更换。
- release manifest 不手工编辑。
- CI 自动生成签名与 checksum。
- 未签名/未校验产物不得发布到 stable。

### 11.3 代码签名

正式发布建议必须做 Windows code signing：

- 主 exe 签名。
- 安装器签名。
- MSI 签名。
- updater sidecar 签名。
- SHA-256 timestamp。

如果短期无证书，需在文档中明确 SmartScreen 风险，但正式发布标准仍应以签名为目标。

### 11.4 发布流水线

GitHub Actions 建议：

```text
push tag vX.Y.Z
├─ run tests
├─ build frontend
├─ build Tauri app
├─ package NSIS/MSI
├─ sign binaries
├─ generate updater manifest
├─ calculate SHA-256
├─ create GitHub Release
├─ upload artifacts
└─ publish release notes / changelog
```

## 12. 一期 AI 开发执行序列

不再使用“HUD MVP”里程碑，也不做人力工期评估。全程按 AI 开发推进，以下 M0-M6 只表示依赖顺序、验证门槛和交付切片，不表示日历排期。

### M0：Windows 壳层风险验证

目标：清除最关键的 Windows 技术风险。

交付：

- Tauri 2 最小应用。
- 透明置顶 overlay。
- 点击穿透 hit rect。
- 不抢焦点验证。
- 单屏/双屏 DPI 初测。
- 全屏检测 PoC。
- 托盘 PoC。
- updater PoC。

退出标准：

- overlay 透明无黑底。
- 岛外点击穿透。
- 点击岛不抢焦点。
- 多屏 100%/150% 坐标一致。
- 若失败，启动 Electron Plan B 评审。

### M1：应用骨架与状态模型

交付：

- Tauri + React + TypeScript 工程。
- Rust native modules：window/display/fullscreen/tray/settings。
- `IslandAppState` 与 store。
- settings persistence。
- i18n 基础。
- 日志系统与诊断入口。

退出标准：

- 应用可启动、显示岛、打开设置、托盘退出。
- 状态模型可用 mock data 驱动 UI。

### M2：UI 完整复刻

交付：

- compact / peek / expanded。
- Usage / Cost / Overview 三页。
- page dots / footer / settings button。
- Ring / Bar / Stepped / Numeric / Sparkline。
- USD / VALUE / TOKENS / TREND。
- Overview grid 与日期详情。
- alert glow / low power 动画策略。

退出标准：

- 使用 mock 数据可完整演示参考项目体验。
- 空闲 CPU 达标。
- 动画流畅且不影响穿透。

### M3：Usage 与 Cost 数据链路

交付：

- Codex auth + usage fetcher。
- Claude credential discovery + usage fetcher。
- Claude OAuth refresh 与安全写回策略。
- Claude/Codex log readers。
- LogParseCache。
- Pricing。
- CostSummary / CostStore。
- last-known-good error handling。

退出标准：

- 已登录 Claude/Codex 的 Windows 用户无需额外输入 token 即可看到数据。
- 未登录时提示明确。
- 成本扫描不阻塞 UI。
- 刷新间隔限制生效。

### M4：设置、托盘与 Windows 桌面集成

交付：

- General / Display / Providers / About。
- Launch at Login。
- Target display。
- Fullscreen avoidance。
- Provider visibility。
- Token counting。
- Language。
- Tray 完整菜单。
- Sleep/wake/lock/unlock 处理。

退出标准：

- 设置全部可视化配置。
- 修改即时生效或有明确提示。
- 多屏/全屏/托盘验收通过。

### M5：发布产品化

交付：

- NSIS installer。
- MSI installer（建议）。
- code signing。
- Tauri updater。
- GitHub release workflow。
- changelog。
- README / FAQ / privacy。
- diagnostics export。

退出标准：

- 干净 Win11 机器可安装、运行、卸载。
- 旧版本可更新到新版本。
- release 产物有 checksum。
- 无默认遥测。

### M6：Beta / RC / Release

交付：

- Beta 包。
- 测试矩阵报告。
- P0/P1 bug 清零。
- RC 包。
- 正式 Release。

测试矩阵：

- 单屏笔记本。
- 双屏办公。
- 4K 高 DPI。
- RDP / 远程桌面。
- 视频全屏。
- PowerPoint 放映。
- 至少一个 DirectX 游戏/全屏应用抽样。

## 13. 验收标准

### 13.1 功能验收

- compact / peek / expanded 三态完整。
- Usage / Cost / Overview 三页完整。
- Claude / Codex 双 provider 完整。
- Chart styles 五种完整。
- Cost styles 四种完整。
- token count mode 完整。
- provider visibility 完整。
- manual refresh 完整。
- low power 完整。
- alert thresholds 完整。
- language 完整。
- launch at login 完整。
- target display 完整。

### 13.2 Windows 窗口验收

- overlay 透明无黑底。
- 置顶稳定。
- 岛外点击/拖拽/滚轮穿透。
- 点击岛不抢焦点。
- Settings 可正常获得焦点。
- 多屏 DPI 定位准确。
- 全屏应用默认隐藏。
- sleep/wake 后恢复。
- Explorer 重启后托盘/窗口可恢复或有清晰行为。

### 13.3 数据验收

- Claude usage endpoint 成功。
- Codex usage endpoint 成功。
- Claude 401/403/429 错误语义正确。
- Codex no auth / expired 语义正确。
- last-known-good 不被瞬时错误清空。
- Claude log scan 去重正确。
- Codex log scan 使用 last_token_usage。
- cache 命中后不重复解析。
- unknown model 有 warning。

### 13.4 性能验收

- 空闲 CPU < 0.5%。
- 常驻内存 < 120MB。
- overlay 不可见/全屏隐藏时动画暂停。
- hover/展开动画流畅。
- 大日志扫描后台执行。
- usage 刷新不低于 5m。

### 13.5 隐私验收

- 无默认 telemetry。
- 无默认 crash report。
- 日志不包含 token/prompt/raw transcript。
- 诊断导出脱敏。
- 凭据不复制到 app settings。
- refresh 写回安全或明确降级。

### 13.6 发布验收

- NSIS 安装器可用。
- MSI 产物可用或有明确延期说明。
- exe/installer 签名有效。
- 自动更新可从低版本升级到高版本。
- 卸载行为明确。
- README / FAQ / Privacy 完整。
- Release notes 与 checksum 完整。

## 14. 主要风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| Tauri/WebView2 透明窗口黑底或闪烁 | UI 体验失败 | M0 优先验证；必要时 Electron 或原生 overlay Plan B |
| no-activate 与 WebView 交互冲突 | 点击岛无法操作或抢焦点 | Rust 侧处理 `WM_MOUSEACTIVATE`，必要时事件转发 |
| Claude Windows 凭据位置不明 | Claude usage 不稳定 | 单独做 credential discovery；不猜测写回 |
| refresh token 写回失败 | 破坏 Claude Code 登录态 | 仅对称写回；失败时提示 re-login |
| usage endpoint 非公开稳定 API | 未来 401/403/shape 变化 | 错误降级、保留旧值、FAQ 说明、集中常量 |
| Codex Windows 路径不确定 | Codex usage/cost 缺失 | 支持 `CODEX_HOME`，实测 CLI 路径 |
| 成本估算与官方账单不一致 | 用户误解 | UI 标注 estimated，unknown model warning |
| SmartScreen 拦截 | 分发转化差 | 做 code signing，README 提供校验说明 |
| 完整复刻范围扩大 | 范围协调风险 | 按 M0-M6 依赖顺序推进，使用 AI 开发持续迭代，但一期不裁剪参考功能 |
| 全屏/游戏兼容性复杂 | 打扰用户 | 默认全屏隐藏，不承诺覆盖独占游戏 |

## 15. 与旧文档的关系

旧文档：

`local/需求讨论/2026-06-08-win11-claude-code-status-hud-需求讨论.md`

仍可保留其中关于 Windows 悬浮窗、性能、Claude Code statusLine/hooks、隐私边界的技术分析，但以下结论已被本文件替代：

- “第一版只做 Claude Code 当前会话状态”。
- “暂不做完整历史费用报表”。
- “暂不做 Claude OAuth usage endpoint 深度集成”。
- “发布产品能力后置”。
- “Usage / Cost / Codex 作为后续增强”。

本文件为正式一期复刻范围的主文档。后续 PRD、设计稿、研发设计应以本文件的一期范围为基线。

## 16. 下一步建议

1. 基于本文件进入 M0 Windows 壳层 spike：验证 Tauri 透明置顶、点击穿透、不抢焦点、多屏 DPI、全屏避让。
2. 同步做 Claude/Codex Windows 凭据与日志路径实测，尤其是 Claude refresh token 写回机制。
3. 产出 UI 设计稿或 Figma：先复刻 compact/peek/expanded + Usage/Cost/Overview。
4. 确定正式技术栈；若 M0 失败，快速切换 Electron Plan B，不拖延一期复刻。
5. 进入 PRD / 研发设计阶段时，按本文件拆解用户故事、验收标准与模块接口。
