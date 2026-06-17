# Mobile HUD contract fixtures

这些 fixtures 是 Android 手机 HUD 一期的跨端协议样例，权威来源在仓库根目录 `schemas/mobile-hud/fixtures/`。

约束：

- `protocolVersion` 当前为 `1`。
- App 内可信视图使用 `privacyLevel: "trustedAppView"`。
- 通知事件必须保持 `sensitivity: "low"`。
- fixtures 不应包含 `transcriptPath`、`projectDir`、`cwd`、`terminal`、`intentId`、`allowedIntents`、`nonce`、raw prompt、tool input/result 等敏感字段。
- `unknown-enum.json` 用来验证 Android 端遇到未来枚举值时能 fallback，而不是崩溃。
