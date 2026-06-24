# Claude HUD One 架构改造执行跟踪计划

- 日期：2026-06-22
- 执行目标：按“Rust HUD Core + Local Runtime + native hud-bridge + Tauri/React Desktop + 原生移动端 + schema-first protocol”的长期路线，自主推进架构改造并自主验收。
- 跟踪方式：本报告记录阶段路线；会话任务列表跟踪当前执行状态；工作日志记录完成检查。

---

## 当前执行进展

- Phase 1A：已完成，协议锚点、Rust 分层骨架、TS 类型抽离、Android contract 补充和 UI 验收稳定性已落地。
- Phase 1B：已完成第一轮，`protocol.json` + privacy denylist 已生成 TypeScript / Kotlin / Swift 协议常量，并纳入 `npm run test:protocol` stale check。
- Phase 2：已推进到纯 Rust bridge 第一轮最终化，安装包随包携带 native `hud-bridge.exe`，installer 和 app-start repair 只生成 native 命令入口；`hud-bridge.exe` 默认不再委托 Node bridge，已由 Rust 直接完成 statusLine/hooks stdin 解析、脱敏状态写入、Terminal HUD 渲染、pending intent request 写入和 PreToolUse allow/deny/defer response；`--emit-json` Rust 脱敏事件 smoke 保留。
- Phase 3：已完成移动 signed intent runtime 第一轮，pairing registry 持久化设备公钥，`/intent/resolve` 入口强制设备已批准、P-256 ECDSA 签名、TTL、bodyHash、idempotencyKey 和 replay cache 校验，再委托本地 pending intent resolver。
- Android 自动验收：已恢复，本机 `scripts/android-gradle.ps1` 可写入/复用 `apps/android/local.properties`，`npm run test:android`、`npm run lint:android`、`npm run build:android` 均已通过。
- 最终打包：`npm run tauri:build` 已通过，安装包为 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`；纯 Rust bridge + Terminal HUD 颜色/完整展示 + 颜色配置页布局 + hash-versioned bridge 安装修复后重打包 SHA256 为 `B829DF81A1BCCC0BD971CB998F83B723F6C6595A8A67F0BC91B7D6A348292BFA`。
- 2026-06-23 双线收口进展：旧 Node bridge 生产残留已清理，项目级 Claude/Codex hooks 不再调用 `.claude/bridge/claude-status-bridge.mjs`，Tauri resources 不再保留 `claude-status-bridge.mjs`；`src-tauri` 中仅保留带注释的 legacy command 识别，用于安装/修复/卸载时替换旧 settings。
- Local Runtime audit 基础已落地：新增 `src-tauri/src/local_runtime/audit.rs` 和 SQLite `audit_events` 单表，bridge parse/process、pending intent 创建/决策、Mobile pairing/intent 校验结果均以低敏 best-effort 事件写入，默认路径为 `%APPDATA%/Claude HUD One/audit/audit.sqlite3`。
- macOS/iOS/Relay 路线已更新为后续阶段：macOS 先补 platform adapter 与 Tauri shell 复用；iOS 只做原生控制面；Relay 只做 rendezvous、低敏中继和 FCM/APNs/APNs 协调，不做云执行层。
- 2026-06-23 Terminal HUD 会话隔离修复：状态合并不再无条件回退读取全局 `claude-status.json`，只有全局状态属于同一 `sessionKey` 时才允许作为 fallback；并且 statusLine 缺失指标不再从历史 session 文件继承，避免旧污染数据在同一 session 文件里继续保留；随后补回 transcript usage / start time / latest todo / tool/agent 低敏汇总，恢复 Tokens/Started/Activity 两行显示，并修复 activity 行只显示 Todo、不显示已完成 Agent/Tool 总数的问题；Tokens 组件在新会话零输入时也显示 `0`；已补充回归测试并安装当前 bridge `hud-bridge-6be127da3c57.exe`。
- 2026-06-24 Desktop HUD 会话列表修复：桌面 HUD 不再把 10 分钟内的历史 bridge session 都当作“已打开会话”，live 会话 TTL 收紧为 45 秒，过期时允许清空 store/localStorage 会话列表并显示空态；运行中状态会结合 running tool/agent 计数、hook 事件和 statusText 派生；Stop 不再创建 attention question，PostToolUse/Stop 会清空 running 计数。已通过 bridge/mobile/frontend/build 验证并安装当前 bridge `hud-bridge-045a99385f73.exe`，新 NSIS SHA256 为 `1ECAAF9C02670F021C619C33A48A726F286B40FA1F97ED966ACBE69EEB78B5CE`。
- 2026-06-24 Desktop HUD 授权误报修复：Rust bridge 不再对所有 `PreToolUse` 无条件生成 HUD approval；现在会尊重 Claude Code hook 输入的 `permission_mode=bypassPermissions`，并 best-effort 读取 Claude Code `permissions.allow/ask/deny` 与 legacy `allowedTools/deniedTools`。命中 allow/deny 或 bypass 时不弹 HUD 授权，命中 ask 时继续保留 HUD 审批能力；已新增 bridge 回归测试覆盖 bypass 与 allow 规则，并通过 `npm run test:bridge`、`cargo check --manifest-path src-tauri/Cargo.toml -j 1`、`npm run build`、`npm run tauri:build`。当前 bridge 为 `hud-bridge-7356720910b8.exe`，NSIS SHA256 为 `9EF428B6808EA24918012B686EC64FEA70B66133744CB4598122F6886ACDFB14`。
- 2026-06-24 Desktop HUD 状态信息修复：定位到 statusLine 心跳刷新被同时当作“真实活动时间”和“活跃状态”，导致旧会话显示“活跃 / <1m”。已将 Rust statusLine 默认状态改为 `idle`/`Session idle`，仅 running tool/agent 计数为正时显示 `running`；前端对 statusLine-only 心跳做 idle 兜底、归一旧 `Claude Code active`、排除 `SessionEnd` live 会话，且卡片空闲态右侧时间改用真实活动/启动时间而不是心跳时间。已通过 bridge/Rust/frontend/Tauri 打包验证；当前 bridge 为 `hud-bridge-cd949ba67cb1.exe`，NSIS SHA256 为 `B138DDB1F2C9B4A26D466D26D677555FE7BED4C698D40B83DD99CCB3C478CECA`。

---

## 阶段路线

### Phase 1A：低风险架构边界固化（当前执行）

目标：不破坏现有功能，先建立协议权威入口和 Rust 分层骨架。

交付：

- `schemas/mobile-hud/protocol.json`
- `schemas/mobile-hud/envelope.schema.json`
- `schemas/mobile-hud/view-model.schema.json`
- `schemas/hud-core/privacy-denylist.json`
- `schemas/hud-core/normalized-hud-state.schema.json`
- `scripts/check-mobile-hud-protocol.mjs`
- `src/protocol/mobileHud.ts`
- `src-tauri/src/hud_core/`
- `src-tauri/src/hud_bridge/`
- `src-tauri/src/local_runtime/`

验收：

- `npm run test:protocol`
- `npm run build`
- `npm run test:rust`
- Android `testDebugUnitTest`
- 文档/工作日志回写
- 如果涉及代码修改，最终必须 `npm run tauri:build`

### Phase 1B：协议生成与跨端类型收敛

目标：将 schema-first 从“协议锚点”升级为“代码生成与跨端契约测试”。

交付：

- JSON Schema → TypeScript DTO
- JSON Schema → Kotlin DTO 或校验器
- Swift Codable model 草案
- Rust protocol compatibility tests
- fixtures 覆盖更多异常/未来字段场景

### Phase 2：native hud-bridge

目标：把 Claude Code hooks/statusLine 生产入口从 Node bridge 逐步迁移到自包含原生 `hud-bridge`。

交付：

- `crates/hud-bridge` 或 `src-tauri/src/hud_bridge` 可执行入口
- stdin JSON parser
- 脱敏与 schema event 输出
- local socket / file queue fallback
- 安装、升级、卸载、诊断策略

### Phase 3：Local Runtime 与移动安全模型强化

目标：让设备身份、请求签名、intent 幂等、审计日志成为本地 runtime 的稳定能力。

交付：

- 设备公钥请求签名验证
- intent nonce / TTL / bodyHash / idempotencyKey
- SQLite event log 和 retention/redaction 策略
- Android 前台/后台/Relay 策略完善

### Phase 4：macOS / iOS / Relay 扩展准备

目标：在不重写核心的前提下增加 macOS adapter、iOS control client 和可选 Relay 协调层。

交付：

- `hud-platform-mac` adapter：封装 Terminal/iTerm/Ghostty 窗口枚举、聚焦、打开路径、菜单栏/通知/启动项等平台能力。
- macOS Tauri shell：复用 React Desktop UI 与 Rust Local Runtime，平台差异只放进 adapter，不复制业务状态机。
- iOS SwiftUI / Swift Package protocol model：复用 schema-first DTO、SPKI pinning、设备私钥签名、低敏 snapshot 和 intent contract。
- Relay + FCM/APNs/APNs 设计：只做 rendezvous、低敏消息中继、推送唤醒和跨网络连接协调；不运行 Claude Code、不保存完整 transcript、不绕过 PC Local Runtime 权限判断。
- macOS Terminal/iTerm/Ghostty 适配验证和 iOS 前台/短后台/推送路径验收。

分阶段验收：

1. macOS adapter trait 与 Windows adapter 调用点分离，当前 Windows 功能不退化。
2. iOS protocol fixtures 可由 Swift model 解析，且不包含 cwd/projectDir/transcriptPath/tool input/raw prompt 等高敏字段。
3. Relay API 只接受低敏 envelope 和 signed intent envelope；最终 allow/deny/answer 仍由 PC Local Runtime 校验并落审计事件。
4. Android/iOS 后台通知只携带低敏摘要，打开 App 后再通过本地/Relay 通道拉取 snapshot。

---

## 当前自主验收清单

- [x] 协议文件存在且 fixtures 通过协议校验。
- [x] Android contract 读取 `protocol.json` 并验证只读/低敏策略。
- [x] TS Mobile HUD 类型从 Tauri invoke wrapper 中抽离。
- [x] Rust `hud_core` / `hud_bridge` / `local_runtime` 骨架被纳入模块树。
- [x] 现有 Tauri command 名称不变。
- [x] `npm run build` 通过。
- [x] `npm run test:rust` 通过。
- [x] `npm run test:ui` 通过。
- [x] Android unit test 已恢复并通过：`npm run test:android`。
- [x] Android lint/build 已通过：`npm run lint:android`、`npm run build:android`。
- [x] native `hud-bridge.exe` 已构建并复制进 Tauri resources，installer / app-start repair 已收敛为 native-only 命令入口，生产路径不再委托 Node bridge。
- [x] 移动 signed intent runtime 已接入 `/intent/resolve`，并有 Rust/Android 测试覆盖签名 payload、metadata 和 replay 基础。
- [x] `npm run tauri:build` 通过，安装包已生成。
- [x] 旧 Node bridge 生产残留已清理，`.claude/settings.json` / `.codex/hooks.json` 不再调用 `.claude/bridge/claude-status-bridge.mjs`。
- [x] Local Runtime audit SQLite 基础已落地，并通过 `cargo check`、`cargo test ... audit`、`npm run test:bridge`、`cargo test ... mobile_hud`、`npm run test:security`、`npm run test:protocol` 的阶段验证。
- [x] macOS / iOS / Relay 下一阶段边界已明确：平台 adapter、原生控制端、Relay 低敏协调层三条线分开推进。
