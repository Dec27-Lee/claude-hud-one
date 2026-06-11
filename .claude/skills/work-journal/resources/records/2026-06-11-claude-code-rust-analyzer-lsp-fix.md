# Claude Code rust-analyzer LSP 报错修复

## 原始需求

用户运行 `/doctor` 看到 `⚠ 1 setup issue: LSP`，具体为 `plugin:rust-analyzer-lsp:rust-analyzer` 崩溃并超过 3 次恢复尝试，要求解释含义并修复。

## 范围

- 本轮做：解释 `/doctor` 报错含义；排查 Claude Code `rust-analyzer-lsp` 插件、`rust-analyzer` 可执行文件与本地 Rust 工具链；在低风险范围内修复；复跑 `/doctor` 或等价检查验证。
- 本轮不做：修改项目业务代码；处理 Remote Control 订阅/OAuth 状态；大规模重装 Claude Code，除非排查确认必须。
- 待确认：如需安装/重装 Rust 工具链或禁用全局插件，以实际排查结果选择最小修复。

## 计划

1. 通过索引确认无强相关历史记录，新建本条轻量记录。
2. 检查 Claude Code 插件状态与 `rust-analyzer`/`rustup`/Cargo 可用性。
3. 判断是缺少语言服务器、PATH 不一致、插件缓存损坏还是工作区初始化问题。
4. 采用最小修复：优先补齐/修复 `rust-analyzer`；若当前不需要 Rust LSP 或插件异常，再禁用/刷新插件。
5. 复跑 `/doctor` 或相关命令验证 LSP 报错是否消失，并记录结果。

## 进展

- 已读取 `.claude/workspace-index.md` 与工作日志二级索引，未发现强相关历史记录。
- 已确认 Claude Code 当前为 `2.1.173`，`rust-analyzer-lsp@claude-plugins-official` 在 user scope 启用，版本 `1.0.0`。
- 已确认故障根因：`where.exe rust-analyzer` 能找到 `C:\Users\Yue\.cargo\bin\rust-analyzer.exe` shim，但执行 `rust-analyzer --version` 报 `Unknown binary 'rust-analyzer.exe' in official toolchain 'stable-x86_64-pc-windows-msvc'`；`rustup which rust-analyzer` 同样报 toolchain 缺少该组件。
- 已执行 `rustup component add rust-analyzer` 与 `rustup component add rust-src`，补齐 stable toolchain 里的语言服务器与 Rust 源码组件。
- 已验证：`rustup which rust-analyzer` 指向 `C:\Users\Yue\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin\rust-analyzer.exe`，`rust-analyzer --version` 输出 `rust-analyzer 1.96.0 (ac68faa2 2026-05-25)`。
- 已尝试运行 `claude doctor` 复测，但该 CLI 命令会进入交互式诊断界面并等待输入，已停止该后台任务；最终交互式 `/doctor` 建议在插件 reload 或重启 Claude Code 后由用户复跑确认。

## 检查

- 需求覆盖：已解释报错含义，并修复 `rust-analyzer-lsp` 启动失败的根因。
- 产物路径：本记录文件；`.claude/skills/work-journal/resources/index.md` 已新增并完成本条记录索引。
- 验证情况：已验证 Rust Analyzer 可执行文件和 rustup 组件恢复正常；`claude doctor` 交互式复测需在当前 Claude Code 会话中执行 `/reload-plugins` 或重启后再跑 `/doctor`。
- 风险：当前会话里的 LSP 已达到崩溃重试上限，可能需要 `/reload-plugins` 或重启 Claude Code 才会重新拉起 LSP。
- 结论：已完成。
