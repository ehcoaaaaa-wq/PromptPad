# PromptPad Expert Skill 使用说明

## 专家库

仓库中的 [promptpad-experts](../skills/promptpad-experts/SKILL.md) 是一个可离线使用的 Codex Skill。首版包含八位专家的中英文工作模板，入口索引位于 `references/index.md`。Skill 会先按任务选出相关专家，通常只读取一个；跨阶段任务最多读取三个。

它提供工作方法，不代表真人专家资质，也不会自行访问私有文件、上传数据或执行外部操作。简单问题无需调用专家库。

## 从 GitHub 安装到 Codex

在 Codex 中使用内置 `skill-installer`，指定仓库 `ehcoaaaaa-wq/PromptPad`、`main` 分支和路径 `skills/promptpad-experts`。安装器会把整个 Skill 文件夹放到 Codex 可扫描的 Skill 目录。若使用命令行安装器，对应参数为：

```text
--repo ehcoaaaaa-wq/PromptPad --ref main --path skills/promptpad-experts
```

也可下载仓库，把 `skills/promptpad-experts` 整个文件夹复制到 Codex 的 Skill 目录中。不要只复制 `SKILL.md`，因为它还需要 `references/`。若未出现，重新打开 Codex 会话并确认 Skill 目录可被扫描。

安装后可以提出“用 PromptPad 专家帮我分析这个 React 页面为什么慢”或“先整理产品需求，再设计界面流程”。Codex 会根据调用说明决定是否使用该 Skill；单纯上传到 GitHub 不会自动安装或启用。

## 从桌面端导出独立 Skill

1. 保存正在编辑的模板，在右上角“导入 / 导出”菜单选择“导出当前模板为 Codex Skill”。
2. 填写小写英文 Skill 名称和具体的调用说明，核对 `SKILL.md` 预览。
3. 选择一个已有目录。PromptPad 会在其中创建以 Skill 名称命名的新文件夹及 `SKILL.md`。同名文件夹已经存在时，导出停止，不覆盖原文件。
4. 需要发布到 GitHub 时，把整个新文件夹放进仓库的 `skills/` 目录，再由你审阅并提交、推送。其他人仍需安装后才能调用。

模板中的 `{{变量}}` 会在导出的 Skill 中列为输入。Agent 应从当前任务获取值，缺少关键值时询问用户；`{{clipboard}}` 不会自动读取，只有用户授权且工具允许时才能使用。导出不修改 PromptPad 的模板库。

## 版本范围

首版使用 Markdown 文件，不依赖 SQLite、额外模型 API 或联网更新。桌面端只负责导出独立 Skill；专家库的编辑与 GitHub 自动更新留待后续版本。

## 桌面端内置专家

桌面端首次启动自动装载八套双语专家到本地数据库。选择“内置专家”即可使用，修改正文需创建个人副本。该数据库不会被 Codex Skill 读取；Skill 仍使用 references 中的 Markdown。详情见 [本地数据库说明](local-database.md)。
