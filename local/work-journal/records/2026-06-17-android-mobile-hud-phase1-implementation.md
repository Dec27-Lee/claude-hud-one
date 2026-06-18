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
  - 2026-06-18 移动端 UI/后台连接产品设计：根据用户要求，已在 `local/需求讨论/2026-06-18-claude-hud-one-android-mobile-hud-界面与后台连接优化方案.md` 补充产品设计方案。方案明确连接前/连接后拆成不同界面，连接前专注配对，连接后参考 Desktop HUD/CodeIsland 的动态胶囊、会话卡、关注项聚合和完成卡；同时把切换手机应用后断联列为后台连接设计问题，建议通过 Android Foreground Service、低敏常驻通知、连接配置持久化、断线重连状态机和电池优化提示解决。
  - 2026-06-18 开始按 UI/后台连接优化方案开发：Android 端新增 `MobileHudAppPhase` 和展示整理函数，将连接前 PairingScreen 与连接后 LiveHudScreen 分离；连接后隐藏完整配对链接，改用 Mobile Dynamic Island、会话摘要卡、关注项聚合、完成卡和折叠诊断；新增 attention 聚合、会话优先级排序、UUID/长文本压缩单测。
  - 2026-06-18 后台连接保活地基：新增 `MobileHudConnectionStore` 持久化 host/port/deviceId/SPKI 与后台保持开关，不保存 token/原始配对链接；新增 `MobileHudConnectionService` 前台服务，使用低敏常驻通知承载后台 WSS 连接与重连地基，并在 Manifest 增加 foreground service 权限和 dataSync service 声明。
  - 2026-06-18 UI/后台优化验证：`scripts/android-gradle.ps1 :app:testDebugUnitTest`、`:app:lintDebug`、`:app:assembleDebug`、`npm run tauri:build` 均通过；新版 APK 输出到 `apps/android/app/build/outputs/apk/debug/app-debug.apk`，Windows 安装包输出到 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。
  - 2026-06-18 真机样式反馈二次优化：用户截图反馈已连接界面虽然区分连接前后，但仍“不好看”、重点信息不突出、缺少 Desktop HUD 动态效果。已按 frontend-design 指导继续优化 Android Compose：Mobile Dynamic Island 增加发光边框、脉冲状态动效、Clawd 状态块、中文 headline 和重点指标；attention 卡改成更强视觉层级的橙色提醒卡；session 卡改为左侧状态轨道、标题/状态/摘要/chips 分层，减少日期、UUID 和英文噪音。
  - 2026-06-18 二次视觉优化验证：`scripts/android-gradle.ps1 :app:testDebugUnitTest`、`:app:lintDebug`、`:app:assembleDebug`、`npm run tauri:build` 均通过；APK 和 Windows 安装包已重新生成。受限于需要真机/真实 PC 配对数据，本轮未自动产出真机连接后截图，需用户安装新版 APK 后体验视觉效果。
  - 2026-06-18 Desktop HUD 对标返工：用户指出手机端数据范围和动态效果都没有真正参考桌面端。已并行梳理 Desktop HUD 的 `activeSurface` 仲裁、ticker/session formatter、pending approval/question、completion 和 Clawd 动效，并把 Android 从“静态卡片堆叠”改成更接近 Desktop 的移动端 surface：approval 优先于 question，completion 优先于 session list，多会话 ticker 4 秒轮播，session 排序对齐 `waiting > running > error > active > idle`，session 支持“全部/收起”。
  - 2026-06-18 Mobile DTO 数据范围补齐：Rust `ClaudeStatusBridgeState` 与 `MobileHudSessionCard` 增加 Desktop 已使用且低敏的展示字段，包括 active tool、permission mode、context window、cache tokens、git summary、added dirs、tools/agents/todos 计数、output speed、session time、last assistant response、thinking/effort；Rust `build_ticker` 生成 tools/git/addedDirs/agents/todos/speed/sessionTokens/effortLevel 等 display-safe ticker，Android 不再只硬编码 activity/model/context/usage/cost。
  - 2026-06-18 协议一致性修复：Android presentation/notification 改为兼容真实 Mobile DTO 的 `approval` / `question` / `waitingAttention`，保留旧 `waitingApproval` / `waitingQuestion` 兼容；相关单测改用真实协议值，避免等待授权/提问被当成普通“需要处理”。
  - 2026-06-18 Desktop 对标返工验证：`scripts/android-gradle.ps1 :app:testDebugUnitTest`、`npm run test:rust`、`scripts/android-gradle.ps1 :app:lintDebug`、`scripts/android-gradle.ps1 :app:assembleDebug`、`npm run tauri:build` 均通过；APK 和 Windows NSIS 安装包已重新生成。
  - 2026-06-18 真机反馈缺陷归因：用户反馈终端无确认但 HUD 显示工具授权、手机端状态延迟、手机显示 24 个会话但实际 3 个、桌面 HUD 点击会话无法定位终端。已并行定位根因：pendingQueue 在 statusLine 更新中保留 hook 残留；Mobile snapshot 未复用桌面端 10 分钟 freshness 过滤；Terminal Jump 过度依赖短生命周期 bridge PID 且多窗口同分标题匹配会放弃聚焦。
  - 2026-06-18 pendingQueue 与状态修复：`src-tauri/resources/claude-status-bridge.mjs` 和 `.claude/bridge/claude-status-bridge.mjs` 将 running hook hold 从 15 分钟降为 12 秒、approval/question TTL 降为 2/5 分钟，并在非 waiting 的 statusLine 更新中清空 stale pendingQueue；桌面 HUD 和 Mobile snapshot 增加 pending `expiresAt` 过期过滤，避免终端已无确认时继续显示授权提醒。
  - 2026-06-18 Mobile 会话 freshness 修复：`src-tauri/src/window/mobile_hud/snapshot.rs` 对齐桌面端 `bridgeIsFresh`，只把 10 分钟内更新的 bridge session 投影给手机端，并新增单测覆盖 stale session 被过滤、过期 pending attention 被丢弃，避免手机显示历史 24 个会话和旧 running 状态。
  - 2026-06-18 Terminal Jump 聚焦策略修复：`src-tauri/src/window/terminal_jump.rs` 默认策略改回 focus-only，不再隐式 openCwd；窗口标题匹配改为按完整 hint 加权并在同分时选择枚举顺序里最靠前的 Windows Terminal，避免多窗口同分直接失败；前端默认调用也改为 focus，并明确提示不会误开新终端。
  - 2026-06-18 真机反馈修复验证：`node --check src-tauri/resources/claude-status-bridge.mjs`、`node --check .claude/bridge/claude-status-bridge.mjs`、`npm run build`、`npm run test:rust`、`npm run ui`、`scripts/android-gradle.ps1 :app:testDebugUnitTest`、`:app:lintDebug`、`:app:assembleDebug`、`npm run tauri:build` 均已通过；首次 UI smoke 与 Tauri build 并发导致 4 个 page.goto 超时，停止后台任务后复跑 10/10 通过。Windows NSIS 安装包已重新生成。
  - 2026-06-18 复连与证书稳定修复：针对“手机退出重开后一直重连不上”，Android 冷启动改为读取本地连接配置后先启动前台服务，再主动拉取 `/snapshot?deviceId=...`，成功后立刻进入已连接并建立 UI WebSocket；失败时区分授权失效、证书 pin mismatch 和网络不可达；同时 PC Mobile HUD 服务改为复用既有证书/私钥并从私钥计算稳定 SPKI fingerprint，避免 PC 服务重启后手机端 pin 失效导致必须重新配对。
  - 2026-06-18 设备去重、删除与设置页交互修复：pairing claim 改为按设备公钥 hash upsert，同一台手机重复配对复用原 `deviceId`，revoked 设备再次配对会复用记录并回到待批准；新增 `delete_mobile_hud_device` Tauri command 和前端 bridge；Mobile HUD 设置页更新为设备卡片，区分待批准/已授权/已撤销，增加批准/拒绝/撤销授权/删除记录按钮，并加入 action-level loading、成功/失败状态提示和按钮 hover/active/focus 反馈。
  - 2026-06-18 Terminal Jump 绑定式定位：不再只靠短生命周期 bridge PID 或 Windows Terminal 标题猜测；新增本地 `terminal-bindings.json`，以 sessionKey/sessionId 的 hash 作为稳定键保存会话到 Windows Terminal HWND 的绑定；点击会话时优先聚焦已绑定 HWND，绑定失效时自动清理；找不到时可绑定最近/当前 Windows Terminal，后续点击走绑定窗口，不再用“找不到就新开终端”糊弄。
  - 2026-06-18 UI 测试稳定性修复：`scripts/test-ui.mjs` 在启动 Playwright 前预热 `@vite/client` 和 `/src/main.tsx`，避免 Vite cold transform 导致首个 `/` 页面 `page.goto` 等待 load 超时；修复后 `npm run ui` 10/10 通过。
- 检查：
  - 需求覆盖：已覆盖用户最新 3 个问题的可自动验证部分：手机 APP 重开恢复连接、PC 证书指纹稳定、同手机重复配对去重、设备删除和设置页交互反馈、Desktop HUD Terminal Jump 绑定式定位；仍需用户用真实手机/真实多窗口 Windows Terminal 布局做最终体验确认。
  - 产物明确：本轮修改 Android `MainActivity.kt`/`MobileHudClient.kt`，Rust `mobile_hud/certificate.rs`、`runtime.rs`、`pairing.rs`、`terminal_jump.rs` 和 `lib.rs`，前端 `mobileHudBridge.ts`、`overlayBridge.ts`、`DesktopHudRoot.tsx`、`SessionCard.tsx`、`MobileHudPanel.tsx`、`styles.css`，以及 UI 测试启动脚本 `scripts/test-ui.mjs`；APK 与 Windows NSIS 安装包已重新生成。
  - 验证情况：`npm run build`、`npm run test:rust`、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm run ui`、`scripts/android-gradle.ps1 :app:testDebugUnitTest`、`:app:lintDebug`、`:app:assembleDebug`、`npm run tauri:build` 已通过；`npm run ui` 首次因 Vite cold transform 在首个 `/` 页面超时，补预热后 10/10 通过。
  - 风险/待确认：Terminal Jump 的 HWND 绑定能解决“后续定位同一窗口”的稳定性，但首次绑定仍依赖最近/当前可见 Windows Terminal，且 Windows Terminal 仍没有公开 tab 级 API；如果同一 Windows Terminal 窗口内有多个 Claude tab，系统只能聚焦窗口，不能保证切到具体 tab。真实局域网防火墙、后台通知权限、电池策略和真机系统行为仍需最终人工体验确认。
  - 结论：已完成本轮可自动验证修复，等待用户安装新版 Windows 安装包和新版 APK 做最终体验。
