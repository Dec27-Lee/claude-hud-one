# CodeIsland / Codex Island 桌面 HUD 展示与交互复刻分析

> 日期：2026-06-12  
> 目标：研究 `local/参考项目/codex-island` 与用户补充远程仓库 `git@github.com:wxtsky/CodeIsland.git` 的桌面悬浮窗/HUD 展示效果，并分析 Claude HUD One 的 Desktop HUD 如何直接参考、选择性照抄和分阶段落地。  
> 重点关注：执行态动效、Claude 小人/品牌动画、多会话展示、悬浮窗点击交互、选择/确认类交互。

> 2026-06-12 纠偏补充：用户补充截图显示，左侧确实存在橙色像素小人/mascot。已确认原本地 `local/参考项目/codex-island` 指向 `ericjypark/codex-island`，是 Claude/Codex usage dashboard；用户给出的远程 `wxtsky/CodeIsland` 才是截图对应的 Claude Code notch / multi-session / mascot 项目。本文后续以 `local/参考项目/CodeIsland` 为直接复刻参考，`codex-island` 仅作为 usage/dashboard 和部分动态岛窗口资料补充。

---

## 0. 结论先行

1. **本地参考代码确实拉错/看错了：`codex-island` 不是截图项目，`wxtsky/CodeIsland` 才是。**  
   原 `local/参考项目/codex-island` 的 remote 是 `git@github.com:ericjypark/codex-island.git`，核心是 Claude/Codex usage dashboard；用户给出的 `git@github.com:wxtsky/CodeIsland.git` 已重新克隆到 `local/参考项目/CodeIsland`，其中明确包含截图里的像素 mascot、多会话卡片、approval/question、Ghostty/iTerm2 click-to-jump 等能力。

2. **会动的橙色小人就是 CodeIsland 的 `ClawdView`，应该作为 Claude HUD One 直接复刻重点。**  
   它不是图片 sprite，而是 SwiftUI Canvas 代码绘制的像素角色，按 `idle / processing / running / waitingApproval / waitingQuestion` 状态切换睡觉、敲键盘、警报等动画；会话卡片左侧通过 `MascotView(source:status:size:)` 接入。

3. **截图里的“Claude (3)”是多 Claude/多 agent 会话面板，CodeIsland 已有完整模型。**  
   `SessionSnapshot` 维护每个 session 的 source、status、cwd、model、terminal metadata、recent messages、subagents、tool history；`SessionListView` / `SessionCard` 渲染多张卡片，并支持按 all/status/cli 分组。Claude HUD One 应优先复刻这个会话卡片列表，而不是只做 usage dashboard。

4. **悬浮窗点击交互不止展示，还包括 approval/question 和终端跳转。**  
   CodeIsland 有 `HookServer + codeisland-bridge + AppState permissionQueue/questionQueue`，能把 CLI hook 的 `PermissionRequest`、`AskUserQuestion` 类事件转成 HUD 内的 Allow/Deny/Always/Dismiss 与问答卡片；同时 `TerminalActivator` 能根据 Ghostty/iTerm2/tmux/zellij/tty/cwd 等 metadata 跳回对应终端。

5. **Claude HUD One 的 Windows overlay 基础仍然可用，但数据/交互层要从 CodeIsland 重学。**  
   当前我们已有 Tauri 透明置顶窗口、Win32 click-through、Window Region、no-activate、DOM hit region 上报、Bridge 状态读取；后续重点应从“usage 动态岛”转向“多 session + mascot + approval/question + click-to-jump”的 Desktop HUD 控制台。

6. **建议落地策略改为：先复刻 CodeIsland 的 session/mascot/approval，再补 usage/cost。**
   - 近期：像素 mascot、会话卡片、多会话列表、状态优先级、hover 展开/收起、completion/approval/question surface。
   - 中期：HookServer/bridge blocking response、permission/question 队列、PreToolUse cache enrich、terminal metadata 和 jump。
   - 后期：多 provider、remote session、ESP32/Buddy、usage/cost dashboard 和更完整 settings。

---

## 0.1 远程 CodeIsland 复核结果

### 0.1.1 本地旧参考与用户截图不是同一个项目

已核对 Git remote：

- `local/参考项目/codex-island` → `git@github.com:ericjypark/codex-island.git`，最新本地提交 `fd6c5f6 chore(release): bump VERSION to 0.1.10`。
- `local/参考项目/CodeIsland` → `git@github.com:wxtsky/CodeIsland.git`，已新克隆，最新提交 `f878234 fix(warp): correct tab activation across windows and tabs (#205)`。

所以用户判断是对的：**前一版分析把 `ericjypark/codex-island` 当成了主要参考，导致漏掉截图里的像素小人、多会话卡片、权限确认和终端跳转。正确参考应切到 `wxtsky/CodeIsland`。**

### 0.1.2 CodeIsland 已实现截图中的橙色小人

CodeIsland 中左侧橙色小人是 `ClawdView`：

- `ClawdView` 主实现：`local/参考项目/CodeIsland/Sources/CodeIsland/PixelCharacterView.swift:4`
- Claude 橙色身体色：`local/参考项目/CodeIsland/Sources/CodeIsland/PixelCharacterView.swift:13`
- 状态分发：`local/参考项目/CodeIsland/Sources/CodeIsland/PixelCharacterView.swift:22`
- 睡觉态 `sleepScene`：`local/参考项目/CodeIsland/Sources/CodeIsland/PixelCharacterView.swift:110`
- 工作/敲键盘态 `workScene`：`local/参考项目/CodeIsland/Sources/CodeIsland/PixelCharacterView.swift:163`
- 等待/警报态 `alertScene`：`local/参考项目/CodeIsland/Sources/CodeIsland/PixelCharacterView.swift:259`
- mascot 路由入口：`local/参考项目/CodeIsland/Sources/CodeIsland/MascotView.swift:17`
- Claude/default fallback 到 `ClawdView`：`local/参考项目/CodeIsland/Sources/CodeIsland/MascotView.swift:61`
- 会话卡片左侧接入 `MascotView(source:status:size:)`：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:1947`

这说明我们的复刻不应停留在 Claude logo；应直接做像素 mascot 状态机。

### 0.1.3 CodeIsland 已实现多会话卡片

CodeIsland 的多会话不是 usage provider 聚合，而是真正的 session map + session card：

- `SessionSnapshot` 核心模型：`local/参考项目/CodeIsland/Sources/CodeIslandCore/SessionSnapshot.swift:9`
- `AgentStatus` 五态：`local/参考项目/CodeIsland/Sources/CodeIslandCore/Models.swift:129`
- hook event reducer：`local/参考项目/CodeIsland/Sources/CodeIslandCore/SessionSnapshot.swift:523`
- 全局摘要优先级 waitingApproval → waitingQuestion → running → processing → idle：`local/参考项目/CodeIsland/Sources/CodeIslandCore/SessionSnapshot.swift:461`
- `SessionListView` 创建 `SessionCard`：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:1643`
- `SessionCard` 定义：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:1886`
- 会话卡片 header / terminal badge / 最近消息 / tool 状态：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:1968`
- 整卡点击：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:2141`

Claude HUD One 应直接参考这个结构：`sessions: Map<sessionId, HudSession>`，而不是只在 current session 旁边放一个计数。

### 0.1.4 CodeIsland 已实现 approval/question 交互

CodeIsland 已经不是只展示“需要处理”，而是能在 HUD 中处理 blocking hook：

- `HookServer` 路由类型：`local/参考项目/CodeIsland/Sources/CodeIsland/HookServer.swift:8`
- HookServer 使用 Unix socket 监听：`local/参考项目/CodeIsland/Sources/CodeIsland/HookServer.swift:24`
- PermissionRequest 路由判断：`local/参考项目/CodeIsland/Sources/CodeIsland/HookServer.swift:233`
- AppState permission request 处理：`local/参考项目/CodeIsland/Sources/CodeIsland/AppState.swift:1045`
- `approvePermission(always:)`：`local/参考项目/CodeIsland/Sources/CodeIsland/AppState.swift:1095`
- `denyPermission()`：`local/参考项目/CodeIsland/Sources/CodeIsland/AppState.swift:1205`
- `dismissPermission()`：`local/参考项目/CodeIsland/Sources/CodeIsland/AppState.swift:1224`
- approval card 四个按钮 deny / dismiss / allow once / always：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:925`
- AskUserQuestion 处理：`local/参考项目/CodeIsland/Sources/CodeIsland/AppState.swift:1274`
- QuestionBar UI：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:1018`

这对 Claude HUD One 很关键：若要在 Windows HUD 上处理选择/确认，需要从当前 statusLine 文件桥升级为能阻塞响应的 hook/IPC 桥。

### 0.1.5 CodeIsland 已实现终端跳转

截图右侧 `Ghostty →`、`iTerm2 →` 对应 CodeIsland 的 `TerminalActivator`：

- TerminalActivator 入口：`local/参考项目/CodeIsland/Sources/CodeIsland/TerminalActivator.swift:71`
- Ghostty 精确聚焦：`local/参考项目/CodeIsland/Sources/CodeIsland/TerminalActivator.swift:236`
- iTerm2 精确聚焦：`local/参考项目/CodeIsland/Sources/CodeIsland/TerminalActivator.swift:468`
- 会话卡片点击调用 terminal jump：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:2150`
- approval card 点击跳回 session：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:941`
- bridge 捕获 terminal metadata：`local/参考项目/CodeIsland/Sources/CodeIslandBridge/main.swift:394`

Windows 侧不能照抄 AppleScript，但可以照抄设计：bridge 采集 Windows Terminal / PowerShell / Windows Terminal tab / ConPTY / cwd / pid / window title 等 metadata，HUD 点击后尽量激活对应窗口或提示用户回到对应终端。

### 0.1.6 CodeIsland 窗口层和 click-through 的边界

CodeIsland 的窗口层是 macOS `NSPanel + SwiftUI`：

- `KeyablePanel` 可成为 key：`local/参考项目/CodeIsland/Sources/CodeIsland/PanelWindowController.swift:7`
- `.borderless + .nonactivatingPanel`：`local/参考项目/CodeIsland/Sources/CodeIsland/PanelWindowController.swift:159`
- floating panel / 高层级 / 透明：`local/参考项目/CodeIsland/Sources/CodeIsland/PanelWindowController.swift:165`
- 顶部定位：`local/参考项目/CodeIsland/Sources/CodeIsland/PanelWindowController.swift:451`
- hover 展开延迟 0.5s、收起延迟 0.15s：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:263`

但复核时没有看到它像 `codex-island` 那样显式使用 `NSWindow.ignoresMouseEvents` / 自定义 window hit-test 做透明区域原生点击穿透；它更多是外部 click monitor + SwiftUI hit testing。**Claude HUD One 当前的 Win32 Window Region / click-through 反而在这一点上更强，应该保留。**

---

## 1. 旧 codex-island 的桌面 HUD 展示效果（仅作补充）

### 1.1 窗口形态：大透明宿主窗口 + 小可见岛

Codex Island 是一个 macOS accessory app，无 Dock 图标，启动后显示顶部透明悬浮窗。窗口固定为一个较大宿主区域，但视觉上只有顶部中央的 island 可见。

关键源码：

- 应用入口和 accessory app：`local/参考项目/codex-island/Sources/App.swift:21`
- 固定宿主窗口尺寸 `900 x 360`：`local/参考项目/codex-island/Sources/Window/IslandWindowController.swift:22`
- 无边框透明窗口、`.popUpMenu` 层级、跨 Space：`local/参考项目/codex-island/Sources/Window/IslandWindowController.swift:28`
- 屏幕顶部居中定位：`local/参考项目/codex-island/Sources/Window/IslandWindowController.swift:237`
- 锁屏隐藏、解锁淡入：`local/参考项目/codex-island/Sources/Window/IslandWindowController.swift:192`

可直接参考的产品体验：

- HUD 应始终像桌面环境的一部分，不像普通窗口。
- 岛外透明区域必须点击穿透，不能吞点击。
- 锁屏、全屏、扩展屏、DPI 变化要进入窗口生命周期管理，而不是只当 CSS 问题。

对 Claude HUD One 的建议：

- 不必马上改成固定 900x360 宿主窗口；当前 Windows/Tauri 的动态 fit + Window Region 已经能跑。
- 但应将“固定宿主窗口”作为可切换实验策略，用于解决动态 resize 抖动、region 滞后、transition 时误点等问题。
- 无论是否固定宿主窗口，都要把可见 island rect 和可交互 region 变成模型派生结果，而不是完全依赖 DOM 渲染后测量。

---

### 1.2 三态动态岛：compact / peek / expanded

Codex Island 的核心展示模型是三态：

| 状态 | 触发 | 展示内容 | 产品意义 |
| --- | --- | --- | --- |
| compact | 默认 | 黑色小岛 + Claude/Codex logo | 常驻但低打扰 |
| peek | hover 或告警 pulse | 扩宽，露出 5h 用量 pill | 轻量 glance，不打断用户 |
| expanded | click | 完整 Usage/Cost/Overview panel | 主交互界面 |

关键源码：

- 三态枚举：`local/参考项目/codex-island/Sources/Model/IslandModel.swift:6`
- compact 尺寸：`local/参考项目/codex-island/Sources/Model/IslandModel.swift:167`
- peek 尺寸：`local/参考项目/codex-island/Sources/Model/IslandModel.swift:172`
- expanded 尺寸：`local/参考项目/codex-island/Sources/Model/IslandModel.swift:177`
- hover 进入 peek：`local/参考项目/codex-island/Sources/Views/IslandRootView.swift:156`
- click 进入 expanded：`local/参考项目/codex-island/Sources/Views/IslandRootView.swift:122`
- 设计文档说明 hover 只 peek、click 才 expanded：`local/参考项目/codex-island/docs/superpowers/specs/2026-05-01-notch-peek-design.md:44`

可照抄点：

1. **hover 不直接展开大面板。**  
   hover 只给一个 glance 信息，避免用户鼠标经过顶部时 HUD 大面积弹开。

2. **peek slot 固定宽度。**  
   数字变化不要导致岛宽度跟着跳，避免轮廓抖动。

3. **expanded 面板分层。**  
   Header/Footer 固定，中间内容横向分页，避免整块 UI 乱滑。

4. **首次展开给 discoverability cue。**  
   展开后轻微露出下一页边缘，提醒用户可横向切页。

Claude HUD One 应对齐的目标：

- compact：当前会话状态 + 极简运行态标识。
- peek：当前活跃会话的一句话状态，例如“Tool: Bash · 2m”“Waiting approval”“3 sessions active”。
- expanded：多页面板，至少包括 Session / Usage / Cost / Overview / Controls。

---

### 1.3 视觉层级：黑色岛体、柔和光晕、品牌色、等宽数字

Codex Island 的视觉不是靠复杂图形，而是靠稳定层级：

1. 黑色 island silhouette。
2. 外层 soft glow / material halo。
3. Claude/Codex 品牌色。
4. 关键数字使用等宽字体。
5. 告警时只替换 glow 和关键数字颜色，不做系统级打断。

关键源码：

- 岛形轮廓：`local/参考项目/codex-island/Sources/Views/IslandShape.swift:3`
- 连续圆角：`local/参考项目/codex-island/Sources/Views/IslandShape.swift:6`
- glow layer：`local/参考项目/codex-island/Sources/Views/IslandRootView.swift:422`
- 颜色 token：`local/参考项目/codex-island/Sources/Theme/Colors.swift:3`
- Claude terracotta：`local/参考项目/codex-island/Sources/Theme/Colors.swift:8`
- 字体 token / SF Mono：`local/参考项目/codex-island/Sources/Theme/Typography.swift:3`

Claude HUD One 可复刻方式：

- 保留 Win11 顶部居中的黑色 capsule 作为主体。
- 用 CSS `box-shadow` / `filter: blur()` / 半透明渐变模拟 halo。
- 重要数字、token、cost、context 用等宽字体。
- 告警色只影响 halo、状态点、数字，不要把整个 HUD 变红。
- 在低功耗模式下暂停持续 glow，只保留状态变化瞬间动效。

---

### 1.4 执行态动效：扫光、呼吸点、数字滚动、图表缓动

Codex Island 不是实时 agent 执行 HUD，它主要是 usage/cost dashboard。但它的刷新/加载动效很适合迁移到 Claude Code 执行态：

- loading sweep：岛边缘 angular sweep 环绕。
- live dot：绿色呼吸点，刷新成功时 bump。
- loading dot：peek pill 中的小点脉冲。
- numeric transition：数字变化滚动/淡入。
- charts：从旧值缓动到新值，而不是刷新归零。

关键源码：

- LoadingSweep：`local/参考项目/codex-island/Sources/Views/IslandRootView.swift:573`
- 30Hz sweep：`local/参考项目/codex-island/Sources/Views/IslandRootView.swift:597`
- LiveDot：`local/参考项目/codex-island/Sources/Views/LiveDot.swift:3`
- LiveDot bump：`local/参考项目/codex-island/Sources/Views/LiveDot.swift:39`
- Peek loading dot：`local/参考项目/codex-island/Sources/Views/NotchPeekPill.swift:130`
- NumericTransition：`local/参考项目/codex-island/Sources/Theme/NumericTransition.swift:3`
- Ring chart 从旧值动到新值：`local/参考项目/codex-island/Sources/Views/Charts/RingChart.swift:18`

建议映射到 Claude HUD One：

| Claude Code 状态 | HUD 动效 |
| --- | --- |
| idle / ready | dim logo + 低亮度 live dot |
| running | cobalt sweep 沿岛边运行 |
| tool running | sweep + peek 展示工具名 |
| subagent running | 多点呼吸 / 小队列 badge |
| waiting approval | amber 静态 glow + 自动 peek |
| failed / blocked | red pulse 一次 + 保留错误状态 |
| completed | green bump + 3 秒 summary 后回 idle |

---

### 1.5 动效节奏：形状先动，内容后进，退出更快

Codex Island 的高级感来自非对称动效：

- 打开用 spring，稍慢，便于跟随。
- 关闭更快，响应鼠标离开。
- peek 先形变再显示 pill。
- expanded 先展开容器，内容延迟淡入。
- page swipe 使用独立曲线，不跟容器 spring 混在一起。

关键源码：

- 动画 token：`local/参考项目/codex-island/Sources/Theme/Animations.swift:3`
- openMorph / closeMorph：`local/参考项目/codex-island/Sources/Theme/Animations.swift:17`
- peek pill 延迟淡入：`local/参考项目/codex-island/Sources/Views/IslandRootView.swift:173`
- expanded 内容延迟出现：`local/参考项目/codex-island/Sources/Views/IslandRootView.swift:144`
- 设计 timing 表：`local/参考项目/codex-island/docs/superpowers/specs/2026-05-01-notch-peek-design.md:180`

Claude HUD One 应照抄这套节奏，不建议只做简单 CSS display/block：

- container morph：spring/cubic-bezier。
- 内容淡入：延迟 120-220ms。
- pill 退出：先 opacity，再收缩容器。
- 页面切换：固定 duration + ease，不使用弹簧。
- running sweep：单独 compositor 动画，避免触发 React 整树重渲染。

---

## 2. Claude 小人/mascot：截图确认存在，应作为复刻重点

### 2.1 纠偏后的事实

用户补充截图中，左侧橙色像素小人明确存在，并且出现在每个 Claude Code 会话卡片左侧：

- 顶部标题是 `Claude (3)`，表示 3 个 Claude 会话。
- 会话卡片包含 `vibe-notch #8387`、`wxt`、`vibe-notch #demo` 等项目/会话名。
- 右侧展示 `Ghostty →`、`iTerm2 →`，说明卡片可跳回对应终端。
- 左侧橙色像素角色有不同状态：睡眠/等待的 `Zz`、键盘/工作态、thinking 文案等。

需要修正前一版判断：**不是“没有小人”，而是本地 `codex-island` 源码没有这个小人；截图对应的是 `Vibe Notch` 或同类 Claude Code notch 产品。** Homebrew cask 也把 `vibe-notch` 描述为 “Dynamic Island-style notifications for Claude Code CLI sessions”。Vibe Island 同类页面还明确展示多会话、Ghostty/iTerm2 跳转与 approval 处理能力。

本地 `codex-island` 仍然只有 Claude logo overlay：

- 构建复制 `claude_logo.pdf`：`local/参考项目/codex-island/build.sh:40`
- 读取 Claude logo：`local/参考项目/codex-island/Sources/Views/IslandRootView.swift:221`
- LogoOverlay 组件：`local/参考项目/codex-island/Sources/Views/IslandRootView.swift:436`
- 20x20 logo：`local/参考项目/codex-island/Sources/Views/IslandRootView.swift:461`

因此，报告口径调整为：**Codex Island 负责参考动态岛窗口/三态/usage panel；截图/Vibe Notch 负责参考多会话卡片、像素 mascot 和 Claude Code 交互态。**

### 2.2 小人应该怎么照抄

建议 Claude HUD One 直接做“像素 Claude companion”作为 Desktop HUD 的状态锚点，而不是只放 Claude logo：

| 状态 | 截图/目标表现 | Claude HUD One 建议 |
| --- | --- | --- |
| idle / sleeping | 橙色小人 + `Zz` | 小人静止或轻微呼吸，头顶 `Zz` 帧动画 |
| thinking | 小人旁显示 `thinking_` | 小人眨眼/头顶点点，文本下划线闪烁 |
| running / tool | 小人工作态/键盘态 | 小人敲键盘或身体 2 帧循环，岛边 sweep 同步 |
| waiting approval | 需要处理的醒目态 | 小人停止动画，amber 气泡/叹号，自动 peek |
| done | 短暂完成反馈 | 绿色 bump / 小人点头一次 |
| error / blocked | 错误反馈 | 红色边缘 + 小人 shake 一次 |

实现建议：

- 第一版：CSS 像素画 / inline SVG / 多帧 sprite，控制成本最低。
- 帧数控制在 2-6 帧，保持复古像素感，不做复杂骨骼动画。
- 小人必须绑定 `HudSession.activity`，每个会话卡片可独立显示状态。
- 在 compact/peek 中只显示一个主 mascot；expanded sessions 页每个会话卡片显示自己的小人。
- 不要作为独立子窗口；必须作为 Desktop HUD 内容层的一部分，否则焦点、穿透、缩放、DPI 都会复杂化。
- 透明窗口下要测试 alpha 边缘，像素画建议用整数倍缩放，避免 Windows DWM 模糊。

### 2.3 资产来源边界

- 若要“照抄截图风格”，可以复刻**像素风格、状态语义、布局位置和动画节奏**。
- 不建议直接复制第三方产品的具体图像资源，除非确认授权。
- 可以用自制像素 Claude companion：橙色 Anthropic 主题、睡眠/思考/键盘/等待/错误五套状态。

---

## 3. 多会话展示：以截图/Vibe Notch 卡片为直接目标，Codex Island 作为数据页参考

### 3.1 截图里的多会话模式

截图里的多会话比本地 `codex-island` 更贴近 Claude HUD One 的目标形态：

- 顶部 `Claude (3)`：按 agent/provider 聚合，并显示会话数量。
- 每张卡片左侧：橙色像素 mascot，表达 sleeping/thinking/running 等状态。
- 主标题：项目名或会话名，如 `vibe-notch #8387`、`wxt`、`vibe-notch #demo`。
- 消息摘要：保留最近用户/助手消息、命令提示符风格、`thinking_` 等当前状态。
- 右侧时间：`1h`、`<1m`、`1m`，用于判断 freshness。
- 右侧终端入口：`Ghostty →`、`iTerm2 →`，用于一键回到对应终端 session。

这应成为 Claude HUD One Desktop HUD 的多会话直接复刻目标：**expanded sessions 页就是多张会话卡片；peek 态只显示当前最需要关注的一张或 `Claude (N)` 摘要。**

### 3.2 Codex Island 的“多”是什么

Codex Island 的多维度主要包括：

- 多 provider：Claude / Codex。
- 多 usage window：5h / 7d。
- 多本地 session log 聚合：扫描 Claude/Codex JSONL。
- 多页面：Usage / Cost / Overview。

关键源码：

- README “Two providers, four windows”：`local/参考项目/codex-island/README.md:28`
- Usage 数据结构：`local/参考项目/codex-island/Sources/Usage/AppUsage.swift:3`
- UsageView 双 provider 布局：`local/参考项目/codex-island/Sources/Views/UsageView.swift:20`
- Claude JSONL log 扫描：`local/参考项目/codex-island/Sources/Cost/ClaudeLogReader.swift:3`
- Codex JSONL log 扫描：`local/参考项目/codex-island/Sources/Cost/CodexLogReader.swift:3`
- TokenEvent 统一模型：`local/参考项目/codex-island/Sources/Cost/TokenEvent.swift:3`
- 三页定义：`local/参考项目/codex-island/Sources/Model/ScreenPref.swift:9`
- PagedContent 三页 HStack：`local/参考项目/codex-island/Sources/Views/PagedContent.swift:21`

### 3.3 Claude HUD One 的优势

Claude HUD One 已经有更接近真实多会话的基础：

- Bridge 写当前状态和 sessions 文件。
- Rust 读取 session files、去重、按新旧排序。
- 前端可映射为 current session 和 session list。

关键源码：

- Bridge state 路径和 sessions 路径：`.claude/bridge/claude-status-bridge.mjs:28`
- Bridge 写出 state：`.claude/bridge/claude-status-bridge.mjs:1402`
- Rust sessions paths：`src-tauri/src/window/claude_status.rs:91`
- session dedupe：`src-tauri/src/window/claude_status.rs:102`
- newest-first truncation：`src-tauri/src/window/claude_status.rs:116`
- 前端 load bridge sessions：`src/providers/claudeCodeSummary.ts:275`
- store setSessions：`src/stores/useIslandStore.ts:189`
- CurrentSessionStrip 多 session 列表：`src/components/island/CurrentSessionStrip.tsx:83`

### 3.3 建议照抄的多会话展示方式

把 Codex Island 的 provider/page 结构迁移成 Claude HUD One 的 session/page 结构：

| Codex Island | Claude HUD One 对应 |
| --- | --- |
| Claude/Codex logo tabs | 当前会话 / 其他活跃会话 tabs |
| 5h headline pill | 当前会话 running/waiting/tool/status pill |
| Usage page | Context / token / quota page |
| Cost page | Cost / model / cache page |
| Overview page | 多会话总览 / 最近活动 / warnings |
| Page dots | Session / Usage / Cost / Controls dots |

推荐 expanded 页面：

1. **Session**：当前会话、项目、分支、活跃 tool、todo、subagent。
2. **Usage**：context、token、rate/quota、cache。
3. **Cost**：本次、今日、本月、模型 breakdown。
4. **Sessions**：多会话列表，按 fresh/running/waiting 排序。
5. **Controls**：refresh、open settings、pause/low power、diagnostics。

多会话状态必须有产品定义：

- `active`：最近 N 秒内有 status/hook 更新。
- `running`：activity/tool/subagent/todo 体现正在执行。
- `waiting`：检测到需要用户输入/确认/权限或长时间无输出但未结束。
- `stale`：超过 freshness 阈值。
- `closed/archived`：超过保留窗口，仅进历史，不出现在 HUD 主列表。

---

## 4. 悬浮窗点击交互：可照抄清单

### 4.1 点击穿透双保险

Codex Island 的点击穿透值得直接照抄思想：

1. View 层 `hitTest` 只让 island rect 命中。
2. Window 层根据鼠标位置提前切 `ignoresMouseEvents`。

关键源码：

- hitTest 说明：`local/参考项目/codex-island/Sources/Window/IslandHostingView.swift:4`
- 根据 `islandModel.size` 算可点 rect：`local/参考项目/codex-island/Sources/Window/IslandHostingView.swift:33`
- rect 外返回 nil：`local/参考项目/codex-island/Sources/Window/IslandHostingView.swift:42`
- `acceptsFirstMouse`：`local/参考项目/codex-island/Sources/Window/IslandHostingView.swift:45`
- 初始 `window.ignoresMouseEvents = true`：`local/参考项目/codex-island/Sources/Window/IslandWindowController.swift:87`
- 全局/本地 mouseMoved monitor：`local/参考项目/codex-island/Sources/Window/IslandWindowController.swift:97`
- 10Hz timer 兜底：`local/参考项目/codex-island/Sources/Window/IslandWindowController.swift:103`
- 动态 flip ignoresMouseEvents：`local/参考项目/codex-island/Sources/Window/IslandWindowController.swift:118`

Claude HUD One 已经有 Windows 等价实现：

- `HitRegion`：`src-tauri/src/window/overlay.rs:13`
- `OverlayTracker`：`src-tauri/src/window/overlay.rs:32`
- 25ms cursor polling：`src-tauri/src/window/overlay.rs:166`
- `WM_MOUSEACTIVATE` / `WM_NCHITTEST`：`src-tauri/src/window/overlay.rs:233`
- Win32 extended styles：`src-tauri/src/window/overlay.rs:277`
- `SetWindowRgn`：`src-tauri/src/window/overlay.rs:451`
- React 上报 hit regions：`src/components/island/IslandRoot.tsx:217`
- overlay bridge invoke：`src/app/overlayBridge.ts:107`

下一步不是重做，而是把 hit region 来源从“DOM 实测为主”升级为“layout model 派生 + DOM 校准”。

---

### 4.2 hover、click、page、refresh

Codex Island 的基本点击交互可直接复刻：

- hover：compact → peek。
- click：compact/peek → expanded。
- page dot：点击切换 Usage/Cost/Overview。
- trackpad/wheel：expanded 下横向切页。
- footer live status：点击刷新当前页数据。
- gear：打开 settings。

关键源码：

- `contentShape(IslandShape())`：`local/参考项目/codex-island/Sources/Views/IslandRootView.swift:121`
- click gesture：`local/参考项目/codex-island/Sources/Views/IslandRootView.swift:122`
- hover handler：`local/参考项目/codex-island/Sources/Views/IslandRootView.swift:156`
- 横向滚动仅 expanded 响应：`local/参考项目/codex-island/Sources/Window/IslandHostingView.swift:59`
- Shift+wheel fallback：`local/参考项目/codex-island/Sources/Window/IslandHostingView.swift:77`
- PageIndicator dot 点击：`local/参考项目/codex-island/Sources/Views/PageIndicator.swift:3`
- Footer live refresh button：`local/参考项目/codex-island/Sources/Views/PanelFooter.swift:136`
- 当前页路由 refresh：`local/参考项目/codex-island/Sources/Views/PanelFooter.swift:183`
- Settings gear：`local/参考项目/codex-island/Sources/Views/SettingsButton.swift:12`

Claude HUD One 可落地为：

- Desktop HUD expanded page dots 可点击。
- 鼠标滚轮 / Shift+滚轮切换页面。
- Footer/status chip 点击 refresh bridge state 或 usage/cost snapshot。
- `Waiting approval` 状态下点击展开 Controls 页。
- 右上角或 footer gear 打开 Settings Desktop HUD tab。

---

### 4.3 选择/确认类交互

Codex Island 有这些本地选择/确认模式：

- Settings tab 选择。
- Toggle。
- Segmented control。
- Picker。
- 语言切换后 NSAlert 确认 Restart now / Later。
- Claude re-auth inline button。
- Launch at Login 系统权限失败后 inline error。

关键源码：

- settings active tab：`local/参考项目/codex-island/Sources/Views/SettingsView.swift:26`
- tab button：`local/参考项目/codex-island/Sources/Views/SettingsView.swift:101`
- SettingsToggle：`local/参考项目/codex-island/Sources/Views/Settings/SettingsToggle.swift:6`
- SegmentedControl：`local/参考项目/codex-island/Sources/Views/Settings/SegmentedControl.swift:7`
- language picker binding：`local/参考项目/codex-island/Sources/Views/SettingsView.swift:467`
- restart prompt：`local/参考项目/codex-island/Sources/Views/SettingsView.swift:478`
- restart alert buttons：`local/参考项目/codex-island/Sources/Views/SettingsView.swift:482`
- Claude re-auth button：`local/参考项目/codex-island/Sources/Views/UsageView.swift:101`
- spawn `claude auth login`：`local/参考项目/codex-island/Sources/Usage/ClaudeCredentials.swift:305`

Claude HUD One 应分两层实现：

#### A. 本地可控确认：可以直接做

例如：

- 切换显示器。
- 重置设置。
- 暂停 Desktop HUD。
- 开启/关闭低功耗。
- 修改语言后提示重启。
- bridge 安装/恢复确认。
- 打开 settings / diagnostics。

这些都属于本应用状态，可在悬浮窗内完整交互。

#### B. Claude Code 权限/选择：不能假装已能做，需要新增桥

例如：

- Claude Code tool permission approve/deny。
- Claude Code AskUserQuestion 选项。
- CLI 交互式确认。
- 用户输入文本。

这些需要 Claude Code 提供可外部控制的稳定接口，或我们在 statusLine/hooks/terminal 层新增可靠 bridge。没有明确接口前，Desktop HUD 只能展示“需要用户处理”，并引导用户回终端。

建议设计一个 `InteractionInbox`，但分阶段启用能力：

| 阶段 | 能力 | 风险 |
| --- | --- | --- |
| 1 | 只展示 waiting / needs input / open terminal | 低 |
| 2 | 本应用设置确认和选择 | 低 |
| 3 | 从 bridge 读取结构化 pending interaction 并展示 | 中 |
| 4 | HUD 上选择后写回 Claude Code / CLI | 高，需要官方/稳定接口 |

---

## 5. Claude HUD One 当前实现承接能力

### 5.1 Windows overlay 已经具备对标基础

当前 Desktop HUD 主窗口已是透明、无边框、always-on-top、skip taskbar：

- main window 配置：`src-tauri/tauri.conf.json:16`
- 透明：`src-tauri/tauri.conf.json:21`
- decorations false：`src-tauri/tauri.conf.json:22`
- alwaysOnTop：`src-tauri/tauri.conf.json:25`
- skipTaskbar：`src-tauri/tauri.conf.json:26`

Rust 层也已覆盖关键 Win32 能力：

- overlay 配置：`src-tauri/src/window/overlay.rs:79`
- click-through：`src-tauri/src/window/overlay.rs:91`
- cursor polling：`src-tauri/src/window/overlay.rs:166`
- no activate guard：`src-tauri/src/window/overlay.rs:229`
- Win32 styles：`src-tauri/src/window/overlay.rs:277`
- Window Region：`src-tauri/src/window/overlay.rs:451`

这说明我们不需要从零复刻窗口层，而是应把 Codex Island 的窗口策略作为校准标准。

---

### 5.2 当前 Desktop HUD 的主要弱点：模型层分散

当前布局事实分散在多处：

- Tauri 初始窗口尺寸：`src-tauri/tauri.conf.json:19`
- Rust overlay padding/slot：`src-tauri/src/window/display.rs:9`
- Rust fit overlay：`src-tauri/src/window/display.rs:93`
- React DOM 实测：`src/components/island/IslandRoot.tsx:217`
- Desktop HUD config：`src/hud/config.ts:138`
- Rust default desktop settings：`src-tauri/src/window/settings.rs:158`

Codex Island 则用 `IslandModel` 把 state → size → hit rect 收在一起：

- `state`：`local/参考项目/codex-island/Sources/Model/IslandModel.swift:12`
- `size`：`local/参考项目/codex-island/Sources/Model/IslandModel.swift:13`
- `recomputeSize`：`local/参考项目/codex-island/Sources/Model/IslandModel.swift:165`

建议新增 Claude HUD One 的 `IslandLayoutModel`：

```text
输入：
  mode: compact | peek | expanded
  page: session | usage | cost | sessions | controls
  density / preset / visibleItems
  currentSession activity / waiting / alerts

输出：
  hostWindowStrategy
  capsuleRect
  panelRect
  hitRegions
  animationTokens
  preferredWindowSize
```

这样 React 渲染、Rust Window Region、display.rs fit 逻辑、settings preset 都能共享同一个语义模型。

---

### 5.3 Bridge 与多会话基础足够，但需要升级成 provider/session model

当前数据链路：

```text
Claude Code statusLine/hooks
  -> .claude/bridge/claude-status-bridge.mjs
  -> %APPDATA%/Claude HUD One/claude-status.json
  -> %APPDATA%/Claude HUD One/sessions/*.json
  -> Rust claude_status.rs
  -> Tauri commands
  -> src/providers/claudeCodeSummary.ts
  -> useIslandStore
  -> IslandRoot / CurrentSessionStrip / UsageView / CostView
```

关键源码：

- bridge summarizeStatusLine：`.claude/bridge/claude-status-bridge.mjs:986`
- bridge summarizeHook：`.claude/bridge/claude-status-bridge.mjs:1071`
- bridge 写状态：`.claude/bridge/claude-status-bridge.mjs:1402`
- Rust 读取 current state：`src-tauri/src/window/claude_status.rs:85`
- Rust 读取 sessions：`src-tauri/src/window/claude_status.rs:91`
- 前端 bridge → session patch：`src/providers/claudeCodeSummary.ts:96`
- normalize 承接点：`src/hud/normalize.ts:9`

后续应把 Claude Code 当前状态、usage/cost、本地日志、未来 Codex provider 都归一成 provider/session model，而不是继续把所有东西塞进 `claudeCodeSummary.ts`。

---

## 6. 可直接照抄 / 需要改写 / 不建议照抄

| 类别 | CodeIsland / codex-island 做法 | Claude HUD One 处理 |
| --- | --- | --- |
| 多会话卡片 | CodeIsland `SessionListView` + `SessionCard` | 直接照抄结构，迁移到 React/Tauri |
| 像素 mascot | CodeIsland `ClawdView` Canvas 状态动画 | 直接复刻为 CSS/SVG/Canvas 像素角色 |
| AgentStatus | idle / processing / running / waitingApproval / waitingQuestion | 直接照抄状态语义 |
| Top-level surface | collapsed / sessionList / approvalCard / questionCard / completionCard | 直接照抄为 Desktop HUD surface enum |
| approval/question | HookServer blocking response + queue | 思路照抄，Windows/Claude Code bridge 需重写 |
| click-to-jump | TerminalActivator 支持 Ghostty/iTerm2/tmux/zellij | 思路照抄，Windows 侧适配 Windows Terminal/进程窗口 |
| hover 展开 | 0.5s 展开、0.15s 收起，交互卡不自动收起 | 直接照抄 |
| 三态/usage dashboard | codex-island compact/peek/expanded + Usage/Cost/Overview | 作为补充页照抄，不再作为主线 |
| click-through | codex-island 更完整；CodeIsland 较弱 | 保留 Claude HUD One 现有 Win32 Window Region/click-through |
| macOS material/AppKit | NSPanel / SwiftUI / AppleScript / CoreBluetooth | 不照抄代码，只迁移模型和交互 |
| ESP32 Buddy | BLE companion desk pet | 后期增强，可暂不做 |

---

## 7. 分阶段落地方案

### Phase 1：复刻 CodeIsland 截图级会话卡片与 mascot

目标：先让 Desktop HUD 的核心观感与截图一致：`Claude (N)`、多会话卡片、左侧橙色像素小人、右侧终端跳转入口。

建议改造：

1. 定义 `HudSession` / `HudAgentStatus` / `HudSurface`，对齐 CodeIsland 的 `SessionSnapshot`、`AgentStatus`、`IslandSurface`。
2. 实现像素 `Clawd` mascot：sleep / work / alert 三组动画，对应 idle、processing/running、waitingApproval/waitingQuestion。
3. Expanded panel 先做 `SessionListView`：每张卡片展示 mascot、项目名、最近消息、耗时、终端来源 badge。
4. compact/peek 显示 `Claude (N)`、当前最需要关注的 session 和状态。
5. hover 展开延迟 0.5s、收起 0.15s；approval/question/completion surface 不被 hover 自动收起。
6. 保留现有 Win32 click-through / Window Region，不为了复刻 CodeIsland 弱化窗口命中稳定性。

主要文件：

- `src/components/island/IslandRoot.tsx`
- `src/components/island/CurrentSessionStrip.tsx`
- `src/stores/useIslandStore.ts`
- `src/app/types.ts`
- `src-tauri/src/window/display.rs`

验收口径：

- 默认 compact 低打扰，展开后是多会话卡片列表。
- 左侧像素小人有至少 idle/work/alert 三态动画。
- 多个 Claude Code 会话可按 waiting > running > processing > idle 排序。
- 岛外点击不被吞，多屏/DPI 下 hit region 不明显漂移。

---

### Phase 2：HookServer / Bridge / blocking interaction

目标：从“读取 statusLine 文件状态”升级为“能接住 hook event，并对 PermissionRequest / AskUserQuestion 阻塞响应”。

建议改造：

1. 设计 Windows/Tauri 版 `HookServer`，可用本地 TCP/Named Pipe/Unix domain socket 等 IPC，先保证本机安全权限。
2. bridge 读取 Claude Code hook stdin JSON，归一化 eventName/sessionId/toolName/toolInput/source/terminal metadata。
3. AppState 维护 `permissionQueue`、`questionQueue`、`pendingToolUses`。
4. 实现 PreToolUse cache enrich，避免 PermissionRequest payload 过薄导致 HUD 无上下文。
5. approval UI 支持 Allow once / Always / Deny / Dismiss；question UI 支持单选、多选、Other、文本输入。
6. blocking hook 返回必须可审计，默认不自动批准。

主要文件：

- `.claude/bridge/claude-status-bridge.mjs` 或新增独立 hook bridge
- `src-tauri/src/window/claude_global.rs`
- `src-tauri/src/window/claude_status.rs`
- `src/providers/claudeCodeSummary.ts`
- `src/stores/useIslandStore.ts`

验收口径：

- PermissionRequest 能进入 HUD approval surface。
- 用户在 HUD 点击后，hook 能收到正确 allow/deny response。
- Dismiss 不等于 deny。
- AskUserQuestion 能在 HUD 展示并回写选择。

---

### Phase 3：终端跳转与多 provider 扩展

目标：让会话卡片右侧的 `Ghostty/iTerm2/Terminal →` 在 Windows 上变成可用的“回到会话”能力，并逐步扩展多 provider。

建议改造：

1. bridge 捕获 terminal metadata：pid、ppid、cwd、window title、Windows Terminal profile/tab 线索、shell、tty/ConPTY 可用信息。
2. Windows 侧实现 `TerminalActivator`：先支持 Windows Terminal / PowerShell / Git Bash / VS Code terminal 的窗口激活与 cwd/title 匹配。
3. 点击 session card 后验证前台窗口是否切到目标；失败时 HUD shake/error feedback。
4. subagent 不单独建 session card，挂在 parent session 下，用 mini icon grid 和 `+N Sub` 展示。
5. 多 provider 支持数据化：先 Claude Code，再 Codex/Gemini/OpenCode/Cursor 等，不把 provider if/else 写进 UI。

主要风险：

- Windows Terminal tab 级别精确跳转没有 macOS AppleScript 那么稳定，可能只能做到窗口级激活。
- 权限确认是安全敏感链路，必须避免模拟键盘输入或误批准。
- 多 provider hook payload 差异大，必须先做 event normalizer。

验收口径：

- 点击会话卡片能尽量回到对应终端窗口；无法精确跳转时有明确反馈。
- subagent 在同一 session 下聚合，不导致卡片爆炸。
- provider 适配通过配置表/normalizer 扩展。

---

### Phase 4：固定宿主窗口与更高级动效实验

目标：在保留现有稳定路径的前提下，验证 Codex Island 的固定宿主窗口方案是否更稳。

建议改造：

1. 在设置或内部 flag 中增加 `windowStrategy: dynamic-fit | fixed-host`。
2. fixed-host 下保持一个足够大的透明窗口，内部 island 变形，Win32 region 控制输入区域。
3. transition 期间减少 Tauri resize，只更新 region。
4. 加 diagnostics overlay 显示 host rect、capsule rect、hit regions、cursor inside、scale factor。

主要文件：

- `src-tauri/src/window/display.rs`
- `src-tauri/src/window/overlay.rs`
- `src/app/overlayBridge.ts`
- `src/components/island/IslandRoot.tsx`

验收口径：

- expanded/peek 切换无明显窗口跳动。
- 岛外点击继续穿透。
- 双屏、125%/150% DPI、全屏应用下表现可接受。
- 性能不明显劣化。

---

## 8. 风险与边界

1. **不要把 Codex Island 的 macOS API 当成可移植实现。**  
   `NSWindow.level = .popUpMenu`、`SMAppService`、Keychain、Sparkle、haptic、ultraThinMaterial 都不能直接搬到 Windows/Tauri。

2. **不要把“多 provider/log 聚合”误认为“多实时会话控制”。**  
   Claude HUD One 要做的是 Claude Code 多会话，需要独立生命周期和 freshness 规则。

3. **不要把 Claude Code 权限确认当成普通 UI 按钮。**  
   CodeIsland 已证明可以通过 hook blocking response 做 HUD approval，但这仍是安全敏感链路；Windows 版必须有可审计响应、超时策略、dismiss/deny 区分和默认保守策略。

4. **不要为了复刻视觉牺牲点击穿透稳定性。**  
   Windows overlay 的最大风险仍是 region、DPI、no-activate、透明窗口、transition 的时序问题。

5. **不要让 mascot 动画变成性能负担。**  
   透明置顶窗口里持续 blur/shadow/动画可能吃 GPU。应支持 low power mode，并在不可见/锁屏/全屏时暂停。

6. **usage/cost 仍应标明估算。**  
   本地 JSONL + pricing snapshot 无法等同官方账单。

---

## 9. 建议下一步产品决策

如果要“直接参考甚至照抄”，建议确认三个范围：

1. **是否把 CodeIsland 作为 Desktop HUD 主参考，codex-island 退为 usage/dashboard 参考？**  
   建议确认：主线改为 CodeIsland，因为它才有截图里的 mascot、多会话、approval/question 和终端跳转。

2. **像素小人是否作为一期正式视觉锚点？**  
   建议是：做。第一版至少复刻 sleep/work/alert 三态；不直接复制第三方素材，使用自制 Claude 橙色像素 companion。

3. **一期是否做真正 HUD approval/question？**  
   建议分两步：先做 approval/question UI 和 queue，再做 blocking hook response；默认保守，不自动批准。

---

## 10. 最小可执行清单

建议下一轮实现按以下顺序推进：

1. 把 Desktop HUD 主参考切到 `local/参考项目/CodeIsland`，保留 `codex-island` 作为 usage/cost dashboard 补充。
2. 建 `HudSession` / `HudAgentStatus` / `HudSurface`，对齐 CodeIsland 的 `SessionSnapshot` / `AgentStatus` / `IslandSurface`。
3. 制作橙色像素 `Clawd` mascot，至少支持 sleep/work/alert 三态。
4. 重做 expanded sessions 页：多会话卡片、最近消息、耗时、终端 badge、subagent mini icons。
5. 实现 approval/question surface：Allow once / Always / Deny / Dismiss、单选/多选/文本输入。
6. 设计 Windows 版 HookServer/bridge blocking response，替代单纯 statusLine 文件轮询。
7. 设计 Windows 版 TerminalActivator，先做到窗口级跳转和失败反馈。
8. 后续再补 usage/cost dashboard、provider 扩展、remote session、ESP32/Buddy。

总体判断：**用户截图对应的正确参考是 `wxtsky/CodeIsland`，不是原来的 `ericjypark/codex-island`。Claude HUD One 的 Desktop HUD 后续应直接对标 CodeIsland：多会话卡片 + 像素小人 + approval/question + click-to-jump 是主线；codex-island 的 Usage/Cost/Overview 与动态岛三态只作为补充参考。**
