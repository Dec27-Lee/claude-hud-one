# Claude HUD One 内置 Claude HUD Plus 终端 HUD 集成分析

> 日期：2026-06-10  
> 文档版本：v2，按用户 6 条新约束修订  
> 范围：继续只读研究当前仓库与 `E:\Develop_E\claude-hud-plus`，把方案从“兼容外部 Claude HUD Plus 的谨慎集成”调整为“Claude HUD One 的一体化目标架构”。  
> 本轮不做：不搬代码、不改安装逻辑、不读取 prompt / tool-result / transcript 正文或凭据。

## 0. 本次修订的硬约束

用户已明确新的产品方向：

1. **Claude HUD Plus 现在支持展示的所有信息，新项目里也必须能展示**，不能只保留基础 model/context/status。
2. **Claude HUD Plus 现有 UI 可视化样式配置能力，要整合到新项目 Settings 的独立 tab**，不需要和桌面端设置耦合。
3. **不考虑历史用户迁移问题**，配置冲突可以直接覆盖。
4. **不考虑 Claude HUD Plus 的恢复**，也不需要兼容“恢复回外部 HUD Plus”。
5. **共享给桌面端的字段也应该可配置**：未来桌面悬浮窗展示哪些信息项，也要能由用户定义，而不是现在固定写死。
6. **项目名称已确定为 Claude HUD One**，远程仓库名将改为 `claude-hud-one`，后续工作区命名需统一到这个品牌。

因此上一版报告中的这些判断需要调整：

- “保留外部 HUD Plus 恢复路径”改为：**新项目直接接管并覆盖 Claude Code statusLine 配置**。
- “只共享少量公共字段”改为：**建立可配置的字段注册表和 display item registry，终端与桌面都能按配置选择展示项**。
- “HUD Plus UI 控制台后置”改为：**Terminal HUD 的可视化配置应作为 Settings 独立 tab 的一等功能**。
- “迁移/兼容已有 HUD Plus 用户”改为：**不做历史迁移设计，按新产品默认配置覆盖冲突**。

## 1. 新结论

推荐把当前项目升级为一个新的 Windows 本地 Claude HUD One 套件：

> 一个安装包、一个 Settings、一个 Claude Code `statusLine.command` owner，同时提供 **Terminal HUD** 与 **Desktop HUD** 两个展示面。

更明确地说，新项目应该是：

```text
Claude HUD One
= Terminal HUD（完整覆盖 Claude HUD Plus 能力）
+ Desktop HUD（当前 Claude HUD One 悬浮窗能力升级）
+ Unified Bridge（统一 Claude Code 信息采集）
+ Display Registry（终端/桌面都可配置展示项）
+ Settings Studio（Terminal HUD 与 Desktop HUD 分 tab 可视化配置）
```

关键变化：

- **Claude HUD One 不再只是桌面动态岛**，而是 HUD 套件宿主；
- **Claude HUD Plus 不再是外部插件依赖**，其终端渲染能力应被内置为 Terminal HUD 模块；
- **配置冲突不再走迁移/恢复路径**，新产品作为唯一 owner 直接覆盖；
- **桌面悬浮窗也要从固定 UI 变成可配置展示系统**，和 Terminal HUD 一样有信息项注册表；
- **项目名已确定为 Claude HUD One**，同时保留 Claude 与 HUD 识别，并强调一个应用统一终端与桌面 HUD。

## 2. 最终命名

用户已明确：项目名必须同时包含 **Claude** 和 **HUD**，因为工具就是专注 Claude Code 使用；最终名称确定为 **Claude HUD One**，远程仓库名将改为 `claude-hud-one`。

### 2.1 正式名称：Claude HUD One

统一建议：

- 产品名：**Claude HUD One**
- 仓库名：`claude-hud-one`
- 安装应用名：`Claude HUD One`
- 副标题：**Terminal & Desktop HUD Suite for Windows**
- 中文描述：**面向 Windows 的 Claude Code 本地 HUD 套件，同时提供终端 statusLine HUD 与桌面悬浮 HUD。**

命名含义：

- `Claude`：明确服务对象是 Claude Code 用户；
- `HUD`：覆盖终端 statusLine HUD 与桌面悬浮 HUD 两个展示面；
- `One`：表达一个应用、一个 Settings、一个 Bridge owner、一个共享状态中心；
- 后续 README / About / installer 仍建议明确 **Unofficial / Not affiliated with Anthropic**，避免误认为官方产品。

### 2.2 备选：Claude HUD Suite

建议：

- 产品名：**Claude HUD Suite**
- 仓库名：`claude-hud-suite`
- 副标题：**Terminal & Desktop HUD for Claude Code**

优点：

- 同时包含 `Claude` 和 `HUD`；
- `Suite` 能表达“终端 HUD + 桌面 HUD + Settings Studio”的组合产品；
- 比 `Claude HUD One` 更像一个产品套件名称。

缺点：

- 少了 `Code`，可能被理解为面向 Claude Desktop / Claude 网页，而不是 Claude Code；
- 需要副标题强调 `for Claude Code`。

### 2.3 备选：Claude HUD Desk

建议：

- 产品名：**Claude HUD Desk**
- 仓库名：`claude-hud-desk`
- 副标题：**Desktop & Terminal HUD for Claude Code on Windows**

优点：

- 同时包含 `Claude` 和 `HUD`；
- `Desk` 能表达 Windows 桌面、本地应用、悬浮 HUD；
- 比 `Claude HUD Suite` 更有桌面工具感。

缺点：

- `Desk` 对终端 statusLine 能力表达不够强；
- 仍需要副标题说明不是只做桌面悬浮窗。

### 2.4 备选：Claude HUD Plus Desk

建议：

- 产品名：**Claude HUD Plus Desk**
- 仓库名：`claude-hud-plus-desk`
- 副标题：**Claude HUD Plus with Desktop HUD for Windows**

优点：

- 延续 `Claude HUD Plus` 的既有资产；
- 对熟悉旧终端插件的用户最容易理解：这是 Plus 的桌面增强版。

缺点：

- 名字偏长；
- 容易让人误解为“Claude HUD Plus 的附属桌面版”，而不是一个新的统一 HUD 套件；
- 如果后续项目独立发展，Plus 这个后缀可能成为包袱。

### 2.5 命名结论

最终统一为：

> **Claude HUD One**  
> Terminal & Desktop HUD Suite for Windows

此前备选 `Claude HUD Suite`、`Claude HUD Desk`、`Claude HUD Plus Desk` 不再作为正式命名继续推进，仅保留为命名讨论记录。

建议后续统一使用：

- App display name：`Claude HUD One`
- Repo slug：`claude-hud-one`
- Windows executable：`claude-hud-one.exe`
- AppData 目录：`Claude HUD One`
- Settings 标题：`Claude HUD One Settings`
- About 文案：`An unofficial terminal and desktop HUD suite for Claude Code on Windows.`

## 3. 新目标架构

### 3.1 总体架构

```text
                 ┌──────────────────────────────┐
                 │ Claude Code                  │
                 │ statusLine stdin + hooks     │
                 └──────────────┬───────────────┘
                                │
                                ▼
       ┌──────────────────────────────────────────────────┐
       │ Claude HUD One Bridge Core                              │
       │ 唯一 statusLine owner / hooks owner              │
       ├──────────────────────────────────────────────────┤
       │ 1. 读取 stdin / hooks                            │
       │ 2. 生成 Normalized HUD State                     │
       │ 3. 写入 Shared State Store                       │
       │ 4. 调用 Terminal HUD Renderer 输出 stdout        │
       │ 5. 为 Desktop HUD 提供可配置字段投影             │
       └──────────────┬─────────────────────┬─────────────┘
                      │                     │
                      ▼                     ▼
     ┌──────────────────────────┐   ┌──────────────────────────────┐
     │ Terminal HUD             │   │ Shared State Store           │
     │ 内置 Claude HUD Plus 能力 │   │ sessions / usage / metrics   │
     │ rows / colors / preview  │   │ configurable field schema    │
     └──────────────────────────┘   └──────────────┬───────────────┘
                                                     │
                                                     ▼
                                   ┌────────────────────────────────┐
                                   │ Desktop HUD                    │
                                   │ 可配置 compact / peek / panel  │
                                   └────────────────────────────────┘

     ┌──────────────────────────────────────────────────────────────┐
     │ Settings Studio                                              │
     │ Terminal HUD tab：完整 HUD Plus 可视化配置                   │
     │ Desktop HUD tab：桌面信息项/布局可配置                       │
     │ Bridge tab：接管 statusLine / hooks / diagnostics            │
     └──────────────────────────────────────────────────────────────┘
```

### 3.2 statusLine 所有权

新项目不再把 HUD Plus 视为外部上游，也不需要 restore 外部 HUD Plus。安装 / 启用时直接成为唯一 owner：

```text
~/.claude/settings.json
  statusLine.command = Claude HUD One Bridge command
  hooks.* = Claude HUD One Bridge hook command
```

配置冲突处理策略：

- 若已有 `statusLine.command`：直接覆盖；
- 若已有 Claude HUD Plus 配置：不迁移、不恢复；
- 若已有其他 statusLine：不作为产品需求处理；
- Settings 里可显示“Claude HUD One currently owns Claude Code statusLine”，但不需要提供恢复外部插件路径。

> 仍建议实现写入前的内部备份用于调试或卸载异常排查，但备份不是用户迁移/恢复功能，也不是产品承诺。

### 3.3 statusLine 热路径不能依赖桌面 GUI

即使产品是一体化，statusLine command 仍不应依赖 Tauri GUI 进程存活。推荐：

- Bridge runtime / terminal renderer 是轻量 Node 脚本或独立 CLI；
- Tauri 桌面应用负责安装、配置、预览、诊断；
- Claude Code 调 statusLine 时只执行 Bridge runtime；
- 桌面 app 未启动时，Terminal HUD 仍正常工作；
- Terminal HUD 渲染失败时输出简洁 fallback，不影响 shared state 写入。

## 4. Terminal HUD 必须完整覆盖 Claude HUD Plus 展示能力

用户已明确要求：Claude HUD Plus 现在支持展示的所有信息，新项目里也要能展示。因此 Terminal HUD 模块应以 **Claude HUD Plus 现有能力为功能基线**。

### 4.1 信息项完整覆盖清单

#### Model / 路由模型

必须支持：

- Claude Code 原始模型名；
- provider 标签；
- `modelFormat`: `full` / `compact` / `short`；
- `modelOverride`；
- CCR / Claude Code Router 真实路由模型；
- `Routing...` / pending 状态；
- 路由模型缺失时的提示；
- effort / thinking 强度标识。

#### Context

必须支持：

- 上下文进度条；
- 上下文数值模式：percent / tokens / remaining / both；
- input / output / cache creation / cache read token 明细；
- context warning / critical 阈值；
- `autocompactBuffer`；
- context window size override；
- 以 token K 数显示，而不只依赖百分比。

#### Project / Workspace

必须支持：

- 当前项目路径/项目名；
- `pathLevels` 1/2/3；
- added dirs；
- added dirs inline / line 两种布局；
- 安全 file link / path rendering；
- 截断与 wrap。

#### Git

必须支持：

- branch；
- dirty 标记；
- ahead / behind；
- push warning / critical 阈值；
- changed file stats：modified / added / deleted / untracked；
- line diff：added / deleted；
- branch overflow：truncate / wrap。

#### Session

必须支持：

- session tokens；
- input / output / cache token breakdown；
- session start time；
- last response time；
- session name / rename 后标题；
- duration；
- Claude Code version。

#### Activity

必须支持：

- activity 组合行；
- `activityLine.mode`: auto / details / summary；
- `activityLine.maxWidthRatio`；
- `toolNameFormat`: full / short；
- activity items：todos / agents / tools / sessionTime；
- activity warnings：usage / memory / environment / promptCache。

#### Tools

必须支持：

- running tool；
- completed tool statistics；
- tool name；
- tool target / path 的安全截断；
- MCP tool short name；
- tool call count。

#### Agents

必须支持：

- running agent；
- completed agent；
- agent type；
- agent model；
- agent description；
- agent duration。

#### Todos

必须支持：

- current todo；
- completed / total；
- all done 状态。

#### Usage

必须支持：

- 5h usage；
- 7d usage；
- usage bar；
- used / remaining；
- reset time：relative / absolute / both；
- limit reached；
- compact usage；
- balance label；
- external usage snapshot / freshness。

#### Cost

必须支持：

- Claude Code 原生 cost；
- local estimate fallback；
- native / estimated 标签；
- session cost 展示。

#### System / Environment

必须支持：

- CLAUDE.md count；
- rules count；
- MCP count；
- hooks count；
- outputStyle；
- memory usage / RAM bar；
- prompt cache TTL / active / warning / expired。

#### Custom

必须支持：

- `customLine` 自定义短语。

### 4.2 Terminal HUD 布局/样式配置必须覆盖

必须保留并可配置：

- `rows`；
- row item：`model`、`contextBar`、`contextValue`、`project`、`git`、`addedDirs`、`sessionTokens`、`usage`、`promptCache`、`memory`、`environment`、`tools`、`agents`、`todos`、`activity`、`sessionTime`、`customLine`；
- `rowOverflow`: truncate / wrap；
- `pathLevels`；
- `maxWidth`；
- `addedDirsLayout`: inline / line；
- `gitStatus` 全套配置；
- `activityLine` 全套配置；
- `display.*` 全套开关与阈值；
- `colors.*` 全套颜色；
- `contextBands` / `usageBands`；
- `barFilled` / `barEmpty`；
- legacy 字段读取兼容可以后置，但新配置以 rows 为准。

## 5. Settings Studio 设计

用户已明确：HUD Plus 现有 UI 可视化样式配置能力要整合进新项目设置界面，独立 tab 展示，不需要和桌面端耦合。

### 5.1 Settings 信息架构

建议 Settings 顶部 tab 改为：

1. **General**：语言、低功耗、启动项、基础行为；
2. **Terminal HUD**：完整 Claude HUD Plus 样式/布局配置；
3. **Desktop HUD**：桌面悬浮窗展示项与布局配置；
4. **Bridge**：statusLine / hooks 接管、健康检查；
5. **Updates**：手动更新 / 版本；
6. **Diagnostics**：路径、状态、隐私说明、调试。

如果保留当前 6 tab，也应把 Claude tab 拆分为：

- Bridge；
- Terminal HUD；
- Desktop HUD。

### 5.2 Terminal HUD tab 必须包含的能力

参考 Claude HUD Plus UI，至少应包含：

#### Builder / 布局编辑

- rows 可视化；
- 拖拽 row item；
- 新增/删除行；
- item 顺序调整；
- row overflow 切换；
- max width 设置；
- 组件详情面板。

#### Item 详情配置

至少覆盖：

- model：format / override；
- context：value mode / thresholds / autocompactBuffer；
- project：pathLevels；
- git：dirty / ahead-behind / file stats / thresholds；
- addedDirs：inline / line；
- usage：5h/7d、bar、compact、reset label、thresholds、timeFormat；
- promptCache：TTL；
- environment：config counts、output style、threshold；
- activity：mode、width ratio、tool name format、items、warnings；
- sessionTime：start / last response；
- customLine。

#### Color Workbench

必须覆盖：

- labelTitle / labelValue；
- warning / critical；
- model / project / git / gitBranch / context / usage / usageWarning / custom；
- barFilled / barEmpty；
- contextBands / usageBands。

#### Preview / JSON / Diff

必须支持：

- 实时预览；
- dark/light preview；
- ANSI -> HTML 预览；
- 原始 JSON 编辑；
- 保存前 diff；
- validate；
- reset default。

由于用户不要求历史迁移/恢复，备份恢复可以不作为核心产品能力，但保存前 diff / validate 仍有必要，避免配置写坏后 Terminal HUD 热路径报错。

#### Diagnostics

必须支持：

- Bridge runtime 是否存在；
- Terminal renderer 是否存在；
- Node/运行时是否可用；
- rows 是否存在未知 item；
- config 是否可渲染；
- width probe 是否正常；
- CCR 状态；
- statusLine owner 是否为 Claude HUD One。

### 5.3 Desktop HUD tab 必须成为新能力

当前桌面端是固定展示，用户明确希望未来可定义悬浮窗展示信息项。因此 Desktop HUD tab 需要独立设计，不能只复用 Terminal HUD rows。

建议提供：

- compact slots 配置；
- peek slots 配置；
- expanded pages 配置；
- display item 开关；
- item 顺序；
- provider 选择；
- session / usage / cost / overview 组件模板；
- 字段可见性；
- 桌面预览。

第一阶段可以不做拖拽，先支持：

- 模板选择；
- item 开关；
- 上移/下移；
- compact / peek / expanded 各模式分别配置。

## 6. 可配置 Shared State 与 Display Registry

用户第五条是本轮最关键的新约束：shared 给桌面端的字段应支持配置，未来要能定义桌面悬浮窗展示的信息项。

因此不能再把 shared state 理解成“固定脱敏字段 JSON”。应改为三层模型：

```text
Field Schema      定义有哪些可引用字段
Display Item      定义有哪些可展示组件
Layout Slots      定义每个模式/位置展示哪些 item
```

### 6.1 Field Schema

示意：

```ts
type HudFieldSchema = {
  key: string
  label: string
  sourcePath: string
  valueType: 'string' | 'number' | 'percent' | 'duration' | 'currency' | 'tokenCount' | 'enum' | 'boolean' | 'list'
  scope: 'terminal' | 'desktop' | 'both'
  privacy: 'public' | 'sensitive' | 'restricted'
  defaultEnabled: boolean
  formatters?: string[]
}
```

桌面端首批应注册：

- `session.activity`；
- `session.projectSlug`；
- `session.sessionLabel`；
- `session.statusText`；
- `session.modelLabel`；
- `session.activeToolName`；
- `session.contextUsedTokens`；
- `session.contextUsedPercent`；
- `session.totalCostUsd`；
- `session.updatedAt`；
- `session.multiSessionCount`；
- `provider.claude.fiveHour.usedPercent`；
- `provider.claude.fiveHour.resetAt`；
- `provider.claude.weekly.usedPercent`；
- `provider.claude.source`；
- `cost.claude.todayUsd`；
- `cost.claude.monthUsd`；
- `overview.dailyBuckets`；
- `overview.activeDays`；
- `meta.privacyNote`。

### 6.2 Display Item Registry

示意：

```ts
type HudDisplayItem = {
  id: string
  label: string
  target: 'terminal' | 'desktop' | 'both'
  category: 'session' | 'usage' | 'cost' | 'overview' | 'git' | 'tools' | 'agents' | 'todos' | 'system' | 'custom'
  fieldKeys: string[]
  supportedModes: string[]
  renderer: string
  configurable: boolean
}
```

Desktop HUD 初版 item：

- `session.activityBadge`；
- `session.identity`；
- `session.statusTicker`；
- `session.toolChip`；
- `session.modelChip`；
- `session.contextChip`；
- `session.costChip`；
- `session.multiSessionCounter`；
- `usage.providerCard`；
- `usage.windowMini`；
- `cost.hero`；
- `cost.metricPair`；
- `overview.heatmap`；
- `overview.summaryStats`；
- `meta.lastUpdated`；
- `meta.privacyNote`。

Terminal HUD 的 item 可以映射 HUD Plus row items：

- `terminal.model`；
- `terminal.contextBar`；
- `terminal.contextValue`；
- `terminal.project`；
- `terminal.git`；
- `terminal.addedDirs`；
- `terminal.sessionTokens`；
- `terminal.usage`；
- `terminal.promptCache`；
- `terminal.memory`；
- `terminal.environment`；
- `terminal.tools`；
- `terminal.agents`；
- `terminal.todos`；
- `terminal.activity`；
- `terminal.sessionTime`；
- `terminal.customLine`。

### 6.3 Desktop Layout Slots

Terminal 继续使用 rows，Desktop 使用 slots：

```ts
type DesktopHudLayout = {
  compact: {
    left: HudDisplayAssignment[]
    center: HudDisplayAssignment[]
    right: HudDisplayAssignment[]
  }
  peek: {
    primary: HudDisplayAssignment[]
    secondary: HudDisplayAssignment[]
  }
  expanded: {
    pages: DesktopHudPage[]
  }
}
```

默认布局可以等价复刻当前桌面 UI，但从配置生成：

- compact：activity + statusTicker + session counter；
- peek：identity + status + context；
- expanded/session：CurrentSessionStrip；
- expanded/usage：UsageView；
- expanded/cost：CostView；
- expanded/overview：OverviewView。

后续用户可替换这些 item。

### 6.4 隐私边界仍要保留

“字段可配置”不等于“原始字段都能展示”。应区分：

- 原始源数据；
- normalized state；
- desktop-safe projection；
- display item config。

桌面可配置字段只能来自 allowlist。

禁止进入 desktop-safe 的内容仍包括：

- prompt 正文；
- tool input；
- tool result；
- transcript 正文；
- MCP payload；
- credentials；
- 原始长命令；
- 未脱敏完整路径。

## 7. 配置冲突与安装策略

按用户新约束：不考虑历史迁移、不考虑恢复，配置冲突直接覆盖。

### 7.1 安装 / 启用时直接覆盖

策略：

- 写入 Claude HUD One Bridge 为唯一 `statusLine.command`；
- 写入 Claude HUD One hooks；
- 写入 Claude HUD One 默认 terminal HUD config；
- 写入 Claude HUD One 默认 desktop HUD config；
- 若已有 HUD Plus / Claude HUD One / 自定义 statusLine 配置，不做迁移，不提供恢复。

### 7.2 Settings 中的说明

Settings 不需要展示复杂兼容模式，只需要显示：

- Claude HUD One owns Claude Code statusLine；
- Terminal HUD enabled / disabled；
- Desktop HUD enabled / disabled；
- Bridge health；
- Last status update。

可以保留“重新安装/修复 Claude HUD One Bridge”按钮，但不需要“恢复原 statusLine”按钮。

### 7.3 卸载

虽然不考虑 HUD Plus 恢复，但卸载仍应清理自己写入的内容：

- 移除 Claude HUD One hooks；
- 移除 Claude HUD One statusLine；
- 清理 AppData；
- 清理 HKCU Run；
- 不负责恢复外部 HUD Plus。

这不是历史迁移/恢复，而是产品自身清理边界。

## 8. 实施路线（按新约束修订）

### Phase 0：定名与协议

产物：

- 项目新名：推荐 `Claude HUD One`；
- `NormalizedHudState`；
- `HudFieldSchema`；
- `HudDisplayItemRegistry`；
- `TerminalHudConfig`；
- `DesktopHudConfig`；
- privacy allowlist。

### Phase 1：Terminal HUD 内置化

目标：完整复用 Claude HUD Plus 终端能力。

任务：

- 抽取 HUD Plus runtime / renderer / config；
- 产出内置 terminal renderer；
- bridge 调用 renderer 输出 stdout；
- statusLine owner 直接覆盖为 Claude HUD One；
- 保留 fallback。

验收：HUD Plus 当前所有 row item 和 display 配置可用。

### Phase 2：Terminal HUD Settings tab

目标：把 HUD Plus UI 配置控制台整合进新 Settings。

任务：

- rows builder；
- item detail panel；
- color workbench；
- preview；
- JSON editor；
- diff / validate；
- diagnostics。

验收：不需要打开外部 HUD Plus UI，即可完成当前 HUD Plus 的样式与布局配置。

### Phase 3：Desktop HUD Display Registry

目标：让桌面悬浮窗展示项可配置。

任务：

- field schema；
- desktop-safe projection；
- desktop display item registry；
- compact / peek / expanded layout config；
- 当前 UI 改为由默认 config 生成。

验收：用户可以控制桌面 HUD 显示 model、context、tool、usage、cost 等哪些信息项。

### Phase 4：Desktop HUD Settings tab

目标：提供桌面展示配置界面。

任务：

- compact/peek/panel 模板；
- item 开关；
- item 顺序；
- provider 选择；
- 预览；
- 保存/重置默认。

### Phase 5：高级能力

后置：

- CCR 真模型增强完整 UI；
- transcript-derived safe fields；
- terminal / desktop 主题联动；
- 更多 provider；
- 更复杂的拖拽式 Desktop HUD 布局。

## 9. 验收标准

### 9.1 Terminal HUD parity

- Claude HUD Plus 当前所有 row item 在新项目中可展示；
- Claude HUD Plus 当前所有 display/git/activity/color 配置在新项目中可保存并生效；
- UI 可视化配置能力达到当前 HUD Plus UI 控制台水平；
- 终端预览与真实 statusLine 输出一致；
- Windows PowerShell / VS Code terminal / CJK 宽度不明显回归。

### 9.2 Desktop HUD configurability

- 桌面 compact/peek/expanded 展示项不再固定；
- 用户可以选择显示哪些信息项；
- 用户可以调整信息项顺序；
- 默认配置复刻当前桌面 UI；
- 新增字段需要先注册 field schema，不能直接穿透 UI。

### 9.3 Bridge ownership

- Claude Code 只有一个 `statusLine.command`，且指向 Claude HUD One；
- hooks 指向 Claude HUD One；
- 配置冲突时 Claude HUD One 直接覆盖；
- Settings 可一键修复 Claude HUD One Bridge；
- 不提供恢复外部 HUD Plus 的产品路径。

### 9.4 隐私

- shared state 不出现 prompt / transcript 正文 / tool input / tool result / credentials；
- Terminal HUD 可内部读取 transcript 做增强，但不写入正文到 shared state；
- Desktop HUD 可配置字段必须来自 desktop-safe allowlist；
- 增加敏感字段扫描测试。

## 10. 对用户 6 条要求的逐条回应

1. **HUD Plus 所有展示信息新项目都要支持**：已调整为 Terminal HUD parity，列出 model/context/project/git/session/activity/tools/agents/todos/usage/cost/system/custom 全量覆盖清单。
2. **HUD Plus UI 配置整合到 Settings 独立 tab**：已调整为 Settings Studio 的 Terminal HUD tab，包含 rows builder、item detail、color workbench、preview、JSON、diff、diagnostics。
3. **不考虑历史用户迁移，配置冲突直接覆盖**：已删除迁移/导入/保守模式，改为 Claude HUD One 直接接管 statusLine/hooks/default config。
4. **不考虑 HUD Plus 恢复**：已删除“恢复外部 HUD Plus”的推荐，只保留卸载清理自身内容。
5. **shared 给桌面端字段应可配置**：已新增 Field Schema / Display Item Registry / Desktop Layout Slots 方案，支持未来定义桌面展示项。
6. **项目名称需要改**：推荐 `Claude HUD One`，备选 `Claude HUD Suite`、`Claude HUD Desk`、`Claude HUD Plus Desk`；建议仓库名 `claude-hud-one`，副标题 `Terminal & Desktop HUD Suite for Windows`。

## 11. 当前最小下一步

如果进入实现，不建议直接开搬代码。最小下一步应是先写 4 个技术规格文件：

1. `NormalizedHudState` / `HudFieldSchema` 类型草案；
2. Terminal HUD parity matrix（HUD Plus 展示项和配置项矩阵）；
3. Settings Studio tab 信息架构与 UI 草图；
4. Claude HUD One Bridge ownership 写入/卸载清理策略。

这 4 个规格写清后，再进入代码抽取和改造会更稳。