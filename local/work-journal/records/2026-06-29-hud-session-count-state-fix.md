# HUD 会话数量与状态显示异常修复

- 需求人：Dec27-Lee <lipengyue31@163.com>
- 日期：2026-06-29
- 状态：in_progress

## 原始需求

目前会话状态显示存在两个问题：

1. 移动 HUD 和桌面 HUD 显示的会话数量有差异：通过终端启动某个工作区的 Claude Code 后，再通过 `/resume` 切换历史会话，移动 HUD 会有两个会话，但桌面只有一个；预期只有一个会话。
2. 移动 HUD 和桌面 HUD 的会话状态变化异常：会话仍在运行（包括后台运行）时，状态在“运行中”和“空闲”之间反复跳变。

需要排查 Rust bridge / Desktop HUD / Mobile HUD 状态聚合逻辑，修复并验证；按项目规则，代码修改完成后重新打安装包。

## 范围

- 本轮做：定位会话数量不一致与状态跳变根因；修复 Rust/TS/Android 或协议侧相关逻辑；运行可用自动化验证；完成后执行安装包构建。
- 本轮不做：大幅重做 UI 视觉、引入新的远端同步服务、改变隐私红线与协议安全边界。
- 待确认：真机/真实 Claude Code 后台运行场景只能尽量用本地状态输入与自动化测试覆盖，必要时请用户最终体验确认。

## 计划

1. 通过工作区索引定位最新 Rust bridge / Mobile-safe 协议 / Desktop HUD 状态链路资料与代码入口。
2. 并行排查 Rust bridge 会话归一化、Desktop HUD 会话选择/去重、Mobile DTO 聚合与状态 freshness 逻辑。
3. 明确 `/resume` 场景下“同一工作区只应保留一个当前会话”的归一化规则，以及运行中/后台运行状态不应被短周期空闲快照覆盖的规则。
4. 实施最小代码修复，并补充或调整单元/契约测试。
5. 运行前端/Rust/Android 相关测试与 `npm run tauri:build` 打包验证。
6. 回写本记录的进展与检查结论。

## 进展

- 2026-06-29：已创建本轮问题修复记录，并用 Workflow 并行排查 Rust bridge、Desktop HUD、Mobile HUD 与测试入口。
- 2026-06-29：已修复 `/resume` 场景的会话身份归一化：Rust bridge、Tauri session 聚合、Desktop HUD、Mobile HUD session ref 均优先使用 `transcriptPath` 作为同一逻辑会话标识；同时补充旧 sessionKey / 新 sessionId 但同 transcript 的去重测试。
- 2026-06-29：已修复状态跳变相关逻辑：statusLine 可按 sessionId/transcriptPath 回找上一条 hook running 状态，避免 statusLine 缺少 transcript 时丢失 running 信号；hook running 粘滞窗口从 10 分钟收敛到 90 秒，避免旧 hook 长时间把空闲误判为运行；transcript 未配对 tool/agent 只有 10 分钟内才作为 running，避免历史 `/resume` transcript 永久误报运行中。
- 2026-06-29：已重新构建 native `hud-bridge.exe` 资源并完成 Tauri NSIS 安装包构建。

## 检查

- 需求覆盖：已覆盖两个反馈点；会话数量不一致通过 transcript 优先身份与后端读取去重处理，状态跳变通过别名回找、running 粘滞窗口收敛、transcript running freshness 处理。
- 产物路径：`src-tauri/src/hud_bridge/runtime.rs`、`src-tauri/src/window/claude_status.rs`、`src-tauri/src/window/mobile_hud/snapshot.rs`、`src/providers/claudeCodeSummary.ts`、`src-tauri/resources/hud-bridge.exe`、`src-tauri/target/release/bundle/nsis/Claude HUD One_0.1.0_x64-setup.exe`。
- 验证情况：`npm run test:bridge` 通过；`cargo test --manifest-path src-tauri/Cargo.toml -j 1 claude_status` 通过；`npm run build` 通过；`npm run test:rust:mobile` 通过；`npm run tauri:build` 通过；`npm run test:android` 通过。
- 风险：真实 Claude Code 后台运行和 `/resume` 行为仍建议用户安装新包后用实际终端场景体验确认；当前已用 bridge/session/mobile DTO 自动化测试覆盖关键规则。
- 结论：已完成。
