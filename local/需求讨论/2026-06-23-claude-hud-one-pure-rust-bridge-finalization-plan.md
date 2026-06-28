# Claude HUD One 纯 Rust Bridge 最终化开发计划（Claude 自用）

- 日期：2026-06-23
- 适用背景：当前项目仍处个人开发阶段，只有 Dec27-Lee 自用，不需要为其他用户保留复杂迁移兼容；后续开发应围绕最终目标一步到位。
- 核心修正：上一轮已把生产入口切到 native `hud-bridge.exe`，但仍委托 Node bridge 保持功能等价。下一步不应继续强化“兼容委托”，而应直接完成 **纯 Rust native bridge 全能力替代**，再删除 Node bridge 生产路径。

## 2026-06-23 执行进展

- 已完成第一轮纯 Rust bridge 最终化：`hud-bridge.exe` 默认不再委托 `node claude-status-bridge.mjs`，而是直接在 Rust 中解析 statusLine/hooks stdin、写入 `claude-status.json` / `sessions/*.json` / `pending-intents/requests/*.json`，并输出 Terminal HUD 或 PreToolUse blocking response。
- 已新增 `schemas/hud-bridge/fixtures/`，覆盖 statusLine、PreToolUse approval、UserPromptSubmit、Notification/question 和 malformed stdin 契约输入。
- 已新增 `src-tauri/src/hud_bridge/runtime.rs`，并让 `src-tauri/examples/hud-bridge.rs` 变成薄 CLI：`--emit-json` 保留脱敏事件 smoke，正常 statusLine/hooks 走 Rust runtime。
- 已收敛生产安装路径：`src-tauri/tauri.conf.json` 不再打包 `resources/claude-status-bridge.mjs`；installer 只复制/安装 `hud-bridge.exe`；`claude_global.rs` 不再 `include_str!` Node bridge，也不再生成 `node "...claude-status-bridge.mjs"` command。
- 已保留旧 Node command 识别，仅用于 settings/cleanup 兼容清理；源码里的旧 Node bridge 可继续作为 parity 参考，但不再是生产依赖。
- 已根据安装后反馈修复 Terminal HUD 样式回退：Rust runtime 现在读取 `%APPDATA%/Claude HUD One/settings.json` 的 `terminalHud` 配置，恢复默认多行 rows、context bar/context value、session token breakdown、ANSI 颜色、截断/换行和 activity/tools/agents/todos 等基础渲染；同时修复保存普通 App settings 时可能隐式接管非 HUD statusLine 的问题。
- 已修复安装后仍使用旧 Terminal HUD 的真实原因：旧 `%APPDATA%/Claude HUD One/bridge/hud-bridge.exe` 在 Claude Code statusLine 刷新期间可能被占用，覆盖复制失败会导致继续运行旧 hash。现在 installer/app-start repair 改为安装 `hud-bridge-<sha12>.exe` 并把 Claude settings 指向版本化文件，避免 in-use exe 无法覆盖的问题；当前已手动安装验证 `hud-bridge-2d161423a799.exe`。
- 已继续修复用户反馈的 Terminal HUD 颜色和展示不完整问题：Rust renderer 不再因 `preset: hud-plus-default` 丢弃用户颜色/rows patch，补齐 context/usage band 与阈值配色、labelTitle/labelValue 分色、activityLine items/warnings/maxWidthRatio、git branchOverflow，并让 ANSI 截断/换行尽量保留颜色；Settings 颜色配置页修复继承两行 grid 后多子元素叠加的问题。
- 已继续修复 git 组件不显示与活动行标题/值未拆色的问题：Rust statusLine 现在会在 Claude Code 输入没有 git 字段时，从当前 project dir 采集 git branch/dirty/ahead/behind 和 diff 行数；activity 的 Todo/Agents/Tools 标题走 `labelTitle`，数值走 `labelValue`。
- 已继续修复 git 组件细节颜色与上下文百分比：git 括号内新增行数使用绿色、删除行数使用红色；context percent 优先按实际 `contextUsedTokens / contextWindowSize` 重新计算，避免在配置 270K 窗口时仍沿用 Claude Code 原始 1M used_percentage。
- 已重新打 NSIS 安装包：`src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`，SHA256：`B829DF81A1BCCC0BD971CB998F83B723F6C6595A8A67F0BC91B7D6A348292BFA`。
- 已继续完成双线收口第一轮：删除旧 Node bridge 源文件/资源文件，清理项目级 Claude/Codex hook 中的 `node .claude/bridge/claude-status-bridge.mjs` 调用，保留的 `claude-status-bridge.mjs` 字符串仅用于识别并替换/清理历史 settings。
- 已接入 Local Runtime audit SQLite 基础：bridge parse/process、pending intent created/decision、Mobile pairing/intent 校验结果均写入低敏审计事件；审计写入 best-effort，不影响 statusLine/hooks/mobile 主流程，且禁止 prompt/tool input/tool result/transcript/cwd/projectDir/token/cost/nonce/signature/body/answerText 等字段进入 attributes。
- 已修复 Terminal HUD 跨会话串数据：Rust runtime 过去在当前 session 文件不存在时会回退读取全局 `claude-status.json`，导致 Tokens/Todo/Agents/Tools 等会话级指标被其他会话继承；进一步检查发现已污染的同一 session 文件还会继续保留旧 live metrics，因此 statusLine 的缺失指标不再从历史 session 文件继承。随后用户反馈两行完全消失，定位为 Rust 版少了旧 Node bridge 的 transcript 低敏汇总能力；现已补回 transcript usage / start time / latest todo / running tool 汇总，只读取 usage、timestamp、tool_use metadata 和 todo status，不落 prompt/tool result/transcript 正文。用户继续反馈 activity 行只显示 Todo，定位为已完成 Agent/Tool 没计入总数；现已改为总数显示 completed+running，running 单独标注。用户要求新会话 Tokens 组件零值也展示，已改为 `Tokens 0 (in: 0, out: 0, cache: 0)`；已新增回归测试覆盖，并安装当前 bridge `hud-bridge-6be127da3c57.exe`。
- 已修复 Desktop HUD 会话列表误保留关闭会话和运行态误判：前端会话列表改为只展示 45 秒内 live bridge session，过期时清空 store/localStorage 会话列表并显示空态，不再用旧 currentSession 填充列表；运行态结合 running tool/agent 计数、hook 事件和 statusText 派生；Rust hook 侧 Stop 不再生成 attention question，PostToolUse/Stop 会写入 0 running 计数避免继承旧 running。已新增回归测试，当前 bridge 为 `hud-bridge-045a99385f73.exe`，NSIS SHA256 为 `1ECAAF9C02670F021C619C33A48A726F286B40FA1F97ED966ACBE69EEB78B5CE`。
- 已修复 Desktop HUD 授权误报：Rust bridge 的 `PreToolUse` pending intent 生成逻辑现在会先对齐 Claude Code 权限语义，`permission_mode=bypassPermissions` 直接跳过 HUD approval；同时 best-effort 读取全局/项目 `.claude/settings.json` 的 `permissions.allow/ask/deny` 与 legacy `allowedTools/deniedTools`，命中 allow/deny 时不弹 HUD 授权，ask 继续保留 HUD 审批。测试环境已隔离真实用户 settings，新增 bypass/allow 回归测试；已通过 bridge/Rust/frontend/Tauri 打包验证。当前 bridge 为 `hud-bridge-7356720910b8.exe`，bridge SHA256 为 `7356720910B8B1234D380C05449DD3A282604DEEFE0BB67FC8B78688BB6FB7FF`，NSIS SHA256 为 `9EF428B6808EA24918012B686EC64FEA70B66133744CB4598122F6886ACDFB14`。
- 已修复 Desktop HUD 状态信息误判：Rust bridge 不再把 statusLine 心跳默认写成 `active`/`Claude Code active`，而是默认 `idle`/`Session idle`，只有 running tool/agent 计数为正才提升为 `running`；前端同步对 statusLine-only 心跳降级 idle、归一旧状态文案、排除 `SessionEnd` live session，并让空闲卡片右侧时间使用最后 assistant response / activityStartedAt / sessionStartedAt，避免心跳刷新造成 `<1m` 错觉。已新增 statusLine idle/running 回归测试并通过验证；当前 bridge 为 `hud-bridge-cd949ba67cb1.exe`，bridge SHA256 为 `CD949BA67CB1E187006F904EF559FA76288750893F15BE2DBE3B6B3A67333FF3`，NSIS SHA256 为 `B138DDB1F2C9B4A26D466D26D677555FE7BED4C698D40B83DD99CCB3C478CECA`。
- 已完成纯 Rust bridge 最终化收口：全局安装 hook 列表补齐官方支持的 `SessionStart` / `SessionEnd` / `CwdChanged`，与 Rust runtime 已识别事件对齐；Notification/question HUD 明确降级为 attention-only，不再暴露可输入 answer 的假闭环，pending intent response 不再落盘 `answerText`，过期 request 在 Desktop/Mobile resolve 入口即拒绝，legacy `audit.jsonl` 改为只记录 `intentRef` hash；新增 `scripts/verify-r6.ps1` 与 `npm run verify:r6` 串联 Phase R6 全量验证。已通过完整 R6：`check:version`、`test:protocol`、`build`、`cargo check`、`test:rust`、`test:bridge`、`test:security`、`test:android`、`lint:android`、`build:android`、`test:ui`、`tauri:build`；当前 bridge 为 `hud-bridge-34557e85fcb6.exe`，bridge SHA256 为 `34557E85FCB67A98692D1EDB9484778EB2CB49776A0E6D09B1F5AF9F4C97520B`，NSIS SHA256 为 `D0AB00B717058BB511ED86D58CDA5FB0E8A2E66A191F1A86ACD7FFF67B43410B`。补充检查发现 Android `build:android` 因 Gradle up-to-date 未刷新 APK 时间戳，已新增 `build:android:fresh` 并让 `verify:r6` 使用 clean+assembleDebug；已强制重新生成 `apps/android/app/build/outputs/apk/debug/app-debug.apk`，时间戳 `2026-06-25 09:45:26`，SHA256 `ED73E422EFF511A96BD49769FC3237328E2CACB98B7E4B8689864BB98666B375`。
- 已修复 Desktop/Mobile 会话 activity 误判第二轮：statusLine 不能可靠提供 assistant streaming 或 typing 状态，原逻辑把 `UserPromptSubmit` 当作 running，且 Mobile capsule 把 `active` 也映射为 running，导致已停止会话在用户打字时仍显示运行中；同时没有 `MessageDisplay` hook，普通 assistant 输出会话可能没有 tool/agent running count 而显示 idle。现已安装 `MessageDisplay`、`PostToolUseFailure`、`PostToolBatch`、`SubagentStart/Stop`、`PostCompact` 等 hook，改为 `MessageDisplay` 表示 response running、`UserPromptSubmit` 仅表示 active/prompt submitted；Desktop 和 Mobile 共享同一语义，Mobile capsule 保留 active 而不强制 running。已通过 bridge/mobile/frontend/Rust 验证并重新打包安装；当前 bridge 为 `hud-bridge-2c249935189d.exe`，bridge SHA256 为 `2C249935189DD6FD3B53DC5C63E8DE67D6DC3646FB339B407197F23CE8CD4AFB`，NSIS SHA256 为 `9412CA5E82CBCE4BAFB181710488FE57766062EC7C6C319E3F9190C99A1CFE2C`，Android debug APK SHA256 为 `35A22F30B4BDF56ABF2F8AB82096491AAE9985674270233CC4FF86B4E792DFD4`。

---

> **阅读说明（2026-06-28）：上方“2026-06-23 执行进展”为当前状态摘要；下方计划段落是当时的执行路线，已完成项不得再被当成待办。生产包与项目 hooks 已清理旧 Node bridge；源码中残留的 `claude-status-bridge.mjs` 字符串只用于识别并替换/清理历史 settings。**

## 1. 历史计划：下一步最重要的目标

一句话：

> 把 `hud-bridge.exe` 从“native 入口 + Node 委托”升级为“纯 Rust 完整 Claude Code statusLine/hooks bridge”，并移除安装包对 Node / `claude-status-bridge.mjs` 的生产依赖。

最终目标链路应变成：

```text
Claude Code statusLine/hooks
  ↓
hud-bridge.exe
  ↓
Rust 解析 stdin / 脱敏 / 状态归一化 / Terminal HUD 渲染 / pending intent / hook response
  ↓
%APPDATA%\Claude HUD One\*.json
  ↓
Tauri Desktop HUD / Mobile HUD / Settings / Diagnostics
```

而不是：

```text
Claude Code → hud-bridge.exe → node claude-status-bridge.mjs
```

---

## 2. 这次不要优先做什么

为了避免继续摊大，下一轮不要把主线分散到这些方向：

- 不优先做 Relay / APNs / 跨公网控制。
- 不优先做 iOS 工程。
- 不优先做 macOS adapter。
- 不优先继续扩展 Mobile HUD 可操作 UI。
- 不优先做大型 schema DTO 全自动生成。
- 不再为“其他已安装用户从 Node 平滑迁移”设计复杂兼容分支。

原因：当前最大架构债是 bridge 仍依赖 Node。只要这个没解决，`Rust HUD Core + native hud-bridge + Local Runtime` 的长期路线就还没闭环。

---

## 3. 当前可直接删除/收敛的兼容假设

因为目前只有本人使用，允许更激进：

1. **允许安装后直接覆盖 Claude Code settings**
   - 可以把 `statusLine.command` 和 hooks 全部改成 `hud-bridge.exe`。
   - 只保留 settings 备份，不需要支持多版本桥并存。

2. **允许移除生产包里的 Node bridge**
   - `src-tauri/resources/claude-status-bridge.mjs` 可以先作为 parity 参考保留在源码中；当 Rust parity 完成后，不再打入安装包。
   - `.claude/bridge/claude-status-bridge.mjs` 可保留为开发参考或最终删除。

3. **允许要求重新配对移动设备**
   - signed intent 已新增设备公钥字段；如果旧 registry 里缺少 `publicKeyDerB64`，可以提示重新配对，不做复杂迁移。

4. **允许清理旧 AppData bridge state**
   - 如果状态格式要调整，允许删除 `%APPDATA%\Claude HUD One\bridge` 下旧 bridge 文件。
   - 但 `claude-status.json`、`sessions/` 的消费 schema 尽量保持，避免前端大改。

---

## 4. 开发分阶段计划

### Phase R0：锁定 Node bridge 行为契约

目标：先把现在 Node bridge 的真实能力固化成 fixtures / 对照测试，避免 Rust 重写时漏功能。

需要做：

- 新建 bridge fixtures 目录，例如：
  - `schemas/hud-bridge/fixtures/statusline-basic.json`
  - `schemas/hud-bridge/fixtures/pretooluse-approval.json`
  - `schemas/hud-bridge/fixtures/pretooluse-no-pending.json`
  - `schemas/hud-bridge/fixtures/notification.json`
  - `schemas/hud-bridge/fixtures/stop.json`
  - `schemas/hud-bridge/fixtures/malformed-stdin.txt`
- 从 `src-tauri/resources/claude-status-bridge.mjs` 提炼当前行为契约：
  - statusLine stdout 格式；
  - hook response JSON；
  - AppData 状态文件字段；
  - sessions 文件策略；
  - pending-intents request/response 文件结构；
  - fail-safe 行为；
  - 敏感字段禁止落盘规则。
- 新增 Rust 对照测试，先允许调用 Node bridge 生成 expected，再逐步替换为静态 expected。

验收：

```bash
npm run test:bridge
cargo test --manifest-path src-tauri/Cargo.toml -j 1 hud_bridge
```

完成标准：Rust 测试能明确告诉 Claude：纯 Rust bridge 必须兼容哪些输入/输出。

---

### Phase R1：实现 Rust bridge runtime core

目标：把核心逻辑从 example CLI 中抽离出来，不再只做 `native_event`。

建议文件结构：

```text
src-tauri/src/hud_bridge/
  mod.rs
  native_event.rs              # 保留：低敏事件核
  runtime.rs                   # 新增：bridge 主流程
  input.rs                     # 新增：stdin JSON / mode 解析
  state.rs                     # 新增：ClaudeStatusBridgeState 构建与序列化
  paths.rs                     # 新增：APPDATA / project state / sessions / pending-intents 路径
  writer.rs                    # 新增：atomic write / cleanup / session cap
  terminal_hud.rs              # 新增：statusLine Terminal HUD 渲染
  pending_intent.rs            # 新增：approval/question request/response/fail-safe
  git.rs                       # 可选：git branch/dirty/ahead/behind 采集
  metrics.rs                   # 可选：memory / token / usage 字段归一化
```

`src-tauri/examples/hud-bridge.rs` 只保留薄 CLI：

```text
parse args → read stdin → hud_bridge::runtime::run(mode, input, options)
```

验收：

- 不传 `--emit-json` 时，Rust 自己完成完整 bridge 行为。
- `--emit-json` 仍保留，用于调试低敏 native event。
- 不调用 `node`。

---

### Phase R2：完整重写 statusLine 渲染

目标：`hud-bridge.exe` 自己输出 Terminal HUD，而不是委托 Node。

必须覆盖：

- model / effort / thinking；
- context percent / token；
- project label；
- activity；
- tools / agents / todos；
- usage / cost；
- git；
- terminalHud settings；
- fallback 文本 `Claude HUD One`；
- ANSI 颜色输出。

注意：

- 可以先做到视觉语义一致，不需要逐字符完全一样。
- 但不能回退成只有 `Claude HUD One`。

验收：

```bash
hud-bridge.exe --statusline < fixture
```

输出应有真实 HUD 内容，而不是单行 fallback。

---

### Phase R3：完整重写 hooks 与 pending intent

目标：Rust 直接处理 Claude Code hooks。

必须覆盖 hook 事件：

- `UserPromptSubmit`
- `PreToolUse`
- `PostToolUse`
- `Notification`
- `Stop`
- `StopFailure`
- `PreCompact`

必须覆盖 pending intent：

- approval item 生成；
- question item 生成；
- private nonce；
- request 文件写入；
- response 轮询；
- allowOnce / deny / dismiss；
- answerIntent；
- timeout 后 fail-safe defer；
- audit jsonl；
- pending item cleanup；
- max pending items。

验收：

- `PreToolUse` approval fixture 可以生成 request 文件。
- HUD resolver 写 response 后，Rust bridge 可以返回 Claude Code blocking hook JSON。
- 超时情况下不挂死 Claude Code。
- 敏感字段不写入 Mobile DTO / public status。

---

### Phase R4：Rust 状态文件写入完全替代 Node

目标：前端和 Mobile HUD 继续读取同一组状态文件，但写入方改为 Rust。

需要保持的消费路径：

```text
%APPDATA%\Claude HUD One\claude-status.json
%APPDATA%\Claude HUD One\sessions\*.json
%APPDATA%\Claude HUD One\pending-intents\requests\*.json
%APPDATA%\Claude HUD One\pending-intents\responses\*.json
%APPDATA%\Claude HUD One\pending-intents\audit.jsonl
```

需要考虑：

- atomic write；
- session cap；
- stale cleanup；
- malformed JSON 忽略；
- AppData 不存在时 graceful fallback；
- project `.claude/bridge/state` 是否还保留。

验收：

- Desktop HUD 能刷新 session state；
- Mobile HUD snapshot 能看到 sanitized sessions；
- approval/question 队列能在 Desktop HUD 显示；
- 不依赖 Node 脚本。

---

### Phase R5：删除生产 Node bridge 依赖

目标：生产安装包里不再需要 Node。

要改：

- `src-tauri/tauri.conf.json`
  - 移除 `resources/claude-status-bridge.mjs` 打包。
  - 保留 `resources/hud-bridge.exe`。
- `src-tauri/resources/install-claude-hud-one-bridge.ps1`
  - 只安装 `hud-bridge.exe`。
  - 不再生成 `node "...claude-status-bridge.mjs"` command。
- `src-tauri/resources/cleanup-claude-hud-one.ps1`
  - 只需识别 `hud-bridge.exe` 和旧残留 `claude-status-bridge.mjs`。
- `src-tauri/src/window/claude_global.rs`
  - 不再 `include_str!` Node bridge。
  - app-start repair 只确保 native bridge。
- `package.json`
  - `build:bridge` 保留。
  - 增加纯 Rust bridge parity tests。
- README
  - 明确不再依赖 Node。

验收：

```bash
node --version
```

即使系统没有 Node，安装后的 Claude Code bridge 也能工作。

---

### Phase R6：最终回归与打包

必须跑：

```bash
npm run check:version
npm run test:protocol
npm run build
cargo check --manifest-path src-tauri/Cargo.toml -j 1
npm run test:rust
npm run test:bridge
npm run test:security
npm run test:android
npm run lint:android
npm run build:android
npm run test:ui
npm run tauri:build
```

建议额外手工验收：

1. 安装新包。
2. 检查 `~/.claude/settings.json`：
   - `statusLine.command` 指向 `hud-bridge.exe`；
   - hooks 指向 `hud-bridge.exe --hook`。
3. 暂时把 Node 从 PATH 移除或模拟不可用。
4. 打开 Claude Code，确认 Terminal HUD 仍有完整信息。
5. 触发 approval / question，确认 Desktop HUD pending 队列有效。
6. 手机连接 Mobile HUD，确认 snapshot 不包含敏感字段。
7. 重新打包并记录 installer SHA256。

---

## 5. 下一轮 Claude 执行顺序

下一轮如果用户说“继续开发”，Claude 应按这个顺序执行：

1. **先建 bridge fixtures 和 parity tests**，不要直接删 Node。
2. **实现 `hud_bridge::runtime` / `state` / `paths` / `writer` 骨架**。
3. **先让 Rust 写出 `claude-status.json` 和 sessions**。
4. **再实现 statusLine Terminal HUD 渲染**。
5. **再实现 PreToolUse pending intent 和 fail-safe**。
6. **再删 installer / app-start 的 Node 生产路径**。
7. **最后完整验证和 `npm run tauri:build`**。

关键原则：

> 不为外部用户迁移做复杂兼容，但仍要用测试保护现有功能不退化。

---

## 6. 完成判定

下一阶段只有满足以下条件，才能说“纯 Rust bridge 最终化完成”：

- `hud-bridge.exe` 不再调用 `node`。
- 安装包不再打入 `claude-status-bridge.mjs` 作为生产依赖。
- 没有 Node 的机器上，Claude Code statusLine / hooks 仍可工作。
- Desktop HUD session / pending queue 正常。
- Mobile HUD snapshot 正常且低敏。
- approval / question pending intent 正常。
- 所有验证命令通过。
- 最终重新生成 NSIS 安装包。

如果只是把入口指向 `hud-bridge.exe`，但仍委托 Node，不算完成。