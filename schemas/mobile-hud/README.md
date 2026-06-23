# Mobile HUD protocol

`schemas/mobile-hud/` 是 Android / 未来 iOS 手机 HUD 的协议权威入口。它约束的是移动端可见的低敏展示 DTO，不是桌面端完整 Claude Code 状态镜像。

## 权威顺序

1. `protocol.json`：协议版本、兼容策略、隐私策略和移动端 v1 能力边界。
2. `*.schema.json`：envelope / view model 的 JSON Schema 约束。
3. `fixtures/*.json`：跨端契约样例，用于 Rust / TypeScript / Kotlin / 未来 Swift 测试。
4. Rust / TypeScript / Kotlin / Swift models：各端实现必须跟随前 3 项。

## 当前协议约束

- `protocolVersion` 当前为 `1`。
- App 内可信视图使用 `privacyLevel: "trustedAppView"`。
- 通知事件必须保持 `sensitivity: "low"`。
- Mobile HUD v1 是只读控制面：
  - `terminalJump: false`
  - `approvalActions: false`
  - `questionActions: false`
- `unknown-enum.json` 用来验证移动端遇到未来枚举值时能 fallback，而不是崩溃。

## 隐私红线

fixtures、snapshot、notification events、未来 Relay 低敏 DTO 不应包含：

- `transcriptPath`
- `projectDir`
- `cwd`
- `terminal`
- `intentId`
- `allowedIntents`
- `nonce`
- `rawInput`
- `rawOutput`
- `toolInput`
- `toolResult`
- `wtSession`
- `windowTitleHint`
- `bridgeProcessId`
- raw prompt / tool input / tool result / credential / full local path

如确实需要关联桌面端高敏对象，只允许使用短哈希、低敏摘要、不可逆 session ref 或本机 PC 内部索引，不能把原始路径和原始内容发给移动端。

## 兼容规则

- 新增可选字段：允许，不提升 `protocolVersion`。
- 删除字段、改变字段类型、改变字段语义、启用移动端高风险 action：必须提升 `protocolVersion`。
- enum-like 字段在移动端必须按 string / unknown fallback 处理，不允许用封闭枚举导致崩溃。
- unknown fields 必须被客户端忽略。
- notification payload 只能携带低敏摘要，详情必须在用户打开 App 后通过已认证通道拉取。

## 验证命令

```bash
npm run test:protocol
npm run test:privacy
npm run test:rust:mobile
```

Android 契约测试：

```powershell
.\apps\android\gradlew.bat -p .\apps\android testDebugUnitTest
```
