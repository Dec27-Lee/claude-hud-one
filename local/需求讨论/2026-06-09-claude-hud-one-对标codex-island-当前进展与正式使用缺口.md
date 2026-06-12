# Claude HUD One 对标 codex-island：当前进展、问题与正式使用缺口

> 日期：2026-06-09  
> 状态：阶段性复盘 / 正式使用前差距清单  
> 目标口径：继续以 `local\参考项目\codex-island` 为完整对标对象，在 Windows 11 上实现等价产品能力，而不是只做 Claude Code 状态栏或简化 MVP。
>
> 2026-06-09 后续范围修订：用户确认本轮 Usage 直接使用 Claude Code 自身 statusLine 估算信息；Codex 本次不实现，已有代码保留但前端不展示；发布目标不上架应用商店，但必须具备安装、卸载、手动更新、开机启动等常规桌面应用闭环；全部做完后再提交。

## 1. 当前结论

Claude HUD One 当前已经从“方案/原型”推进到**可本地运行、可打包、可截图冒烟验证的 pre-release 工程版**：

- Windows 桌面壳、动态岛 UI、Settings 窗口、托盘、开机启动、基础 overlay、点击穿透、多显示器定位、全屏避让、本地 Usage/Cost 聚合、Claude Code 实时状态桥、Playwright UI 冒烟、Rust 单元测试、Windows release workflow 草案均已具备。
- 参考项目 `codex-island` 的主要界面结构已经在 Windows 版中建立：`compact / peek / expanded`、`Usage / Cost / Overview`、Claude/Codex provider、图表样式、成本样式、设置项、低功耗与告警配置位。
- 但是，距离“完全对标参考项目并正式使用/正式发布”仍是**部分完成**，核心缺口集中在：
  1. Claude/Codex 官方 usage endpoint 与认证/凭据闭环；
  2. Codex Windows 真实会话/usage 数据结构实测；
  3. 自动更新真实 endpoint/signing key/下载安装链路；
  4. 代码签名、SmartScreen、正式发布流水线实跑；
  5. 多屏/DPI/不抢焦点/全屏避让的实机矩阵验证；
  6. 告警触发、手动刷新、错误修复引导等产品化细节。

因此当前判断是：**已具备内部试用和继续迭代基础，但还不能称为已正式完成对 `codex-island` 的完整复刻。**

## 2. 原始对标目标

一开始的要求是：

- 参考项目 `codex-island` 在 macOS 上展示 Claude/Codex 状态与用量；本项目要在 Win11 上实现同样效果。
- 参考项目已有功能一期都要支持，不做简化 MVP。
- 按正式发布产品打造，而不只是 demo。
- 重视 UI 展示效果、实时性、CPU/内存占用和可视化 UI 配置。
- 默认本地优先，不做遥测、不上传日志、不保存 prompt/transcript/tool-result/凭据正文。

这意味着 Windows 版的验收标准不是“能显示 Claude Code 当前状态”，而是：

> 在 Windows 11 上形成一个完整的 Claude/Codex 动态岛 HUD 产品：能看用量、看成本、看年度概览、能配置、能低功耗运行、能安装/更新/诊断，并且与参考项目的核心体验等价。

## 3. `codex-island` 参考项目核心能力

按当前参考项目梳理，必须对标的能力可以归纳为以下几类。

### 3.1 动态岛 UI 与交互

- macOS 顶部刘海/菜单栏动态岛。
- `compact / peek / expanded` 三态。
- hover 预览 5h usage。
- 点击展开完整面板。
- Usage / Cost / Overview 三页。
- 底部 page dots / 横向切页。
- 设置入口。
- 接近限额时的 warning / critical 视觉反馈。

### 3.2 Claude/Codex 双 provider

- Claude 与 Codex 均为一等 provider。
- provider 可显示/隐藏。
- 隐藏只影响 UI，不应破坏内部数据刷新。
- 单 provider / 双 provider 布局需要自适应。

### 3.3 Usage 数据

- Claude/Codex 5 小时窗口。
- Claude/Codex 7 天窗口。
- reset time / last synced。
- 错误态：未登录、凭据失效、scope 不足、网络失败、接口失败。
- 参考项目使用官方 usage endpoint：
  - Claude：Anthropic OAuth usage endpoint。
  - Codex：ChatGPT/Codex usage endpoint。

### 3.4 Cost / Token / Overview

- 本地日志扫描估算成本。
- today / month-to-date cost。
- token throughput。
- all / billable token 口径。
- per-model breakdown。
- unknown model warning。
- 年度 contribution grid / daily buckets。
- 成本明确标注为 estimate，不等同官方账单。

### 3.5 设置与产品化

- Refresh interval：5 / 15 / 30 分钟。
- Manual refresh。
- Low power mode。
- Alerts threshold。
- Provider visibility。
- Chart style。
- Cost style。
- Token count mode。
- Launch at login。
- Language。
- Target display。
- Auto update。
- Diagnostics / About / License / GitHub。

### 3.6 性能与隐私

- 启动即刷新，不等 hover。
- 缓存 last-known-good 数据，避免失败时 UI 归零。
- 日志扫描使用缓存/增量策略，避免高频全量重扫。
- usage endpoint 最低刷新间隔不低于 5 分钟。
- 不做默认 telemetry / crash report。
- 不上传本地日志。
- 不保存 prompt、transcript 正文、tool result 正文或凭据正文。

### 3.7 发布能力

- macOS 参考项目使用 Sparkle / DMG / GitHub Release / Homebrew 等机制。
- Windows 等价目标应是：
  - NSIS/MSI 安装包；
  - GitHub Release artifacts；
  - checksum；
  - Tauri updater 或等价安全更新；
  - signing key；
  - 代码签名；
  - SmartScreen 风险处理；
  - 可复现 release workflow。

## 4. 当前已完成进展

### 4.1 工程骨架与构建

已完成：

- `Tauri 2 + React + TypeScript + Rust` 项目骨架。
- `npm run build` 前端构建链路。
- `cargo check` Rust/Tauri 检查链路。
- `npm run tauri:build` release 构建链路。
- NSIS / MSI 打包产物。
- release exe 存活冒烟脚本。
- `scripts/check-version.mjs` 版本一致性检查。
- `scripts/smoke.ps1` 全链路 smoke。
- `.github/workflows/release.yml` Windows release workflow 草案。

已具备的产物路径：

- `src-tauri\target\release\claude-hud-one.exe`
- `src-tauri\target\release\bundle\nsis\Claude HUD One_0.1.0_x64-setup.exe`
- `src-tauri\target\release\bundle\msi\Claude HUD One_0.1.0_x64_en-US.msi`

当前含义：**工程已经能打包，不再是纯前端 demo。**

### 4.2 动态岛 UI

已完成：

- compact 胶囊态。
- hover/peek 展示态。
- expanded 展开面板。
- Usage / Cost / Overview 三页。
- provider chip / page dots / settings button。
- Current Session 状态条。
- warning / critical 基础视觉状态。
- 低功耗模式下弱化部分视觉效果。
- Playwright UI 截图冒烟覆盖 compact、expanded Usage/Cost/Overview、Settings。

当前不足：

- UI 结构已搭起，但与 macOS 参考项目的动画精致度、边界细节、hover morph 手感仍需继续抛光。
- expanded 里的部分交互仍偏展示：例如手动刷新、告警触发、错误修复引导还需补齐闭环。

### 4.3 Windows overlay 原生能力

已完成：

- 透明、无边框、置顶 overlay。
- `WS_EX_LAYERED`。
- `WS_EX_TOOLWINDOW`。
- `WS_EX_NOACTIVATE`。
- `WM_MOUSEACTIVATE -> MA_NOACTIVATE`，降低点击抢焦点风险。
- 前端上报多矩形 hit region。
- Rust 侧基于 cursor/window rect 轮询切换 `WS_EX_TRANSPARENT`。
- `devicePixelRatio` 到物理像素的基础转换。
- 显示器枚举。
- target display / top offset 定位。
- 前台全屏窗口基础检测与自动隐藏。

当前不足：

- click-through 仍依赖 50ms cursor polling，需要做 CPU/功耗实测。
- 多显示器、不同缩放比、任务栏位置、窗口热插拔、全屏游戏/视频/远程桌面仍需实机矩阵验证。
- Windows 没有 macOS 刘海区域，当前是“顶部中央胶囊”的等价实现；这是合理差异，但需要继续打磨原生感。

### 4.4 Settings / 托盘 / 本地配置

已完成：

- 独立 Tauri Settings 窗口。
- 原生 settings JSON：`%APPDATA%\Claude HUD One\settings.json`。
- 开机启动：HKCU Run。
- 托盘菜单：Show Island / Settings / Hide Island / Quit。
- Settings 中已具备：
  - language；
  - refresh interval；
  - always show usage；
  - low power mode；
  - fullscreen avoidance；
  - alerts threshold；
  - target display；
  - top offset；
  - island width mode；
  - chart style；
  - cost style；
  - token count mode；
  - provider visibility；
  - diagnostics；
  - updates 状态区块。

当前不足：

- 前端 localStorage 与原生 settings 仍同时存在，需要继续确认 source of truth 和迁移边界。
- 部分设置是 UI/状态位已具备，但实际行为还不完整，例如告警通知、自动更新检查。
- About / License / GitHub / 更完整的错误修复引导还需产品化补充。

### 4.5 Usage / Cost / Overview 本地聚合

已完成：

- Rust 侧本地 Usage/Cost 聚合。
- Claude/Codex 日志目录扫描。
- 结构化 token 字段递归收集。
- `input_tokens` / `output_tokens` / `cache_creation_input_tokens` / `cache_read_input_tokens` 等字段处理。
- cache-read 1/10 billable 折扣计算。
- today / month / daily buckets / provider state / model breakdown 基础能力。
- last-known-good cache：`%APPDATA%\Claude HUD One\usage-cost-cache.json`。
- UI 展示 source/auth：`mock` / `localEstimate` / `endpoint` / `cache`，避免误把本地估算当成官方数据。
- Rust 单元测试覆盖 Usage/Cost 核心聚合分支。

当前不足：

- 当前 Usage 仍主要是 local estimate，不是参考项目中的官方 usage endpoint。
- Claude/Codex 官方 usage API、OAuth refresh、scopeRequired、expired、missing 等真实认证状态尚未闭环。
- Codex Windows session/auth 文件结构还需要实测。
- 成本估算需要继续与参考项目、ccusage、官方账单口径做对比验证。

### 4.6 Claude Code 当前会话实时状态增强

已完成：

- `.claude/settings.json` 接入项目级 statusLine 与 hooks。
- `.claude/bridge/claude-status-bridge.mjs` 写入脱敏状态摘要。
- 写入路径：
  - `%APPDATA%\Claude HUD One\claude-status.json`
  - `.claude\bridge\state\claude-status.json`
- HUD 正常模式约 1 秒刷新 bridge patch，低功耗约 5 秒刷新。
- 支持状态：Prompt submitted、Tool running、Tool finished、Waiting、Run failed、Compacting context 等。
- 支持模型、context 百分比、tool name、cost/duration 等聚合字段。
- 不保存 prompt、tool input、tool result、transcript 正文或凭据。
- 已兼容 `claude-hud-plus`：statusLine 模式先写入 Claude HUD One 状态，再委托全局 HUD Plus 输出底部状态栏；失败时回退 `Claude HUD One · ...`。

当前定位：

- 这是 Windows 版的增强能力，很有价值；
- 但它不能替代 `codex-island` 的主目标，即 Claude/Codex Usage/Cost/Overview 双 provider 产品能力。

当前不足：

- 最新 `claude-hud-plus` 委托修复已通过 `node --check` 和样例 stdin 验证，但这次改动之后还没有重新跑完整 `npm run smoke`。
- 需要在真实新 Claude Code session 中确认底部 HUD Plus 显示与 Claude HUD One 状态桥双写同时稳定。

### 4.7 发布与验证

已完成：

- 本地 smoke 脚本已建立。
- Playwright UI 冒烟截图已建立。
- Rust Usage/Cost 单测已建立。
- GitHub Actions Windows release workflow 草案已建立。
- 本地已有 release exe / NSIS / MSI 产物。

当前不足：

- updater 仍是 `not_configured` 状态。
- 没有真实 updater endpoint。
- 没有 Tauri signing key。
- 没有代码签名证书。
- 没有 SmartScreen reputation。
- GitHub Actions release workflow 尚未以真实 tag/正式发布跑通。
- 正式 release 资产、checksum、升级路径还没有真实验收。

## 5. 对标状态矩阵

| 对标能力 | 参考项目要求 | 当前状态 | 判断 |
| --- | --- | --- | --- |
| Windows/macOS 顶部动态岛 | 透明置顶、低打扰、compact/peek/expanded | 已有 Win11 顶部胶囊 overlay 与三态 UI | 部分完成，需实机抛光 |
| Usage 页 | Claude/Codex 5h + 7d 官方用量 | UI 有，本地估算有，官方 endpoint 未接 | 部分完成 |
| Cost 页 | 本地日志估算 today/MTD/token/breakdown | 已有本地聚合、cache、单测 | 基本完成，需口径对账 |
| Overview 页 | 年度 daily token grid | UI 与 daily buckets 已有基础 | 部分完成，需真实数据验收 |
| Claude provider | OAuth usage endpoint + 本地凭据 | 本地日志/状态桥已接，官方 OAuth usage 未闭环 | 部分完成 |
| Codex provider | Codex auth + usage endpoint + sessions | 本地扫描结构已预留，真实 Windows 结构未验 | 部分完成偏早期 |
| 图表样式 | Ring/Bar/Stepped/Numeric/Sparkline | 前端已有多样式基础 | 部分完成，需视觉对齐 |
| 成本样式 | USD/VALUE/TOKENS/TREND | 已有样式状态与展示基础 | 部分完成 |
| token 口径 | all/billable | 已有设置和部分计费逻辑 | 部分完成，需全链路验证 |
| provider visibility | 隐藏/显示并持久化 | 已纳入 native settings | 基本完成 |
| refresh interval | 5/15/30 分钟 | 已有设置和轮询 | 基本完成 |
| manual refresh | 点击立即刷新 | 尚未形成完整 UI 行为闭环 | 未完成/待补齐 |
| low power | 动画/轮询/可见性节流 | 已有设置与刷新降频 | 部分完成 |
| alerts | warning/critical glow/pulse/去重 | 有阈值和基础视觉，缺触发/通知/消抖 | 部分完成偏早期 |
| launch at login | 开机启动 | HKCU Run 已实现 | 基本完成，需安装后验证 |
| language | 多语言/中英 | 有 language 设置位 | 部分完成，需 i18n 文案覆盖 |
| target display | 多显示器选择 | 已实现枚举、target、top offset | 基本完成，需多屏 DPI 实测 |
| settings window | 独立设置窗口 | 已实现 | 基本完成 |
| no telemetry/privacy | 本地优先/不上传日志 | 设计上已遵守，状态桥脱敏 | 基本完成，需文档审查 |
| auto update | Sparkle/等价安全更新 | 只有 updater 状态骨架 | 未完成 |
| release package | 安装包、checksum、release | 本地 NSIS/MSI 已有，CI 草案已建 | 部分完成 |
| signing/SmartScreen | 正式发布可信链路 | 未配置证书与信誉 | 未完成 |

## 6. 当前主要问题

### 6.1 最大问题：官方 Usage 数据源未闭环

参考项目的 Usage 核心来自官方 endpoint，而当前 Windows 版主要来自本地日志估算。

这会导致：

- 5h / 7d usage 百分比可能与官方面板不一致；
- auth 状态无法准确提示；
- scopeRequired / expired / missing 等产品状态无法真正落地；
- 用户可能误以为数据是官方 usage，因此必须继续明确 source/auth 标识。

正式使用前必须补：

- Claude 凭据定位；
- Claude OAuth usage endpoint 调用；
- refresh token 安全处理策略；
- Codex auth/session 定位；
- Codex usage endpoint 调用；
- endpoint 失败时使用 last-known-good cache；
- 不读取/不保存 raw credential 的边界设计。

### 6.2 Codex Windows 真实数据结构仍需验证

当前已按常见目录预留扫描，但参考项目的 Codex 能力依赖真实 auth/session JSONL 结构。

正式使用前必须验证：

- `%USERPROFILE%\.codex\auth.json` 或 `CODEX_HOME` 在 Windows 下是否一致；
- sessions 目录结构；
- rollout/session JSONL 中 token usage 字段；
- Codex usage endpoint 是否需要额外 header/scope；
- 未登录/过期/多账号时 UI 如何提示。

### 6.3 发布链路还不是正式产品级

当前能打包，但正式发布链路尚未完整。

缺口包括：

- updater endpoint；
- updater signing key；
- 下载安装/重启应用流程；
- 代码签名证书；
- SmartScreen reputation；
- GitHub Actions workflow 真实 tag 发布验收；
- SHA256SUMS / release notes / installer 升级覆盖测试；
- 卸载后 AppData/开机启动项清理策略。

### 6.4 Windows 原生交互需要实机矩阵

当前 overlay 基础能力已经实现，但 Windows 场景复杂，正式使用前需要实测：

- 单屏 / 双屏 / 多屏；
- 100% / 125% / 150% / 混合 DPI；
- 顶部/底部/左侧/右侧任务栏；
- 高刷屏；
- UAC 弹窗；
- 游戏/视频/远程桌面全屏；
- 前台应用点击是否被 overlay 抢焦点；
- click-through 边界是否误穿透或误拦截；
- 低配机器空闲 CPU / 内存。

### 6.5 产品交互闭环还要补齐

当前 UI 结构和状态位很多，但以下闭环还需补：

- 手动刷新按钮真正触发 Usage/Cost reload；
- “synced Xs ago” 可点击刷新；
- alerts 阈值跨越触发、去重、恢复；
- provider auth 错误修复引导；
- unknown model warning 交互；
- diagnostics 一键打开/复制必要信息；
- About / License / GitHub；
- update check 的真实结果展示。

### 6.6 当前工作区仍有未提交修改

当前工作区在上一次提交后又继续做了多项修改，包括：

- `claude-hud-plus` statusLine 委托兼容；
- Rust Usage/Cost 单测；
- provider visibility 原生持久化；
- updater 状态骨架；
- README / workflow / smoke 脚本等更新。

正式验证或发布前应先：

1. 跑完整验证；
2. 锁定一次 commit；
3. 再基于干净工作树进行 release 验收。

## 7. 正式使用前待办

### P0：必须完成，否则不能算完整对标

1. **官方 Usage endpoint 接入**
   - Claude official usage endpoint；
   - Codex official usage endpoint；
   - 5h / 7d 真实用量；
   - endpoint source 标识；
   - error/auth 状态闭环。

2. **认证/凭据链路**
   - Claude 本机凭据定位；
   - Claude refresh 策略；
   - Codex auth 文件定位；
   - missing / expired / scopeRequired / notConfigured 状态；
   - 重新登录引导；
   - 不保存 raw credential。

3. **Codex Windows 实测**
   - auth 路径；
   - session 路径；
   - token usage 字段；
   - cost/usage 聚合口径。

4. **正式更新链路**
   - updater endpoint；
   - signing key；
   - 检查/下载/安装/重启；
   - 失败回退。

5. **正式发布链路**
   - 代码签名；
   - SmartScreen 风险处理；
   - GitHub Release tag 实跑；
   - NSIS/MSI 安装、升级、卸载验证；
   - SHA256SUMS 与 release notes。

6. **完整 smoke 复跑**
   - 最新 `claude-hud-plus` statusLine 委托兼容后，需要重新执行 `npm run smoke`；
   - 同时应验证真实 Claude Code session 里 HUD Plus 底部显示与 Claude HUD One 状态桥双写。

### P1：正式体验必须补齐

1. **手动刷新闭环**
   - footer refresh；
   - synced label 点击刷新；
   - 防并发；
   - 失败保留旧值。

2. **Alerts 完整行为**
   - warning/critical 阈值触发；
   - pulse/peek；
   - 去重；
   - reset 后恢复；
   - 可选 Windows toast。

3. **低功耗策略完善**
   - 降低动画；
   - 减少 polling；
   - 空闲时减少刷新；
   - 系统省电模式联动。

4. **数据准确性对账**
   - 与参考项目 cost scan 对账；
   - 与 ccusage 口径对账；
   - 与官方 usage/账单面板抽样对账；
   - unknown model pricing fallback。

5. **多屏/DPI/全屏实机矩阵**
   - 形成测试表；
   - 记录问题；
   - 针对误判和焦点问题修复。

### P2：产品完善与长期质量

1. **视觉精修**
   - 动态岛 morph 动画；
   - hover 手感；
   - expanded 阴影/层次；
   - warning/critical 视觉节奏；
   - 与 Windows 11 Acrylic/Mica 风格平衡。

2. **Settings 完整化**
   - GitHub / License / About；
   - release channel；
   - diagnostics copy/export；
   - reset settings；
   - provider re-auth 引导。

3. **更多自动化测试**
   - settings native load/save；
   - claude-status bridge 单测；
   - updater DTO/状态机测试；
   - overlay 命中区域逻辑测试；
   - release workflow dry run。

4. **文档完善**
   - 用户安装说明；
   - 常见问题；
   - 隐私说明；
   - 未签名/SmartScreen 说明；
   - 开发者 release checklist。

## 8. 建议的下一步执行顺序

按“先补核心数据，再补发布闭环，再做体验抛光”的顺序推进：

1. **先复跑当前完整验证**
   - `npm run smoke`
   - 验证最新 `claude-hud-plus` wrapper 没破坏构建与 UI。

2. **锁定当前阶段 commit**
   - 在验证通过后提交当前工作区，避免后续改动与当前 pre-release 基线混在一起。

3. **补 Claude official usage endpoint**
   - 先做 interface / not configured / auth missing；
   - 再做只读凭据定位；
   - 最后做 endpoint 调用和错误态。

4. **补 Codex official usage 与 Windows session 实测**
   - 先验证路径与字段；
   - 再接入 provider 状态；
   - 再对齐 Cost/Overview。

5. **补手动刷新与 alerts**
   - 让现有 UI 从“展示”变成完整交互。

6. **补 updater/signing/release**
   - 如果暂时没有签名证书和 updater endpoint，也要在 UI 和 README 中保持明确的 not configured 状态，避免误导用户。

7. **做多屏/DPI/全屏实机验证**
   - 这是 Windows 动态岛正式可用的关键验收。

## 9. 验收口径

后续如果要声明“正式完成 / 可以正式使用”，至少需要满足：

- Claude 和 Codex 的 Usage 数据均能从真实官方 endpoint 或等价可信来源获取。
- Cost/Token/Overview 能基于真实本地日志稳定聚合，并有缓存和错误保护。
- provider auth/error 状态准确，不误导用户。
- 动态岛不抢焦点、不误挡点击，多屏/DPI/全屏场景通过实测。
- Settings 中关键配置能持久化、即时生效、升级兼容。
- 手动刷新、低功耗、alerts、diagnostics 形成闭环。
- 安装包可安装、可升级、可卸载。
- updater 能真实检查/下载/安装，或正式发布说明中明确禁用原因。
- 代码签名/SmartScreen/Release assets/checksum/release notes 处理完成。
- 完整 smoke、UI 冒烟、Rust 单测、release workflow 至少各通过一轮。
- 隐私边界复核通过：不上传日志、不保存 prompt/transcript/tool-result/凭据正文。

## 10. 最终判断

当前阶段：**部分完成，已具备本地试用基础。**

更具体地说：

- 如果目标是“看见 Windows 动态岛、展开 Usage/Cost/Overview、读取本地聚合数据、显示当前 Claude Code 状态、打包出 exe/msi”，当前已经做到。
- 如果目标是“完全对标 `codex-island` 并正式发布给用户使用”，当前还未完成，必须继续补齐官方 Usage/认证链路、Codex 实测、更新/签名/发布链路和 Windows 实机稳定性验证。

因此下一阶段不应再扩大 UI demo 范围，而应集中补齐：

1. 真实 Usage 数据；
2. 认证/凭据状态；
3. 正式发布链路；
4. Windows 原生稳定性矩阵；
5. 产品交互闭环。

## 11. 2026-06-09 范围修订后的推进结果

按用户最新回复，本轮已把“完整对标”的执行口径调整为：先交付 Claude Code 可发布使用版本，Codex 后置。

### 11.1 本轮已调整

- **Usage 数据源**：前端 Usage provider 新增 `claudeCode` 来源，优先读取 Claude Code statusLine 桥里的 `rate_limits.five_hour.used_percentage`、`rate_limits.five_hour.resets_at`、`rate_limits.seven_day.used_percentage`、`rate_limits.seven_day.resets_at`，并展示为 `Claude Code estimate`，不再把本轮目标绑定到官方 usage endpoint。
- **Codex 展示范围**：保留 `codex` provider、cost、diagnostics 和本地聚合代码结构，但前端默认展示顺序改为只展示 Claude；mock/native settings 默认 `codex: false`；Usage、Cost、Overview、Settings、Diagnostics 冒烟断言均不展示 Codex。
- **产品交互闭环**：expanded footer 和 Settings About/Diagnostics 已新增手动刷新入口；刷新会拉取当前 session、status bridge、Usage/Cost snapshot 和 display 列表，并通过 `isRefreshing` 防并发；alerts 已从 settings threshold 自动推导 warning/critical，并在岛体 glow 与 header pill 中反馈。
- **发布/更新闭环**：Updates 区块从单纯 `not_configured` 改为明确的 `manual_update_only`：展示 GitHub Releases 页面、手动更新可用状态，并提供 `Open release page` 按钮。README 已补安装、卸载、覆盖更新、开机启动说明。
- **发布验证脚本**：`scripts/smoke.ps1` 在 Tauri release build 后增加 NSIS/MSI 产物存在性、非空和 SHA256 校验输出。

### 11.2 本轮仍保留的边界

- 自动 updater endpoint、updater signing key、代码签名证书和 SmartScreen reputation 仍属于外部发布资源，本轮不假装已完成；UI 和 README 均明确为手动更新。
- Codex 代码保留但不作为本次可用版本验收项，后续用户需要 Codex 时再恢复前端展示并做 Windows 实测。
- Usage 口径是 Claude Code 自身估算，不等同官方账单或官方 usage endpoint；Cost 仍是本地聚合估算。

### 11.3 最新验证状态

已执行：

- `node --check .claude\bridge\claude-status-bridge.mjs`
- `npm run build`
- `cargo check --manifest-path src-tauri\Cargo.toml -j 1`
- `npm run test:rust`
- `npm run test:ui`
- `npm run smoke`：版本一致性、前端 build、Rust check、Rust usage/cost tests、UI screenshots、Tauri release build、NSIS/MSI SHA256 校验、release exe 8 秒存活均通过。
- 本机双屏 release 启动验证：检测到 `DISPLAY1 2048x1280` 与 `DISPLAY2 2560x1440 primary`，release exe 启动 15 秒未退出。

待最终执行：

- 提交修改。
- 真正的点击穿透/全屏避让视觉手感仍建议在长期使用中继续观察；工具侧本轮已完成构建、启动和双屏枚举验证。
