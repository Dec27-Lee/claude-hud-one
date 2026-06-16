# Claude HUD One Android 手机 HUD 研究报告（一期目标澄清版）

> 日期：2026-06-16  
> 本版依据最新范围澄清修订：**第一阶段必须交付 Android 手机 HUD 真机可用版**，并且必须包含：
>
> 1. 现在 Desktop HUD 已有的信息展示，手机 App 内要有等价展示；
> 2. 手机通知要有；
> 3. 通过 Wi-Fi / 局域网配对链接连接要有。
>
> 因此，上一版“Phase 1 只做 PC 安全服务、Android 和通知后置”的方案不符合当前目标。本版已调整为：**Phase 0 是内部前置工程；Phase 1 才是用户可验收的一期交付，包含 PC 服务 + Wi-Fi 配对 + Android App + 桌面 HUD 信息等价展示 + 低敏手机通知。**

---

## 0. 当前方案复查结论

### 0.1 原复查优化版的问题

上一版方案为了控制风险，把一期拆得过窄：

- Phase 0：协议、安全边界、本机 debug。
- Phase 1：PC 端安全局域网服务。
- Phase 2：Android 单 PC 前台 MVP。
- Phase 3：低敏通知、Desk Display、产品化体验。

这个拆法在安全工程上稳，但与最新目标冲突：用户要的第一阶段不是“PC 服务阶段”，而是 **Android 手机 HUD 可以真实使用的一期版本**。

所以现在需要改成：

- **Phase 0：一期前置工程**，开发内部里程碑，不是用户交付。
- **Phase 1：Android 手机 HUD 一期可交付版**，必须包含 Android 真机、Wi-Fi 配对、桌面 HUD 信息等价展示、手机通知。
- Phase 2 以后再做 Desk Display 高级体验、多 PC、Widget、后台强实时、远程交互。

### 0.2 新结论

> 手机 HUD 一期应定义为：**安全配对 + 加密 Wi-Fi 连接 + Android 单 PC 前台实时 HUD + Desktop HUD 信息等价展示 + 低敏手机通知 + 只读边界**。

关键边界：

- “桌面 HUD 信息都有”指 **App 内可信设备视图** 要覆盖 Desktop HUD 当前展示的信息结构。
- “手机通知要有”指 **低敏系统通知** 要有，不等于通知/锁屏展示所有详情。
- “Wi-Fi 配对链接要有”指 **二维码 + 可复制配对链接 + 手动 IP fallback** 都要进入一期。
- “信息展示完整”不等于“远程操作完整”。手机端一期仍不做 allow / deny / answer / terminal jump。

---

## 1. 产品定位

### 1.1 一句话定位

> **Claude HUD Mobile 是 Claude HUD One 的 Android 手机伴随屏：通过 Wi-Fi 与电脑配对后，在手机上展示 Desktop HUD 等价的 Claude Code 状态信息，并用低敏通知提醒用户等待处理、任务完成或异常。**

### 1.2 三个 HUD 面的分工

| 展示面 | 状态 | 核心价值 | 职责边界 |
| --- | --- | --- | --- |
| Terminal HUD | 已有 | 终端内即时状态 | Claude Code statusLine 文本、上下文、模型、工具、token/usage 摘要 |
| Desktop HUD | 已有 | Windows 悬浮活动岛 | 多会话、Clawd、approval/question、completion、终端跳转、本机安全交互 |
| Mobile HUD | 新增 | Android 手机伴随屏 | Wi-Fi 配对、Desktop HUD 信息等价展示、手机通知、只读 Attention、连接诊断 |

Mobile HUD 应继承 Desktop HUD 的信息层级、状态优先级和 CodeIsland 风格，但不继承桌面专属能力：Windows overlay、click-through、hover、terminal jump、Win32 region 都不能原样迁移。

---

## 2. 一期必须做 / 不做

### 2.1 一期必须做

一期交付必须包含：

1. **PC 端手机 HUD 开关**
   - 设置页新增 `手机 HUD / Mobile HUD`。
   - 可启停局域网服务。
   - 可生成配对二维码和 Wi-Fi 配对链接。
   - 可查看设备连接状态。
   - 可撤销设备。

2. **Wi-Fi / 局域网配对连接**
   - Android 扫二维码配对。
   - Android 可打开/粘贴配对链接。
   - 支持手动 IP:Port fallback。
   - PC 端显式确认设备。
   - 配对 token 短期有效。
   - 配对后设备授权可撤销。

3. **加密传输和认证**
   - 真实局域网状态传输不能明文裸跑。
   - 未授权设备不能读取任何状态。
   - 抓包不可读业务 payload 和长期凭据。

4. **Android 单 PC 前台实时 HUD**
   - 一期只连接一台 PC。
   - 1-3 秒内看到 Claude Code 状态变化。
   - 支持断线、重连、撤销后的重新配对提示。

5. **Desktop HUD 信息等价展示**
   - App 内可信设备视图要覆盖当前 Desktop HUD 实际展示的信息结构。
   - 不直接透传内部 DTO，而是生成 Mobile HUD ViewModel。
   - 字段需要脱敏、别名或用户开关。

6. **手机通知**
   - 等待处理通知。
   - 任务完成通知。
   - 失败/异常通知。
   - 连接断开/恢复通知。
   - Android 13+ 通知权限引导。
   - 通知和锁屏默认低敏。

7. **只读边界**
   - 手机端可以看状态和清除本地提醒。
   - 手机端不能改变 Claude Code pending intent 结果。

### 2.2 一期不做

一期仍然不做：

- 手机端 Allow approval。
- 手机端 Always allow。
- 手机端 Deny approval。
- 手机端回答 Question。
- 调用现有 `resolve_claude_pending_intent`。
- 发送 approval intent nonce 到手机。
- 手机端终端跳转或执行命令。
- 查看 raw prompt。
- 查看 tool input / tool result。
- 查看 transcript 内容。
- 查看完整 cwd/projectDir/transcriptPath。
- 查看完整 Bash 命令或 diff。
- 多 PC 管理。
- 后台 100% 实时长连承诺。
- Widget / Quick Settings Tile。
- 云中继 / 公网访问。

---

## 3. 当前 Desktop HUD 实际展示的信息清单

> 一期要“桌面 HUD 有的信息手机也要有”，首先要明确当前 Desktop HUD 实际显示了什么。以下以当前 `DesktopHudRoot` 为准，不以旧 `IslandRoot` 或尚未实际渲染的配置项为准。

### 3.1 Surface 与状态优先级

Desktop HUD 当前有 5 种 surface：

- `collapsed`
- `sessionList`
- `approvalCard`
- `questionCard`
- `completionCard`

优先级：

1. 有 pending approval → approval card。
2. 否则有 pending question → question card。
3. 否则有 completion 且非 compact → completion card。
4. 否则非 compact → session list。
5. 否则 collapsed。

Mobile HUD 一期应保持同样的注意力优先级：

- 手机首页顶部始终显示最高优先级状态。
- Attention 列表优先展示 approval/question。
- completion/error 以卡片和通知呈现。

### 3.2 Capsule 胶囊态信息

Desktop capsule 当前展示：

- Clawd / mascot 状态：idle / working / alert。
- 当前工具或模型：优先工具名，否则模型名，否则 Claude Code。
- 标题：单会话 `Claude`，多会话 `Claude (N)`。
- activity label：空闲 / 活跃 / 运行中 / 等待中 / 异常。
- ticker：默认来自 activity / project / tools。
- waiting/error `!` 提醒。
- 多会话轮播序号。
- 终端跳转符号。

Mobile 一期等价展示：

- 顶部状态卡或手机胶囊。
- 手机版 Clawd/状态图标。
- `Claude (N)` 会话数量。
- 当前最高优先级会话的工具/模型。
- activity chip。
- ticker 两行摘要。
- waiting/error 明显提示。
- 终端跳转符号在手机端改为“请回电脑处理/查看终端”。

### 3.3 Ticker / 显示项

当前 Desktop formatter 实际支持：

| Desktop item | 当前桌面展示 | Mobile 一期要求 |
| --- | --- | --- |
| `activity` | 活动状态 + bridge status / last event | 要展示，移动端本地化 |
| `project` | workspace/session label | 要展示，但用项目别名或 basename，不发完整路径 |
| `model` | 模型标签 | 要展示 |
| `tools` | 当前工具名 | 要展示工具名/类别，不展示参数 |
| `contextValue` | 已用 context tokens | 要展示，建议同时展示百分比 |
| `sessionTokens` | input/output/cache 总和 | 要展示 |
| `cost` | `$x.xx` | App 内可信设备可展示；通知/锁屏不展示 |
| `git` | branch + dirty | 要展示；branch 默认可截断/别名，dirty 可直接展示 |
| `addedDirs` | basename-only 目录 slug | 要展示；必要时别名/截断 |
| `agents` | agent 数量 | 要展示 |
| `todos` | todo 完成数/总数 | 要展示 |
| `speed` | tok/s | 要展示 |

注意：配置里有 `usage`、`effortLevel`，但当前 Desktop ticker formatter 没有实际展示 case。因此一期以“当前 Desktop 实际展示”为准时，它们不是硬性必备；如果产品希望顺便补齐，可以作为 Mobile 增强字段，但不要误写成 Desktop 现状已展示。

### 3.4 Session list / 会话卡片

Desktop 会话列表展示：

- 会话总数。
- 分组：ALL / STA / CLI。
- 设置按钮。
- 刷新按钮。
- 每个 SessionCard：
  - Mascot。
  - 主标题 / workspace / session identity。
  - activity 状态。
  - 状态文案：terminal jump status / session status / last event。
  - model。
  - active tool。
  - permission mode。
  - session age。
  - pending 摘要。
  - 更新时间。
  - Terminal 按钮。

Mobile 一期等价展示：

- 会话列表页。
- ALL / 状态 / 来源分组。
- 每个会话卡显示：
  - 状态图标/Clawd。
  - 项目别名 / 会话短码。
  - activity。
  - 状态文案。
  - model。
  - tool。
  - permission mode。
  - age / updatedAt。
  - pending summary。
  - 终端按钮改为“回电脑处理/终端不可在手机打开”。

### 3.5 Pending approval card

Desktop approval card 展示：

- 工具名。
- 项目标签。
- 队列位置 `1/N`。
- 到期时间。
- 已脱敏工具详情：
  - Bash：只显示命令请求类别，不显示命令文本和参数。
  - Edit/MultiEdit：文件编辑请求，不显示 diff。
  - Write：文件写入请求，不显示文件内容。
  - Read：文件读取请求，不显示路径和行号。
  - Grep/Glob：搜索请求，不显示 pattern 和路径。
- context：cwdSlug/projectSlug/workspace label。
- 隐私说明。
- 按钮：Deny / Dismiss / Allow Once / Always disabled / Terminal。

Mobile 一期等价展示：

- 展示工具名/工具类别。
- 展示项目别名。
- 展示队列位置、到期时间、风险等级。
- 展示与 Desktop 等价的脱敏工具详情。
- 展示隐私说明。
- 按钮只保留：
  - 打开 App / 查看详情。
  - 清除手机本地提醒。
  - 回电脑处理提示。
- 不展示 Allow / Deny / Always / Submit 操作。

### 3.6 Pending question card

Desktop question card 展示：

- 标题。
- 项目标签。
- 队列位置和到期时间。
- sanitized summary 或 fallback。
- choices 或输入框 placeholder。
- Skip / Submit / Terminal 按钮。

Mobile 一期等价展示：

- 展示标题、项目别名、队列位置、到期时间。
- 展示 sanitized summary。
- 如果有 choices，可作为只读选项列表展示。
- 输入框只作为“回电脑回答”的提示，不在手机提交。
- 不提供 Skip/Submit。
- 不发送 question 原文或用户 prompt。

### 3.7 Completion card

Desktop completion card 展示：

- Completed / 已完成。
- `${workspaceLabel} finished a Claude Code turn`。
- 时间：just now / Ns ago / Nm ago。
- 提示：详情请看终端。
- 按钮：Open Terminal / Dismiss。

Mobile 一期等价展示：

- 任务完成卡。
- 完成通知。
- 展示项目别名和完成时间。
- 提示回电脑/终端查看详情。
- 不展示 assistant 输出内容或 transcript。

---

## 4. Mobile HUD 一期信息展示策略

### 4.1 三个展示档位

为同时满足“桌面信息都有”和“手机安全边界”，一期采用三档：

#### A. safeNotification

用于系统通知和锁屏。

只显示：

- 等待处理。
- 任务完成。
- 任务失败。
- 连接断开/恢复。

不显示：

- 项目名。
- 工具名。
- 模型名。
- 成本。
- 问题摘要。
- approval 类型。
- 路径。
- 命令。

#### B. trustedAppView

用于已配对、PC 端已授权设备的 App 内展示。**一期必须支持**，用来满足 Desktop HUD 信息等价展示。

可展示：

- 当前 Desktop HUD 实际展示的信息项。
- 项目别名或 basename。
- 模型标签。
- 工具名，不含参数。
- 状态文本，但必须由服务端生成安全展示文案。
- context / token / cost / git / dirs / agents / todos / speed。
- pending card 的脱敏详情。
- completion 卡。

仍不展示：

- raw prompt。
- tool input/result。
- transcript。
- secrets。
- 完整 cwd/projectDir。
- 完整 Bash 命令。
- diff / 文件内容。
- approval intent nonce。

#### C. debugView

仅开发者使用。

- 不进入通知/锁屏。
- 不作为一期用户卖点。
- 有风险提示。
- release 默认关闭。

### 4.2 Mobile DTO 不直接复用 Desktop DTO

不能把 `CurrentSessionState` 原样发给手机。建议生成 `MobileHudViewModel`：

```ts
type MobileHudViewModel = {
  protocolVersion: 1
  snapshotVersion: 1
  updatedAt: string
  displayMode: 'trustedAppView'
  summary: MobileHudSummary
  capsule: MobileHudCapsule
  sessions: MobileHudSessionCard[]
  attention: MobileHudAttentionItem[]
  completion?: MobileHudCompletionCard
  notifications: MobileHudNotificationEvent[]
}
```

其中 session card 应覆盖 Desktop card：

```ts
type MobileHudSessionCard = {
  mobileSessionId: string
  sessionShortId: string
  workspaceLabel: string
  projectAlias: string
  activity: 'idle' | 'active' | 'running' | 'waiting' | 'error' | 'unknown'
  attentionKind: 'none' | 'approval' | 'question' | 'completion' | 'error'
  statusText: string
  modelLabel?: string
  activeToolName?: string
  toolCategory?: 'file' | 'shell' | 'git' | 'network' | 'agent' | 'mcp' | 'other' | 'unknown'
  permissionMode?: string
  ageLabel?: string
  updatedAt?: string
  contextUsedTokens?: number
  contextUsedPercent?: number
  sessionTokens?: number
  totalCostUsd?: number
  outputSpeed?: number
  gitBranchLabel?: string
  gitDirty?: boolean
  addedDirLabels?: string[]
  agentsCount?: number
  agentsRunningCount?: number
  todosCompletedCount?: number
  todosTotalCount?: number
  pendingSummary?: {
    count: number
    hasApproval: boolean
    hasQuestion: boolean
    title?: string
    summary?: string
  }
  terminalHint: 'returnToPc' | 'notAvailableOnMobile'
}
```

---

## 5. 手机通知一期范围

### 5.1 一期通知类型

一期必须有这些通知：

| 通知 | 触发 | 默认文案 | 敏感等级 |
| --- | --- | --- | --- |
| Waiting attention | 进入 waiting approval/question | Claude 正在等待处理 | 低敏 |
| Completed | 检测到 completion | Claude 任务已完成 | 低敏 |
| Failed/Error | activity error / StopFailure | Claude 任务失败或中断 | 低敏 |
| Connection lost | 断线超过阈值 | 手机 HUD 已断开 | 低敏 |
| Reconnected | 重连成功 | 手机 HUD 已重新连接 | 低敏 |

### 5.2 通知权限

Android 13+ 需要 `POST_NOTIFICATIONS`。

要求：

- 用户首次开启手机通知时请求。
- 用户拒绝后，App 前台仍可使用。
- 不反复弹权限请求。
- 设置页可重新引导。

### 5.3 通知和锁屏隐私

默认通知不显示：

- 项目名。
- 工具名。
- 模型名。
- 成本。
- question 内容。
- approval 具体内容。
- 文件路径。
- 命令。
- prompt。
- transcript。

点击通知：

- 打开 App。
- 定位到 Attention 列表或对应 session。
- 不直接执行任何操作。

通知 action 一期只允许：

- 打开 App。
- 清除本地提醒。

不允许：

- Allow。
- Deny。
- Answer。
- Skip。

### 5.4 后台到达率说明

一期有手机通知，但不承诺后台 100% 实时：

- App 前台时实时。
- App 短时间后台时尽力保持连接并发通知。
- 被系统杀掉、Doze、厂商后台限制时不保证实时。
- 不做云推送。
- 不默认启用长期前台服务。

---

## 6. Wi-Fi 配对链接一期设计

### 6.1 配对入口

一期必须提供三种入口：

1. PC 端二维码。
2. PC 端可复制 Wi-Fi 配对链接。
3. Android 手动输入 IP:Port fallback。

### 6.2 配对链接格式

建议使用自定义 URI：

```text
claudehud://pair?host=192.168.1.23&port=27431&pairingId=pair_xxx&token=one_time_xxx&fp=sha256_xxx&expires=...
```

也可以提供纯文本 fallback：

```json
{
  "type": "claude-hud-one-pairing",
  "protocolVersion": 1,
  "host": "192.168.1.23",
  "port": 27431,
  "pairingId": "pair_...",
  "oneTimeToken": "...",
  "serverFingerprint": "sha256:...",
  "expiresAt": "2026-06-16T12:00:00Z"
}
```

### 6.3 配对安全要求

- token 默认 60 秒过期。
- token 只能用一次。
- token 不能作为长期凭据。
- PC 端必须显示待确认设备。
- PC 端用户点击允许后才发 snapshot。
- Android 保存设备授权到 Keystore / DataStore。
- PC 可撤销设备，撤销后立即断开。

### 6.4 加密要求

真实局域网传输必须加密。Phase 0 技术选型必须在下面二选一：

- WSS + server public key / SPKI fingerprint pinning。
- 成熟 Noise/ECDH/AEAD 应用层加密 over WebSocket。

明文 `ws://` 只允许 localhost mock/debug，不允许真实局域网状态。

---

## 7. PC 端一期工作范围

### 7.1 必须新增模块

建议在：

```text
src-tauri/src/window/mobile_hud/
  mod.rs
  snapshot.rs
  service.rs
  pairing.rs
  device_registry.rs
  network.rs
  crypto.rs
```

### 7.2 Tauri 服务生命周期

新增 `MobileHudServiceState`：

```text
Disabled → Starting → Listening → Pairing → Connected
          ↘ Failed
Connected → Stopping → Disabled
```

要求：

- 用 `tauri::async_runtime::spawn` 启动。
- 不阻塞 Tauri 主线程。
- settings 保存后 reconcile 服务状态。
- 禁用手机 HUD 立即停止服务。
- App 退出时 graceful shutdown。
- 端口占用要进入 Failed 并提示。

### 7.3 设置页

新增 `MobileHudPanel`：

- 启用/关闭手机 HUD。
- 当前服务状态。
- 当前 IP/端口。
- 当前加密/认证状态。
- 生成二维码。
- 复制配对链接。
- 设备列表。
- 撤销设备。
- 网络诊断。
- 通知说明。

内部命名统一：

- TS：`mobileHud`
- Rust：`mobile_hud`
- UI：`手机 HUD` / `Mobile HUD`

### 7.4 网络诊断

一期必须展示：

- 当前绑定 IP。
- 当前端口。
- 候选网卡。
- 是否绑定 localhost / 局域网。
- 防火墙提示。
- 多网卡/VPN/WSL/Docker 风险提示。
- 最近连接错误。

不默认绑定 `0.0.0.0`。

---

## 8. Android 一期工作范围

### 8.1 工程结构

建议放本仓库：

```text
apps/android/
  settings.gradle.kts
  build.gradle.kts
  gradlew / gradlew.bat
  app/
    src/main/...
```

技术栈：

- Kotlin。
- Jetpack Compose。
- OkHttp WebSocket 或 Ktor Client。
- kotlinx.serialization。
- CameraX + ML Kit 或 ZXing。
- DataStore。
- Android Keystore。

### 8.2 页面

一期页面：

1. Pairing 页面
   - 扫二维码。
   - 打开/粘贴配对链接。
   - 手动 IP:Port。
   - 显示 PC 信息并等待 PC 确认。

2. Live HUD 首页
   - 顶部 capsule。
   - 状态图标/Clawd。
   - Claude(N)。
   - 当前工具/模型。
   - ticker 摘要。
   - 当前最高优先级 attention。

3. Sessions 页面
   - 多会话列表。
   - ALL / 状态 / 来源分组。
   - Session card 覆盖 Desktop 当前信息。

4. Attention 页面
   - approval/question 只读详情。
   - completion/error。
   - 提示回电脑处理。

5. Settings/Diagnostics 页面
   - 当前 PC。
   - 断开/删除配对。
   - 通知权限状态。
   - 连接诊断。

### 8.3 Android 权限

一期需要：

- `INTERNET`
- `CAMERA`：只在扫码时请求。
- `POST_NOTIFICATIONS`：Android 13+，只在用户启用通知时请求。

一期避免：

- 位置权限。
- 后台定位。
- 无障碍权限。
- 悬浮窗权限。
- 默认电池优化白名单。
- 默认前台服务权限。

---

## 9. 一期验收标准

### 9.1 产品验收

- PC 设置页可开启手机 HUD。
- PC 可生成二维码和 Wi-Fi 配对链接。
- Android 真机同 Wi-Fi 可完成配对。
- PC 端可确认并授权设备。
- Android App 可展示当前 Desktop HUD 等价信息。
- 多会话、状态、工具、模型、context、token、cost、git、dirs、agents、todos、speed、pending、completion 都有手机端展示位置。
- waiting approval/question 能触发手机通知。
- completion/error 能触发手机通知。
- 连接断开/恢复能触发通知或状态提示。
- PC 撤销设备后 Android 需要重新配对。

### 9.2 安全验收

- 未授权设备无法读取 snapshot。
- 配对 token 60 秒过期。
- token 用后即失效。
- token 重放失败。
- 抓包不可读业务 payload 和长期凭据。
- snapshot 不包含 raw prompt、tool input/result、transcript、secrets、完整路径、完整 Bash 命令、intent nonce。
- 手机端不能 allow / deny / answer / terminal jump。
- 通知和锁屏默认不显示敏感详情。

### 9.3 工程验收

- Rust 有 `MobileHudViewModel` builder。
- 有 desktop-to-mobile 字段映射表。
- 有 protocolVersion / snapshotVersion。
- 有 contract fixtures。
- Android 可解析 fixtures。
- unknown enum 有 fallback。
- Tauri 服务启停不阻塞主线程。
- 端口占用有错误提示。
- 有基础网络诊断。

---

## 10. 修订后的分阶段路线

### Phase 0：一期前置工程（内部里程碑）

目标：为一期交付做技术前置，不作为用户验收版本。

包含：

- Desktop HUD 信息项盘点。
- Desktop → Mobile 字段映射表。
- `MobileHudViewModel` DTO。
- `MobileHudEnvelope`。
- protocol/snapshot version。
- contract fixtures。
- 敏感字段测试。
- localhost debug client。
- 加密方案选型。

### Phase 1：Android 手机 HUD 一期可交付版

目标：用户能在 Android 手机上通过 Wi-Fi 配对使用手机 HUD。

包含：

- PC Mobile HUD 设置页。
- PC 局域网加密服务。
- Wi-Fi 配对二维码。
- Wi-Fi 配对链接。
- Android 原生 App。
- 扫码/链接/手动 IP 配对。
- 单 PC 授权和撤销。
- 前台实时 Live HUD。
- Desktop HUD 信息等价展示。
- Attention 只读列表。
- 低敏手机通知。
- Android 通知权限引导。
- 连接诊断。

### Phase 2：日常体验增强

包含：

- Desk Display Mode。
- 保持屏幕常亮。
- OLED 低亮。
- 通知节流与分组。
- 更完善网络诊断。
- 更细隐私开关。
- 通知内容可配置。

### Phase 3：多设备与生态扩展

包含：

- 多 PC 管理。
- mDNS 自动发现。
- Widget。
- Quick Settings Tile。
- 完成历史。
- 更稳定后台策略。

### Phase 4：受控交互（单独立项）

候选：

- 本地 dismiss。
- 低风险 question answer。
- Deny。
- Allow once。

仍不建议：移动端 Always Allow。

前置条件：

- 强认证。
- 加密。
- 防重放。
- action 签名。
- capability token。
- 生物识别。
- PC 审计。
- 用户显式开启。

---

## 11. 仍待确认的问题

1. 一期 App 内 trusted view 是否默认显示真实 project basename，还是强制项目别名？建议默认别名，可由用户开关显示 basename。
2. 一期是否显示 exact cost？建议 App 内可信设备可显示，通知和锁屏不显示。
3. Pending question 是否展示 choices？建议可只读展示 choices，不允许提交。
4. 配对链接 URI scheme 使用 `claudehud://pair` 还是 `claude-hud-one://pair`？建议选择短且稳定的 `claudehud://pair`。
5. 加密方案一期选 WSS pinning 还是成熟应用层加密？需要技术 spike。
6. Desktop HUD 当前配置里未实际展示的 `usage`、`effortLevel` 是否要顺手补到 Mobile？建议不作为“桌面已有信息”硬性验收，但可作为增强。

---

## 12. 最终建议

当前方案确实需要按最新目标调整：

- 不能再把 Android App 和通知放到 Phase 2/3。
- 不能把 Phase 1 定义成只有 PC 服务。
- 一期必须交付完整手机端闭环：**Wi-Fi 配对 + Android App + Desktop HUD 信息等价展示 + 低敏通知**。

但安全边界仍要保留：

- 真实局域网必须加密。
- 手机通知默认低敏。
- App 内展示覆盖 Desktop HUD 信息，但要用 mobile-safe ViewModel。
- 不发 raw prompt/tool input/tool result/transcript/完整路径/完整命令/intent nonce。
- 手机端一期只读，不做 allow/deny/answer/terminal jump。

这样既满足“一阶段必须有完整手机 HUD 体验”的目标，又不会把 Claude Code 的本机权限控制面过早暴露到手机和局域网。