# Claude HUD One Android 手机 HUD 研究报告（技术方案补漏版）

> 日期：2026-06-17  
> 本版用途：复盘上一版“一期目标澄清版”在技术方案上的遗漏，并把遗漏补成可执行的工程方案。  
> 一期目标保持不变：**第一阶段必须交付 Android 手机 HUD 真机可用版**，包含 Desktop HUD 现有信息等价展示、手机通知、Wi-Fi / 局域网配对连接、APK 安装包与更新后的 Windows 端安装包。

---

## 0. 本次技术复盘结论

上一版已经明确了产品边界，但技术方案仍有这些遗漏：

1. **PC 端 Tauri 服务生命周期不够具体**：需要写清 managed state、settings reconcile、shutdown、端口释放、退出清理，而不是只画状态机。
2. **加密方案不能长期二选一**：实现计划需要默认技术路线。本版建议一期优先采用 **WSS + 自签证书 + SPKI fingerprint pinning + Android Keystore 设备签名**；Noise/ECDH 作为备选 spike，不作为一期默认路线。
3. **配对协议缺少设备身份和防重放细节**：要补 pairing offer、one-time token、PC 确认、device key、challenge-response、session 生命周期、pairing race 处理。
4. **Mobile ViewModel 缺少 DisplayPolicy / NotificationEvent / dedupeKey**：只定义 session card 不够，通知去重、completion 推断、配置映射都需要协议字段。
5. **Desktop HUD 信息映射仍不够精确**：要区分“默认 ticker 实际显示”“formatter 可渲染”“registry 标记支持”“配置存在但 UI 未落地”。
6. **Android 工程落地缺少关键约束**：Gradle、SDK、包名、签名、Deep Link、通知 Channel、APK 输出路径、CI 命令都需要写清楚。
7. **Windows 网络和安装器风险不足**：防火墙、网卡选择、端口占用、未签名程序监听局域网、NSIS 卸载清理都要纳入一期验收。
8. **测试体系不足**：要补 Rust contract tests、敏感字段扫描、Android fixture 解析、网络/配对/通知/E2E/安装验收。

---

## 1. 一期交付定义

### 1.1 一期必须交付

一期交付物：

1. **Windows 端新安装包**
   - Claude HUD One 新增 Mobile HUD 设置页。
   - 支持开启/关闭手机 HUD 服务。
   - 支持 Wi-Fi 配对二维码和配对链接。
   - 支持设备确认、授权、撤销。
   - 支持 mobile-safe snapshot 推送。

2. **Android APK 安装包**
   - `apps/android/app/build/outputs/apk/debug/app-debug.apk` 用于内部测试。
   - 如配置 release signing，可额外输出 `app-release.apk`。

3. **端到端能力**
   - Android 真机与 PC 同一 Wi-Fi 下完成配对。
   - Android App 内展示 Desktop HUD 当前实际展示信息的移动端等价视图。
   - 手机收到 waiting / completion / error / connection 通知。
   - PC 端撤销设备后 Android 断开并要求重新配对。

### 1.2 一期不做

一期仍然不做：

- 手机端 Allow / Deny / Answer / Always Allow。
- 手机端调用 `resolve_claude_pending_intent`。
- 手机端终端跳转或远程命令执行。
- raw prompt / tool input / tool result / transcript / 完整路径 / 完整 Bash 命令。
- 多 PC 管理。
- Widget / Quick Settings。
- 云中继 / 公网访问。
- 后台 100% 实时长连承诺。

---

## 2. Desktop HUD → Mobile HUD 信息映射

### 2.1 映射口径

一期“Desktop HUD 有的信息手机也要有”按当前实际 `DesktopHudRoot` 为准，但要区分四类：

| 类别 | 含义 | Mobile 一期处理 |
| --- | --- | --- |
| 默认实际显示 | 默认配置下 Desktop HUD 当前真实可见 | 一期必须覆盖 |
| formatter 可渲染 | `desktopItemLabel` 支持，但需配置进入 ticker | 一期应覆盖，受 display policy 控制 |
| registry 标记支持 | `displayItemRegistry` / config 标为 supported | 如 Desktop UI 未实际渲染，不作为硬性“现有信息” |
| 数据存在但未展示 | `CurrentSessionState` 有字段，但 Desktop 不展示 | 可后续增强，不作为一期必备 |

### 2.2 当前 Desktop HUD 核心信息

| Desktop 区域 | 信息 | Mobile 一期映射 |
| --- | --- | --- |
| Capsule | Clawd 状态、Claude(N)、activity、tool/model、ticker、waiting/error badge | `capsule` + 首页顶部卡 |
| Ticker | activity、project、model、tools、contextValue、sessionTokens、cost、git、addedDirs、agents、todos、speed | `displayPolicy.visibleItems` + `capsule.tickerLines` + session card chips |
| Session list | 会话数量、ALL/状态/来源分组、SessionCard、pending summary、terminal button | Sessions 页面 + sourceGroup + terminalHint |
| Approval card | 工具、项目、队列、到期、脱敏工具详情、隐私说明 | Attention approval，只读，保留脱敏说明 |
| Question card | 标题、项目、队列、到期、sanitized summary、choices/placeholder | Attention question，只读展示 choices，不提交 |
| Completion card | completed、workspace、完成时间、回终端查看提示 | Completion card + completion notification |

### 2.3 不能照搬到 Mobile 的字段

Mobile builder 必须显式丢弃：

- `transcriptPath`
- `projectDir`
- `cwd`
- `terminal.cwd`
- `terminal.wtSession`
- `terminal.wtProfileId`
- `terminal.bridgeProcessId`
- `terminal.bridgeParentProcessId`
- `terminal.windowTitleHint`
- `intentId`
- `allowedIntents`
- `intentExpiresAt`
- approval nonce / response file path
- raw tool input / output / diff / command / grep pattern

### 2.4 Mobile ViewModel 修订版

```ts
type MobileHudViewModel = {
  protocolVersion: 1
  snapshotVersion: number
  snapshotId: string
  generatedAt: string
  displayMode: 'trustedAppView'
  privacyLevel: 'safeNotification' | 'trustedAppView'

  summary: MobileHudSummary
  displayPolicy: MobileHudDisplayPolicy
  capsule: MobileHudCapsule
  sessions: MobileHudSessionCard[]
  attention: MobileHudAttentionItem[]
  completion?: MobileHudCompletionCard
  notificationEvents: MobileHudNotificationEvent[]
}
```

#### `displayPolicy`

```ts
type MobileHudDisplayPolicy = {
  visibleItems: string[]
  hiddenByDesktopConfig: string[]
  sourceGroupingEnabled: boolean
  terminalJump: 'returnToPc' | 'disabledOnDesktop' | 'notAvailableOnMobile'
  waitingNotifyEnabled: boolean
  completionNotifyEnabled: boolean
  errorNotifyEnabled: boolean
}
```

来源：

- `desktopHud.visibleItems` → App 内字段可见性基线。
- `desktopHud.zones.ticker` → Mobile capsule ticker。
- `desktopHud.maxVisibleSessions` → 首页摘要数量；Sessions 页不受限。
- `desktopHud.autoExpandOnWaiting` → waiting attention 是否自动置顶，不直接控制通知开关。
- `desktopHud.autoExpandOnCompletion` → completion card 置顶策略，不直接控制通知开关。
- `desktopHud.terminalJumpBehavior` → `terminalHint`，手机端永远不能打开 PC 终端。

#### `MobileHudSessionCard`

```ts
type MobileHudSessionCard = {
  mobileSessionId: string
  sessionShortId: string
  sourceLabel?: string
  sourceKind?: 'hookBridge' | 'statusLineBridge' | 'summary' | 'mock' | 'unknown'

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
  contextWindowSize?: number
  sessionTokens?: number
  totalCostUsd?: number
  outputSpeed?: number

  gitBranchLabel?: string
  gitDirty?: boolean
  gitAhead?: number
  gitBehind?: number
  addedDirLabels?: string[]
  addedDirsOverflowCount?: number

  agentsCount?: number
  agentsRunningCount?: number
  todosActiveCount?: number
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

#### `MobileHudAttentionItem`

```ts
type MobileHudAttentionItem = {
  attentionId: string
  dedupeKey: string
  kind: 'approval' | 'question'
  sessionRef: string
  title: string
  summary: string
  projectAlias?: string
  queuePosition?: number
  queueTotal?: number
  expiresAt?: string

  toolName?: string
  toolCategory?: string
  safeToolDetail?: {
    marker: string
    title: string
    detail: string
  }

  readonlyChoices?: { id: string; label: string }[]
  privacyNote: string
  allowedMobileActions: ['openApp', 'dismissLocal', 'returnToPc']
}
```

#### `MobileHudNotificationEvent`

```ts
type MobileHudNotificationEvent = {
  eventId: string
  dedupeKey: string
  collapseKey: string
  kind: 'waitingAttention' | 'completed' | 'failed' | 'connectionLost' | 'reconnected'
  sensitivity: 'low'
  title: string
  body: string
  createdAt: string
  source: 'pendingQueue' | 'activityTransition' | 'bridgeActivity' | 'connection'
  targetSessionRef?: string
}
```

---

## 3. 通知事件与去重

### 3.1 通知不是 snapshot 的 UI 字段

通知必须使用独立事件模型，不能把完整 session DTO 发给 Android 通知层后再靠 UI 隐藏。

通知 payload 只允许：

- `eventId`
- `kind`
- `sensitivity`
- `createdAt`
- `sessionShortId`
- `safeTitleKey` / `safeBodyKey` 或低敏文案
- `deepLinkTarget`

### 3.2 去重规则

| 事件 | 来源 | dedupeKey | collapseKey |
| --- | --- | --- | --- |
| waiting approval/question | pendingQueue pending item | `attention:{sessionRef}:{pendingItemId}:{updatedAt}` | `attention:{sessionRef}:{pendingItemId}` |
| completed | busy → settled 或 `lastAssistantResponseAt` | `completion:{sessionRef}:{completedAt}` | `completion:{sessionRef}` |
| failed/error | `activity=error` / StopFailure | `error:{sessionRef}:{event}:{updatedAt}` | `error:{sessionRef}` |
| connection lost | Mobile connection layer | `connection:{pcId}:lost:{bucket}` | `connection:{pcId}` |
| reconnected | Mobile connection layer | `connection:{pcId}:reconnected:{bucket}` | `connection:{pcId}` |

### 3.3 Completion 特别说明

Desktop completion 不是稳定后端事件，而是前端根据 activity transition 和 `lastAssistantResponseAt` 推断。一期 PC 端 Mobile builder 必须在 Rust 聚合层实现等价推断，并加 90 秒 TTL。通知不能因每次 snapshot 重发而重复弹出。

---

## 4. PC 端技术方案

### 4.1 Rust 模块结构

```text
src-tauri/src/window/mobile_hud/
  mod.rs
  types.rs
  snapshot.rs
  service.rs
  pairing.rs
  device_registry.rs
  network.rs
  crypto.rs
  notification.rs
  diagnostics.rs
```

### 4.2 Tauri managed state

新增 `MobileHudRuntime`：

```text
MobileHudRuntime
  - service_state
  - current_bind_address
  - current_port
  - shutdown_tx
  - server_task_handle
  - broadcaster
  - connected_clients
  - device_registry
  - notification_dedupe_cache
  - last_error
```

接入要求：

- `Builder::manage(MobileHudRuntime::default())`。
- `setup()` 读取 settings 后 reconcile。
- `save_app_settings` 后 reconcile。
- App exit 时 graceful shutdown。
- 禁用 mobile HUD 后立即 stop 并释放端口。
- 重复点击 start 不重复启动。

### 4.3 Tauri commands

一期建议命令：

- `get_mobile_hud_service_state`
- `set_mobile_hud_enabled`
- `restart_mobile_hud_service`
- `create_mobile_hud_pairing_offer`
- `cancel_mobile_hud_pairing_offer`
- `list_mobile_hud_devices`
- `approve_mobile_hud_device`
- `reject_mobile_hud_device`
- `revoke_mobile_hud_device`
- `get_mobile_hud_network_diagnostics`
- `get_mobile_hud_debug_snapshot`

所有命令必须注册到 `tauri::generate_handler![...]`，并在前端新增 `src/app/mobileHudBridge.ts` 封装。

### 4.4 Settings 与设备注册表

`AppSettings` 新增：

```ts
type MobileHudConfig = {
  version: 1
  enabled: boolean
  port: number | null
  portMode: 'fixed' | 'auto'
  bindMode: 'localhostOnly' | 'selectedInterface'
  selectedInterfaceId?: string
  selectedAddress?: string
  notificationsEnabled: boolean
  trustedAppViewEnabled: boolean
  showProjectBasename: boolean
  showExactCost: boolean
}
```

设备注册表不要塞进前端 settings，单独文件：

```text
%APPDATA%/Claude HUD One/mobile-devices.json
```

只保存非 secret 或 public 信息：

- `deviceId`
- `deviceName`
- `devicePublicKeyFingerprint`
- `firstPairedAt`
- `lastSeenAt`
- `revokedAt`
- `protocolVersion`
- `appVersion`

密钥 / 证书 / token 文件单独保存，原子写入，不能暴露给 React 前端。

### 4.5 Rust 依赖建议

一期默认加密方案：**WSS + 自签证书 + SPKI pinning + Android Keystore 设备签名**。

Rust 侧候选依赖：

- `tokio`
- `axum`
- `tokio-rustls`
- `rustls`
- `rcgen`
- `uuid`
- `rand`
- `sha2`
- `base64`
- `time`
- `p256` 或 `ed25519-dalek`（用于设备公钥签名校验，需与 Android Keystore 能力对齐）
- `zeroize`

备选路线：Noise/ECDH/AEAD over WebSocket，可在 Phase 0 spike 中验证，但不作为默认实现路线。

---

## 5. 配对、认证与加密协议

### 5.1 Pairing offer

PC 生成：

```json
{
  "type": "claude-hud-one-pairing",
  "protocolVersion": 1,
  "pairingId": "pair_...",
  "oneTimeToken": "...",
  "issuedAt": "...",
  "expiresAt": "...",
  "nonce": "...",
  "host": "192.168.1.23",
  "port": 27431,
  "serverFingerprint": "sha256:...",
  "hostCandidates": []
}
```

二维码和链接都使用该 payload。链接建议：

```text
claudehud://pair?host=192.168.1.23&port=27431&pairingId=pair_xxx&token=one_time_xxx&fp=sha256_xxx&expires=...
```

### 5.2 Pairing 防重放

规则：

- `oneTimeToken` 绑定 `pairingId`、`nonce`、`serverFingerprint`、过期时间。
- 默认 60 秒过期。
- 成功、拒绝、失败次数超限、超时后都关闭 pairing session。
- 同一 `pairingId` 同时只能有一个 pending candidate。
- 多设备抢同一二维码时，第一台进入 pending，其他返回 `pairing_in_progress` 或 `pairing_consumed`。
- PC 用户确认前不发送任何 snapshot。

### 5.3 设备身份

Android 首次配对：

- 生成设备密钥对。
- 私钥保存 Android Keystore。
- 公钥发送给 PC。
- PC 显示设备名、App 版本、来源 IP、public key fingerprint。
- 用户允许后写入 `mobile-devices.json`。

后续连接：

- PC 发送 server nonce。
- Android 用设备私钥签名挑战。
- PC 校验 deviceId + public key + signature。
- 成功后建立 WebSocket session。

### 5.4 WebSocket envelope

```ts
type MobileHudEnvelope = {
  protocolVersion: 1
  messageId: string
  seq: number
  kind: 'hello' | 'snapshot' | 'notification' | 'ack' | 'heartbeat' | 'error' | 'revoke'
  sentAt: string
  snapshotVersion?: number
  payload: unknown
}
```

规则：

- `seq` 单调递增。
- Android 发现重复或缺口时请求 full snapshot。
- heartbeat 建议 10 秒一次，30 秒无 heartbeat 进入 connection lost。
- revoke 消息收到后 Android 清本地授权并回 pairing。

---

## 6. Windows 网络、安装与防火墙

### 6.1 监听策略

- 默认不监听。
- 本机调试只绑定 `127.0.0.1`。
- 用户开启 Wi-Fi 后，只绑定用户选择的私有 IPv4。
- 不默认绑定 `0.0.0.0`。
- 默认排除 VPN / WSL / Docker / Hyper-V / Tailscale / ZeroTier 网卡。

### 6.2 防火墙策略

一期默认不静默添加防火墙规则，先使用产品引导：

- 设置页说明首次开启可能出现 Windows 安全警报。
- 建议只允许“专用网络”。
- 显示连接失败排查步骤。

如果后续做自动规则，需单独设计：

- 是否需要管理员权限。
- rule name。
- local subnet 限制。
- 卸载时是否删除。
- 用户拒绝管理员权限后的 fallback。

### 6.3 安装器影响

NSIS / 安装包需要复查：

- 是否展示 Mobile HUD 网络权限提示。
- 卸载时是否清除 `mobile-devices.json`、证书、密钥、日志。
- 重新安装后设备是否需要重新配对。
- 未签名 exe 监听局域网可能触发 Windows / 杀软警告，公开发布前需评估代码签名。

---

## 7. Android 技术方案

### 7.1 工程结构

```text
apps/android/
  settings.gradle.kts
  build.gradle.kts
  gradlew
  gradlew.bat
  app/
    build.gradle.kts
    src/main/AndroidManifest.xml
    src/main/java/com/claudehud/one/mobile/...
```

建议：

- `namespace = "com.claudehud.one.mobile"`
- `applicationId = "com.claudehud.one.mobile"`
- `minSdk = 26`
- `compileSdk` / `targetSdk` 使用本机可用稳定 SDK。
- Kotlin + Compose + Material3。
- JVM target 17。

### 7.2 Android 依赖

- Compose BOM
- Material3
- Navigation Compose
- Lifecycle ViewModel Compose
- kotlinx.serialization
- OkHttp WebSocket
- DataStore
- CameraX
- ML Kit Barcode Scanning
- AndroidX Security / Keystore 相关能力
- Timber（debug only，可选）

### 7.3 Manifest / 权限

一期权限：

- `INTERNET`
- `CAMERA`：只在扫码时请求。
- `POST_NOTIFICATIONS`：Android 13+，只在用户开启通知时请求。

Deep Link：

- `claudehud://pair?...`
- Activity 必须按 Android 12+ 明确 `android:exported`。
- URI 解析不能把完整链接/token 打日志。

一期避免：

- 位置权限。
- 悬浮窗权限。
- 无障碍权限。
- 后台定位。
- 默认电池优化白名单。
- 默认前台服务。

### 7.4 Android 状态机

```text
Unpaired
  → PairingInput
  → WaitingPcConfirm
  → PairedDisconnected
  → Connecting
  → ConnectedSyncing
  → ConnectedLive
  → ConnectionLost
  → Revoked
  → Error
```

每个状态需定义：

- UI 展示。
- 是否重连。
- 是否允许通知。
- 是否清理本地凭据。
- 用户可执行动作。

### 7.5 Notification Channel

一期 Channel：

| Channel | 用途 | 默认级别 |
| --- | --- | --- |
| `attention` | waiting approval/question | 较高 |
| `task_status` | completion / error | 默认 |
| `connection` | lost / reconnected | 较低 |

通知默认 `VISIBILITY_PRIVATE`，锁屏不显示敏感详情。

### 7.6 APK 产物

Debug：

```powershell
cd E:\Develop_E\claude-hud-one\apps\android
.\gradlew.bat :app:assembleDebug
```

产物：

```text
apps/android/app/build/outputs/apk/debug/app-debug.apk
```

安装：

```powershell
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

Release：

```powershell
.\gradlew.bat :app:assembleRelease
```

产物：

```text
apps/android/app/build/outputs/apk/release/app-release.apk
```

Release signing：

- keystore 不提交入仓库。
- `keystore.properties` 加 `.gitignore`。
- CI release 用 secret 注入。

---

## 8. 测试与验收

### 8.1 Contract fixtures

建议路径：

```text
schemas/mobile-hud/fixtures/
  running.json
  multi-session.json
  waiting-approval.json
  waiting-question.json
  completion.json
  error.json
  connection-lost.json
  revoked.json
  unknown-enum.json
```

要求：

- Rust 生成或校验 fixtures。
- Android 单测解析 fixtures。
- unknown enum fallback 不崩溃。
- snapshotVersion 不兼容时显示升级提示。

### 8.2 敏感字段扫描

序列化后的 Mobile ViewModel 不得包含：

- `transcriptPath`
- `projectDir`
- `cwd`
- `intentId`
- `allowedIntents`
- `nonce`
- `API_KEY`
- `TOKEN=`
- `Authorization`
- Windows 盘符完整路径
- Bash 完整命令
- diff / 文件内容

### 8.3 PC 验收

- 服务启停不阻塞 Tauri。
- settings reconcile 生效。
- 端口占用进入 Failed。
- 禁用后端口释放。
- pairing token 过期/重放失败。
- PC 撤销设备后 Android 断开。
- 多网卡可选择正确 IP。
- 防火墙阻断时 UI 有诊断。

### 8.4 Android 验收

- 扫码配对。
- 打开 `claudehud://pair` 链接。
- 手动 IP:Port。
- 拒绝相机权限后仍可粘贴链接。
- Android 13+ 拒绝通知权限后 App 前台仍可用。
- waiting/completion/error 通知低敏。
- PC revoke 后回到重新配对。
- App 前台/后台/锁屏行为符合“不承诺后台 100% 实时”。

### 8.5 构建验收

- `npm run build`
- `npm run ui`
- `npm run tauri:build`
- `apps/android/gradlew.bat :app:assembleDebug`
- `apps/android/gradlew.bat :app:testDebugUnitTest`
- `apps/android/gradlew.bat :app:lintDebug`

---

## 9. 分阶段路线

### Phase 0：一期前置工程

- 冻结加密方案。
- 建 Rust DTO / ViewModel。
- 建 contract fixtures。
- 建 settings 和 service skeleton。
- 建 Android 空壳工程。
- 跑通 debug APK。
- 跑通 localhost debug snapshot。

### Phase 1：Android 手机 HUD 一期可交付版

- PC Mobile HUD 设置页。
- 加密 WSS 服务。
- Wi-Fi 配对二维码/链接。
- Android 扫码/链接/手动 IP 配对。
- 单 PC 授权和撤销。
- Desktop HUD 信息等价展示。
- Attention 只读列表。
- 低敏手机通知。
- Windows 安装包 + Android APK。

### Phase 2：日常体验增强

- Desk Display Mode。
- 常亮模式。
- 通知节流配置。
- 更完整网络诊断。
- 多通知 Channel 设置。
- 更细隐私开关。

### Phase 3：生态扩展

- 多 PC。
- mDNS 自动发现。
- Widget。
- Quick Settings Tile。
- 完成历史。

### Phase 4：受控交互（单独立项）

- 本地 dismiss。
- 低风险 question answer。
- Deny。
- Allow once。

移动端仍不建议 Always Allow。

---

## 10. 仍待技术确认

1. WSS pinning 是否能在当前 Windows/Tauri + Android OkHttp 下稳定跑通；若成本过高，再切 Noise/ECDH。
2. Android Keystore 设备签名选 P-256 ECDSA 还是 Ed25519 兼容库方案。
3. PC 是否允许自动添加 Windows 防火墙规则，还是只做用户引导。
4. `projectAlias` 默认规则：basename、Project N、还是用户可配置。
5. exact cost 是否 App 内默认展示；建议默认跟随 Desktop，可在 Mobile 设置关闭。
6. 当前 Desktop 配置存在但 UI 未实际渲染的 `usage`、`effortLevel` 是否顺手补进 Mobile；建议作为增强，不作为“一期等价”阻塞。

---

## 11. 最终建议

方案可以继续按“一期交付 Android 真机 HUD”的目标推进，但开发时必须先解决技术前置：

1. **先冻结协议和加密路线**，不要带着 WSS/Noise 二选一进入大开发。
2. **先做 Mobile ViewModel 和 contract fixtures**，确保 Desktop HUD 信息等价且不泄密。
3. **PC 服务必须是 Rust 后端权威聚合**，不能依赖 React store。
4. **Android APK 是一期交付物**，Gradle、签名、通知权限、Deep Link 必须提前落地。
5. **通知必须事件化和去重**，不能每次 snapshot 更新都弹通知。
6. **Windows 防火墙/网卡/端口是核心验收项**，不是后续优化。
7. **只读边界不变**：手机端一期只能看和提醒，不能改变 Claude Code 执行结果。
8. **交付前必须 Claude 自主全流程验收**：由于用户安装包测试成本高，开发阶段不能把半成品交给用户试错；必须由 Claude 自动完成 PC/Android 构建、协议联调、Playwright 前端交互截图、Android fixture/unit/UI 测试、emulator/adb 或可用真机验证、通知低敏检查、打包产物记录和失败修复循环，全部自测通过后再让用户安装 APK 与 Windows 安装包做最终人工体验。