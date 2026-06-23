# Claude Code 终端、桌面端、移动端产品与技术架构分析报告

- 日期：2026-06-22
- 研究对象：Claude Code CLI/终端、Claude Desktop / Code tab / IDE 集成、Claude iOS/Android App 与 Claude Code Remote Control / Web / SDK 等相关形态
- 研究方式：基于公开资料检索、官方文档、包元数据、公开仓库、应用商店页面与多轮交叉核验整理；未做私有二进制逆向。
- 结论标注：
  - **公开事实**：官方文档、公开包/仓库或应用商店明确可见。
  - **强推断**：多处公开信息互相印证，但未直接公开内部实现源码。
  - **弱推断/未知**：公开资料不足，不能写成确定事实。

---

## 1. 总结先行

### 1.1 Claude Code 不是单一客户端，而是一组共享 Agent 能力的产品面

从公开资料看，Claude Code 至少包含以下几类 surface：

1. **终端 / CLI：`claude`**  
   本地 coding-agent 命令行入口，支持交互 TUI、非交互 `-p/--print`、pipe input、恢复会话、后台 agent、worktree、MCP、hooks、skills、plugins、Remote Control、本地/远程 web session 等能力。

2. **桌面端：Claude Desktop App 的 Code tab / Claude Code Desktop 体验**  
   官方桌面文档明确 Claude Desktop 有 Chat、Cowork、Code 三个 tab；Code tab 面向 Claude Code 工作流。Desktop 与 CLI “运行同一个底层 engine，并提供图形界面”，但 Desktop 是交互式图形产品，不支持 CLI 的 `--print` / `--output-format` 这类 headless 输出。

3. **IDE 集成：VS Code / JetBrains 等**  
   IDE 集成提供图形面板、诊断/代码执行等 IDE MCP 能力。VS Code extension 文档/Marketplace 信息显示它会 bundle 一个私有 CLI copy 用于 chat panel；如果要在 VS Code terminal 直接运行 `claude`，仍需要单独安装 standalone CLI。

4. **移动端：Claude iOS / Android App + Claude Code Remote Control**  
   移动 App 本身是 Claude consumer app，支持跨 web/iOS/Android 继续对话、上传文件/图片等。它参与 Claude Code 的方式主要不是“在手机本地跑 coding agent”，而是通过 Remote Control 成为本机 Claude Code session 的远程窗口：本机 Claude Code 继续在本机运行，手机/网页只是控制窗口。

5. **Web / Cloud：Claude Code on the web、routines**  
   `claude.ai/code` 可以在 Anthropic-managed cloud infrastructure 上运行云端 Claude Code session；routines 是保存后的 Claude Code 配置，可由 schedule、GitHub event、HTTP API 等触发。这与 Remote Control 的“本地运行、远程窗口”是两个不同执行边界。

6. **Agent SDK：TypeScript / Python SDK**  
   Claude Agent SDK 官方定位是“把 Claude Code 作为库”来构建生产级 agent。TypeScript SDK 公开资料显示其通过 optional dependencies / platform binary 复用 Claude Code binary，并由 `query()` 启动 Claude Code CLI subprocess，复用 Claude Code 的 tools、agent loop、context management。

### 1.2 “用什么语言/框架开发”的确定性结论

补充说明：如果把“Claude Code 是 TypeScript 开发的”理解为“Claude Code 内部源码里存在大量 TypeScript”，这个判断有公开报道与包形态线索支撑；但如果理解为“当前 native binary 的全部核心实现语言、构建链路、语言占比已经由官方公开确认”，公开证据还不够。更准确的写法是：**Claude Code 有明确的 TypeScript/JavaScript 生态痕迹与历史源码泄露报道；当前官方安装形态则是 native binary + npm/Node wrapper/optional dependency 分发机制。**

| 对象 | 可以确定的公开事实 | 不能确定 / 不应写死 |
| --- | --- | --- |
| `claude` / Claude Code CLI | 通过 npm 包 `@anthropic-ai/claude-code` 分发；官方 setup 文档说明 npm 包安装的是同一个 native binary，native binary 本身不调用 Node；当前包元数据可见 Node postinstall、JS wrapper、`.d.ts` 类型文件、平台 optional binary packages；媒体报道曾称某 release 误包含大量 TypeScript 源码/source map。 | 可以说 TS/JS 是 Claude Code 实现与分发生态中的重要组成；但不能把媒体报道、source map 事故或 wrapper 文件等同于官方正式公开的完整源码、稳定 API 或当前版本全部核心语言占比。 |
| `ant` / Anthropic CLI | 官方 GitHub `anthropics/anthropic-cli` 是 API-first CLI，主要语言 Go（GitHub language stats 显示 Go 占绝大多数）。 | `ant` 不是 Claude Code CLI；不能把 `ant` 的 Go 技术栈套到 `claude` 上。 |
| Claude Agent SDK | TypeScript 包 `@anthropic-ai/claude-agent-sdk` 与 Python 包 `claude-agent-sdk`；TS SDK 是 ESM/Node 生态；SDK 启动 Claude Code subprocess/binary。 | SDK 不是 Claude Code 客户端 UI 本身；不能据此反推 Desktop/mobile UI 框架。 |
| VS Code extension | 是 VS Code extension；会 bundle private copy of CLI；通过 IDE MCP 暴露 IDE 能力。 | Marketplace/官方文档未足以确认其全部实现语言、前端框架和内部模块划分。 |
| Claude Desktop / Code tab | 官方确认 Desktop 与 CLI 共享底层 Claude Code engine，并提供图形界面；支持 Local/Remote/SSH 环境。 | 公开资料不足以确认它是 Electron、Tauri、Swift、React、React Native、Flutter 或其他技术栈。 |
| Claude iOS / Android App | 官方应用商店与新闻确认 iOS/Android App 存在，支持跨端同步与移动端使用；Remote Control 文档确认移动 App 可作为本地 Claude Code session 的远程窗口。 | 公开资料不足以确认 iOS/Android App 的具体语言与框架（Swift/Kotlin/React Native/Flutter 等均不能写成事实）。 |

---

## 2. 产品架构总览

### 2.1 可归纳的产品分层

```text
用户交互层
├─ Terminal / CLI: claude TUI、claude -p、pipe、resume、agents、worktree
├─ Desktop GUI: Claude Desktop App -> Code tab
├─ IDE GUI: VS Code / JetBrains extension panel + IDE MCP bridge
├─ Web GUI: claude.ai/code、Remote Control web window
└─ Mobile GUI: Claude iOS / Android App 的 Claude Code remote window

Claude Code Agent 层
├─ agent loop / tool-use loop
├─ context management / session persistence
├─ permissions / approval modes
├─ tools: Bash、Read、Edit、MCP、IDE diagnostics/code execution 等
├─ hooks / statusLine / skills / plugins / subagents / workflows
└─ local project memory: CLAUDE.md、settings、MCP config 等

执行环境层
├─ Local machine: 本机 shell、文件系统、git worktree、IDE、terminal
├─ SSH environment: Desktop/remote 场景可连接远端环境
├─ Anthropic cloud: Claude Code on the web / routines 的云端执行环境
└─ Agent SDK host process: 你的 Node/Python 应用以 subprocess 方式驱动 Claude Code

服务与同步层
├─ Anthropic API / Claude.ai OAuth / subscription auth
├─ Remote Control relay/sync: outbound HTTPS/TLS，本机不开放入站端口
├─ Web/cloud session persistence
└─ ordinary Claude app chat sync: web/iOS/Android 跨端同步
```

这个分层的关键点是：**UI surface 可以很多，但执行边界不同**。Terminal 和 Desktop local mode 通常在用户本机执行；Remote Control 是本机执行 + 远程控制窗口；Claude Code on the web 是云端执行；Agent SDK 是宿主应用拉起 Claude Code subprocess；普通 Claude mobile app 的聊天同步则属于 consumer Claude app，不等同于 Claude Code 本地 agent。

### 2.2 三个容易混淆的边界

#### 边界 A：`claude` CLI 与 `ant` CLI

- `claude` 是 Claude Code 的 coding-agent CLI。
- `ant` 是 Anthropic CLI，用于 Claude Platform / Claude API 的 API-first 资源管理与调用。
- `ant` 官方仓库是 Go 语言项目，但这不能说明 `claude` CLI 的内部实现语言。

#### 边界 B：Remote Control 与 Claude Code on the web

- **Remote Control**：本机 Claude Code session 继续在本机运行，web/mobile 只是窗口；本机进程只发起 outbound HTTPS/TLS，不开放 inbound ports。
- **Claude Code on the web**：任务在 Anthropic-managed cloud infrastructure 上运行，浏览器关闭后 session 可继续。

#### 边界 C：Agent SDK 与 Claude API / Managed Agents

- **Claude API**：面向开发者的 Messages API、tool use、server tools 等。
- **Claude Agent SDK**：复用 Claude Code 的 agent loop/tools/context 的 SDK，运行方式是宿主程序启动 Claude Code CLI/binary subprocess。
- **Managed Agents**：Anthropic 托管 agent loop 和工具执行容器的另一类产品能力，不等同于本机 Claude Code CLI。

---

## 3. 终端 / CLI：`claude` 的产品与技术架构

### 3.1 产品能力

官方 CLI reference 显示 `claude` 支持大量命令与 flags，包括：

- `claude`：启动交互式 session。
- `claude "query"`：带初始 prompt 启动交互 session。
- `claude -p "query"`：非交互 print mode，查询后退出。
- `cat file | claude -p "query"`：处理 pipe input。
- `claude -c` / `--continue`：继续当前目录最近会话。
- `claude -r` / `--resume`：按 session ID 或 name 恢复会话。
- `claude agents` / `attach` / `logs` / `respawn` / `stop`：后台 session / agent view 管理。
- `claude mcp`：配置 MCP servers。
- `claude plugin`：管理 plugins。
- `claude remote-control`、`--remote-control` / `--rc`：开启 Remote Control。
- `claude --remote`：创建 web session。
- `claude --teleport`：把 web session 恢复到本地 terminal。
- `claude --worktree`：在隔离 git worktree 中启动。
- `--tools`、`--allowedTools`、`--disallowedTools`、`--permission-mode`：工具可用性与权限模式控制。
- `--json-schema`、`--output-format json/stream-json`、`--input-format stream-json`：结构化和脚本化输出。

这些能力说明 Claude Code CLI 不只是“聊天命令行”，而是一个本地 coding agent runtime 的控制面：它负责会话、权限、工具、配置、项目上下文、MCP、hooks、plugins、subagents/workflows 与执行环境的组合。

### 3.2 技术实现与运行时：能确定什么

公开可确定：

1. **分发形态**  
   `@anthropic-ai/claude-code` 是 npm 生态分发包；安装后提供 `claude` 命令。

2. **Node/ESM wrapper 与 native binary 机制**  
   npm 包侧公开信息和 CLI reference 中 `claude install [version]` “Install or reinstall the native binary” 表明，当前 Claude Code 分发不能简单理解为纯 JS CLI；它至少包含 Node/npm 安装入口和平台相关 binary/native component 机制。

3. **本地状态与配置**  
   CLI 支持 CLAUDE.md、settings、hooks、MCP、plugins、skills、session persistence、debug logs 等，本地会话与项目目录强相关。

4. **Agent loop 与 tool-use loop**  
   从 Agent SDK 文档可反向证明 Claude Code 有可被 SDK 复用的 tools、agent loop、context management。CLI 自身的 `--max-turns`、tool/permission flags、headless stream-json 等也指向同一套 agent loop 抽象。

不能确定：

- 官方未公开 Claude Code CLI 完整源码；不能断言核心 agent loop 是 TypeScript、Rust、Go、Swift 或其他语言。
- npm 分发只说明分发/启动层，不等价于完整实现语言。
- native binary 的内部语言、UI TUI 框架、模块边界均缺乏公开证据。

### 3.3 CLI 架构抽象

```text
用户输入 / Shell / Pipe / CI
        │
        ▼
claude command wrapper（npm / Node 入口 + native binary 安装/启动机制）
        │
        ▼
Claude Code local agent runtime
        ├─ 会话管理：continue / resume / session-id / no-session-persistence
        ├─ 上下文：工作目录、CLAUDE.md、settings、memory、add-dir
        ├─ 工具层：Bash / Read / Edit / MCP / IDE / browser 等
        ├─ 权限层：default / acceptEdits / plan / auto / dontAsk / bypassPermissions
        ├─ 扩展层：hooks / skills / plugins / subagents / workflows
        ├─ 输出层：TUI / text / json / stream-json / json-schema
        └─ 远程层：remote-control / remote web / teleport
        │
        ▼
Anthropic API / Claude.ai auth / local shell & filesystem
```

### 3.4 追补：关于 TypeScript、npm 包和 native binary 的更细结论

公开资料能补充出一些更细的事实，这部分是原报告里写得偏保守的地方：

1. **当前官方更推荐 native install，npm 安装已不再是唯一主路径**  
   官方 GitHub README / setup 文档显示 npm 安装方式存在，但 npm installation 已被标注为 deprecated；官方推荐 install script、Homebrew、WinGet 等 native install 方式。

2. **npm 包安装的也是 native binary**  
   官方 setup 文档说明：npm package installs the same native binary as the standalone installer；平台 binary 通过 per-platform optional dependency 拉取；安装后的 `claude` binary does not itself invoke Node。也就是说，`npm install -g @anthropic-ai/claude-code` 不应被简单理解为“运行时是 Node CLI”。

3. **npm 包里仍然有明确 JS/TS 痕迹**  
   npm registry / CDN 可见当前包包含 `install.cjs`、`cli-wrapper.cjs`、`sdk-tools.d.ts` 等文件：
   - `install.cjs` 是 Node/CommonJS postinstall 脚本，用于选择和安装平台 binary。
   - `cli-wrapper.cjs` 是 fallback launcher，用 Node spawn 平台 binary。
   - `sdk-tools.d.ts` 是 TypeScript declaration，暴露工具 schema 相关类型。

4. **TypeScript 证据更多来自历史包线索与媒体报道**  
   公开 issue 和媒体报道提到，某些历史版本曾出现 `sdk.mjs`、`cli.js`、source map / internal source 泄露等情况；ITPro 等报道转述 Anthropic 确认某 release packaging issue 误包含内部源码，并称泄露材料包含大量 TypeScript 文件。这个证据足以支持“Claude Code 内部源码至少大量使用 TypeScript”的强判断，但引用时应标注为媒体报道/历史事故，而不是官方架构白皮书。

5. **仍不能依赖 bundle / source map / 反编译作为稳定接口**  
   Claude Code GitHub 仓库 LICENSE 是 Anthropic 保留权利/商业条款约束，不是 MIT/Apache 这类开源授权。即使安装包或某次 source map 能看到内部函数、prompt、协议、目录，也不等于官方公开 API 或稳定兼容承诺。报告和产品设计应优先依赖 CLI flags、hooks、MCP、settings、Agent SDK、Remote Control 等文档化接口。

一句话修正：**你知道“Claude Code 是 TS 开发的”并不离谱；更精确是“公开报道和包形态强烈支持 Claude Code 内部大量 TS/JS，但当前官方交付形态是 native binary，TS 源码与内部协议没有作为开源/稳定 API 正式公开”。**

---

## 4. Claude Agent SDK：把 Claude Code 作为库的架构

### 4.1 官方定位

Claude Agent SDK 的定位不是普通的 HTTP API SDK，而是面向“用 Claude Code 构建生产级 agent”的 SDK：它复用 Claude Code 的工具系统、agent loop 和上下文管理能力。

公开资料显示：

- TypeScript 包：`@anthropic-ai/claude-agent-sdk`。
- Python 包：`claude-agent-sdk`。
- TypeScript SDK 是 Node/ESM 生态，依赖/捆绑平台 Claude Code binary 的机制，并可通过 `pathToClaudeCodeExecutable` 指向外部 `claude`。
- `query()` 返回 async generator，SDK 通过启动 Claude Code CLI subprocess 来驱动 agent loop。
- `maxTurns` 控制 tool-use round trips。

### 4.2 SDK 与 CLI 的关系

```text
你的应用代码（Node/TypeScript 或 Python）
        │
        │  import/query/config
        ▼
Claude Agent SDK
        │
        │  spawn subprocess / locate bundled or external Claude Code executable
        ▼
Claude Code CLI/binary
        │
        ▼
Claude Code tools + agent loop + context management
        │
        ├─ local tools / MCP / filesystem / shell
        └─ Anthropic API / auth
```

这意味着如果要在自己的产品里“嵌入 Claude Code 类 agent”，官方优先路线不是重新实现 CLI，而是通过 Agent SDK 复用 Claude Code runtime。

### 4.3 与 Claude API 的区别

| 维度 | Claude API SDK | Claude Agent SDK |
| --- | --- | --- |
| 抽象层级 | Messages API / tool use / server tools | Claude Code agent runtime |
| 工具执行 | 你自己实现工具 loop，或使用 SDK tool runner | 复用 Claude Code 的 tools、permissions、context、agent loop |
| 执行环境 | 你的服务/应用进程 | SDK 启动 Claude Code subprocess/binary |
| 适合场景 | 自定义 LLM app、workflow、业务工具 | 嵌入 coding agent、复用 Claude Code 行为 |
| 风险 | 需要自己设计工具权限与上下文 | 依赖 Claude Code binary、CLI 版本与本地环境 |

---

## 5. 桌面端：Claude Desktop / Code tab / Claude Code Desktop

### 5.1 产品形态

官方 Desktop 文档给出的关键事实：

- Claude Desktop app 有 **Chat、Cowork、Code** 三个 tab。
- Code tab 中每个 conversation 是一个 session，有独立 history、project folder、code changes。
- Desktop 支持 **Local、Remote/cloud、SSH** 三类 environment。
- 如果已经使用 Claude Code CLI，Desktop “runs the same underlying engine with a graphical interface”。
- CLI 与 Desktop 可同时运行在同一台机器、同一项目；它们各自维护 separate session history，但共享 CLAUDE.md、MCP servers、hooks、skills、settings 等配置与项目记忆。
- Desktop 是 interactive only；不支持 CLI 的 `--print` / `--output-format`。
- Desktop 提供图形化能力：自动 worktrees、多 session、diff viewer、embedded preview/browser、integrated terminal、file editor、side chat、computer use、connectors/MCP、plugins/skills 等。
- Desktop 官方支持 macOS/Windows，Linux 不支持。

### 5.2 技术架构判断

公开事实足以支撑下面这个架构抽象：

```text
Claude Desktop App
├─ Chat tab：普通 Claude consumer chat
├─ Cowork tab：协作/工作型体验
└─ Code tab：Claude Code GUI
   ├─ Session manager：多会话、history、project folder、code changes
   ├─ Environment selector：Local / Remote cloud / SSH
   ├─ Visual coding surfaces：diff viewer、file editor、preview/browser、terminal
   ├─ Agent interaction：approval、permissions、side chat、computer use
   └─ Shared Claude Code engine/config：CLAUDE.md、MCP、hooks、skills、settings
```

更准确地说，Desktop Code tab 可以理解为：**Claude Code engine 的图形外壳 + 环境选择器 + 多会话/可视化工作台**。它不是单纯把终端嵌入窗口，而是把 session、diff、terminal、preview、file editor、side chat 等 coding workflow 组件图形化。

### 5.3 语言与框架：公开资料不足

用户关心“桌面端用什么语言/框架开发”。目前公开资料只能确定：

- Desktop 是 macOS/Windows 桌面应用；Linux 不支持。
- Code tab 与 CLI 共享底层 engine。
- Desktop 图形层存在 embedded terminal、preview/browser、file editor、diff viewer 等复杂 UI。

但不能确定：

- 是否 Electron。
- 是否 Tauri。
- 是否 React / Vue / Svelte。
- 是否原生 Swift / AppKit / SwiftUI / WinUI / WebView。
- 是否跨平台 C++ / Rust / Qt。

因此报告中不能把 Claude Desktop 写成“Electron + React”或“Tauri + React”之类，除非未来 Anthropic 官方公开源码或技术说明。

### 5.4 Desktop 与本项目 Claude HUD One 的启发

对本项目有用的判断是：

1. Desktop 的官方方向是“图形化 coding workbench”，不是只显示状态。
2. Desktop 和 CLI 共享 engine/config，但 session history 分离；这说明在做第三方 HUD/辅助面板时，也应把“状态读取/控制面”与“真实 agent runtime”解耦。
3. Desktop 的 Local/Remote/SSH 三环境模型，可作为 Claude HUD One 后续远程/手机 HUD 的参考分层：本地运行、远程窗口、云端 session 要分别建模。

---

## 6. IDE 集成：VS Code / JetBrains 与 IDE MCP

### 6.1 产品形态

公开文档与 VS Code Marketplace 信息显示：

- VS Code extension 提供 Claude Code 的 native graphical interface。
- Extension 的 chat panel 会 bundle private copy of CLI。
- 如果用户想在 VS Code terminal 中直接运行 `claude`，仍需要安装 standalone CLI。
- IDE integration 会暴露 IDE 上下文能力，例如 diagnostics、execute code 等。
- 文档提到 IDE MCP server 绑定本机 `127.0.0.1` 随机高位端口，并使用随机 auth token；模型可见工具包括类似 `mcp__ide__getDiagnostics`、`mcp__ide__executeCode` 的能力。

### 6.2 技术架构抽象

```text
VS Code / JetBrains IDE
        │
        ├─ Extension UI / chat panel
        │    └─ bundled private Claude Code CLI copy
        │
        ├─ IDE MCP server
        │    ├─ localhost random port
        │    ├─ random auth token
        │    └─ IDE tools: diagnostics / execute code / editor context
        │
        └─ Standalone terminal
             └─ user-installed `claude` CLI（如需在 terminal 直接运行）
```

### 6.3 语言与框架边界

- VS Code extension 按生态通常会使用 TypeScript/JavaScript，但本报告不把“通常”写成事实。
- 官方公开信息足以确认它是 VS Code extension，并 bundle CLI；不足以确认 extension 内部所有实现语言、webview 框架、构建工具和 UI 库。

---

## 7. Remote Control：移动端/网页控制本地 Claude Code 的架构

### 7.1 核心事实

Remote Control 官方文档的关键说法可以归纳为：

- 当在本机启动 Remote Control session 时，Claude Code **始终在本机运行**，不会把执行迁移到云端。
- web 和 mobile interface 只是进入这个本地 session 的窗口。
- 本机 Claude Code session 只发起 outbound HTTPS requests，不在本机开放 inbound ports。
- 远程访问依赖 Claude.ai / Claude App，通常需要 Claude.ai OAuth/订阅；API key 使用形态与 Remote Control 不同。
- 远程控制可通过 `claude remote-control` server mode 或 `claude --remote-control` / `--rc` interactive mode 开启。

### 7.2 Remote Control 架构图

```text
本机开发机
┌──────────────────────────────────────────────┐
│ claude CLI / Claude Code local session        │
│ ├─ local files / shell / git / tools           │
│ ├─ session state / permissions                 │
│ └─ outbound HTTPS/TLS only                     │
└───────────────────────┬──────────────────────┘
                        │
                        ▼
              Anthropic / Claude relay & auth
                        ▲
                        │
┌───────────────────────┴──────────────────────┐
│ claude.ai / Claude iOS App / Claude Android App│
│ └─ remote window / UI control surface          │
└──────────────────────────────────────────────┘
```

### 7.3 安全边界

Remote Control 的关键安全设计不是“手机直连电脑端口”，而是：

- 本机只主动连出 HTTPS/TLS。
- 不需要路由器端口映射，不暴露本机 inbound 服务。
- 远程 UI 只是控制和显示窗口，本机工具执行仍受本地权限、Claude Code permissions、用户确认机制约束。
- 使用短期凭据/会话认证来连接 remote surface。

对第三方 HUD 或移动控制器而言，这个模型很值得借鉴：如果要做跨设备控制，优先考虑“本机 agent 主动连出 + 手机端作为授权窗口/状态窗口”，而不是让手机直接扫描/调用本机开放端口。

---

## 8. Claude Code on the web 与 routines：云端执行边界

### 8.1 产品形态

Claude Code on the web 位于 `claude.ai/code`，官方文档说明它在 Anthropic-managed cloud infrastructure 上运行 tasks。用户可以在浏览器中发起任务，浏览器关闭后 session 仍可继续。

Routines 是保存的 Claude Code 配置，可通过：

- schedule 定时触发；
- GitHub event 触发；
- HTTP API 触发；
- routine fire API / per-routine token 等机制运行。

### 8.2 与本地 CLI/Remote Control 的区别

| 维度 | Local CLI | Remote Control | Claude Code on the web |
| --- | --- | --- | --- |
| 执行位置 | 用户本机 | 用户本机 | Anthropic-managed cloud infrastructure |
| UI 位置 | 终端本地 | Web/mobile 远程窗口 | Web |
| 本地文件访问 | 直接访问本机项目 | 仍由本机 session 访问 | 云端环境 / 连接的 repo / 配置环境 |
| 网络方向 | 本机调用 Anthropic API | 本机 outbound HTTPS/TLS 到 Anthropic | 浏览器访问 Claude web，任务在云端跑 |
| 浏览器关闭后 | 本地进程是否继续取决于本机 session | 本机进程继续则 session 继续 | 云端 session 可继续 |
| 典型用途 | 本地开发、交互/脚本 | 离开电脑后继续控制本机 Claude Code | 云端异步任务、自动化 routine |

---

## 9. 移动端：Claude iOS / Android App 与 Claude Code 使用形态

### 9.1 Claude mobile app 的公开事实

官方新闻与应用商店页面能确认：

- Claude 有 iOS App 和 Android App。
- iOS App 官方发布说明强调免费使用、与 web chats seamless syncing、支持照片/文件上传等。
- Android App 官方发布说明强调可在 web/iOS/Android 之间继续会话，面向 Pro/Team 等用户可用，并通过 Google Play 分发。
- App Store / Google Play 页面只能证明应用存在、版本、平台、功能描述、隐私/权限等元数据，不能证明具体实现语言或跨平台框架。

### 9.2 移动端参与 Claude Code 的两种形态

#### 形态 1：普通 Claude mobile app

```text
Claude iOS / Android App
└─ 普通 Claude chat / 文件与图片上传 / 跨端会话同步
   └─ Claude backend / account sync
```

这是 consumer Claude app 的普通移动端使用。

#### 形态 2：Claude Code Remote Control window

```text
Claude iOS / Android App
└─ Claude Code remote window
   └─ Anthropic relay/auth
      └─ 本机 Claude Code session（真实执行仍在本机）
```

这里手机不是运行本地 coding agent 的地方，而是一个远程控制/查看窗口。真正读写本机代码、运行 shell、调用本地工具的仍是电脑上的 Claude Code session。

### 9.3 移动端语言/框架：未知

目前不能可靠确定 Claude iOS / Android App 是：

- iOS Swift / SwiftUI；
- Android Kotlin / Jetpack Compose；
- React Native；
- Flutter；
- 其他跨平台框架。

应用商店页面和官方新闻不提供足够证据。报告中只能写“公开资料未披露具体移动端语言/框架”。

---

## 10. 认证、会话与同步

### 10.1 本地 CLI 认证

CLI 文档显示：

- `claude auth login`：登录 Anthropic account，可用 `--email`、`--sso`、`--console` 等。
- `claude auth status`：输出认证状态。
- `claude setup-token`：生成长生命周期 OAuth token，用于 CI/scripts，需要 Claude subscription。

这说明 Claude Code 既支持 Claude.ai/subscription 相关认证，也支持 console/API billing 相关登录模式，但不同功能的可用性不完全相同。

### 10.2 Remote Control 认证

Remote Control 更偏 Claude.ai 账号和订阅体系：

- 需要把本机 session 与 web/mobile 端账号关联。
- API key 不是 Remote Control 的主要认证方式。
- 本机和远程 UI 之间通过 Anthropic relay/auth 连接。

### 10.3 Session persistence

CLI 支持：

- continue / resume；
- session name；
- session ID；
- no-session-persistence；
- background sessions；
- remote/web session teleport。

Desktop 支持每个 conversation/session 独立 history、project folder、code changes。Desktop 与 CLI 的 session history 分离，但共享 CLAUDE.md、settings 等配置。

### 10.4 Cloud/web session persistence

Claude Code on the web 的 session 在云端基础设施中运行，浏览器关闭后仍可继续。这与本地 CLI 的 persistence 不同；它依赖云端任务环境。

---

## 11. 对“架构与技术栈”的可信度矩阵

| 结论 | 可信度 | 依据类型 | 备注 |
| --- | --- | --- | --- |
| Claude Code CLI 是 `claude`，支持交互、print/headless、pipe、resume、MCP、plugins、Remote Control 等 | 高 | 官方 CLI reference | 公开事实 |
| `@anthropic-ai/claude-code` 通过 npm 分发 | 高 | npm package / 官方安装文档 | 公开事实 |
| CLI 当前包含 native binary 安装/重装机制 | 高 | CLI reference `claude install` | 公开事实 |
| CLI 完整核心实现语言未知 | 高 | 未公开源码/官方说明 | 应标注未知 |
| `ant` 是 API-first Anthropic CLI，主要 Go | 高 | GitHub 官方仓库 | 公开事实；注意不是 `claude` |
| Agent SDK TS/Python 通过 Claude Code subprocess/binary 复用 Claude Code agent loop | 高 | 官方 SDK 文档 / npm | 公开事实 |
| Desktop Code tab 与 CLI 共享底层 engine，提供 GUI | 高 | 官方 Desktop 文档 | 公开事实 |
| Desktop 支持 Local/Remote/SSH environment | 高 | 官方 Desktop 文档 | 公开事实 |
| Desktop 是 Electron/React/Tauri 等 | 低/未知 | 无官方公开证据 | 不应断言 |
| VS Code extension bundle private CLI copy | 高 | 官方 IDE 文档 / Marketplace | 公开事实 |
| IDE MCP server 使用 localhost 随机端口和随机 token | 中高 | 官方 IDE 文档 | 公开事实，细节按文档版本为准 |
| Remote Control 本机运行、web/mobile 只是窗口、本机不开放 inbound ports | 高 | 官方 Remote Control 文档 | 公开事实 |
| Claude Code on the web 在 Anthropic-managed cloud infrastructure 运行 | 高 | 官方 web 文档 | 公开事实 |
| Claude mobile app 作为 Remote Control UI 控制本机 session | 高 | 官方 Remote Control 文档 | 公开事实 |
| Claude mobile app 的 Swift/Kotlin/RN/Flutter 技术栈 | 未知 | 应用商店不披露 | 不应断言 |

---

## 12. 对 Claude HUD One 的产品参考建议

结合本次研究，对本项目后续产品架构有几个可落地参考：

1. **区分 runtime 与 surface**  
   Claude Code 自身已经把 CLI、Desktop、IDE、Web、Mobile 作为不同 surface；Claude HUD One 也应避免把“状态采集、显示、控制、远程同步、真实执行”混在一起。

2. **移动端不要假设本地执行**  
   官方 Remote Control 的方向是手机作为远程窗口，本机继续运行 Claude Code。Claude HUD One Android HUD 若要贴近 Claude Code 官方模型，也应把手机定位为状态/提醒/轻控制 surface，而不是在手机上复刻本地 agent runtime。

3. **安全链路优先 outbound / relay**  
   Remote Control 明确不开放 inbound ports，这对跨设备 HUD 很关键。本项目当前局域网配对/手机 HUD 若继续增强，应持续关注：短期凭据、pinning、设备撤销、低敏数据、权限最小化、默认不暴露高危操作。

4. **Desktop GUI 重点是工作台，不是状态条**  
   官方 Desktop 的 Code tab 包含 diff、file editor、preview、terminal、side chat、computer use 等，说明未来桌面 GUI 趋势是“多 session coding workbench”。Claude HUD One 的 Desktop HUD 可以继续保留轻量悬浮状态，但若做更大版本，应明确是“HUD 辅助层”还是“完整工作台”。

5. **第三方集成优先利用公开配置面**  
   Claude Code 已公开的稳定集成面包括：CLI flags、hooks、statusLine、MCP、settings、Agent SDK、Remote Control。不要依赖未公开私有协议或逆向 desktop/mobile binary。

---

## 13. 对新项目技术选型的启示：借鉴 Claude Code 的“Agent 内核”，不要照搬它的终端形态

用户后续补充的讨论把问题从“Claude Code 自身是什么技术栈”推进到了更实际的一层：**如果要开发一个覆盖终端、桌面端、移动端的新项目，是否应该使用和 Claude Code 类似的技术框架？**

结论是：**可以借鉴 Claude Code 的 TypeScript 优先、Agent loop、工具协议、权限审批、上下文管理和 SDK 化分层；但不建议直接照搬 Claude Code 的产品形态或把 CLI/TUI 简单包成桌面端、移动端。**

### 13.1 对 Gemini 讨论内容的校正

Gemini 的回答里有几类判断是有参考价值的：

- TypeScript 很适合作为 Agent 产品的核心工程语言，尤其适合定义工具 schema、事件协议、会话状态、权限策略和跨端共享类型。
- Claude Code 的核心不是传统 MVC / Web 框架，而是 Agent loop：模型理解任务、选择工具、执行工具、读取结果、继续决策，直到任务完成。
- Hooks、权限控制、上下文管理、会话状态、MCP / tools / subagents 这些机制，比“用了哪个 UI 框架”更能代表 Claude Code 的架构价值。
- 如果新项目覆盖终端、桌面、移动端，应把业务逻辑和 Agent Runtime 抽到共享核心，而不是每端重复实现。

但也需要修正几个容易误导的点：

1. **“Claude Code 是 TypeScript + Node.js CLI”需要加边界**  
   可以说 Claude Code 有很强的 TypeScript/JavaScript 证据和历史源码线索；但当前官方交付形态是 native binary，npm 包更多是分发/安装 wrapper，安装后的 `claude` binary 本身不调用 Node。不要把 npm 安装等同于纯 Node runtime。

2. **“Claude Agent SDK 开源成了 SDK”不要写成 Claude Code 整体开源**  
   Agent SDK 有公开包和官方文档，TypeScript/Python 都可用；但这不等于 Claude Code 完整核心实现开源。报告中应区分“公开 SDK / 包 / 文档化接口”和“未公开内部实现”。

3. **“Hooks 是安全框架”需要降级为治理机制**  
   Hooks 可用于工具执行前后拦截、审计、注入上下文或自动化，但硬安全边界应优先依赖 permission system、工具白名单/黑名单、沙箱、审计日志和人工审批。Hooks 不应被设计成唯一安全防线。

4. **“Context compaction 保证上下文完整”不准确**  
   Claude Code 的上下文管理目标是让长任务继续推进，不是无损保留所有历史。新项目也应把长期规则、项目知识、用户偏好、任务状态显式沉淀到 memory / project config / journal，而不是完全依赖自动摘要。

5. **“终端、桌面、移动都用同一套 UI 框架”要谨慎**  
   共享 TypeScript 类型、状态机、Agent SDK、工具协议是高价值的；但 CLI、桌面 GUI、移动 App 的交互模型差异很大，不应强求一套 UI 组件无损覆盖三端。

### 13.2 新项目应借鉴 Claude Code 的哪些层

如果新项目也是 AI Agent / 效率工具 / 编程助手类产品，最值得借鉴的是下面这些架构层，而不是某个具体 UI 框架：

```text
共享 Agent Core（推荐 TypeScript 优先）
├─ Model Adapter：Claude / OpenAI / 本地模型等适配
├─ Agent Loop：plan -> tool use -> observe -> verify -> continue
├─ Tool Registry：Bash、文件、搜索、浏览器、MCP、业务 API 等工具注册
├─ Permission Policy：只读/写入/执行命令/外部发送/删除等风险分级
├─ Context Manager：上下文裁剪、摘要、引用、project memory、prompt cache
├─ Session Store：会话、任务、事件流、checkpoint、审计日志
├─ Hook/Event Bus：PreToolUse、PostToolUse、Stop、Compact、Notification 等生命周期
├─ SDK/API：给 CLI、Desktop、Mobile、后端、插件调用的稳定接口
└─ Sync/Relay：跨设备同步、远程控制、推送、短期凭据

多端交互壳层
├─ CLI/TUI：适合 power user、脚本、CI、开发者工作流
├─ Desktop GUI：适合 diff、权限审批、任务队列、通知、系统集成、本地文件
├─ Mobile App：适合任务发起、状态查看、审批、通知、轻量编辑和远程控制
└─ Web Console：适合云端任务、团队协作、管理后台和分享
```

### 13.3 推荐技术栈组合

#### 方案 A：TypeScript 全栈优先，最快形成统一产品

```text
Agent Core：TypeScript / Node.js
CLI：Commander.js / Oclif / Ink
Desktop：Tauri + React + TypeScript（或 Electron + React）
Mobile：React Native + Expo
Web/Admin：React / Next.js
通信：tRPC / HTTP + SSE / WebSocket
状态与 schema：Zod / Valibot / TypeScript types / Zustand 或 Redux Toolkit
```

适合：团队偏前端/TS、希望快速覆盖多端、产品还在探索期。  
优点：语言统一，类型复用强，开发效率高，AI/SDK/MCP 生态接入顺。  
缺点：移动端深度原生能力和长期后台任务需要额外原生模块；Electron 体积大，Tauri 跨平台细节需要 Rust/系统能力补位。

#### 方案 B：TypeScript Agent Core + Rust 本地执行层，适合重本地能力产品

```text
Agent Orchestrator：TypeScript
Local Runtime / Sandbox：Rust
Desktop：Tauri + React
CLI：Node.js wrapper 或 Rust CLI
Mobile：React Native / Expo，主要做远程控制和审批
通信：本地 IPC + HTTP/SSE/WebSocket
安全：Rust 执行命令、文件索引、权限沙箱、加密存储、审计日志
```

适合：开发者工具、本地文件/命令能力重、安全要求高、桌面端是主战场。  
优点：性能、安全、包体和系统集成都更好；与 Tauri 结合自然。  
缺点：TS/Rust 边界、IPC 协议、跨平台构建复杂度更高。

#### 方案 C：云端 Agent Runtime + 多端轻客户端，适合移动端和团队协作

```text
Agent Runtime：TypeScript/NestJS 或 Go
任务执行：云端 sandbox / worker / queue
CLI：Node.js/Ink 或 Go
Desktop：Tauri/Electron，作为本地桥和可视化工作台
Mobile：React Native / Flutter，作为控制台、审批端、通知端
同步：账号体系、任务流、推送、WebSocket/SSE
安全：云端权限策略、审计、secret 管理、组织级策略
```

适合：企业协作、长任务、多设备连续会话、移动端占比较高、需要集中审计治理。  
优点：移动端限制最小，长任务和推送体验稳定，多端同步自然。  
缺点：本地 IDE/文件系统/命令执行需要额外 local bridge；云成本、隐私和合规压力更大。

### 13.4 推荐落地路线

如果目标是做一个“像 Claude Code 一样先进，但覆盖终端、桌面端、移动端”的新项目，建议路线是：

1. **先做共享 Agent Core，不先纠结所有端的 UI**  
   先把模型调用、工具注册、权限策略、事件流、上下文管理、session store、日志审计做成纯 TypeScript SDK/API。

2. **CLI 先行验证 Agent Loop**  
   CLI 最接近 Claude Code，也最容易验证工具调用、权限审批、上下文压缩、任务恢复、配置文件等核心机制。

3. **桌面端做可视化工作台**  
   桌面端不要只是把终端包进窗口，而要提供 session 列表、diff、文件预览、权限审批、任务队列、通知、日志审计、本地桥管理等 GUI 能力。

4. **移动端定位为远程控制和轻量协作端**  
   移动端不适合承担完整本地 Bash/文件系统/长任务执行。更合理的定位是：发起任务、查看进度、审批高风险工具、接收通知、轻量输入、远程接管桌面/云端 session。

5. **把安全和权限作为第一层架构，而不是后补功能**  
   所有工具都应有 schema、权限等级、审计事件、用户确认策略、超时/取消、敏感信息脱敏和可回放日志。

### 13.5 最终建议

- 如果你当前项目更偏 **开发者工具 / 本地自动化 / 桌面主战场**：优先考虑 **方案 B：TypeScript Agent Core + Rust Local Runtime + Tauri + React + React Native**。
- 如果更偏 **SaaS / 企业协同 / 多设备连续任务 / 移动端占比较高**：优先考虑 **方案 C：云端 Agent Runtime + 多端轻客户端**。
- 如果目标是 **最快做 MVP，团队主要熟悉前端/TS**：先用 **方案 A：TypeScript 全栈优先**，但从第一天就把 Agent Core、工具协议和权限策略做成可替换模块，避免后期重构。

对本项目 Claude HUD One 来说，现阶段更接近方案 B 和方案 C 的混合：桌面端/本地 bridge 负责连接本机 Claude Code 和系统能力，Android 端更适合作为远程状态、通知、审批和轻控制面，而不是在手机端复刻完整 Claude Code runtime。

---

## 14. 资料来源清单

> 注：以下为本次研究引用和交叉核验的主要公开来源。部分页面内容较长，本地研究过程中已通过 deep-research workflow 对关键 claims 做 3-vote adversarial verification；本报告只保留可用于结论的部分。

1. Claude Code CLI reference  
   https://code.claude.com/docs/en/cli-usage

2. Claude Code Remote Control  
   https://code.claude.com/docs/en/remote-control

3. Claude Code on the web  
   https://code.claude.com/docs/en/claude-code-on-the-web

4. Claude Desktop / Code tab  
   https://code.claude.com/docs/en/desktop

5. Claude Code IDE integrations  
   https://code.claude.com/docs/en/ide-integrations

6. Claude Agent SDK overview / docs  
   https://code.claude.com/docs/en/agent-sdk/overview

7. npm: `@anthropic-ai/claude-code`  
   https://www.npmjs.com/package/@anthropic-ai/claude-code

8. npm registry metadata: `@anthropic-ai/claude-code`  
   https://registry.npmjs.org/@anthropic-ai/claude-code/latest

9. jsDelivr package files: `@anthropic-ai/claude-code` package.json / install.cjs / cli-wrapper.cjs / sdk-tools.d.ts  
   https://cdn.jsdelivr.net/npm/@anthropic-ai/claude-code@2.1.185/package.json  
   https://cdn.jsdelivr.net/npm/@anthropic-ai/claude-code@2.1.185/install.cjs  
   https://cdn.jsdelivr.net/npm/@anthropic-ai/claude-code@2.1.185/cli-wrapper.cjs  
   https://cdn.jsdelivr.net/npm/@anthropic-ai/claude-code@2.1.185/sdk-tools.d.ts

10. GitHub: `anthropics/claude-code` / LICENSE  
    https://github.com/anthropics/claude-code  
    https://github.com/anthropics/claude-code/blob/main/LICENSE.md

11. 媒体报道：Claude Code source map / source leak packaging issue  
    https://www.itpro.com/security/data-breaches/there-was-a-manual-deploy-step-that-should-have-been-better-automated-claude-code-creator-confirms-cause-of-massive-source-code-leak  
    https://www.infoq.com/news/2026/04/claude-code-source-leak/

12. npm: `@anthropic-ai/claude-agent-sdk`  
   https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk

13. PyPI: `claude-agent-sdk`  
   https://pypi.org/project/claude-agent-sdk/

14. GitHub: `anthropics/anthropic-cli`  
    https://github.com/anthropics/anthropic-cli

15. VS Code Marketplace: Claude Code extension  
    https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code

16. Claude Android App announcement  
    https://claude.com/blog/android-app

17. Claude iOS App / Team plan announcement  
    https://claude.com/blog/team-plan-and-ios

18. App Store: Claude by Anthropic  
    https://apps.apple.com/app/claude-by-anthropic/id6473753684

19. Google Play: Claude by Anthropic  
    https://play.google.com/store/apps/details?id=com.anthropic.claude

20. Claude Code architecture / setup / hooks / Agent SDK references  
    https://code.claude.com/docs/en/how-claude-code-works  
    https://code.claude.com/docs/en/setup  
    https://code.claude.com/docs/en/hooks  
    https://code.claude.com/docs/en/agent-sdk/typescript  
    https://code.claude.com/docs/en/agent-sdk/python

---

## 15. 最终判断

如果只回答“Claude Code 终端、桌面端、移动端分别是什么架构”：

- **终端/CLI**：公开上是 npm 分发的 `claude` 命令 + native binary 机制 + 本地 agent runtime；支持交互/headless/脚本化/工具权限/会话/插件/MCP/远程控制。完整内部语言未公开。
- **桌面端**：Claude Desktop 的 Code tab，是与 CLI 共享底层 Claude Code engine 的图形化工作台；支持 Local/Remote/SSH、多 session、diff、terminal、preview、file editor 等。图形层实现语言/框架未公开。
- **IDE 端**：IDE extension 是 Claude Code 的 IDE surface，VS Code extension 会 bundle 私有 CLI copy，并通过本地 IDE MCP server 暴露 IDE 能力。extension 内部完整技术栈未公开。
- **移动端**：Claude iOS/Android App 是 consumer mobile app；在 Claude Code 场景中主要通过 Remote Control 作为本机 Claude Code session 的远程窗口。本机 session 仍在电脑上执行，手机不是本地 coding runtime。移动 App 语言/框架未公开。
- **云端/Web**：Claude Code on the web 是云端执行，区别于 Remote Control；routines 则把 Claude Code 配置保存并通过 schedule/GitHub/HTTP API 等触发。
- **SDK**：Claude Agent SDK 是官方把 Claude Code 作为库复用的方式，TypeScript/Python SDK 通过 Claude Code binary/subprocess 驱动 agent loop；它与直接 Claude API SDK 或 Managed Agents 是不同抽象层。
- **新项目选型**：如果要做覆盖终端、桌面端、移动端的新产品，建议复制 Claude Code 的 Agent Core 思想，而不是复制它的终端外壳。优先构建 TypeScript Agent Core、工具协议、权限策略、上下文管理和事件流；桌面端用 Tauri/Electron + React 做可视化工作台；移动端用 React Native/Flutter 做远程控制、审批、通知和轻量协作端。