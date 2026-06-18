# Android 手机 HUD 一期实现

- 需求人：Dec27-Lee <lipengyue31@163.com>
- 原始需求：按照 `local/需求讨论/2026-06-17-claude-hud-one-android-mobile-hud-一期开发执行计划.md` 开始执行 Android 手机 HUD 一期开发，从 Phase 0 的协议与加密 spike、Mobile HUD DTO、Settings skeleton、Android 空壳工程开始，后续按计划推进到 PC/Android 联调、自动化验收和打包。
- 范围：
  - 本轮做：启动一期实现工作；先执行 Phase 0，建立协议/DTO/settings/Android 工程地基；过程中按计划使用自动化验证，不能把半成品交给用户安装试错。
  - 本轮不做：不跳过 Phase 0 直接做 Android UI；不开放手机端 allow/deny/answer/terminal jump；不提交/推送，除非用户另行要求。
  - 待确认：Android release 签名证书、真机/模拟器可用性、WSS pinning 若遇到系统限制是否切换到 Noise/ECDH/AEAD。
- 计划：
  1. 检查当前工作树、Git 身份和既有未提交文档状态，避免覆盖用户改动。
  2. 并行梳理 PC/Tauri 状态链路、前端 settings/types、Android 工程落地方式和协议加密依赖风险。
  3. 执行 Phase 0.1：验证并冻结 WSS pinning / 备选 Noise 的可实现路线，沉淀结论。
  4. 执行 Phase 0.2：新增 Mobile HUD Rust DTO、snapshot 纯函数和 contract fixtures，并加敏感字段检查测试。
  5. 执行 Phase 0.3：新增 PC settings mobileHud skeleton 和前端 Settings Mobile HUD 空壳。
  6. 执行 Phase 0.4：创建 Android 空壳工程，至少能构建 debug APK 并解析 fixtures。
  7. 阶段完成后运行对应构建/测试，失败则自主修复循环，并回写执行计划与工作日志。
- 进展：
  - 2026-06-17 已按用户要求启动实现阶段。
  - 2026-06-17 已确认当前工作树已有上一轮文档未提交修改；本轮将在其基础上继续开发，不自动提交/推送。
  - 2026-06-17 Phase 0 PC 地基：新增 `src-tauri/src/window/mobile_hud/`，包含证书/SPKI fingerprint 工具、Mobile HUD DTO、snapshot envelope、敏感字段检查单测；新增 `get_mobile_hud_snapshot` 与 `get_mobile_hud_security_preview` Tauri command。
  - 2026-06-17 Phase 0 contract fixtures：新增 `schemas/mobile-hud/README.md` 和 `schemas/mobile-hud/fixtures/*.json`，覆盖 running、multi-session、waiting-approval、waiting-question、completion、error、connection-lost、revoked、unknown-enum。
  - 2026-06-17 Phase 0 settings skeleton：`AppSettings` / `SettingsState` / store merge / mock data 增加 `mobileHud`；新增 `src/components/settings/MobileHudPanel.tsx`、Settings → 移动 HUD tab、`src/app/mobileHudBridge.ts`。
  - 2026-06-17 Phase 0 Android 空壳：新增 `apps/android/` Kotlin/Compose 子工程、Gradle Wrapper、Deep Link manifest、Mobile HUD Kotlin DTO 和 fixture 解析单测。
  - 2026-06-17 验证通过：`npm run build`；`npm run ui`；`npm run test:rust`；`cargo check --manifest-path src-tauri/Cargo.toml -j 1`；`npm run tauri:build`。
  - 2026-06-17 Windows 安装包已生成：`src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。
  - 2026-06-17 Android 构建环境：用户授权接受 Android SDK License 后，已在项目内 `.tools/` 准备 JDK 17、Gradle 8.7、Android SDK command-line tools、platform-tools、API 34、build-tools、emulator 和 default x86_64 system image；`.tools/` 已加入 `.gitignore`。
  - 2026-06-17 Android 验证通过：`scripts/android-gradle.ps1 :app:testDebugUnitTest`、`:app:lintDebug`、`:app:assembleDebug` 均通过；APK 产物：`apps/android/app/build/outputs/apk/debug/app-debug.apk`。
  - 2026-06-17 Android emulator 自验收通过：创建 `ClaudeHudOneApi34` AVD，安装 APK，验证未配对首页、`claudehud://pair?...` deeplink、UI dump 断言和 token/fingerprint 脱敏；截图：`artifacts/screenshots/android-mobile-hud-unpaired-shell.png`、`artifacts/screenshots/android-mobile-hud-pairing-shell.png`；模拟器已关闭。
  - 2026-06-17 Android SPKI pinning 地基：新增 OkHttp `CertificatePinner` 构建与匹配/拒绝单测，验证 `sha256/<base64>` SPKI pinning 格式和 mismatch 拒绝。
  - 2026-06-17 Phase 1A PC 服务：新增 `MobileHudRuntime` managed state、WSS listener、`/health`、`/snapshot`、`/pairing/claim`、`/ws`、heartbeat/周期 snapshot push、未认证 snapshot/ws 拒绝、LAN IPv4 广告、settings reconcile、start/stop/restart Tauri commands。
  - 2026-06-17 Phase 1A pairing/device registry：新增 one-time pairing offer、deeplink/QR payload、token hash 持久化、pairing claim、pending device、approve/revoke、device public key hash 和 APPDATA mobile-hud registry；Settings Mobile HUD 页接入服务控制、配对载荷和设备列表。
  - 2026-06-17 Phase 1B Android：新增严格 deeplink parser、sanitized summary、P-256 Android Keystore 设备密钥、OkHttp WSS client skeleton、自签证书 SPKI pinned trust manager、pairing claim request、只读 Live/Sessions/Attention/Diagnostics UI、低敏通知 channel/text sanitizer。
  - 2026-06-17 release 打包修复：`axum-server` 改用 `tls-rustls-no-provider` + `rustls` ring provider，解决 `aws-lc-sys` release 编译依赖 MSVC INCLUDE 环境导致 `npm run tauri:build` 失败的问题。
  - 2026-06-17 Phase 1A/1B 验证通过：`npm run build`、`npm run ui`、`npm run test:rust`、`cargo check --manifest-path src-tauri/Cargo.toml -j 1`、`npm run tauri:build`、`scripts/android-gradle.ps1 :app:testDebugUnitTest`、`:app:lintDebug`、`:app:assembleDebug`。
  - 2026-06-17 Android emulator 自验收更新：重建 `ClaudeHudOneApi34` AVD，安装 APK，验证未配对首页、配对 deeplink、Live/Sessions/Attention 文案、token/fingerprint 不出现在 UI dump；截图：`artifacts/screenshots/android-mobile-hud-live-shell.png`、`artifacts/screenshots/android-mobile-hud-pairing-live.png`。
  - 2026-06-17 PC release smoke：使用 release exe + 隔离 APPDATA + BOM-free `settings.json` + `mobileHud.enabled/autoStart=true` 验证通过，`https://127.0.0.1:27431/health` 返回 mobileHud OK，未认证 `/snapshot` 返回 401；已恢复原已安装 Claude HUD One 进程。
  - 2026-06-17 用户安装反馈修复：用户反馈“不知道怎么配对、手机 APP 不能操作且英文过多”后，已补 PC 设置页显式配对步骤、复制完整配对链接按钮与复制成功提示；Android 改为中文界面，新增“粘贴配对链接”输入框和“提交配对请求”按钮，提交时生成 Android Keystore 公钥并向 PC `/pairing/claim` 发起请求，失败时给中文网络/过期/服务未启动提示。
  - 2026-06-17 用户反馈修复验证：`npm run build`、`npm run ui`、`npm run tauri:build`、`scripts/android-gradle.ps1 :app:testDebugUnitTest`、`:app:lintDebug`、`:app:assembleDebug` 均通过；emulator 安装新版 APK 并截图 `artifacts/screenshots/android-mobile-hud-zh-pairing.png`，UI dump 验证中文配对入口可见。
  - 2026-06-17 真机 pinning 失败修复：用户真机提交配对时报 `Certificate pinning failure`；原因是 Android 端同时使用自定义 SPKI trust manager 和 OkHttp `CertificatePinner`，双重 pinning 在自签证书链上仍触发 CertificatePinner 失败。已移除 OkHttp `CertificatePinner`，保留自定义 trust manager 对服务端证书 SPKI 指纹做唯一校验，仍保持 pinned self-signed TLS 安全边界。
  - 2026-06-17 pinning 修复验证：`scripts/android-gradle.ps1 :app:testDebugUnitTest`、`:app:lintDebug`、`:app:assembleDebug`、`npm run tauri:build` 均通过；新版 APK 已输出到 `apps/android/app/build/outputs/apk/debug/app-debug.apk`。
  - 2026-06-17 PC 批准后手机无变化修复：用户反馈 PC 端批准连接后手机端仍无变化；根因是 Android 端只提交 pairing claim，不解析/保存 PC 返回的 `deviceId`，也不会在 PC 批准后用 `deviceId` 连接 `/snapshot`/`/ws`，Compose UI 仍停留在静态 preview。
  - 2026-06-17 Android 批准后连接链路：新增 pairing claim response 解析、`MobileHudConnectionConfig` 构建、授权 `/snapshot?deviceId=...` 拉取、等待 PC 批准轮询、批准后 WSS 连接和实时 snapshot 驱动 Compose UI；WebSocket 回调切回主线程更新状态，仍不在 URL 中携带 token/fp。
  - 2026-06-17 批准后连接链路验证：新增 Android 单测覆盖 `deviceId` 解析、连接配置和 snapshot 请求不泄露 token/fp；`scripts/android-gradle.ps1 :app:testDebugUnitTest`、`:app:lintDebug`、`:app:assembleDebug`、`npm run tauri:build` 均通过；新版 APK 与 Windows 安装包已重新输出。
  - 2026-06-17 待下次修复的 Android 已连接 UI 问题：用户真机确认“连接了，也能展示信息”，但当前 Android 端只是把 Mobile DTO 用文本卡片堆叠展示；连接前/连接后没有明显界面区分，已连接后仍显示配对卡和完整配对链接输入框，会话/关注项未做移动端信息密度控制、去重、折叠、截断，也不像 Desktop HUD/CodeIsland 风格动态展示会话状态。
  - 2026-06-17 下次建议改法：连接前只保留配对引导；连接后隐藏配对区和完整链接，改为移动端动态岛/胶囊头部、会话摘要卡、关注项去重限量、指标 chips、低优先级诊断折叠；继续保持手机端只读，不提供 allow/deny/answer/terminal jump。
- 检查：
  - 需求覆盖：已完成可自动验证的一期实现。Phase 0、Phase 1A 主要代码、Phase 1B 可自动验证代码、Phase 1C 构建/打包/release smoke/emulator 验收均已完成；真实手机 Wi-Fi 扫码、系统通知实际弹出、PC revoke 后 Android 真链路断开仍属于最终人工体验/真机验收。
  - 产物明确：新增/修改 Rust mobile_hud runtime/pairing/snapshot/types/certificate、PC settings skeleton、Mobile HUD 设置页和 bridge、contract fixtures、Android PairingLink/Client/DeviceKeys/Notifications/Compose UI、Android 本地构建脚本、UI/Rust/Android 测试、工作区索引和执行计划状态。
  - 验证情况：PC 前端构建、UI smoke、Rust usage/mobile_hud 单测、cargo check、Tauri 打包、release exe `/health` smoke、Android unit/lint/APK、emulator 安装/deeplink/UI dump/screenshot 均已通过。
  - 风险/待确认：真实局域网防火墙、真机扫码、后台通知权限、不同网卡 LAN IP 选择仍需最终人工体验确认；当前 emulator 验证不等价于真机 Wi-Fi 全链路。
  - 结论：已完成可自动验证部分，等待用户安装包/真机最终体验。
