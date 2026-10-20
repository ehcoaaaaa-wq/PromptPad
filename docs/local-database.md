# 本地专家库与 SQLite（首版）

桌面端以数据目录中的 `promptpad.db` 为唯一运行时存储。首次启动自动装入八套专家的中英文版本（16 条记录），无需联网或手动添加。Codex 的 `skills/promptpad-experts` 仍直接读取 Markdown。

## 内容构建

`content/experts/manifest.json` 为每个专家声明稳定 key、语言标题、领域、内容版本和源文件。`scripts/build-experts.mjs` 读取现有双语 Markdown，生成 `src-tauri/resources/experts.json`。生成物提交到 Git，并通过 Rust `include_str!` 编译进程序，安装包不依赖仓库目录或额外资源路径。

- `pnpm experts:build`：重新生成确定性的内容包。
- `pnpm experts:check`：拒绝过期的生成物；正式前端构建执行此检查。
- `schemas/expert-package.schema.json` 描述包格式；构建脚本和 Rust 分别执行必要的语义校验。
- 维护者修改内容时更新 manifest 中对应内容版本、包版本、发布日期和源提交信息。
- 不把索引或 `SKILL.md` 当作专家正文，不把“先确认”段落自动转为填空变量。

## 存储边界

`src-tauri/storage` 是可独立测试的 Rust crate。SQLite 使用 bundled 构建；连接由 Tauri 管理，命令在阻塞工作线程中串行执行。前端仅在命令成功后发布新状态；读取失败时显示重试页并禁止写入。

首版规范化存储模板主体、变量、标签、用户收藏/置顶、设置、专家包及迁移记录。低频来源/版本字段放入 `metadata_json`，由 Rust/TypeScript 类型约束；尚未提供领域 SQL 检索或 FTS 索引。业务关系 `derivedFromId` 是历史来源标识，不建立会级联删除个人副本的外键。

数据库 schema v1 与交换格式 v2、专家包格式 v1 分开版本化。`schema_migrations` 记录 SQL 校验和，结构不匹配会拒绝打开。数据库使用默认 rollback journal，未启用 WAL。

## 旧数据迁移及恢复

保留既有目录规则：Windows 默认 `D:\PromptPad`，其他平台 `~/PromptPad`，支持 `PROMPTPAD_DATA_DIR`。

首次打开未初始化的数据库时，若存在 `prompts.json`：

1. 校验 JSON v1、稳定 ID、变量、设置与保留命名空间。
2. 使用不覆盖的名称写入并同步 `prompts.pre-sqlite-<时间戳>.json`。
3. 在同一事务内建表、导入个人模板与设置、安装专家包、记录迁移成功。
4. 提交后使用数据库；原 JSON 保持原样，以后不再读取或双写。

损坏 JSON、重复 ID 或迁移失败会阻止进入编辑界面。修复文件后可以重试。重复标签按关系模型合并，变量顺序、默认值与说明保留；变量名为空或重复会拒绝迁移并提示。

普通导入事务开始前通过 SQLite Online Backup API 创建 `promptpad.backup-<时间戳>.db`。恢复时退出应用，备份当前 `promptpad.db`，再用选定数据库备份替换它。恢复旧专家版本后启动较新应用会再次升级内置内容。

如需退回旧版应用：先导出最新 JSON，将 `schemaVersion` 改为 1，并只保留需要带回的个人模板，验证副本后再替换旧版的 `prompts.json`。当前的旧 JSON 只代表迁移前快照。

## 使用、导入和导出

- 内置专家正文只读；收藏与置顶单独保存。创建个人副本会产生新 ID，记录 `derivedFromId`、`baseVersion`，不携带官方包身份。
- JSON v1/v2、原有单模板 Markdown 均可导入。普通导入仅导入模板，不导入设置。
- 导出内置专家后再导入，会转为 `imported:<原 ID>` 的个人记录；重复导入可以跳过、覆盖或复制，绝不覆盖官方记录。
- Markdown v2 保留来源元数据；Skill 导出保留完整正文、变量指导、专家语言和来源版本。导出是快照，同名目录仍拒绝覆盖。
- 搜索使用 Fuse，新增描述字段权重，有搜索词时保留相关性排序。专家视图支持中文/英文筛选。

## 随应用升级

应用只安装编译时内置的可信专家包，不从普通文件导入入口安装“官方包”。相同包版本和校验值无操作；同版本内容变化拒绝覆盖；更高版本先备份、再事务更新，并保留收藏、置顶、个人模板和个人副本。旧应用不会把已安装的新专家包降级。

本轮不提供在线更新、本地专家包安装入口、自动合并个人修改、专家下架处理或 FTS；这些属于 P2 及后续。包中移除某个专家不会自动删除旧记录。

## 验证

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
cargo test --manifest-path src-tauri/storage/Cargo.toml --locked
cargo test --manifest-path src-tauri/Cargo.toml --locked
pnpm tauri build
```

Windows CI 执行前端、数据库、Tauri 测试及桌面可执行程序构建（不生成安装器）。安装包与真实桌面人工验收仍需检查：断网首次启动、旧 JSON 迁移、保存后重启、专家使用/个人副本、Markdown/JSON/Skill 导出、托盘退出、备份恢复。使用临时 `PROMPTPAD_DATA_DIR`，不要直接用唯一真实数据做验收。
