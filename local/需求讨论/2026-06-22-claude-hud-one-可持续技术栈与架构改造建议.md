# Claude HUD One 可持续技术栈与架构改造建议

- 日期：2026-06-22
- 目标：在不考虑重构成本、以长期可持续发展为优先的前提下，为 Claude HUD One 确定终端、桌面端、移动端、未来 macOS/iOS 扩展的技术栈与改造方向。
- 结论先行：**不要追求所有端一套 UI 代码；要追求一套稳定协议、一套本地核心、一套安全模型，以及可替换的平台适配层。**

---

## 0. 本次复审后的关键修正

上一版报告的大方向正确，但有几处需要更精确：

1. **终端 bridge 不应长期依赖 Node。**  
   短期继续用 TypeScript/Node bridge 很方便；但 Claude Code 当前是 native binary 优先，hooks/statusLine 本质是“运行外部命令 + stdin/stdout JSON”，不要求 Node。长期产品化应收敛到自包含 `hud-bridge` 原生可执行文件，TypeScript 留在 UI、schema tooling、开发脚本和 fallback。

2. **Rust Local Core 不能变成“万能后端”。**  
   Rust 层应拆成：`hud-core` 纯领域核心、`hud-local-runtime` 本地运行时、`hud-platform-*` 平台适配。这样未来 macOS、headless daemon、relay 测试环境才能复用核心语义。

3. **hooks/statusLine 是集成边界，不是可靠事件总线或安全核心。**  
   它们适合采集状态、生命周期事件和 transcript 路径，但不应承担最终 session reducer、移动端审批、权限判断和安全审计。

4. **移动端是控制面，不是执行面。**  
   Android/iOS 负责查看、通知、审批、轻量输入和远程控制；不运行 Claude Code、不执行 shell、不保存完整高敏 transcript。

5. **Relay 不是云端执行层。**  
   Relay 只应做设备发现、低敏消息中继、FCM/APNs 推送协调；最终权限判断和本地执行仍在 PC 的 Local Core。

---

## 1. 最终推荐技术路线

Claude HUD One 推荐采用下面这条主路线：

```text
Rust Domain Core + Rust Local Runtime
+ HUD Native Bridge for Claude Code hooks/statusLine
+ Tauri Desktop + React/TypeScript UI
+ Android Kotlin/Compose
+ iOS Swift/SwiftUI
+ Schema-first Protocol
+ Optional Relay for push / cross-network control
```

也就是：

| 层级 | 推荐技术 | 结论 |
| --- | --- | --- |
| 领域核心 | Rust `hud-core` | 负责协议类型、事件归一化、session reducer、intent validation、权限策略、敏感级别、审计语义。 |
| 本地运行时 | Rust `hud-local-runtime` | 负责 SQLite、event bus、local API/WSS、设备注册、配对、队列、日志。 |
| 平台适配 | Rust `hud-platform-win` / `hud-platform-mac` | Windows HWND/Terminal/Region/Startup；未来 macOS Accessibility/Terminal/iTerm/Ghostty/菜单栏等。 |
| 终端集成 | 生产路径 Rust/native `hud-bridge`；TypeScript 仅保留在工具链/调试侧 | Claude Code hooks/statusLine 调用外部命令，不要求 Node；正式产品应使用自包含 bridge，避免运行时依赖 Node。 |
| 桌面端 | Tauri 2 + React + TypeScript | 继续保留并强化当前方向，未来覆盖 Windows/macOS；React 只做 UI 和 intent 提交。 |
| Android | Kotlin + Jetpack Compose | 保留原生路线，重点是通知、生命周期、安全存储、配对、WSS/Relay client。 |
| iOS | Swift + SwiftUI | 未来 iOS 做原生控制端；后台通知和跨公网依赖 Relay + APNs。 |
| 协议 | JSON Schema + 代码生成；OpenAPI/AsyncAPI 按需 | 共享协议语义和兼容规则，不强行共享 UI。 |
| 存储 | SQLite + 低敏事件日志 + OS Keychain/Keystore | 状态和审计可回放；密钥、高敏 transcript 不进入普通日志。 |
| 远程 | Optional Relay | 负责 rendezvous、低敏中继、推送协调；不运行 Claude Code，不绕过 Local Core。 |

一句话：**桌面和本地能力走 Rust/Tauri，桌面 UI 走 React/TS，移动端走原生，跨端共享协议、状态语义、安全模型和设计 token。**

---

## 2. 架构边界定义

本文里的 Local Core 不是“把所有后端逻辑塞进 Rust”，而是拆成清晰边界：

```text
hud-core
├─ 协议类型
├─ 事件归一化
├─ session reducer
├─ intent validation
├─ permission policy
├─ sensitivity model
└─ audit model

hud-local-runtime
├─ SQLite / migration
├─ append-only event log
├─ local API / WSS
├─ device registry / pairing
├─ queue / retry / dedupe
└─ diagnostics

hud-platform-*
├─ terminal window detection
├─ focus / open terminal
├─ overlay region
├─ startup / tray / notification
└─ OS-specific permissions

client surfaces
├─ Tauri/React Desktop
├─ Android Kotlin/Compose
├─ future iOS SwiftUI
└─ CLI / diagnostics tools
```

Claude HUD One 不复刻 Claude Code 或 Managed Agents 的执行 runtime。它的定位是：**观察 Claude Code 本地会话、归一化状态、执行用户授权的本地控制 intent，并把低敏状态同步到桌面/移动端。**

---

## 3. 为什么不是“全端 React Native / Flutter / WebView 一把梭”

不是这些技术不能做，而是它们主要优化 UI 复用；Claude HUD One 的长期风险集中在系统集成、生命周期、安全通道和本地执行边界。

Claude HUD One 的核心能力包括：

- 读取 Claude Code hooks/statusLine/transcript/session metadata；
- 绑定终端会话与窗口；
- Windows HWND / 未来 macOS Accessibility / AppleScript / Terminal/iTerm/Ghostty 等平台能力；
- 本机 WSS / 配对 / 证书 pinning / 设备撤销；
- 桌面悬浮窗、点击穿透、窗口 region、系统托盘、开机启动；
- 移动端通知、审批、低敏状态同步；
- 未来跨公网远程控制和多设备连续会话。

所以：

1. **不建议桌面端改成 Electron。**  
   Electron 能做，但与“轻量常驻、系统集成、低资源悬浮窗”的目标不如 Tauri/Rust 匹配。

2. **不建议 Android 改成 React Native / Capacitor 只为复用 React UI。**  
   Android 端重点是系统生命周期、通知、安全存储、配对和网络连接；Kotlin/Compose 更稳。

3. **不建议正式移动端押注 Tauri Mobile。**  
   可用于实验，但正式 Android/iOS 更需要原生后台、通知、证书、系统权限和平台体验。

4. **不建议移动端执行完整 Claude Code runtime。**  
   手机是控制面，不是本地 Bash/文件系统/Agent 执行环境。

---

## 4. Claude Code 给我们的真正启发

前面对 Claude Code 的研究里，最值得借鉴的不是“它是不是 TypeScript”，而是它的分层思想：

```text
Agent / Session Product
├─ Event ingestion
├─ Tool / permission boundary
├─ Context / state management
├─ Hooks / lifecycle
├─ Session persistence
├─ SDK / CLI / Desktop / Mobile surfaces
└─ Local / Remote execution boundary
```

映射到 Claude HUD One，应该变成：

```text
HUD Product Core
├─ Claude Code Event Ingestion：statusLine、hooks、transcript_path、session metadata
├─ Session State Engine：active/running/waiting/completed/stale
├─ Terminal Binding：Windows Terminal / future macOS terminal adapters
├─ Permission & Intent：approval、question、dismiss、open terminal、future allow/deny/answer
├─ Mobile Sync：device pairing、WSS/Relay、push、low-sensitive DTO
├─ Security：SPKI pinning、device key、nonce、TTL、audit log
├─ Storage：SQLite、event log、settings、device registry
└─ Client SDK：Desktop UI、Android、future iOS、CLI diagnostics
```

核心原则：**Claude HUD One 的核心不应该是某个 React 页面，也不应该是某个 Android Activity；核心应该是一个稳定的 HUD Core + Local Runtime。**

---

## 5. 目标架构

```text
Claude Code / Terminal
        │
        │ statusLine / hooks / transcript_path / cwd / session metadata
        ▼
HUD Bridge
  ├─ production: self-contained Rust/native executable
  └─ dev/tooling: TypeScript schema tooling and diagnostics only
        │
        │ schema event / local socket / file queue
        ▼
Rust HUD Local Runtime
        ├─ Event Bus
        ├─ Session Store / SQLite
        ├─ Permission & Intent Policy
        ├─ Pairing / Device Registry
        ├─ WSS / Local API
        ├─ Windows Adapter
        ├─ future macOS Adapter
        └─ Protocol SDK / Generated Types
        │
        ├──────────────► Tauri Desktop Shell
        │                  └─ React/TypeScript Desktop HUD UI
        │
        ├──────────────► Android App
        │                  └─ Kotlin / Compose
        │
        ├──────────────► future iOS App
        │                  └─ Swift / SwiftUI
        │
        └──────────────► optional Relay
                           └─ rendezvous / low-sensitive relay / push coordinator
```

注意：Claude Code 的 statusLine/hooks 提供的是会话状态、生命周期事件和 transcript 路径等集成入口，**不等同于终端窗口绑定能力**。Windows Terminal、PowerShell、Git Bash、WSL，以及未来 macOS Terminal/iTerm/Ghostty 的窗口识别、聚焦、恢复和启动，应由 Rust platform adapter 处理。

---

## 6. 各端技术栈选择

### 6.1 Windows / macOS 桌面端

推荐：**Tauri 2 + Rust + React + TypeScript**

继续保留当前方向，但调整职责：

- `src-tauri` 不长期承载全部业务逻辑；
- Rust workspace 抽出 `hud-core`、`hud-local-runtime`、`hud-platform-*`；
- Tauri shell 调用 runtime，不直接实现复杂状态机；
- React UI 只订阅状态、展示 UI、提交 intent；
- Windows/macOS 差异放进 platform adapter。

建议未来结构：

```text
crates/
  hud-core/           # 领域核心：状态机、事件、权限、intent、敏感级别、审计
  hud-local-runtime/  # 本地运行时：SQLite、WSS、device registry、queue、diagnostics
  hud-protocol/       # schema / generated types / compatibility rules
  hud-platform/       # 平台 trait
  hud-platform-win/   # Windows HWND、Terminal、Region、Startup 等
  hud-platform-mac/   # macOS Accessibility、Terminal/iTerm、MenuBar 等
  hud-bridge/         # 长期 hooks/statusLine 原生入口
src-tauri/            # Tauri 命令、窗口、托盘、capabilities、权限桥
src/                  # React Desktop HUD UI
packages/             # TS schema tooling、开发脚本、fallback bridge、SDK
```

Tauri 也要纳入安全模型：React 只能调用 allowlist command；高风险 intent 必须由 Rust runtime 校验 session、device、nonce、TTL、权限等级后执行；前端不得持有设备私钥、relay token、完整 transcript 路径或高敏原文。

### 6.2 终端 / Claude Code 集成

推荐：**生产路径自包含 Rust/native bridge，TypeScript/Node 仅用于开发工具链和调试材料**

Claude Code hooks/statusLine 的本质不是 Node 插件机制，而是“运行外部命令”。Claude Code 会把 JSON 输入通过 stdin 传给 hook/statusLine 命令，并读取 stdout/stderr 或退出码。这个命令可以用 Node、Python、PowerShell、Rust CLI 等任意运行时实现。

需要特别注意：Claude Code 当前推荐 native install；即使通过 npm 安装，官方也说明 npm 包安装的是同一个 native binary，`claude` binary 本身不调用 Node。因此 Claude HUD One 不能假设用户环境长期存在 Node/npm。

当前项目已经按最终路线收敛：

1. **生产 bridge**：Claude Code hooks/statusLine 直接调用自包含 `hud-bridge.exe`，由 Rust 读取 stdin JSON、脱敏、归一化状态、渲染 Terminal HUD、写入 pending intent request，并返回 blocking hook response。
2. **协议固化**：bridge 输入/输出契约继续沉淀到 `schemas/hud-bridge/fixtures/` 与 `schemas/mobile-hud/`，用测试保护跨端低敏 DTO 和行为兼容。
3. **运行时边界**：当前仍以文件队列和状态 JSON 作为 Desktop/Mobile 的稳定消费面；下一步再把 SQLite event log、local event bus、diagnostics API 逐步提升为 Local Runtime 的主干能力。
4. **TypeScript 保留位置**：TypeScript 继续用于 React UI、schema tooling、开发脚本、调试工具和可选 SDK，不再作为生产桥接层运行时。

### 6.3 Android

推荐：**Kotlin + Jetpack Compose 继续走原生**

Android 原生客户端的重点是平台生命周期下的可靠控制面，而不是无限后台长连接。局域网 WSS 可用于 App 前台和用户明确开启的短时前台服务；后台提醒应优先走 FCM/Relay，避免依赖系统不保证的长期保活。

Android 端职责：

- Pairing UI；
- WSS / Relay client；
- Notification；
- Session list / detail；
- Approval / Question intent UI；
- Local low-sensitive cache；
- Diagnostics。

不做：

- 完整 session reducer；
- 终端窗口定位；
- Claude Code transcript 解析；
- 高危命令执行；
- 本地 Agent runtime。

### 6.4 iOS

推荐：**Swift + SwiftUI**

iOS 正式客户端应定位为安全控制面。无 Relay 时只承诺同局域网、前台或短后台窗口内的连接与审批；跨公网通知、后台可靠唤醒和离线事件必须通过 Relay + APNs 实现。

iOS 端重点：

- APNs；
- Keychain；
- Network.framework；
- background task 限制；
- local notification；
- Universal Link / QR pairing；
- iOS 审核和隐私权限；
- SPKI pinning + device key。

iOS 与 Android 共享协议 schema、状态语义、设计 token、安全策略和 API contract，不强行共享 UI 组件。

---

## 7. 现有项目应该如何改造

### 阶段 1：先定协议，把重复 DTO 收回来

当前已有 `schemas/mobile-hud/`，建议升级为完整协议目录：

```text
schemas/hud-protocol/
  envelope.schema.json
  snapshot.schema.json
  session.schema.json
  event.schema.json
  device.schema.json
  intent.schema.json
  approval.schema.json
  question.schema.json
  terminal.schema.json
  settings.schema.json
  fixtures/
```

Schema-first 不等于只放 JSON 示例。建议明确：

- JSON Schema 定义 envelope、snapshot、session、event、intent、device、terminal、settings 等数据结构；
- OpenAPI 只描述 HTTP/local API/relay API；
- WebSocket/SSE/event stream 使用独立 event envelope schema，必要时补 AsyncAPI；
- 所有 schema 必须定义 `protocolVersion`、`schemaVersion`、`kind`、`capabilities`、`sensitivity`、unknown enum fallback、deprecated 字段、兼容规则；
- CI 校验 fixtures，生成 Rust/TypeScript/Kotlin/Swift DTO，并运行跨语言解析测试。

### 阶段 2：抽出 Rust 领域核心和本地运行时

把 Tauri 后端里的业务逻辑拆成两层：

```text
hud-core
├─ normalize_event()
├─ reduce_session_state()
├─ validate_intent()
├─ classify_sensitivity()
├─ build_audit_event()
└─ define_permission_policy()

hud-local-runtime
├─ ingest_event()
├─ register_device()
├─ revoke_device()
├─ create_pairing_token()
├─ verify_mobile_request()
├─ publish_event_stream()
├─ persist_event_log()
└─ run_local_api()
```

目标：Tauri 是桌面壳，Local Runtime 是本机服务，Core 是可测试、可复用、可被未来 relay/headless 环境引用的领域逻辑。

### 阶段 3：重整 Terminal Bridge

产品化安装目标应是原生 `hud-bridge`：

```text
crates/hud-bridge/
  src/statusline.rs
  src/hooks.rs
  src/transcript_ref.rs
  src/sanitize.rs
  src/client.rs
  src/file_queue.rs

packages/terminal-bridge/       # dev-only diagnostics / fixture tooling if needed
  src/statusline.ts
  src/hooks.ts
  src/sanitize.ts
  src/client.ts
```

要求：

- 所有输出都是 schema event；
- 所有敏感信息先脱敏；
- hook/statusLine 不直接决定 UI；
- bridge 与 runtime 通信失败时有 file queue fallback；
- Claude Code settings 写入要有备份、owner 标记、冲突检测、可恢复机制；
- bridge 可安装、升级、诊断、卸载。

### 阶段 4：Desktop UI 变成纯客户端

React 桌面端只做：

- 订阅 session state；
- 展示 Desktop HUD；
- 发起 open terminal / approve / deny / answer / dismiss 等 intent；
- 展示设置页；
- 展示设备管理和配对；
- 展示日志和诊断。

不要让 UI 层承担 session 状态推导、设备信任判断、WSS 安全策略、terminal binding 核心算法、approval/question 协议判断。

### 阶段 5：Android 只保留移动端职责

Android 不实现完整 session reducer，但要实现轻量同步状态机：

- connection state；
- lastSeenSeq；
- snapshotVersion；
- pendingIntent local state；
- retry/backoff；
- idempotencyKey；
- expired/revoked fallback。

Core/Relay 必须保证 event sequence、snapshot reconciliation、重复 intent 幂等处理和过期语义。

### 阶段 6：为 macOS / iOS 预留 adapter

现在就应该把平台差异隔离出来：

```text
PlatformAdapter
├─ list_terminal_windows()
├─ focus_terminal_session()
├─ open_terminal_at_cwd()
├─ set_overlay_region()
├─ register_startup()
├─ send_notification()
└─ read_system_theme()
```

Windows 和 macOS 分别实现。未来加 macOS 时不是重写产品，而是补 adapter。

---

## 8. 应该尽早做的架构决策

### 8.1 共享协议优先于共享 UI

Claude HUD One 的跨端一致性应该来自：同一套 session state、event 类型、intent 类型、权限策略、敏感字段分级和版本兼容规则，而不是强行让 React 组件跑到 Android/iOS。

### 8.2 本地 Core 应该比 UI 更稳定

UI 可以快速迭代，Core 不应该经常变。需要尽快稳定：状态机、安全策略、设备协议、存储结构、event log、intent validation。

### 8.3 移动端是控制面，不是执行面

手机可以看状态、审批、回答问题、打开/唤醒桌面会话；手机不直接执行 shell、不保存高敏 transcript、不承担完整 Claude Code runtime。

### 8.4 安全模型要先于功能扩展

安全模型必须覆盖三层：

1. **传输层信任**：本地 WSS 使用自签证书 + QR/Deep Link 传递 SPKI fingerprint，移动端执行 TOFU/pinning；证书轮换、pin 更新和设备撤销要有明确流程。
2. **设备身份**：配对时登记设备公钥；后续读请求/intent 请求应由设备私钥签名，服务端验证 `deviceId + nonce + timestamp + bodyHash`。`deviceId` 只能作为索引，不能作为认证凭据。
3. **Intent 授权**：每个 intent 必须绑定 session、riskLevel、allowedActions、TTL、nonce、bodyHash、origin、auditId、idempotencyKey；高风险 intent 默认需要 PC 端确认或更高权限策略。

移动端不保存完整 transcript、cwd/projectDir/transcriptPath/tool input/raw prompt 等高敏字段；通知 payload 只能携带低敏摘要。

### 8.5 hooks/statusLine 是集成边界，不是安全核心

**statusLine 的边界：**

- 通过 stdin 接收 Claude Code JSON session data，通过 stdout 输出展示文本；
- 主要用于状态展示和低敏心跳；
- 更新是事件驱动并带 debounce 的，正在运行的 statusLine 命令可能被取消；
- 不应当作可靠事件队列、审批通道或移动同步唯一依据。

**hooks 的边界：**

- hooks 可在 Claude Code 生命周期事件中运行外部命令、HTTP endpoint、MCP tool、prompt 或 agent；
- 只有部分事件支持阻断，`PostToolUse` 发生在工具执行之后，不能回滚已经发生的行为；
- hook matcher 不应被当成硬安全边界，硬性 allow/deny 应优先使用 Claude Code permissions 或 managed policy；
- hooks/statusLine 可能被用户、项目或 managed settings 禁用或限制。

Claude HUD One 的原则：hooks/statusLine 只负责采集、脱敏、投递事件；最终状态、安全、审计和移动 intent 校验都必须进入 Rust Local Runtime。

### 8.6 Relay 是可选协调层，不是云端执行层

Relay 最多承担三类职责：

- device rendezvous / pairing assistance；
- 低敏事件和 intent 中继；
- FCM/APNs 推送协调。

Relay 不运行 Claude Code、不持有 shell 权限、不保存完整 transcript、不绕过 Local Core 权限判断。移动端后台通知和 iOS 跨公网审批一旦成为正式能力，Relay 就从“可选增强”变成“可靠交付所需组件”。

---

## 9. 最终建议

如果完全不考虑重构成本，只考虑长期正确性，我建议 Claude HUD One 做下面这个选择：

1. **保留并强化 Tauri + React + TypeScript + Rust 桌面技术路线。**
2. **把 Rust 从 Tauri 命令层提升为 `hud-core` + `hud-local-runtime` + `hud-platform-*`。**
3. **把 Claude Code bridge 保持在自包含 `hud-bridge` 原生可执行文件生产路径，避免重新引入 TS/Node 运行时依赖。**
4. **TypeScript 继续用于桌面 UI、schema tooling、开发脚本、fallback bridge 和未来 SDK。**
5. **Android 继续 Kotlin/Compose，未来 iOS 使用 SwiftUI。**
6. **跨端共享协议、状态语义、权限策略、设计 token，不强求共享 UI 组件。**
7. **移动端只做远程控制、审批、通知和轻量协作，不做完整执行环境。**
8. **未来如需公网/多设备，增加 Relay；Relay 只做协调和低敏中继，不做执行面。**

最终目标架构是：

```text
Claude HUD One = Rust HUD Core + Local Runtime
               + HUD Native Bridge for Claude Code hooks/statusLine
               + Tauri/React Desktop
               + Native Mobile Clients
               + Schema-first Protocol
               + Optional Relay
               + TypeScript tooling / UI / fallback bridge
```

这条路线比“全端统一一个 UI 框架”更适合 Claude HUD One，因为本项目真正难点不是页面复用，而是本地系统集成、Claude Code 会话理解、移动端安全控制和未来跨平台可持续演进。
