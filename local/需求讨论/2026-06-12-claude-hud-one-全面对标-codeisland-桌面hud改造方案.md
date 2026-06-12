# Claude HUD One 全面对标 CodeIsland 桌面 HUD 改造方案

> 日期：2026-06-12  
> 结论：Claude HUD One 的 **Desktop HUD 主线全面切换为 Windows 版 CodeIsland**。参考对象为 `local/参考项目/CodeIsland`，不是旧 `codex-island`。Windows 上不做 Mac 刘海硬件适配，而是用 Tauri 透明置顶悬浮窗模拟同等桌面体验。  
> 裁剪：一期只做 **Claude Code**，不做 Codex/Gemini/Cursor/Copilot/Cline 等其他 AI 工具；现有 **Terminal HUD 必须保留**，作为 Claude Code `statusLine` 输出和终端内状态面。

---

## 1. 最终产品方向

### 1.1 目标一句话

把 Claude HUD One 从“Claude Code 状态动态岛 + Terminal HUD 套件”，升级为：

> **Windows 上的 CodeIsland for Claude Code：一个顶部悬浮的 Claude Code 多会话活动岛，带像素 Clawd 小人、会话卡片、工具状态、approval/question、完成提醒、终端跳转，同时保留终端内 HUD。**

### 1.2 我决定采用的对标原则

1. **桌面 HUD 直接对标 CodeIsland，不再以旧 codex-island 为主线。**  
   旧 `local/参考项目/codex-island` 是 Claude/Codex usage dashboard，可作为 Usage/Cost 补充；真正要照抄的是 `local/参考项目/CodeIsland`。

2. **只做 Claude Code。**  
   CodeIsland 的多 provider 能力很多，但本项目一期全部裁掉：不做 Codex、Gemini、Cursor、Qoder、Copilot、Cline、OpenCode、Kimi、Trae、Factory、CodeBuddy 等。

3. **保留 Terminal HUD。**  
   CodeIsland 的“回到终端”是产品闭环，Claude HUD One 的 Terminal HUD 不能删，反而要和 Desktop HUD 形成双面：
   - Terminal HUD：继续作为 Claude Code statusLine 输出。
   - Desktop HUD：作为 Windows 悬浮窗活动岛，承担会话、审批、问答、提醒、跳转。

4. **视觉照抄，底层重写。**  
   CodeIsland 是 macOS SwiftUI/AppKit/NSPanel/AppleScript/CoreBluetooth；Claude HUD One 是 Windows/Tauri/React/Rust/Win32。UI 信息架构、状态机、动效节奏、交互语义照抄；平台能力全部按 Windows 重写。

5. **先做可用闭环，再补 usage/cost。**  
   一期主线是：多会话 + mascot + approval/question + terminal jump。Usage/Cost/Overview 暂时后置为辅助页，不再是桌面 HUD 核心。

---

## 2. CodeIsland 必须照抄的体验

### 2.1 Surface 状态机

CodeIsland 用 `IslandSurface` 控制顶层 HUD 状态，同一时刻只展示一种 surface：

- collapsed
- sessionList
- approvalCard
- questionCard
- completionCard

参考：`local/参考项目/CodeIsland/Sources/CodeIsland/IslandSurface.swift:1`

Claude HUD One 必须照抄成：

```ts
type DesktopHudSurface =
  | { type: 'collapsed' }
  | { type: 'sessionList' }
  | { type: 'approvalCard'; sessionId: string }
  | { type: 'questionCard'; sessionId: string }
  | { type: 'completionCard'; sessionId: string }
```

落地判断：

- 这是重写 Desktop HUD 的第一优先级。
- 当前 `compact / peek / expanded` 可以保留为视觉层概念，但状态机必须升级为 surface-driven。
- approval/question/completion 不应只是 expanded 内的一页，而应是可抢占普通 sessionList 的高优先级 surface。

---

### 2.2 像素 Clawd 小人

CodeIsland 的橙色小人是 `ClawdView`，不是图片 sprite，而是 SwiftUI Canvas 绘制的像素角色：

- `ClawdView` 主实现：`local/参考项目/CodeIsland/Sources/CodeIsland/PixelCharacterView.swift:4`
- 状态分发：`local/参考项目/CodeIsland/Sources/CodeIsland/PixelCharacterView.swift:22`
- 睡觉态 `sleepScene`：`local/参考项目/CodeIsland/Sources/CodeIsland/PixelCharacterView.swift:110`
- 工作态 `workScene`：`local/参考项目/CodeIsland/Sources/CodeIsland/PixelCharacterView.swift:163`
- 警报态 `alertScene`：`local/参考项目/CodeIsland/Sources/CodeIsland/PixelCharacterView.swift:259`
- mascot 路由：`local/参考项目/CodeIsland/Sources/CodeIsland/MascotView.swift:17`
- Claude/default fallback：`local/参考项目/CodeIsland/Sources/CodeIsland/MascotView.swift:61`
- SessionCard 左侧接入：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:1947`

Claude HUD One 一期直接做一个 React 版像素 Clawd：

| Claude Code 状态 | Clawd 表现 | 对应 CodeIsland |
| --- | --- | --- |
| idle | 睡觉 + Zz | sleepScene |
| processing | 思考/等待输出 | workScene 低速 |
| running/tool | 敲键盘/工作 | workScene 高速 |
| waitingApproval | 警报/惊醒/叹号 | alertScene |
| waitingQuestion | 警报/问号/等待输入 | alertScene 变体 |
| completed | 点头/绿色 bump | completion 动效 |
| error | shake + 红色 glow | error feedback |

实现方式我建议：

- 不直接复制第三方具体图像资源。
- 用 CSS pixel art 或 SVG rect 网格自制 `ClawdMascot`。
- 文件建议：`src/components/desktopHud/ClawdMascot.tsx`。
- 不引入 Lottie/Rive，第一版用 2-6 帧 CSS animation，成本低、性能可控。
- 每个 SessionCard 左侧都显示一个小 Clawd；collapsed 状态只显示当前最重要 session 的 Clawd。

---

### 2.3 多 Claude Code 会话卡片

CodeIsland 的 `SessionCard` 是对标核心：

- SessionCard 定义：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:1886`
- 左侧 mascot / subagent：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:1943`
- 会话标题 / tag / terminal badge：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:1968`
- inline approval：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:2001`
- 最近 prompt / chat / 当前状态：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:2082`
- 整卡点击：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:2141`

Claude HUD One 一期 SessionCard 要包含：

```text
左侧：Clawd 小人 + subagent mini icons
中间：project/session title + session id
正文：last user prompt、last assistant summary、current tool/status
右侧：elapsed time + terminal badge + jump arrow
状态：waiting/running/processing/idle/completed/error
```

必须支持的排序：

1. waitingApproval
2. waitingQuestion
3. running
4. processing
5. completed 最近完成
6. idle fresh
7. stale

当前 Claude HUD One 已经能读取多 session 文件，但 UI 要重做成真正的卡片列表，不再只是 CurrentSessionStrip 的补充信息。

---

### 2.4 Compact bar

CodeIsland compact bar 左侧显示 mascot，中间显示当前工具状态，右侧显示会话计数和等待提醒：

- compact 左侧 mascot：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:376`
- tool linger / tool status：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:399`
- 右侧 session count / waiting badge：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:445`
- 工具颜色分类：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:492`

Claude HUD One 的 collapsed/compact bar 应照抄：

```text
[Clawd]  Claude (N)  ·  Bash/Edit/Read/Thinking...       [waiting badge]
```

Windows 版顶部悬浮窗默认表现：

- 屏幕顶部居中。
- 类 Mac 刘海黑色 capsule。
- 鼠标 hover 500ms 展开 sessionList。
- 鼠标离开 150ms 收起。
- waitingApproval / waitingQuestion 自动弹出，不等 hover。

---

### 2.5 Approval 卡片

CodeIsland 能在 HUD 内处理 PermissionRequest：

- 审批 surface 渲染：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:119`
- ApprovalBar 定义：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:847`
- 审批按钮：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:925`
- AppState permission request：`local/参考项目/CodeIsland/Sources/CodeIsland/AppState.swift:1045`
- approve：`local/参考项目/CodeIsland/Sources/CodeIsland/AppState.swift:1095`
- deny：`local/参考项目/CodeIsland/Sources/CodeIsland/AppState.swift:1205`
- dismiss：`local/参考项目/CodeIsland/Sources/CodeIsland/AppState.swift:1224`
- HookServer permission 路由：`local/参考项目/CodeIsland/Sources/CodeIsland/HookServer.swift:233`

Claude HUD One 一期是否做真实 approval blocking？我的决定：

- **报告中把它列为一期核心目标，但实现上分两步。**
  1. 先做 UI/queue/surface/状态展示。
  2. 再做 hook blocking response。
- 因为这涉及 Claude Code hook 响应安全，必须在实现阶段用 Workflow 单独验证。

一期目标 UI：

```text
ApprovalCard
- tool name
- file/path/server/command summary
- session/project
- queue index
- Deny
- Dismiss
- Allow once
- Always
```

安全边界：

- Dismiss 不等于 Deny。
- Always 默认不启用，需要用户明确点击。
- 不模拟键盘输入。
- 不把 raw prompt/tool result 暴露到桌面 HUD；只显示安全摘要。

---

### 2.6 Question / AskUserQuestion 卡片

CodeIsland 支持 Claude Code 问答卡：

- AskUserQuestion 模型：`local/参考项目/CodeIsland/Sources/CodeIsland/Models.swift:10`
- QuestionBar：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:1020`
- 多问题 wizard：`local/参考项目/CodeIsland/Sources/CodeIsland/NotchPanelView.swift:1086`
- handleQuestion：`local/参考项目/CodeIsland/Sources/CodeIsland/AppState.swift:1242`
- handleAskUserQuestion：`local/参考项目/CodeIsland/Sources/CodeIsland/AppState.swift:1274`
- answerQuestion / answerQuestionMulti：`local/参考项目/CodeIsland/Sources/CodeIsland/AppState.swift:1386`

Claude HUD One 必须支持：

- 单选。
- 多选。
- Other 输入。
- 文本输入。
- 1-4 个问题 wizard。
- Submit / Skip / Dismiss。

这是桌面 HUD 的高价值能力，不能后置太久。

---

### 2.7 Completion 卡片与智能抑制

CodeIsland 会在任务完成后弹 completionCard，同时避免打扰：

- completion 处理：`local/参考项目/CodeIsland/Sources/CodeIsland/AppState.swift:723`
- 智能抑制：`local/参考项目/CodeIsland/Sources/CodeIsland/AppState.swift:741`
- 5 秒自动收起：`local/参考项目/CodeIsland/Sources/CodeIsland/AppState.swift:786`

Claude HUD One 应实现：

- Claude Code Stop/StopFailure 后生成 completion surface。
- 如果用户正在对应终端前台，可不弹或降级为 subtle glow。
- completion 不覆盖 approval/question。
- 多个 completion 排队展示。

---

### 2.8 Terminal Jump / 回到终端

CodeIsland 的 TerminalActivator 是核心闭环：

- TerminalActivator 定位：`local/参考项目/CodeIsland/Sources/CodeIsland/TerminalActivator.swift:4`
- 主入口：`local/参考项目/CodeIsland/Sources/CodeIsland/TerminalActivator.swift:71`
- terminal metadata 采集：`local/参考项目/CodeIsland/Sources/CodeIslandBridge/main.swift:394`
- SessionSnapshot 保存 terminal 信息：`local/参考项目/CodeIsland/Sources/CodeIslandCore/SessionSnapshot.swift:65`

Windows 版一期策略：

- 先实现 “Open / Focus Terminal” 到窗口级。
- 支持 Windows Terminal、PowerShell、cmd、Git Bash、WezTerm、Ghostty for Windows（如可识别）。
- 优先使用 hook bridge 捕获：pid、ppid、cwd、shell、terminal program、window title、WT_SESSION。
- 找不到原窗口时打开新 terminal 到 cwd。
- 点击 SessionCard 右侧 badge 和整卡都可触发 jump。

不要承诺第一版能精确跳到 Windows Terminal 的 tab/pane；这是二期实验。

---

## 3. Claude-only 裁剪方案

### 3.1 删除/后置的 CodeIsland 能力

CodeIsland 支持很多 AI 工具：`local/参考项目/CodeIsland/README.md:43`

Claude HUD One 一期全部不做：

- Codex
- Gemini
- Cursor
- Trae
- Qoder
- Copilot
- Factory
- CodeBuddy
- Kimi
- OpenCode
- Cline
- 自定义 CLI
- Remote multi-provider installer
- provider-specific mascot
- provider-specific TerminalActivator
- ESP32 Buddy

### 3.2 保留的 CodeIsland 内核

只保留这些思想：

| CodeIsland 模块 | Claude HUD One 处理 |
| --- | --- |
| IslandSurface | 直接迁移为 DesktopHudSurface |
| AgentStatus | 直接迁移为 ClaudeCodeSessionStatus |
| ClawdView | React/CSS/SVG 重写 |
| SessionCard | React 重写 |
| ApprovalBar | React 重写，Hook response 分阶段实现 |
| QuestionBar | React 重写 |
| HookServer | Windows/Tauri/Rust 重写 |
| TerminalActivator | Windows Terminal/window activation 重写 |
| ConfigInstaller Claude block | 参考，现有 claude_global.rs 扩展 |
| SoundManager | 二期可选 |
| Remote/ESP32 | 三期后或不做 |

### 3.3 命名口径

报告后续实施时，命名统一为：

- 产品：Claude HUD One
- 桌面悬浮窗：Desktop HUD
- 终端输出：Terminal HUD
- 桌面核心组件：DesktopHud
- 会话：ClaudeCodeSession / HudSession
- 状态：ClaudeCodeAgentStatus
- 小人：Clawd / ClawdMascot

不再用 `Codex`、`Provider`、`AI tools hub` 作为桌面 HUD 主叙事。

---

## 4. 当前 Claude HUD One 可承接位置

### 4.1 必须保留的已有能力

当前项目已有 Windows overlay 基础：

- 主窗口透明/无边框/置顶/skip taskbar：`src-tauri/tauri.conf.json:15`
- overlay hit region command：`src-tauri/src/lib.rs:17`
- overlay layout command：`src-tauri/src/lib.rs:41`
- Win32 HitRegion：`src-tauri/src/window/overlay.rs:13`
- OverlayTracker：`src-tauri/src/window/overlay.rs:32`
- click-through / no-activate / hit-test：`src-tauri/src/window/overlay.rs:166`
- 前端 overlayBridge：`src/app/overlayBridge.ts:107`

这些都保留，不重写 Rust 窗口基础。

### 4.2 Terminal HUD 必须保留

现有 Terminal HUD 不能被 Desktop HUD 重构影响：

- Terminal HUD config：`src/hud/config.ts:76`
- Terminal HUD default：`src/hud/config.ts:166`
- TerminalHudPanel：`src/components/settings/TerminalHudPanel.tsx:357`
- bridge statusLine 模式：`.claude/bridge/claude-status-bridge.mjs:7`
- 打包版 bridge：`src-tauri/resources/claude-status-bridge.mjs:7`

实施原则：

- Terminal HUD 设置页保留。
- statusLine 输出保留。
- Desktop HUD 设置页重写，但不复用 Terminal HUD 布局。
- 两者共享 Claude Code 状态源，但 UI 配置分开。

### 4.3 需要重写的 Desktop HUD 文件

当前 Desktop HUD 主入口：

- `src/app/App.tsx:276`
- `src/components/island/IslandRoot.tsx:183`
- `src/components/island/CurrentSessionStrip.tsx:4`
- `src/stores/useIslandStore.ts:59`
- `src/app/types.ts:3`
- `src/hud/config.ts:138`
- `src/components/settings/DesktopHudPanel.tsx:15`

我的执行决策：

- 不在 `IslandRoot.tsx` 上继续堆代码。
- 新增 `src/components/desktopHud/`。
- `IslandRoot` 可以作为兼容壳逐步替换，也可以直接让 App 渲染 `DesktopHudRoot`。
- `DesktopHudPanel` 全面重写。
- `DesktopHudConfig` 升级为 V2，并写 migration。

---

## 5. 目标架构

### 5.1 Windows 版 CodeIsland 架构

```text
Claude Code statusLine/hooks
  -> claude-status-bridge.mjs / claude-hook-bridge
  -> AppData state + optional IPC/HookServer
  -> Rust/Tauri commands
  -> React store/useIslandStore or new useDesktopHudStore
  -> DesktopHudRoot
      -> DesktopHudCapsule
      -> ClawdMascot
      -> SessionListSurface
      -> ApprovalSurface
      -> QuestionSurface
      -> CompletionSurface
  -> Win32 overlay/click-through/window region

Terminal HUD 保持：
Claude Code statusLine -> same bridge -> terminalRenderer -> stdout
```

### 5.2 新增前端模块

建议新增：

```text
src/components/desktopHud/
  DesktopHudRoot.tsx
  DesktopHudCapsule.tsx
  DesktopHudSurfaceHost.tsx
  SessionListSurface.tsx
  SessionCard.tsx
  ApprovalSurface.tsx
  QuestionSurface.tsx
  CompletionSurface.tsx
  ClawdMascot.tsx
  ToolBadge.tsx
  TerminalBadge.tsx
  useDesktopHudHitRegions.ts
  desktopHudMotion.ts
```

### 5.3 新增状态和 selector

建议新增：

```text
src/desktopHud/types.ts
src/desktopHud/selectors.ts
src/desktopHud/config.ts
src/desktopHud/migration.ts
src/desktopHud/activityMapper.ts
```

核心类型：

```ts
type ClaudeCodeAgentStatus =
  | 'idle'
  | 'processing'
  | 'running'
  | 'waitingApproval'
  | 'waitingQuestion'
  | 'completed'
  | 'error'
  | 'stale'

type DesktopHudSurface =
  | { type: 'collapsed' }
  | { type: 'sessionList' }
  | { type: 'approvalCard'; sessionId: string }
  | { type: 'questionCard'; sessionId: string }
  | { type: 'completionCard'; sessionId: string }
```

### 5.4 Bridge / HookServer 策略

分两阶段：

#### 阶段 A：先利用现有文件桥

当前 bridge 已能写 APPDATA state 和 sessions：

- `.claude/bridge/claude-status-bridge.mjs:10`
- `src-tauri/src/window/claude_status.rs:51`
- `src/providers/claudeCodeSummary.ts:264`

先扩展状态映射，不急着做 blocking response。

#### 阶段 B：实现 Windows HookServer / blocking response

当要做真正 approval/question 时，新增：

- Rust 本地 IPC server，Named Pipe 或 localhost TCP。
- Node hook bridge 与 Rust IPC 通信。
- permission/question continuation 管理。
- 超时、dismiss、deny、allow response。

这阶段必须单独设计安全策略，避免误批准。

---

## 6. 分阶段落地执行方案

## Phase 0：报告确认与基线冻结

目标：确认方向、冻结约束。

工作项：

1. 把本报告作为桌面 HUD 改造 SSOT。
2. 明确一期只做 Claude Code。
3. 明确保留 Terminal HUD。
4. 确认旧 codex-island 仅作 usage/cost 补充。
5. 增加实现任务记录，进入 Workflow 管理。

验收：

- 报告落盘。
- workspace-index 更新。
- 用户确认进入实现。

---

## Phase 1：Desktop HUD V2 视觉骨架

目标：不动 hook blocking，只先把桌面 HUD 改成 CodeIsland 外观和状态骨架。

工作项：

1. 新建 `desktopHud` 组件目录。
2. 实现 `ClawdMascot` 三态：sleep/work/alert。
3. 实现 `DesktopHudCapsule`：顶部居中、黑色刘海/capsule、Claude(N)、工具状态。
4. 实现 hover 500ms 展开、leave 150ms 收起。
5. 实现 `SessionListSurface` 和 `SessionCard`。
6. 接入现有 sessions 数据。
7. 保留现有 overlay/click-through。
8. 不改 Terminal HUD。

验收：

- 桌面 HUD 视觉接近 CodeIsland 截图。
- 多 Claude Code 会话能显示为卡片。
- Clawd 能根据 idle/running/waiting 切换动画。
- Hover 展开和收起手感接近 CodeIsland。
- `npm run build`、UI smoke、`npm run tauri:build` 通过。

---

## Phase 2：Desktop HUD 状态模型与设置页

目标：从 UI demo 变成可配置、可迁移的产品功能。

工作项：

1. 新增 `DesktopHudConfigV2`。
2. 写旧配置 migration。
3. 重写 `DesktopHudPanel`。
4. 设置项包括：
   - enabled
   - position/top offset
   - hover delay
   - collapse delay
   - max visible sessions
   - mascot speed
   - animation intensity
   - auto expand on waiting
   - auto expand on completion
   - smart suppress
   - terminal jump behavior
5. Terminal HUD 设置页保持原状。

验收：

- 老用户 settings 不崩。
- Desktop HUD 设置可以控制新 UI。
- Terminal HUD 设置不受影响。
- 设置保存/重启后生效。

---

## Phase 3：Approval / Question UI 队列

目标：先实现 HUD 内 approval/question 展示，不急着做真实 blocking response。

工作项：

1. 扩展 bridge hook summary，识别 PermissionRequest / AskUserQuestion / Notification question。
2. 在前端 store 中维护：
   - `permissionQueue`
   - `questionQueue`
   - `pendingToolUses`
3. 实现 `ApprovalSurface`。
4. 实现 `QuestionSurface`。
5. HUD 自动切换 surface。
6. 按钮第一版可只做：
   - Open terminal
   - Dismiss local
   - Copy summary

验收：

- Claude Code 请求权限时，桌面 HUD 自动弹 approval surface。
- Claude Code ask question 时，桌面 HUD 自动弹 question surface。
- 不影响 Claude Code 原终端交互。
- 不误批准任何工具调用。

---

## Phase 4：HookServer / Blocking Response

目标：实现真正的 HUD approval/question 回写 Claude Code。

工作项：

1. 设计 Windows IPC：Named Pipe 优先，localhost TCP 备选。
2. bridge 支持 blocking request / response。
3. Rust/Tauri 管理 pending continuation。
4. Approval 按钮回写 allow/deny。
5. Question 表单回写答案。
6. 超时策略。
7. 安全审计日志。
8. 默认不启用 Always allow，需用户明确开。

验收：

- Allow once / Deny 能影响 Claude Code 权限请求。
- Dismiss 不等于 Deny。
- AskUserQuestion 能从 HUD 回答。
- hook 不死锁，不超过合理超时。
- 失败时 fail safe，不阻塞 Claude Code。

---

## Phase 5：Terminal Jump

目标：实现 CodeIsland 的 click-to-jump Windows 等价。

工作项：

1. bridge 捕获：pid、ppid、cwd、shell、WT_SESSION、window title、terminal app。
2. Rust 枚举窗口，匹配 terminal 进程和标题。
3. 实现 `TerminalActivator`：
   - focus existing terminal window
   - fallback open new terminal at cwd
4. 支持 Windows Terminal、PowerShell、cmd、Git Bash、WezTerm。
5. 点击 SessionCard / TerminalBadge 触发 jump。
6. 失败 shake + 提示。

验收：

- 点击会话卡片能回到对应终端窗口或打开 cwd 新终端。
- 找不到目标时有明确失败反馈。
- 不模拟键盘输入，不做危险自动化。

---

## Phase 6：Completion / Smart Suppress / 精致动效

目标：补齐 CodeIsland 的精致度。

工作项：

1. completionCard 队列。
2. 5 秒自动收起。
3. 对应终端前台时智能抑制。
4. 工具状态 linger 2 秒。
5. 8-bit 可选音效。
6. Clawd 动画速度设置。
7. motion reduced / low power。

验收：

- 任务完成提醒不烦人。
- approval/question 不被 completion 覆盖。
- 动效稳定，不明显占 GPU/CPU。

---

## Phase 7：Usage/Cost 辅助页

目标：把旧 usage/cost 能力作为辅助，不再主导桌面 HUD。

工作项：

1. 保留 Claude Code usage/cost snapshot。
2. 在 expanded 内提供二级入口或 setting 控制展示。
3. 不恢复 Codex provider。
4. 所有 cost 标明估算。

验收：

- 用户能查看 context/token/cost。
- 不干扰会话/approval 主流程。

---

## 7. 关键风险

### 7.1 Windows 无 Mac 刘海屏

处理：

- 不追求硬件 notch。
- 默认顶部居中悬浮黑色 capsule。
- 允许 top offset 和显示器选择。
- 保留 Window Region 和 click-through。

### 7.2 Approval 是安全敏感链路

处理：

- 分阶段做。
- 先 UI 提醒，后 blocking response。
- 不模拟键盘。
- 不自动批准。
- Always allow 需要显式启用和作用域。

### 7.3 Terminal tab 精确跳转在 Windows 难

处理：

- 一期只承诺窗口级 focus / open terminal at cwd。
- 二期实验 Windows Terminal tab 识别。
- 找不到目标时不假装成功。

### 7.4 Terminal HUD 不能被破坏

处理：

- Terminal HUD 代码、设置、bridge statusLine 输出加回归测试。
- Desktop HUD V2 schema 与 Terminal HUD schema 分离。

### 7.5 不要引入多 provider 复杂度

处理：

- Claude-only 写进配置和 UI。
- 删除/隐藏 provider 概念。
- 后续如要恢复多 provider，另开项目。

---

## 8. 文件级执行清单

### 8.1 新增文件

```text
src/components/desktopHud/DesktopHudRoot.tsx
src/components/desktopHud/DesktopHudCapsule.tsx
src/components/desktopHud/DesktopHudSurfaceHost.tsx
src/components/desktopHud/ClawdMascot.tsx
src/components/desktopHud/SessionListSurface.tsx
src/components/desktopHud/SessionCard.tsx
src/components/desktopHud/ApprovalSurface.tsx
src/components/desktopHud/QuestionSurface.tsx
src/components/desktopHud/CompletionSurface.tsx
src/components/desktopHud/TerminalBadge.tsx
src/components/desktopHud/ToolBadge.tsx
src/components/desktopHud/useDesktopHudHitRegions.ts
src/desktopHud/types.ts
src/desktopHud/config.ts
src/desktopHud/selectors.ts
src/desktopHud/activityMapper.ts
src/desktopHud/migration.ts
```

### 8.2 重写/调整文件

```text
src/app/App.tsx
src/app/types.ts
src/stores/useIslandStore.ts
src/components/island/IslandRoot.tsx
src/components/settings/DesktopHudPanel.tsx
src/hud/config.ts
src/styles.css
src/providers/claudeCodeSummary.ts
.claude/bridge/claude-status-bridge.mjs
src-tauri/resources/claude-status-bridge.mjs
src-tauri/src/window/claude_status.rs
src-tauri/src/window/settings.rs
```

### 8.3 保持稳定文件

```text
src/components/settings/TerminalHudPanel.tsx
src/hud/terminalRenderer.ts
src/hud/displayItemRegistry.ts 中 terminal 相关能力
src-tauri/src/window/overlay.rs
src/app/overlayBridge.ts
src-tauri/tauri.conf.json 的窗口基座
src-tauri/resources/install-claude-hud-one-bridge.ps1
```

---

## 9. 验收矩阵

| 阶段 | 验收项 | 通过标准 |
| --- | --- | --- |
| Desktop HUD V2 | 外观 | 顶部悬浮 capsule + Clawd + Claude(N) + session cards 接近 CodeIsland 截图 |
| Mascot | 状态 | idle/work/alert 至少三态动画，不卡顿 |
| 多会话 | 列表 | 多个 Claude Code session 按优先级显示 |
| Hover | 手感 | 500ms 展开、150ms 收起，approval/question 不误收起 |
| Approval UI | 展示 | PermissionRequest 自动弹卡，有按钮和上下文摘要 |
| Question UI | 展示 | AskUserQuestion 可显示选项/文本输入 |
| Blocking | 回写 | Allow/Deny/Answer 能正确返回 Claude Code，失败 fail-safe |
| Terminal Jump | 回终端 | 点击会话可 focus/open 终端，有失败反馈 |
| Terminal HUD | 回归 | statusLine 终端 HUD 不变，可配置仍生效 |
| Overlay | 点击穿透 | 岛外透明区域不吞点击 |
| 全屏/截图 | 避让 | 全屏和截图场景不干扰用户 |
| Build | 打包 | `npm run tauri:build` 通过并生成 NSIS 安装包 |

---

## 10. 我建议的实际执行顺序

如果进入实现，我建议直接按以下顺序做，不再先做旧 usage dashboard：

1. **开实现记录/Workflow**：这是多阶段重构，必须用 Workflow 管理。
2. **Phase 1 视觉骨架**：DesktopHudRoot + Clawd + SessionCard + hover 展开。
3. **Phase 2 配置迁移**：DesktopHudConfigV2 + DesktopHudPanel 重写，Terminal HUD 不动。
4. **Phase 3 状态映射**：bridge state → ClaudeCodeSession → DesktopHud view model。
5. **Phase 4 approval/question UI**：先展示和本地队列，不回写。
6. **Phase 5 HookServer blocking**：单独验证安全闭环。
7. **Phase 6 Terminal jump**：先窗口级，后 tab 级。
8. **Phase 7 polish**：completion、smart suppress、音效、低功耗。
9. **Phase 8 usage/cost 辅助**：放到二级，不影响主流程。

---

## 11. 最终判断

Claude HUD One 要全面对标 CodeIsland，正确方向不是“在现有 Desktop HUD 上加一点小人”，而是：

> **把 Desktop HUD 重构为 Claude Code 活动岛：Clawd 小人 + Claude 会话卡片 + approval/question surface + terminal jump 是主线；Terminal HUD 作为终端内输出继续保留；旧 usage/cost dashboard 降级为辅助能力。**

我建议后续实现就按这份方案推进：**先做截图级视觉和多会话骨架，再接 approval/question，再做终端跳转，最后补 usage/cost 和精致度。**
