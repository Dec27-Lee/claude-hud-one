# Claude HUD One Android Mobile HUD 界面与后台连接优化方案

> 日期：2026-06-18  
> 类型：产品设计 / 交互设计 / 后续实现方案  
> 背景：Android 手机 HUD 一期已经能配对、连接并展示 PC 侧 Mobile DTO，但用户真机反馈：连接前后界面没有明显区分，连接成功后仍像“文本卡片堆叠”，不像 Desktop HUD / CodeIsland 的动态会话展示；切换手机应用后连接会断开，不符合“手机 HUD 伴随观察”的使用预期。

---

## 1. 目标与非目标

### 1.1 本方案要解决什么

1. **连接前/连接后是两种产品状态**
   - 连接前：用户只需要完成配对和诊断，不应该看到大量假数据或已连接布局。
   - 连接后：用户进入真正的 Mobile HUD，配对入口自动降级为“连接管理”，不再占据主界面。

2. **连接后按 Desktop HUD 的动态交互方式展示信息**
   - 不是把 DTO 字段逐行拼成文本。
   - 要把 Desktop HUD 的“胶囊状态 + 会话卡 + 注意项/完成卡 + 智能压缩”翻译成手机界面。
   - 手机端重点是“扫一眼知道 Claude 在干什么、哪里需要回 PC 处理”。

3. **切换应用后不应马上断联**
   - 手机 HUD 是伴随型工具，用户切到微信/浏览器/相册后，仍应保持连接或具备可恢复能力。
   - 需要明确 Android 后台连接、前台服务通知、断线重连和省电限制的产品策略。

4. **保持一期安全边界**
   - 手机端仍只读。
   - 不做 allow / deny / answer / terminal jump。
   - 不展示 projectDir、cwd、raw prompt、tool input/result、完整 pairing token/fingerprint。

### 1.2 本方案不做什么

- 不把手机端做成 PC 端完整控制台。
- 不在手机端处理授权或回答 Claude Code 问题。
- 不为了“后台永久在线”绕过 Android 系统限制或做高耗电常驻。
- 不把 Desktop HUD 原样搬到手机；只迁移其信息架构、状态机和动效语言。

---

## 2. 当前问题复盘

### 2.1 UI 问题

当前 Android 已连接界面主要问题：

- **配对卡常驻**：即使已经连接，仍展示“粘贴配对链接”和完整 `claudehud://pair?...` 文本，造成隐私和认知噪音。
- **连接前后布局一致**：用户无法从界面结构上感知“现在已经进入 Live HUD”。
- **信息展示太像日志**：会话、关注项、ticker 都以长文本堆叠，用户无法快速判断主状态。
- **没有 Desktop HUD 的状态层级**：Desktop HUD 有 compact / peek / expanded、activeSurface、session ticker、completion card、pending surface；手机端现在只有普通 Card 列表。
- **重复 attention 刷屏**：同类 approval/question 多条重复展示，没有 dedupe、分组、限量和“还有 N 条”的折叠。
- **长 ID/长英文泄露界面秩序**：sessionRef、UUID、英文 fallback、长工具名直接进入用户主视图。

### 2.2 后台连接问题

用户反馈切换手机应用后断联，结合当前实现，主要原因是：

- WebSocket 生命周期绑定在 `MainActivity` / Compose 状态里；Activity 进入后台后容易被系统暂停、重建或回收。
- 没有 Android `ForegroundService` 承担“连接守护”职责。
- 没有连接配置持久化与自动恢复状态机。
- 没有明确的后台通知让用户知道“Mobile HUD 正在保持连接”。
- 没有指数退避重连、网络变化监听、PC 服务不可达诊断。

---

## 3. 产品原则

### 3.1 一句话定位

Android Mobile HUD 不是“手机上的设置页”，而是 **Claude Code 的随身动态岛**：连接前帮用户快速上车，连接后只展示最值得扫一眼的信息。

### 3.2 设计原则

1. **连接态驱动界面，而不是组件堆叠**
   - `unpaired / pairing / waitingApproval / connected / reconnecting / disconnected / revoked` 每个状态有不同主界面。

2. **首屏只回答一个问题：Claude 现在怎么样？**
   - 正在运行什么？
   - 是否需要我回 PC 处理？
   - 哪几个会话最重要？

3. **信息密度先压缩，再展开**
   - 默认只展示 1 个主胶囊、最多 3 个会话、最多 2 个注意项。
   - 其他信息进入“更多 / 诊断 / 历史”。

4. **动效服务于状态变化**
   - 运行、等待、完成、断线，都有不同节奏。
   - 不做无意义炫技动画。

5. **后台连接必须可解释**
   - 用户切换应用后，状态不应“突然死掉”。
   - 如果被系统限制，要通过通知和界面告诉用户原因与修复方式。

---

## 4. 状态模型设计

### 4.1 顶层 App 状态

```text
Unpaired
  ↓ 粘贴/扫码配对链接
PairingClaiming
  ↓ PC 收到待批准设备
WaitingPcApproval
  ↓ PC 批准
Connecting
  ↓ snapshot 拉取成功 + WSS 建立
Connected
  ├─ App 前台：Live HUD full UI
  ├─ App 后台：ForegroundService + 低敏常驻通知
  ├─ 网络切换：Reconnecting
  ├─ PC 服务停止：DisconnectedRecoverable
  └─ 设备撤销：Revoked
```

### 4.2 状态与界面映射

| 状态 | 主界面 | 用户主任务 | 是否展示配对输入 | 是否展示 HUD 数据 |
| --- | --- | --- | --- | --- |
| Unpaired | 连接页 | 粘贴/扫码配对链接 | 是 | 否，只展示空状态预览 |
| PairingClaiming | 连接页 loading | 等待提交完成 | 是，锁定输入 | 否 |
| WaitingPcApproval | 等待批准页 | 回 PC 批准 | 否，显示脱敏设备提示 | 否，可显示连接进度 |
| Connecting | 连接中页 | 等待自动连接 | 否 | 可显示骨架屏 |
| Connected | Live HUD | 观察状态 | 否，折叠到设置 | 是 |
| Reconnecting | Live HUD + 顶部黄条 | 等待恢复 | 否 | 显示最后快照 + 过期提示 |
| DisconnectedRecoverable | 恢复页 | 重试/检查 PC 服务 | 可在二级入口显示 | 显示最后快照摘要 |
| Revoked | 重新配对页 | 删除旧连接并重新配对 | 是 | 否 |

---

## 5. 连接前界面设计

### 5.1 目标

连接前只做一件事：**让用户快速、放心地把手机接到 PC**。

### 5.2 页面结构

```text
┌─────────────────────────────┐
│ Claude HUD One              │
│ 手机 HUD · 只读加密伴侣       │
│                             │
│     ◉  等待连接 PC           │
│    ╱│╲  WSS + 指纹校验        │
│                             │
├─────────────────────────────┤
│ 连接步骤                     │
│ 1 PC 设置页启动移动 HUD       │
│ 2 生成并复制配对链接          │
│ 3 粘贴到这里，提交后回 PC 批准 │
├─────────────────────────────┤
│ [ 粘贴配对链接              ] │
│ [ 提交配对请求             ] │
├─────────────────────────────┤
│ 安全说明                     │
│ 手机只读；不会显示命令、路径、 │
│ prompt 或工具输入输出。       │
└─────────────────────────────┘
```

### 5.3 关键设计

- 顶部不是 Live HUD，而是“连接仪表”。
- `claudehud://pair?...` 只出现在输入框中；提交成功后立即清空或折叠。
- 输入框增加“清空 / 从剪贴板粘贴 / 重新说明”辅助操作。
- 链接解析成功后展示脱敏摘要：
  - `PC 192.168.31.200:27431`
  - `Token 已隐藏`
  - `指纹已隐藏`
  - `将在 60 秒后过期`
- 错误文案必须可行动：
  - “链接已过期，请回 PC 重新生成。”
  - “无法连接 PC，请确认手机和 PC 在同一 Wi‑Fi。”
  - “证书指纹不匹配，请删除旧连接并重新配对。”

---

## 6. 连接后界面设计：Mobile Dynamic HUD

### 6.1 总体布局

连接成功后主界面完全切换，不再显示配对卡。

```text
┌─────────────────────────────┐
│  Claude HUD One      ● 已连接│
├─────────────────────────────┤
│ ╭─────────────────────────╮ │
│ │  Clawd  Claude active   │ │  ← Mobile Dynamic Island
│ │  Tool finished · Skill  │ │
│ │  context 44% · $0.90    │ │
│ ╰─────────────────────────╯ │
│                             │
│  需要关注                   │
│ ╭─────────────────────────╮ │
│ │ ! PowerShell 需要授权    │ │
│ │ 请回 PC 终端处理 · 只读  │ │
│ ╰─────────────────────────╯ │
│                             │
│  会话                       │
│ ╭─────────────────────────╮ │
│ │ ● claude-worktrees       │ │
│ │ running · Bash           │ │
│ │ Sonnet · 3m · 44% ctx    │ │
│ ╰─────────────────────────╯ │
│ ╭─────────────────────────╮ │
│ │ ○ HUD 设置优化           │ │
│ │ active · Edit            │ │
│ ╰─────────────────────────╯ │
│                             │
│  [更多会话 7] [诊断]        │
└─────────────────────────────┘
```

### 6.2 顶部 Mobile Dynamic Island

借鉴 Desktop HUD `DesktopHudCapsule` 的结构：左翼 mascot / 中央状态 / 右翼计数。

手机端改为：

- 左侧：Clawd 像素 mascot 或状态光点。
- 中间：当前最重要会话的状态：
  - `Claude active`
  - `Running Bash`
  - `Waiting approval`
  - `Completed just now`
  - `Reconnecting…`
- 下方 ticker：轮播 2-3 个关键指标：
  - 活动：`Tool finished: Skill`
  - 模型：`Sonnet 4.6`
  - 上下文：`44%`
  - 成本：`$0.90`
  - 会话：`3 active`
- 右侧：注意项数量 / 会话序号 / 连接状态。

#### 动效

| 状态 | 动效 |
| --- | --- |
| running | 低频流光，ticker 每 4 秒切换 |
| waiting | 橙色脉冲，轻微放大 |
| completed | 绿色完成闪烁，90 秒后淡出 |
| reconnecting | 断续呼吸，显示最后同步时间 |
| disconnected | 灰色冻结态，保留最后快照 |

### 6.3 会话卡设计

借鉴 Desktop HUD `SessionCard`，手机端只保留必要字段：

```text
╭─────────────────────────────╮
│ ● claude-worktrees     运行中 │
│ Bash 正在执行 · 2 分钟前      │
│ Sonnet · plan · ctx 44%      │
│ ! 有 1 条授权需要回 PC 处理   │
╰─────────────────────────────╯
```

字段策略：

- 标题优先级：`sessionName` → 脱敏 workspace label → `Claude 会话 N`。
- 状态标签：运行中 / 等待中 / 活跃 / 空闲 / 异常。
- 正文只显示一行 `statusText`，超过 32 中文字符截断。
- Meta chips 最多 4 个：模型、工具、permission mode、更新时间。
- pending inline 只显示 1 条最重要提醒。
- 默认最多展示 3 个会话：
  - 等待处理优先；
  - 运行中优先；
  - 最近更新优先。

### 6.4 关注项设计

当前截图里最大问题是 attention 列表刷屏。连接后应改成“关注中心”：

```text
需要关注  12 条
╭─────────────────────────────╮
│ ! PowerShell 需要授权        │
│ 8 条类似请求 · 请回 PC 处理   │
╰─────────────────────────────╯
╭─────────────────────────────╮
│ ? Claude 正在等待回复        │
│ 2 个会话 · 请回 PC 终端查看   │
╰─────────────────────────────╯
```

规则：

- 按 `kind + toolName + sessionRef` 去重。
- 同类请求聚合：`PowerShell 授权 × 8`。
- 主界面最多展示 2 条，其余用“查看全部 N 条”。
- 手机端仍只读，按钮文案不叫“处理”，而叫：
  - `回 PC 查看`
  - `我知道了`（只关闭手机提醒，不回写 Claude Code）
- approval/question 的真实处理仍留在 PC。

### 6.5 完成卡设计

借鉴 Desktop HUD `CompletionCard`：

```text
╭─────────────────────────────╮
│ ✓ 已完成                     │
│ claude-worktrees 完成一轮任务 │
│ 刚刚 · 如需详情请查看 PC      │
╰─────────────────────────────╯
```

规则：

- 只保留 90 秒。
- 如果同时存在 waiting approval，approval 优先于 completion。
- 完成卡可以触发低敏通知：`Claude 任务已完成`。

### 6.6 诊断信息

诊断不应抢首屏。连接后折叠在底部：

```text
诊断  协议 v1 · 快照 4785 · 19 条通知
[展开]
```

展开后显示：

- PC endpoint：脱敏/可复制，但不展示 token。
- 最近同步时间。
- WebSocket 状态。
- 前台服务状态。
- 电池优化状态。
- 最近一次断线原因。

---

## 7. 后台连接与切换应用不断联设计

### 7.1 产品预期

用户切换手机应用后：

- **理想状态**：连接继续保持，通知栏显示低敏常驻通知。
- **系统限制状态**：如果 Android 省电策略阻止后台连接，App 必须明确提示并自动恢复。
- **不可接受状态**：用户一切出应用就静默断联，回到 App 看到无解释的断开。

### 7.2 技术产品方案

#### 方案 A：Foreground Service 作为默认后台连接方案

新增 `MobileHudConnectionService`：

- 负责持有 WebSocket。
- 持有最新 `MobileHudConnectionConfig`。
- 持有最新 snapshot cache。
- 通过 `StateFlow` / callback 向 Activity UI 暴露状态。
- Activity 只负责展示，不直接持有 WebSocket 生命周期。

常驻通知：

```text
Claude HUD One 已连接
正在同步 Claude Code 低敏状态
```

通知动作：

- `打开 HUD`
- `断开连接`

通知不显示：项目路径、命令、prompt、tool input/result、token、fingerprint。

#### 方案 B：后台弱保持 + 前台自动恢复

如果用户不允许常驻通知：

- App 进入后台时允许系统暂停连接。
- 回到前台时自动用保存的 `deviceId + host + fp` 重连。
- UI 标明：`后台保持未开启，回到应用时自动恢复。`

#### 推荐默认

一期优化建议默认采用：

```text
前台服务后台保持：开启
通知低敏：开启
用户可在设置里关闭后台保持
```

因为 Mobile HUD 的核心价值是“离开 PC 后仍能知道 Claude 状态”，没有后台保持会破坏产品定位。

### 7.3 断线重连状态机

```text
Connected
  ↓ onFailure / network lost / app process resume
Reconnecting
  ├─ 0s 立即重连
  ├─ 2s 第 2 次
  ├─ 5s 第 3 次
  ├─ 10s 第 4 次
  └─ 30s 稳态重试
      ↓ 成功
Connected
      ↓ 失败超过 2 分钟
DisconnectedRecoverable
```

规则：

- 前 2 分钟主界面保留最后快照，并显示 `正在重连`。
- 超过 2 分钟显示恢复页，但不清除设备。
- PC 服务重启后，应自动恢复，不要求重新配对。
- 只有证书指纹变化、设备 revoke、deviceId 401 才要求重新配对。

### 7.4 持久化内容

Android 本地保存：

```text
host
port
deviceId
spkiFingerprint
lastConnectedAt
lastSnapshotSummary
backgroundKeepAliveEnabled
```

不保存：

```text
pairing token
原始 pairing link
raw prompt
tool input/result
transcript path
project dir/cwd
```

### 7.5 Android 权限与设置提示

需要在界面中解释：

- Android 13+ 通知权限：用于后台连接状态和低敏提醒。
- 前台服务通知：用于保持与 PC 的加密连接。
- 电池优化：如果系统频繁杀后台，提示用户允许“无限制/不优化”。

文案建议：

```text
为了在切换应用后继续同步，Claude HUD One 会显示一条低敏常驻通知。
通知只显示连接状态，不显示项目名、命令、prompt 或工具内容。
```

---

## 8. 信息安全与隐私展示规则

### 8.1 主界面允许展示

- 会话别名 / 脱敏 workspace label。
- 活动状态：running / waiting / active / idle / error。
- 模型名。
- 工具名：Bash / Edit / Write / Skill 等。
- usage/cost/context 百分比。
- 低敏 attention 摘要。

### 8.2 主界面禁止展示

- 完整 pairing link。
- 完整 token / fingerprint。
- `projectDir`、`cwd`。
- `transcriptPath`。
- raw prompt。
- raw command。
- tool input/result。
- `intentId`、`allowedIntents`、`nonce`。

### 8.3 展示降级策略

如果 DTO 中缺少移动端安全文案：

- 不展示原始字段。
- 显示 fallback：`Claude Code 正在请求处理，请回 PC 查看。`

---

## 9. 文案规范

### 9.1 连接前

- 主标题：`连接到 PC`
- 副标题：`粘贴 PC 设置页生成的配对链接。手机端只读显示 Claude 状态。`
- 按钮：`提交配对请求`
- 等待批准：`已提交。请回 PC 批准这台手机。`

### 9.2 连接后

- 状态：`已连接`
- 同步：`实时 HUD 正在同步`
- 重连：`正在恢复连接，继续显示最后一次状态。`
- 后台：`后台同步已开启`
- 断开：`PC 暂时不可达，正在重试。`

### 9.3 禁用词

- 不说“submit”。
- 不说“response body / WebSocket / DTO”。
- 不让用户看到工程术语，除非在诊断页。

---

## 10. 实现阶段建议

### Phase M1：界面状态拆分

- 新增 `MobileHudAppState`：unpaired / pairing / waitingApproval / connected / reconnecting / disconnected / revoked。
- 连接前只渲染 `PairingScreen`。
- 连接后只渲染 `LiveHudScreen`。
- 已连接后隐藏配对输入框和完整链接。

验收：

- 未连接截图不出现 Live HUD 假数据。
- 已连接截图不出现完整配对链接。

### Phase M2：Mobile Dynamic HUD 组件化

新增组件：

- `MobileHudIsland`
- `MobileSessionCard`
- `MobileAttentionStack`
- `MobileCompletionCard`
- `MobileDiagnosticsSheet`

验收：

- 连接后首屏能在 5 秒内看懂当前主状态。
- 会话默认最多 3 条。
- attention 默认最多 2 类聚合。
- UUID/长英文不刷屏。

### Phase M3：后台连接服务

新增：

- `MobileHudConnectionService`
- `MobileHudConnectionRepository`
- 连接配置持久化
- Foreground service notification
- 断线重连状态机

验收：

- 切到其他 App 3 分钟后返回，仍显示 connected 或 reconnecting，不静默回到未连接。
- PC 服务重启后，手机自动恢复。
- revoke 后手机进入 revoked / 重新配对状态。

### Phase M4：通知与电池优化体验

- 通知权限引导。
- 后台保持开关。
- 电池优化诊断。
- 低敏通知模板统一。

验收：

- Android 13+ 未授权通知时有明确引导。
- 关闭后台保持时，界面明确说明“回到 App 时恢复”。

---

## 11. 验收清单

### 11.1 视觉验收

- [ ] 连接前和连接后截图一眼可区分。
- [ ] 已连接首屏不显示配对链接输入框。
- [ ] 已连接首屏不是纯文本堆叠。
- [ ] 有类似 Desktop HUD 的动态胶囊/会话卡/注意项层级。
- [ ] 长 ID、UUID、英文 fallback 不进入主视图刷屏。

### 11.2 交互验收

- [ ] 配对失败有明确可操作原因。
- [ ] PC 批准后自动进入 Live HUD。
- [ ] attention 聚合后仍能知道“回 PC 处理”。
- [ ] 诊断信息可展开但默认不抢主界面。

### 11.3 后台连接验收

- [ ] 切换手机应用后 3 分钟内不断联，或显示后台同步通知。
- [ ] 回到 App 后自动恢复最新状态。
- [ ] 网络切换后进入 reconnecting，而不是回到未配对。
- [ ] PC 服务重启后自动恢复。
- [ ] PC revoke 后手机明确提示“设备已撤销，请重新配对”。

### 11.4 安全验收

- [ ] UI dump 不包含完整 token / fingerprint。
- [ ] UI dump 不包含 projectDir / cwd / transcriptPath。
- [ ] UI dump 不包含 raw prompt / raw command / tool input/result。
- [ ] 手机端没有 allow / deny / answer / terminal jump 控件。

---

## 12. 设计决策总结

1. **连接页和 Live HUD 必须完全拆开**：连接页服务于“接入”，Live HUD 服务于“观察”。
2. **连接后以 Mobile Dynamic Island 为首屏核心**：抄 Desktop HUD 的状态机和信息层级，而不是抄文本字段。
3. **手机端默认压缩信息**：最多 3 个会话、2 类关注项、1 个完成卡，其他折叠。
4. **后台连接必须产品化**：Foreground Service + 低敏常驻通知是默认方案，不再让 Activity 直接持有连接。
5. **断线不是失败，而是状态**：reconnecting / recoverable / revoked 要有不同界面和文案。
6. **安全边界不变**：手机仍是只读观察端，所有真实处理回 PC。

---

## 13. 下次实现入口

建议下次从以下文件切入：

- Android 当前 UI：`apps/android/app/src/main/java/com/claudehud/one/mobile/MainActivity.kt`
- Android client：`apps/android/app/src/main/java/com/claudehud/one/mobile/MobileHudClient.kt`
- Android manifest：`apps/android/app/src/main/AndroidManifest.xml`
- Desktop HUD 参考：`src/components/desktopHud/DesktopHudRoot.tsx`
- Desktop 胶囊参考：`src/components/desktopHud/DesktopHudCapsule.tsx`
- Desktop 会话卡参考：`src/components/desktopHud/SessionCard.tsx`
- Desktop 关注项参考：`src/components/desktopHud/PendingQueueSurface.tsx`
- Desktop 完成卡参考：`src/components/desktopHud/CompletionCard.tsx`

实现前先补自动化测试：

- Android unit tests：连接状态 reducer / attention 聚合 / 安全脱敏。
- Emulator UI dump：未连接不显示 Live HUD；已连接不显示 pairing link；attention 不刷屏。
- 真机验收：切后台 3 分钟、锁屏 1 分钟、网络切换、PC 服务重启、PC revoke。
