# PromptPad

本地提示词模板管理工具。整理模板、填写 `{{变量}}`，然后复制到任意 AI 工具使用。基于 Tauri 2、React 和 TypeScript。

## 功能

- 创建、编辑、删除模板；按标签、收藏和置顶筛选，支持模糊搜索。
- 使用模板时填写变量；内置 `date`、`time`、`datetime` 和 `clipboard`。
- 导入 JSON 或 Markdown；导入前预览数量及重复项，并自动备份现有模板库。
- 导出整库 JSON 或单个 Markdown 模板。
- 关闭主窗口后可从系统托盘重新打开；正常退出会检查未保存修改，托盘也提供强制退出入口。
- 重复启动时聚焦已有窗口，避免多个进程同时写入模板库。
- 设置页可切换开机自启并查看数据目录；主题可切换浅色、深色或跟随系统。

## 数据与备份

Windows 默认保存在 `D:\PromptPad\prompts.json`；macOS 和 Linux 默认保存在 `~/PromptPad/prompts.json`。可用 `PROMPTPAD_DATA_DIR` 环境变量指定其他目录。如果 Windows 设备没有 D 盘，请先设置该变量。

每次导入前，会在同一数据目录创建 `prompts.backup-<时间戳>.json`。恢复时先退出应用，再备份当前 `prompts.json`，最后用所需备份文件替换它。

## 开发与构建

```sh
pnpm install
pnpm tauri dev
```

```sh
pnpm test
pnpm build
pnpm tauri build
```

安装包位于 `src-tauri/target/release/bundle/`。当前 v0.3 开发与验收安排见 [计划](docs/v0.3-plan.md)。
