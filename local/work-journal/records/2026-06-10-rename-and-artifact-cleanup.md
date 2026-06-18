# 2026-06-10 Claude HUD One 命名统一与构建产物清理

## 原始需求

- 用户最终确定产品名为 `Claude HUD One`，远程仓库将改为 `claude-hud-one`。
- 用户要求修改工作区里所有相关名称，并在本地目录重命名后继续检查源码、文档和构建产物中是否还有旧品牌命名残留。

## 范围

- 本轮做：统一产品显示名、包名、Tauri product/identifier、Rust crate/lib、AppData、bridge、安装/卸载脚本、README、Settings、测试断言和需求讨论文档路径；清理旧 build/target/dist/state 产物并重建。
- 本轮不做：不处理远程仓库改名本身；不引入签名证书或 updater 发布源。
- 待确认：远程仓库改名后如需更新 remote URL，可单独处理。

## 计划

1. 扫描旧名/候选名残留。
2. 统一源码、配置、文档、测试和安装资源中的命名。
3. 清理旧构建产物和运行状态文件。
4. 重新执行版本检查、构建和打包。
5. 再次扫描构建产物中的旧名残留。

## 进展

- 已统一 `Claude HUD One` / `claude-hud-one` 相关命名，覆盖 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、bridge、Settings、安装资源、README、测试和需求讨论文档。
- 已将 `.claude/workspace-index.md` 中需求讨论入口和注释路径调整为不依赖旧物理目录名。
- 用户完成本地目录重命名后，已执行 `cargo clean`，删除 `dist` 与 `.claude/bridge/state` 下旧运行状态，再重新生成构建产物。
- 清理后扫描源码和构建产物，旧品牌命名残留为 0。

## 检查

- 需求覆盖：已覆盖产品命名统一、构建产物清理和旧名残留复查。
- 产物路径：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、`.claude/bridge/claude-status-bridge.mjs`、`src-tauri/resources/*claude-hud-one*`、`src/components/settings/SettingsView.tsx`、`README.md`、`local/需求讨论/2026-06-10-claude-hud-one-内置claude-hud-plus终端hud集成分析.md`。
- 验证情况：`npm run check:version`、`npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml -j 1` 和 `npm run tauri:build` 通过；重建后扫描 6637 个文件、约 2269MB 内容，旧品牌命名残留为 0。
- 风险：历史 Git 提交信息和外部发布资产中的旧名不属于本轮源码/构建产物清理范围。
- 工作区索引：已按长期资料入口变更同步 `.claude/workspace-index.md`。
- 结论：已完成。
