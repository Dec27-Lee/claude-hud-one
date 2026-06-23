# Claude HUD One 架构改造执行与验收

- 需求人：Dec27-Lee <lipengyue31@163.com>
- 原始需求：创建一个计划来跟踪 Claude HUD One 项目架构改造，并自主执行、自主验收。
- 范围：
  - 本轮做：建立会话任务跟踪与本地执行计划；梳理当前架构入口；落地 Phase 1A 低风险架构边界固化，包括协议权威入口、协议验证脚本、TS 类型抽离、Rust 分层骨架、Android 契约补充；运行可用验证与打包。
  - 本轮不做：完整 Cargo workspace 拆分、替换现有 Node bridge 为 native bridge、引入完整 schema codegen、实现 iOS 工程、把移动端升级为远程审批执行面。
  - 待确认：后续是否继续进入 Phase 1B/Phase 2，并处理 Android SDK 本地环境以恢复 Android 单测自动验收。
- 计划：
  1. 使用任务列表建立架构改造跟踪计划和阶段依赖。
  2. 只读梳理现有 package/Tauri/Rust/Android/schema/bridge 入口，确认第一阶段低风险落点。
  3. 设计 Phase 1A 目录与协议落点。
  4. 实施 Phase 1A：协议文件、验证脚本、TS 协议类型、Rust 分层骨架、Android contract test 补充。
  5. 运行协议、前端、Rust、UI、Android、Tauri 打包验证；记录失败原因和下一步。
- 进展：
  - 2026-06-22：已创建任务跟踪 #1-#5，并设置顺序依赖。
  - 2026-06-22：已输出执行跟踪计划 `local/需求讨论/2026-06-22-claude-hud-one-架构改造执行跟踪计划.md`。
  - 2026-06-22：已新增 Mobile HUD protocol 入口：`schemas/mobile-hud/protocol.json`、`envelope.schema.json`、`view-model.schema.json`。
  - 2026-06-22：已新增 HUD Core 隐私/归一化 schema：`schemas/hud-core/privacy-denylist.json`、`normalized-hud-state.schema.json`。
  - 2026-06-22：已新增 `scripts/check-mobile-hud-protocol.mjs`，并在 `package.json` 增加 `test:protocol` / `test:privacy`。
  - 2026-06-22：已将 Mobile HUD TS 类型抽离到 `src/protocol/mobileHud.ts`，`src/app/mobileHudBridge.ts` 改为 Tauri invoke wrapper + 类型 re-export。
  - 2026-06-22：已新增 Rust 分层骨架 `src-tauri/src/hud_core/`、`src-tauri/src/hud_bridge/`、`src-tauri/src/local_runtime/` 并纳入 `src-tauri/src/lib.rs` 模块树。
  - 2026-06-22：已补充 Android contract 注释和 `MobileHudFixtureTest` 对 `protocol.json` 的只读/低敏/设备认证策略断言。
  - 2026-06-22：已将 UI 验收脚本默认改为单 worker 和 60s timeout，避免 compact 首屏截图冷启动导致并发超时。
  - 2026-06-22：已更新 `.claude/workspace-index.md` 和相关协议/计划入口。
  - 2026-06-22：继续推进 Phase 1B，新增 `scripts/generate-mobile-hud-protocol.mjs`，从 `protocol.json` 和隐私 denylist 生成 TypeScript/Kotlin/Swift 协议常量；新增 `src/protocol/mobileHud.generated.ts`、`apps/android/app/src/main/java/com/claudehud/one/mobile/MobileHudProtocol.kt`、`schemas/mobile-hud/generated/MobileHudProtocol.swift`，并将 `npm run test:protocol` 扩展为校验生成文件是否最新。
  - 2026-06-22：启动 Phase 2 native hud-bridge，新增 `src-tauri/src/hud_bridge/native_event.rs` 和 `src-tauri/examples/hud-bridge.rs`，提供自包含 Rust/native bridge 事件归一化与 `--emit-json` smoke 入口；新增 `npm run test:bridge` 和 `npm run build:bridge`。为避免 Tauri 打包误选桥接二进制，bridge 以 Cargo example 形式存在，生产安装接入留到后续任务。
  - 2026-06-22：推进移动安全闭环基础，新增 `src-tauri/src/hud_core/security.rs`，实现移动 intent metadata 的 deviceId、nonce、TTL、bodyHash、idempotencyKey 校验与单元测试，并新增 `npm run test:security`；端到端设备公钥签名接入 runtime 作为后续任务继续。
  - 2026-06-23：继续完成剩余执行项：`src-tauri/examples/hud-bridge.rs` 升级为生产安全 native 命令入口，`scripts/build-hud-bridge.mjs` 构建并复制 `src-tauri/resources/hud-bridge.exe`，`tauri.conf.json` 打包该资源；`install-claude-hud-one-bridge.ps1`、`cleanup-claude-hud-one.ps1` 和 `claude_global.rs` 已支持 `hud-bridge.exe` / Node bridge 双识别、迁移与回滚。
  - 2026-06-23：移动安全闭环接入 runtime：`MobileHudDeviceRecord` 新增设备公钥字段，pairing claim 保存公钥；`hud_core::security` 增加 P-256 ECDSA 验签、canonical signing payload、协议版本/TTL/bodyHash 校验；`mobile_hud::runtime` 新增 `/intent/resolve`，先做设备批准、公钥签名、TTL、bodyHash、idempotencyKey 与 replay cache 校验，再委托 `claude_status::resolve_pending_intent`。
  - 2026-06-23：Android 自动验收恢复，新增 `test:android` / `lint:android` / `build:android` npm 脚本，增强 `scripts/android-gradle.ps1` 的 Java 17、SDK 34/build-tools 检查与 `local.properties` 幂等写入；Android client 增加 signed intent request 构造与测试。
  - 2026-06-23：发布门禁补齐：`scripts/smoke.ps1` 加入 protocol、bridge、security 检查并改为通配 installer；`.github/workflows/release.yml` 加入 `npm run test:protocol`、bridge/security 测试和 native bridge 构建；README 更新为 NSIS only 与 native bridge 迁移说明。
  - 2026-06-23：用户明确当前仍为个人开发阶段，不需要为其他用户保留复杂迁移兼容；已新建 Claude 自用下一步计划 `local/需求讨论/2026-06-23-claude-hud-one-pure-rust-bridge-finalization-plan.md`，将后续主线收敛为一步到位完成纯 Rust `hud-bridge.exe` 全能力替代 Node bridge，并删除生产 Node 依赖。
  - 2026-06-23：按纯 Rust bridge 最终化计划继续执行，新增 `schemas/hud-bridge/fixtures/` 契约输入，新增 `src-tauri/src/hud_bridge/runtime.rs`，将 `src-tauri/examples/hud-bridge.rs` 改为薄 CLI；`hud-bridge.exe` 默认不再委托 Node，Rust runtime 直接完成 statusLine/hooks 解析、状态/会话写入、Terminal HUD 渲染、pending intent request 写入和 PreToolUse allow/deny/defer response。
  - 2026-06-23：生产 Node bridge 路径已收敛：`src-tauri/tauri.conf.json` 不再打包 `resources/claude-status-bridge.mjs`，`install-claude-hud-one-bridge.ps1` 只复制/安装 `hud-bridge.exe`，`claude_global.rs` 不再内嵌或写入 Node bridge、不再生成 `node "...claude-status-bridge.mjs"` command；旧 Node command 识别仅保留为 cleanup/settings 兼容清理。
  - 2026-06-23：用户安装纯 Rust bridge 包后反馈 Settings 页面和底部 Terminal HUD 样式异常；已将 Rust `render_terminal_hud` 从硬编码单行改为读取 `%APPDATA%/Claude HUD One/settings.json` 的 `terminalHud` 配置，恢复默认多行 rows、context bar/context value、session token breakdown、颜色、截断/换行和 activity/tools/agents/todos 等基础渲染；同时避免保存普通 App settings 时隐式接管非 HUD statusLine，并让 native bridge resource 缺失时不写入无效 Claude settings command。
  - 2026-06-23：用户重新安装后 Terminal HUD 仍未变化，定位到 `%APPDATA%/Claude HUD One/bridge/hud-bridge.exe` 仍是旧 hash，原因是 Claude Code statusLine 刷新期间旧 exe 可能被占用，installer 的覆盖复制失败后仍继续使用旧路径。已改为 hash-versioned bridge 安装策略：复制为 `hud-bridge-<sha12>.exe` 并把 Claude settings 指向版本化文件，同时保留旧 `hud-bridge.exe` 作为 best-effort 兼容；Rust app-start repair、installer 和 cleanup 均支持 `hud-bridge*.exe`。已手动安装当前版本 `hud-bridge-2d161423a799.exe` 并验证输出多行 Terminal HUD。
  - 2026-06-23：用户继续反馈 Terminal HUD 底部颜色未完全按配置、展示不完整，且终端颜色配置页布局叠加。已修复 Rust Terminal HUD renderer：保留 `hud-plus-default` preset 下的用户 patch，补齐 context/usage bands 与阈值配色、labelTitle/labelValue 分色、activityLine items/warnings/maxWidthRatio、git branchOverflow，并改进 ANSI 截断/换行保色；已修复 Settings 颜色配置页的 `.terminal-color-panel` grid 继承导致多子元素叠加问题。
  - 2026-06-23：用户反馈配置了 git 组件但底部不显示、活动行标题和值颜色未拆分。定位原因是 Rust statusLine 初版只消费输入中的 git 字段，而 Claude Code statusLine 输入没有提供 git 信息；已增加本地 git 采集，从 project dir 获取 branch/dirty/ahead/behind/diff 行数；同时将 Todo/Agents/Tools 活动行标题与值分别按 `labelTitle`/`labelValue` 着色。
  - 2026-06-23：用户继续反馈 git 括号内新增/删除行数需要分别使用绿色/红色，且 context bar 的百分比不能沿用 1M 窗口下的原始 used_percentage。已修正 git diff 数值配色；context percent 改为优先按实际 `contextUsedTokens / contextWindowSize` 计算，在配置 270K 窗口时会以 270K 为分母。
  - 2026-06-23：按“两个都做”的要求继续双线收口：清理旧 Node bridge 生产残留，删除 `.claude/bridge/claude-status-bridge.mjs` 和 `src-tauri/resources/claude-status-bridge.mjs`，项目级 `.claude/settings.json` / `.codex/hooks.json` 不再调用旧 Node bridge；`src-tauri` 内保留的 `claude-status-bridge.mjs` 字符串仅用于识别并替换/移除历史 settings。
  - 2026-06-23：落地 Local Runtime audit SQLite 基础：新增 `src-tauri/src/local_runtime/audit.rs`，引入 `rusqlite`，建立低敏 `audit_events` 表和 30 天 best-effort retention；bridge parse/process、pending intent 创建/决策、Mobile pairing/intent 校验结果均记录为低敏审计事件，拒绝 prompt/tool input/tool result/transcript/cwd/projectDir/token/cost/nonce/signature/body/answerText 等敏感 attributes。
  - 2026-06-23：更新长期路线文档，将 macOS/iOS/Relay 后续拆为 platform adapter、原生 iOS 控制面和低敏 Relay 协调层；Relay 只做 rendezvous、中继和 FCM/APNs 协调，不做云执行层。
  - 2026-06-23：双线改造后已重新运行完整验证并重新打 NSIS 安装包，新安装包 SHA256 为 `C4B04E0B40BE8EC5F503F0A06B44FFBCA8A0D80B7434E4C6782046CEB391C008`。
  - 2026-06-23：用户反馈底部 Tokens/Todo/Agents/Tools 等信息在各个会话展示一样、发生串数据。定位到 `run_bridge_once` 在当前 session 历史状态不存在时无条件回退读取全局 `claude-status.json`，随后 `merge_with_previous` 把上一会话的缺失指标补到当前会话。已改为只在全局状态属于同一 `sessionKey` 时才允许 fallback，并新增 `hud_bridge_statusline_does_not_reuse_global_state_from_other_session` 回归测试；已重新打包。
- 检查：
  - 需求覆盖：已按用户“继续按纯 Rust bridge 最终化计划执行”和“两个都做”的要求，完成 bridge fixtures、Rust runtime、native CLI 接入、生产 Node bridge 路径移除、旧 Node bridge 残留清理、Local Runtime audit 基础、macOS/iOS/Relay 后续路线规划、验证与重新打包；当前 `hud-bridge.exe` 默认不再调用 Node。
  - 产物路径：`schemas/hud-bridge/fixtures/`；`src-tauri/src/hud_bridge/runtime.rs`；`src-tauri/src/local_runtime/audit.rs`；`src-tauri/examples/hud-bridge.rs`；`src-tauri/resources/install-claude-hud-one-bridge.ps1`；`src-tauri/src/window/claude_global.rs`；`src-tauri/tauri.conf.json`；`README.md`；`local/需求讨论/2026-06-22-claude-hud-one-架构改造执行跟踪计划.md`；`local/需求讨论/2026-06-22-claude-hud-one-可持续技术栈与架构改造建议.md`；`local/需求讨论/2026-06-23-claude-hud-one-pure-rust-bridge-finalization-plan.md`；安装包为 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。
  - 验证情况：历史主线验证包括 `npm run check:version`、`npm run test:protocol`、`npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml -j 1`、`npm run test:rust`、`npm run test:bridge`、`cargo test --manifest-path src-tauri/Cargo.toml -j 1 claude_global`、native bridge statusLine smoke、native bridge hook smoke、`npm run test:security`、`npm run test:android`、`npm run lint:android`、`npm run build:android`、`npm run test:ui`、`npm run tauri:build` 均已通过；本次双线改造后，已重新通过 `cargo check --manifest-path src-tauri/Cargo.toml -j 1`、`cargo test --manifest-path src-tauri/Cargo.toml -j 1 audit`、`npm run test:bridge`、`cargo test --manifest-path src-tauri/Cargo.toml -j 1 mobile_hud`、`npm run test:security`、`npm run test:protocol`、`npm run build`、`npm run test:rust`、`npm run test:ui`、`npm run check:version`、`npm run test:android`、`npm run lint:android`、`npm run build:android`、`npm run tauri:build`；新 installer SHA256 为 `C4B04E0B40BE8EC5F503F0A06B44FFBCA8A0D80B7434E4C6782046CEB391C008`。
  - 风险：Rust Terminal HUD 已补齐本轮发现的颜色/展示/git 配置缺口，但仍不是 TS preview 的逐字符全量 parity；git 采集依赖本机 `git` 命令和项目目录在 git 仓库内，无法采集时会安全隐藏 git 组件；SQLite audit 目前是本地低敏审计地基，还不是完整 event bus/replay store；Relay、macOS/iOS adapter 仍属于后续长期路线，不阻塞本轮安装测试。
  - 是否需要打包：本轮修改了代码和样式文件，已执行 `npm run tauri:build`，安装包生成路径为 `src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。
  - 结论：已完成（纯 Rust bridge 生产路径第一轮最终化、旧 Node bridge 生产残留清理、Local Runtime audit 基础、macOS/iOS/Relay 后续路线规划和最终 Windows 安装包均已完成；后续可继续做 Terminal HUD 逐字符 parity、完整 Local Runtime event bus/replay store 和跨端扩展）
