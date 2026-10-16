# PromptPad

本地提示词模板管理工具。整理模板、填写 `{{变量}}`，然后复制到任意 AI 工具使用。基于 Tauri 2、React 和 TypeScript。

## 功能

- 创建、编辑、删除模板；按标签、收藏和置顶筛选，支持模糊搜索。
- 使用模板时填写变量；内置 `date`、`time`、`datetime` 和 `clipboard`。
- 导入 JSON 或 Markdown；导入前预览数量及重复项，并自动备份现有模板库。
- 导出整库 JSON 或单个 Markdown 模板。
- 将当前模板预览并导出为独立 Codex Skill；仓库内另附可离线使用的双语专家库 Skill。
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

## PromptPad 专家库 Skill

除了桌面端，PromptPad 还提供一个可离线读取的 Codex 专家库：`skills/promptpad-experts/`。它包含八套中英双语工作模板，帮助 Agent 按步骤完成复杂任务。

| 专家 | 适用任务 |
| --- | --- |
| 产品需求 | 梳理目标、用户场景、需求范围与验收标准 |
| 软件架构 | 模块划分、接口设计、方案取舍 |
| 故障排查 | 收集证据、定位原因、制定修复与验证步骤 |
| React 性能 | 分析渲染、状态更新和页面性能问题 |
| UI/UX | 设计信息结构、交互流程与界面体验 |
| 研究整理 | 明确研究问题、整理来源与证据 |
| 数据分析 | 核对数据口径、分析结果与局限 |
| 技术写作 | 编写使用说明、迁移指南和技术文档 |

### 如何工作

Skill 先读取专家索引，再加载相关模板。普通专业任务通常选择一个专家；需要多个阶段时组合 2–3 个，由同一个 Agent 分阶段使用。简单问答、翻译和常规小改动无需调用专家库。

专家库本身使用 Markdown，不需要 SQLite、额外 API 或在线更新。执行任务时是否需要联网，取决于任务本身和 Agent 的能力；专家模板不会授予额外权限。

### 安装到 Codex

在 Codex 中直接发送：

```text
请使用 skill-installer，从 GitHub 仓库 ehcoaaaaa-wq/PromptPad
的 main 分支安装 skills/promptpad-experts。
```

如果使用 Skill 安装器脚本，对应参数是：

```text
--repo ehcoaaaaa-wq/PromptPad --ref main --path skills/promptpad-experts
```

也可以下载仓库，将 `skills/promptpad-experts` 整个文件夹放入当前 Codex 支持的 Skill 目录。必须同时保留 `SKILL.md` 和 `references/`。安装后重新打开 Codex 会话；若未显示，请检查安装目录是否被扫描。

**上传到 GitHub 不等于安装。使用者仍需在自己的 Codex 中安装，才能调用。**

### 调用示例

安装后可直接说：

```text
用 PromptPad 专家帮我分析这个 React 页面为什么慢。

用 PromptPad 专家先整理产品需求，再设计界面流程和软件架构。

Use promptpad-experts to write a migration guide for this project.
```

Agent 会按任务选择必要的专家模板；信息不足时先获取或确认关键输入，结论应区分证据、假设与未验证内容。

### 将自己的模板导出为独立 Skill

1. 在 PromptPad 中选择并保存当前模板。
2. 打开右上角“导入 / 导出”，选择“导出当前模板为 Codex Skill”。
3. 编辑小写英文名称和调用说明，检查生成的 `SKILL.md` 预览。
4. 选择本地已有目录，应用会创建以 Skill 名称命名的新文件夹，写入 `SKILL.md`。
5. 将导出的文件夹安装到 Codex 支持的 Skill 目录后使用。

同名文件夹已经存在时会停止导出，提示另选名称，不覆盖原文件。模板中的 `{{变量}}` 会列为 Agent 需要获取或确认的输入；`{{clipboard}}` 不会自动读取剪贴板，只有用户授权且工具支持时才能使用。导出不修改原有模板库。

### 手动分享独立 Skill

将导出的整个文件夹放入自己的 GitHub 仓库 `skills/` 目录，审阅后提交、推送，再向使用者提供仓库、分支和文件夹路径。对方仍需安装；桌面端目前不提供一键发布和在线更新。
