# Claude HUD One Android 手机 HUD 一期开发执行计划（Claude 自用）

> 日期：2026-06-17  
> 用途：给后续执行开发时使用，记录做到哪一步、每一步的产物、验收和阻塞条件。  
> 依据：`local/需求讨论/2026-06-16-claude-hud-one-android-mobile-hud-研究报告.md` 技术方案补漏版。

---

## 0. 执行总原则

1. **一期必须产出两个安装包**
   - Windows 端：`npm run tauri:build` 输出新安装包。
   - Android 端：`apps/android/app/build/outputs/apk/debug/app-debug.apk`，如有签名配置再输出 release APK。

2. **Phase 0 是内部前置，不是用户验收版本**
   - Phase 0 目标是冻结协议、打通 skeleton、避免后续返工。
   - 用户可验收的一期是 Phase 1 完成后。

3. **手机端一期只读**
   - 不调用 `resolve_claude_pending_intent`。
   - 不发送 intentId / allowedIntents / nonce 到手机。
   - 不做 allow / deny / answer / terminal jump。

4. **真实局域网传输必须加密**
   - 默认执行路线：WSS + 自签证书 + SPKI fingerprint pinning + Android Keystore 设备签名。
   - 如 spike 失败，记录原因后再切到成熟 Noise/ECDH/AEAD。

5. **Mobile ViewModel 是协议边界**
   - PC Rust 后端生成 `MobileHudViewModel`。
   - Android 只消费 Mobile DTO，不消费 Desktop / CurrentSessionState 原始 DTO。

6. **每完成代码修改必须打包**
   - PC 端代码修改完成后必须 `npm run tauri:build`。
   - Android 端代码修改完成后必须 `apps/android/gradlew.bat :app:assembleDebug`。

7. **Claude 必须自动执行到自验收完成**
   - 不能把半成品安装包直接交给用户试错。
   - 后续实现时，Claude 要从 Phase 0 到 Phase 1C 自己连续推进：编码、构建、运行、联调、截图、自动化测试、手工模拟验收、修复问题、重新验证。
   - 只有当 PC 端、Android 端、配对链路、通知链路、Desktop HUD 信息映射、安装包构建全部自测通过后，才停止任务并让用户安装 APK / Windows 安装包做最终人工体验。

8. **优先用自动化和可观测证据替代用户反复安装测试**
   - PC 设置页和 Desktop/Mobile debug 页面要用 Playwright 自动点击、截图和断言。
   - Android 端要优先用 Gradle unit tests、Compose UI tests、emulator/adb 自动化、截图或录屏验证主要页面。
   - 真机不可用时，必须用 Android Emulator + mock PC server 先完成自动化验收，并清楚标注哪些只能等用户真机最终确认。

---

## 1. Phase 0：一期前置工程

### 1.1 协议与加密 spike

目标：冻结一期传输安全方案。

- [ ] 在 Rust 侧验证 `tokio + axum + rustls/tokio-rustls + rcgen` 能启动本机 WSS 服务。
- [ ] 在 Android/OkHttp 侧验证自签证书 SPKI pinning 能连接 WSS。
- [ ] 验证局域网 IP 变化时 pinning 策略是否仍可用。
- [ ] 定义 PC server certificate / key 存储路径。
- [ ] 定义证书轮换策略：fingerprint 变化必须重新配对。
- [ ] 验证 Android Keystore 生成设备签名密钥可用。
- [ ] 选定设备签名算法：优先 P-256 ECDSA；如 Rust/Android 对接不顺，再评估 Ed25519/应用层密钥。
- [ ] 输出最终决策：WSS pinning / Noise 只能选一个进入 Phase 1。

产物：

- [ ] `docs` 或报告中记录最终加密选型。
- [ ] 最小 WSS demo 或 spike 代码可删除，但结论必须沉淀。

阻塞条件：

- [ ] WSS pinning 在 Android 真机不可稳定实现。
- [ ] Rust TLS 依赖导致 Tauri build 无法通过。

---

### 1.2 Mobile HUD DTO 与 fixtures

目标：先定义协议 DTO，不先做网络。

- [ ] 新建 Rust 模块：`src-tauri/src/window/mobile_hud/`。
- [ ] 新建 `types.rs`：定义 `MobileHudViewModel`、`MobileHudEnvelope`、`MobileHudSessionCard`、`MobileHudAttentionItem`、`MobileHudNotificationEvent`。
- [ ] 新建 `snapshot.rs`：实现 `ClaudeStatusBridgeState + LiveUsageCostSnapshot + AppSettings -> MobileHudViewModel` 纯函数。
- [ ] 显式 drop 敏感字段：`transcriptPath`、`projectDir`、`cwd`、terminal metadata、intentId、allowedIntents、nonce、raw input/output。
- [ ] 加 `protocolVersion`、`snapshotVersion`、`snapshotId`、`generatedAt`。
- [ ] 加 `displayPolicy`：visibleItems、hiddenByDesktopConfig、terminalJump、通知开关。
- [ ] 加 `dedupeKey`：attention / completion / error / connection。
- [ ] 建 fixtures 目录：`schemas/mobile-hud/fixtures/`。
- [ ] 生成 fixtures：running、multi-session、waiting-approval、waiting-question、completion、error、revoked、unknown-enum。

验收：

- [ ] Rust 单测能序列化所有 fixtures。
- [ ] JSON 中不含敏感字段关键字。
- [ ] unknown enum fixture 为 Android fallback 预留。

---

### 1.3 Settings 和配置迁移 skeleton

目标：让 PC 设置结构先具备 mobileHud 字段。

- [ ] 修改 `src-tauri/src/window/settings.rs`：`AppSettings` 增加 `mobile_hud`，带 serde default。
- [ ] 定义 `default_mobile_hud()`。
- [ ] 考虑是否新增 `settingsVersion` 或 `mobile_hud.version`。
- [ ] 修改 `src/app/types.ts`：`SettingsState` 增加 `mobileHud`。
- [ ] 修改前端默认 settings / merge 逻辑。
- [ ] 新增 `src/app/mobileHudBridge.ts`，先封装 mock/null invoke。
- [ ] 新增 `MobileHudPanel` 空壳 UI。
- [ ] `SettingsView.tsx` 增加 `mobile` tab。

验收：

- [ ] 旧 settings 文件缺少 mobileHud 时 App 正常启动。
- [ ] 修改 mobileHud 开关后 settings 能保存。
- [ ] `npm run build` 通过。

---

### 1.4 Android 空壳工程

目标：先能构建 APK，并解析 fixtures。

- [ ] 创建 `apps/android/`。
- [ ] 配置 Gradle Wrapper。
- [ ] 配置 `settings.gradle.kts`、根 `build.gradle.kts`、`app/build.gradle.kts`。
- [ ] 设置 `namespace = "com.claudehud.one.mobile"`。
- [ ] 设置 `applicationId = "com.claudehud.one.mobile"`。
- [ ] 设置 `minSdk = 26`。
- [ ] 设置 compile/target SDK 为本机可用稳定版本。
- [ ] 引入 Compose、Material3、Navigation、Lifecycle、serialization。
- [ ] 建立基础页面：Pairing / Live HUD / Sessions / Attention / Settings。
- [ ] 添加 fixture JSON 到 androidTest 或 test resources。
- [ ] 实现 Kotlin DTO 并解析 fixtures。

验收：

- [ ] `apps/android/gradlew.bat :app:assembleDebug` 通过。
- [ ] `apps/android/gradlew.bat :app:testDebugUnitTest` 通过。
- [ ] 产出 `apps/android/app/build/outputs/apk/debug/app-debug.apk`。

---

## 2. Phase 1A：PC Mobile HUD 服务

### 2.1 Rust service runtime

- [ ] 定义 `MobileHudRuntime` managed state。
- [ ] 在 `src-tauri/src/window/mod.rs` 导出 mobile_hud 模块。
- [ ] 在 `src-tauri/src/lib.rs` 注册 managed state。
- [ ] 实现 service 状态：Disabled / Starting / Listening / Pairing / Connected / Failed / Stopping。
- [ ] 实现 start / stop / restart。
- [ ] 实现 shutdown channel。
- [ ] 实现 App exit graceful shutdown。
- [ ] settings 保存后 reconcile service。
- [ ] 端口占用进入 Failed。

验收：

- [ ] start 不阻塞 Tauri 主线程。
- [ ] stop 后端口释放。
- [ ] 重复 start 不启动多个服务。
- [ ] App 退出无残留进程/端口。

---

### 2.2 WSS / WebSocket 服务

- [ ] 添加 Rust 依赖：tokio、axum、rustls/tokio-rustls、rcgen、uuid、rand、sha2、base64、time、p256/ecdsa、zeroize。
- [ ] 实现 WSS listener。
- [ ] 实现 `/health` 最小 OK，不泄露版本和状态。
- [ ] 实现 `/pairing/claim` 或 WSS pairing path。
- [ ] 实现 `/ws` 认证后连接。
- [ ] 实现 heartbeat。
- [ ] 实现 envelope seq。
- [ ] 实现 snapshot full push。
- [ ] 实现 notification event push。

验收：

- [ ] 未认证连接不能读 snapshot。
- [ ] `/health` 不泄露敏感信息。
- [ ] heartbeat 超时能断开。
- [ ] snapshot 变化可推送到 mock client。

---

### 2.3 Pairing 与设备注册

- [ ] 实现 pairing offer：pairingId、oneTimeToken、issuedAt、expiresAt、nonce、host、port、serverFingerprint。
- [ ] 实现二维码 payload 生成。
- [ ] 实现配对链接生成：`claudehud://pair?...`。
- [ ] pairing token 默认 60 秒过期。
- [ ] token 用后失效。
- [ ] token 重放失败。
- [ ] 同一 pairingId 只允许一个 pending candidate。
- [ ] PC UI 显示待确认设备：deviceName、appVersion、IP、publicKey fingerprint。
- [ ] 用户允许后写入 `mobile-devices.json`。
- [ ] 用户拒绝后关闭 pairing。
- [ ] 实现 revoke：断开连接、标记 revoked、拒绝后续连接。

验收：

- [ ] 过期二维码不能配对。
- [ ] 重放 token 失败。
- [ ] 多设备抢同一二维码只允许一个 pending。
- [ ] PC 未确认前 Android 不收到 snapshot。
- [ ] revoke 后 Android 断开并回到配对页。

---

### 2.4 Bridge 状态聚合与通知事件

- [ ] Rust 定时读取 APPDATA 和项目 bridge state。
- [ ] 复用/抽取 `get_claude_status_bridge_sessions`。
- [ ] 生成 `MobileHudViewModel`。
- [ ] 生成 attention notification event。
- [ ] 生成 completion notification event。
- [ ] 生成 error notification event。
- [ ] 实现 event dedupe cache。
- [ ] completion 推断实现 busy → settled + TTL 90s。
- [ ] snapshot 推送和 notification event 分离。

验收：

- [ ] waiting approval 只通知一次。
- [ ] waiting question 只通知一次。
- [ ] completion 不重复刷通知。
- [ ] connection 抖动不刷屏。

---

### 2.5 PC 设置页 UI

- [ ] `MobileHudPanel` 实现服务开关。
- [ ] 显示服务状态。
- [ ] 显示 IP/端口。
- [ ] 显示加密状态和 server fingerprint。
- [ ] 显示二维码。
- [ ] 复制配对链接。
- [ ] 显示 pending device confirmation。
- [ ] 允许/拒绝设备。
- [ ] 已授权设备列表。
- [ ] 撤销设备。
- [ ] 网络诊断：候选 IP、多网卡、端口占用、最近错误、防火墙说明。

验收：

- [ ] UI smoke 能打开 Mobile HUD tab。
- [ ] 可以启动/停止服务。
- [ ] 可以复制配对链接。
- [ ] 可以 revoke device。

---

## 3. Phase 1B：Android App 实现

### 3.1 Manifest、权限、Deep Link

- [ ] `INTERNET` 权限。
- [ ] `CAMERA` 权限，扫码时请求。
- [ ] Android 13+ `POST_NOTIFICATIONS` 权限，开启通知时请求。
- [ ] 配置 `claudehud://pair` intent-filter。
- [ ] 设置 Activity `android:exported`。
- [ ] URI parser 校验 host、port、pairingId、token、fingerprint、expires。
- [ ] 支持 JSON payload 粘贴 fallback。
- [ ] 禁止完整 URI/token 进日志。

验收：

- [ ] 从二维码进入 Pairing 页面。
- [ ] 从链接打开 App。
- [ ] 过期/缺字段链接有错误提示。

---

### 3.2 Android 凭据与配对

- [ ] Android Keystore 生成设备密钥。
- [ ] DataStore 保存非敏感 paired PC 信息。
- [ ] Pairing 页面展示 PC 信息。
- [ ] 等待 PC 确认状态。
- [ ] PC 授权成功后进入 Connecting。
- [ ] PC 拒绝/过期后显示失败。
- [ ] 删除配对时清除本地凭据。

验收：

- [ ] App 重装/清数据后需要重新配对。
- [ ] PC revoke 后本地授权失效。

---

### 3.3 Android 网络连接

- [ ] OkHttp WebSocket/WSS client。
- [ ] SPKI fingerprint pinning。
- [ ] 设备签名 challenge-response。
- [ ] envelope 解析。
- [ ] snapshot 更新 StateFlow。
- [ ] notification event 处理。
- [ ] heartbeat 监控。
- [ ] 前台重连指数退避。
- [ ] revoked / unauthorized / version mismatch 处理。

验收：

- [ ] PC 服务断开后 App 显示 offline。
- [ ] PC 恢复后可重连。
- [ ] fingerprint mismatch 拒绝连接。
- [ ] version mismatch 显示升级提示。

---

### 3.4 Compose UI

- [ ] 建立 App theme：深色、Claude 橙色、HUD 卡片风格。
- [ ] Pairing 页面。
- [ ] Live HUD 首页。
- [ ] Capsule 组件。
- [ ] Clawd/状态图标组件。
- [ ] Ticker 摘要组件。
- [ ] Sessions 页面。
- [ ] SessionCard 组件。
- [ ] Attention 页面。
- [ ] Approval readonly card。
- [ ] Question readonly card。
- [ ] Completion card。
- [ ] Settings/Diagnostics 页面。

验收：

- [ ] App 内能展示 Desktop HUD 等价信息。
- [ ] 多会话列表可读。
- [ ] Attention 优先级正确。
- [ ] 不出现允许/拒绝/提交按钮。

---

### 3.5 Android 通知

- [ ] 创建 channel：attention、task_status、connection。
- [ ] 请求通知权限。
- [ ] waiting 通知。
- [ ] completion 通知。
- [ ] error 通知。
- [ ] connection lost/reconnected 通知。
- [ ] 通知低敏文案。
- [ ] 通知点击打开对应页面。
- [ ] 通知去重。
- [ ] 锁屏 `VISIBILITY_PRIVATE`。

验收：

- [ ] Android 13+ 拒绝权限后 App 前台仍可用。
- [ ] 通知不显示项目名/工具参数/命令/路径/prompt。
- [ ] 同一 pending 不重复通知。

---

## 4. Phase 1C：集成、验证与打包

### 4.1 PC 测试命令

- [ ] `npm run build`
- [ ] `npm run ui`
- [ ] Rust tests：增加并运行 mobile_hud 相关测试。
- [ ] `npm run tauri:build`

### 4.2 Android 测试命令

```powershell
cd E:\Develop_E\claude-hud-one\apps\android
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:lintDebug
```

### 4.3 自动化联调验收

先用自动化和模拟链路完成自测，不能直接依赖用户安装测试：

- [ ] 启动 PC Mobile HUD mock/debug server，输出固定 fixtures。
- [ ] 用 Playwright 打开 Settings → Mobile HUD，自动点击开关、生成二维码、复制配对链接、查看设备列表、撤销设备，并保存截图。
- [ ] 用 Playwright 或脚本验证 Mobile HUD debug snapshot 页面：running、multi-session、waiting-approval、waiting-question、completion、error、revoked fixtures 均可渲染。
- [ ] 用命令行 WebSocket/WSS client 验证 pairing、认证、snapshot、notification、heartbeat、revoke envelope。
- [ ] 用 Android unit tests 解析全部 contract fixtures。
- [ ] 用 Android emulator 或 connected device 自动安装 `app-debug.apk`。
- [ ] 用 adb/deeplink 打开 `claudehud://pair?...`，验证进入 Pairing 页面。
- [ ] 用 Compose UI test 或 Maestro/adb 自动化点击 Pairing、Live HUD、Sessions、Attention、Settings 页面。
- [ ] 用 Android 截图/录屏保存关键页面：Pairing、Live HUD、Sessions、Attention、通知权限、Diagnostics。
- [ ] 用 adb 模拟或真机观察通知：waiting、completion、error、connection lost/reconnected。
- [ ] 自动化验证通知不包含项目名、路径、命令、prompt、tool input/result。

### 4.4 E2E 真机验收

自动化验收通过后，再做真机/真实安装包验收：

- [ ] PC 安装新 Windows 安装包并启动。
- [ ] PC 开启 Mobile HUD。
- [ ] Android 安装 `app-debug.apk` 或 release APK。
- [ ] Android 扫码配对。
- [ ] Android 使用配对链接配对。
- [ ] Android 使用手动 IP:Port fallback 配对。
- [ ] PC 确认设备。
- [ ] Android 显示 Live HUD。
- [ ] Claude Code running 状态 1-3 秒更新。
- [ ] pending approval/question 出现 Attention 和通知。
- [ ] completion 出现卡片和通知。
- [ ] error 出现通知。
- [ ] PC revoke 后 Android 断开。
- [ ] 防火墙拦截时诊断有效。
- [ ] 卸载/重装后配对状态符合预期。

### 4.5 自主修复循环

任何验收失败都不能交给用户处理，必须由 Claude 自己进入修复循环：

1. 记录失败命令、截图、日志和复现步骤。
2. 定位是 PC、Android、协议、网络、通知、UI 还是打包问题。
3. 修改代码或配置。
4. 重新运行对应最小测试。
5. 重新运行完整自动化验收。
6. 重新构建 Windows 安装包和 Android APK。
7. 更新工作日志和执行计划状态。

只有全部自动化验收和可执行真机/模拟验收通过，才进入“交付用户安装测试”。

### 4.6 交付前停止条件

Claude 只能在满足以下条件后停止开发任务并让用户安装测试：

- [ ] `npm run build` 通过。
- [ ] `npm run ui` 通过。
- [ ] mobile_hud Rust tests 通过。
- [ ] `npm run tauri:build` 通过，并记录 Windows 安装包路径。
- [ ] `apps/android/gradlew.bat :app:assembleDebug` 通过，并记录 APK 路径。
- [ ] `apps/android/gradlew.bat :app:testDebugUnitTest` 通过。
- [ ] `apps/android/gradlew.bat :app:lintDebug` 通过，或明确 lint 剩余项不影响一期。
- [ ] PC Mobile HUD 设置页自动截图通过。
- [ ] Android 主要页面截图/录屏通过。
- [ ] Pairing / snapshot / notification / revoke 协议自动验收通过。
- [ ] 通知低敏检查通过。
- [ ] 工作日志记录所有验证命令、结果、产物路径、未能自动验证的少数事项。

### 4.7 产物

- [ ] Windows 安装包路径记录。
- [ ] Android debug APK 路径记录。
- [ ] release APK 如有签名则记录。
- [ ] 工作日志记录测试结果。
- [ ] 如用户要求，提交并推送。

---

## 5. 当前执行状态

- [x] Phase 0 已完成：2026-06-17 已完成协议/DTO/settings/fixtures/Android 空壳工程，并完成 PC、Android、emulator 自验收。
- [x] Phase 1A 已完成主要实现：PC MobileHudRuntime、WSS listener、health/snapshot/ws、pairing claim、device registry、Settings 服务控制已落地；未认证 snapshot/ws 已拒绝。
- [x] Phase 1B 已完成可自动验证实现：Android deeplink parser、P-256 Keystore 设备密钥、OkHttp WSS client skeleton、自签证书 SPKI pinned trust manager、Live/Sessions/Attention/Diagnostics 只读 UI、低敏通知文案与 channel 已落地。
- [x] Phase 1C 自动化验证已完成：PC/Android build、Rust/Android/unit/lint/Playwright、Tauri 打包、release exe autoStart health smoke、emulator UI/deeplink 截图均通过；真实手机 Wi-Fi/系统通知仍属于最终人工体验范围。

### 5.1 2026-06-17 Phase 0 执行记录

已完成：

- [x] 新增 Rust `mobile_hud` 模块：证书/SPKI fingerprint 工具、Mobile HUD DTO、snapshot envelope、敏感字段检查单测。
- [x] 新增 `get_mobile_hud_snapshot` 与 `get_mobile_hud_security_preview` Tauri command。
- [x] 新增 `schemas/mobile-hud/fixtures/`，覆盖 running、multi-session、waiting-approval、waiting-question、completion、error、connection-lost、revoked、unknown-enum。
- [x] `AppSettings` / `SettingsState` / store merge / mock data 增加 `mobileHud`。
- [x] 新增 Settings → 移动 HUD tab 和 `MobileHudPanel`，可保存一期配置地基。
- [x] 新增 `apps/android/` Kotlin/Compose 空壳工程、Deep Link manifest、Mobile HUD Kotlin DTO、fixture 解析单测、OkHttp SPKI pinning 单测。
- [x] 新增 `scripts/android-gradle.ps1`、`npm run ui` 与 `npm run test:rust:mobile`，便于按计划运行验收命令。
- [x] 在项目内 `.tools/` 准备 JDK 17、Gradle 8.7、Android SDK API 34、build-tools、platform-tools、emulator 和 default x86_64 system image；`.tools/` 不入库。
- [x] 更新 `.gitignore`、`.claude/workspace-index.md`、工作日志索引。

已验证：

- [x] `npm run build` 通过。
- [x] `npm run ui` 通过，并生成 Mobile HUD 设置页截图：`artifacts/screenshots/05-mobile-hud-settings.png`。
- [x] `npm run test:rust` 通过，其中 mobile_hud 6 个单测通过。
- [x] `cargo check --manifest-path src-tauri/Cargo.toml -j 1` 通过。
- [x] `npm run tauri:build` 通过，Windows 安装包路径：`src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。
- [x] `scripts/android-gradle.ps1 :app:testDebugUnitTest` 通过。
- [x] `scripts/android-gradle.ps1 :app:lintDebug` 通过。
- [x] `scripts/android-gradle.ps1 :app:assembleDebug` 通过，APK 路径：`apps/android/app/build/outputs/apk/debug/app-debug.apk`。
- [x] Android emulator 安装 APK、未配对首页 UI dump 断言、deeplink 打开、token/fingerprint 脱敏断言通过。
- [x] Android 关键截图：`artifacts/screenshots/android-mobile-hud-unpaired-shell.png`、`artifacts/screenshots/android-mobile-hud-pairing-shell.png`。

阻塞/未完成：

- [x] Phase 1A 真实 WSS listener、pairing runtime、设备注册、revoke、snapshot/notification push 主要实现已落地；release autoStart `/health` smoke 已通过。
- [~] Android 真机扫码、真实局域网、防火墙提示和系统通知实际弹出仍需最终真机验收；当前 emulator/unit/lint/assemble 已覆盖可自动验证部分。

当前执行原则：继续进入 Phase 1A，先实现 PC Mobile HUD runtime 和可自动测试的本机 WSS/mock 服务，再接真实配对 UI；不要让用户安装包测试。

### 5.2 2026-06-17 Phase 1A/1B 执行记录

已完成：

- [x] PC 端新增 `MobileHudRuntime` managed state，支持 Disabled / Starting / Listening / Pairing / Connected / Failed / Stopping、start/stop/restart、settings 保存后 reconcile、连接计数和 graceful shutdown channel。
- [x] PC 端新增 WSS 服务：`/health`、`/snapshot`、`/pairing/claim`、`/ws`；服务绑定 `0.0.0.0` 并优先广告 LAN IPv4；自签证书 SAN 包含 LAN IP、127.0.0.1、localhost；rustls 切到 `ring` provider，避免 release 打包依赖 `aws-lc-sys` 本机 C 编译环境。
- [x] `/snapshot` 和 `/ws` 已要求 approved 且未 revoked 的 `deviceId`，未认证请求返回 401，不发送 Mobile HUD snapshot。
- [x] PC pairing/device registry：生成 one-time pairing offer、deeplink/QR payload、token hash 持久化、token 用后移除、pending device、approve/revoke、device public key hash、registry 持久化到 APPDATA mobile-hud 目录。
- [x] Settings → Mobile HUD：显示服务状态、WSS endpoint、SPKI 指纹、连接数、start/stop/restart、生成配对载荷、pending/device 数量、approve/revoke 设备；UI 不打印完整 token/fingerprint。
- [x] Android：新增严格 deeplink parser、sanitized summary、OkHttp WSS client skeleton、pairing claim request、P-256 Android Keystore 设备密钥、self-signed SPKI pinned trust manager、WebSocket URL 不携带 token。
- [x] Android Compose：改为只读 Mobile HUD 页面，覆盖 Pairing、Live HUD、Sessions、Attention、Diagnostics、Privacy；不出现 allow/deny/answer/terminal jump。
- [x] Android 通知：新增 channel 定义、`VISIBILITY_PRIVATE`、低敏通知文案 sanitizer 和单测。

已验证：

- [x] `npm run build` 通过。
- [x] `npm run ui` 通过，10 个 Playwright/visual smoke tests passed，并覆盖 Mobile HUD 服务/配对设置区截图。
- [x] `npm run test:rust` 通过：usage_cost 5 个单测、mobile_hud 15 个单测通过。
- [x] `cargo check --manifest-path src-tauri/Cargo.toml -j 1` 通过；`cargo tree -i aws-lc-sys` 已显示不再匹配任何包。
- [x] `npm run tauri:build` 通过，Windows 安装包路径：`src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。
- [x] `scripts/android-gradle.ps1 :app:testDebugUnitTest` 通过，Android unit tests 14 个通过。
- [x] `scripts/android-gradle.ps1 :app:lintDebug` 通过。
- [x] `scripts/android-gradle.ps1 :app:assembleDebug` 通过，APK 路径：`apps/android/app/build/outputs/apk/debug/app-debug.apk`。
- [x] Android emulator 重新创建 `ClaudeHudOneApi34` AVD 后安装 APK，未配对首页、配对 deeplink、Live/Sessions/Attention 可见；UI dump 验证未出现完整 token/fingerprint；截图：`artifacts/screenshots/android-mobile-hud-live-shell.png`、`artifacts/screenshots/android-mobile-hud-pairing-live.png`。

已补充验证：

- [x] release exe + 隔离 APPDATA + BOM-free `settings.json` + `mobileHud.enabled/autoStart=true` 自动 `/health` smoke 通过：`https://127.0.0.1:27431/health` 返回 mobileHud OK；未认证 `/snapshot` 返回 401；原已安装 Claude HUD One 进程已恢复。

仍需最终人工体验：

- [ ] 真实手机 Wi-Fi 扫码、系统通知实际弹出、PC revoke 后 Android 真链路断开；当前已用 emulator、unit tests、release smoke 和协议边界测试覆盖可自动验证部分。
