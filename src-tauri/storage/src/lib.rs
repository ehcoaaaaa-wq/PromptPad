mod models;
pub use models::*;
use rusqlite::{Connection, OptionalExtension, Transaction, params};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

type Result<T> = std::result::Result<T, String>;
const MIGRATION: &str = include_str!("../migrations/001_init.sql");
pub const BUILTIN_PACKAGE: &str = include_str!("../../resources/experts.json");
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn digest(text: &str) -> String {
    format!("{:x}", Sha256::digest(text.as_bytes()))
}
fn unique_stamp() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
}
fn validate(prompts: &[Prompt]) -> Result<()> {
    if prompts.len() > 10_000 {
        return Err("模板超过 10000 条".into());
    }
    let mut ids = HashSet::new();
    for p in prompts {
        if p.id.is_empty()
            || !ids.insert(&p.id)
            || !["user", "builtin"].contains(&p.origin.as_str())
            || p.content.len() > 10_000_000
        {
            return Err("模板 ID、来源或内容大小无效".into());
        }
        let mut vars = HashSet::new();
        if p.variables
            .iter()
            .any(|v| v.name.is_empty() || !vars.insert(&v.name))
        {
            return Err("变量名称为空或重复".into());
        }
    }
    Ok(())
}
fn validate_settings(settings: &Settings) -> Result<()> {
    if !["light", "dark", "system"].contains(&settings.theme.as_str()) {
        return Err("主题格式无效".into());
    }
    Ok(())
}
fn version(text: &str) -> Result<(u64, u64, u64)> {
    let parts = text
        .split('.')
        .map(str::parse::<u64>)
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(err)?;
    if parts.len() != 3 {
        return Err("专家包版本必须是 major.minor.patch".into());
    }
    Ok((parts[0], parts[1], parts[2]))
}
fn validate_package(text: &str) -> Result<ExpertPackage> {
    let package: ExpertPackage = serde_json::from_str(text).map_err(err)?;
    validate(&package.prompts)?;
    version(&package.version)?;
    if package.schema_version != 1
        || package.id != "promptpad-experts"
        || package.prompts.is_empty()
    {
        return Err("专家包格式不支持".into());
    }
    let mut identities = HashSet::new();
    for p in &package.prompts {
        let key = p.meta.expert_key.as_deref().ok_or("缺少专家标识")?;
        let locale = p.meta.locale.as_deref().ok_or("缺少专家语言")?;
        if !["zh-CN", "en"].contains(&locale)
            || !identities.insert((key, locale))
            || p.id != format!("builtin:{key}:{locale}")
            || p.origin != "builtin"
            || p.meta.package_id.as_deref() != Some(&package.id)
            || p.title.trim().is_empty()
            || p.content.trim().is_empty()
            || p.meta.content_hash.as_deref() != Some(&digest(&p.content))
        {
            return Err("专家包标识或内容校验失败".into());
        }
        version(p.meta.content_version.as_deref().ok_or("缺少内容版本")?)?;
    }
    Ok(package)
}

pub struct Database {
    conn: Connection,
    directory: PathBuf,
}
impl Database {
    pub fn open(directory: &Path) -> Result<Self> {
        Self::open_with_package(directory, BUILTIN_PACKAGE)
    }
    pub fn open_with_package(directory: &Path, package_text: &str) -> Result<Self> {
        let package = validate_package(package_text)?;
        fs::create_dir_all(directory).map_err(err)?;
        let mut conn = Connection::open(directory.join("promptpad.db")).map_err(err)?;
        conn.busy_timeout(Duration::from_secs(5)).map_err(err)?;
        conn.execute_batch("PRAGMA foreign_keys=ON;").map_err(err)?;
        let initialized: bool = conn.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations')", [], |r| r.get(0)).map_err(err)?;
        if !initialized {
            // Validate and back up the old file before making any schema/data changes.
            let legacy_path = directory.join("prompts.json");
            let legacy = if legacy_path.exists() {
                let text = fs::read_to_string(&legacy_path).map_err(err)?;
                let mut store: Store = serde_json::from_str(&text)
                    .map_err(|e| format!("旧模板库无法解析，未迁移：{e}"))?;
                if store.schema_version != 1 {
                    return Err("旧模板库版本不支持".into());
                }
                validate(&store.prompts)?;
                validate_settings(&store.settings)?;
                for p in &mut store.prompts {
                    if p.id.starts_with("builtin:") {
                        return Err(
                            "旧模板 ID 与内置专家保留命名空间冲突，请先导出并调整 ID".into()
                        );
                    }
                    p.origin = "user".into();
                    p.meta.package_id = None;
                }
                let backup = directory.join(format!("prompts.pre-sqlite-{}.json", unique_stamp()));
                let mut file = OpenOptions::new()
                    .create_new(true)
                    .write(true)
                    .open(backup)
                    .map_err(err)?;
                file.write_all(text.as_bytes()).map_err(err)?;
                file.sync_all().map_err(err)?;
                Some((store, digest(&text)))
            } else {
                None
            };
            let tx = conn.transaction().map_err(err)?;
            tx.execute_batch(MIGRATION).map_err(err)?;
            tx.execute(
                "INSERT INTO schema_migrations(version,checksum) VALUES(1,?1)",
                [digest(MIGRATION)],
            )
            .map_err(err)?;
            let settings = legacy
                .as_ref()
                .map(|(s, _)| s.settings.clone())
                .unwrap_or_default();
            tx.execute(
                "INSERT INTO settings VALUES('app',?1)",
                [serde_json::to_string(&settings).map_err(err)?],
            )
            .map_err(err)?;
            if let Some((store, hash)) = legacy {
                for p in &store.prompts {
                    write_prompt(&tx, p)?;
                }
                tx.execute("INSERT INTO import_runs(source_hash) VALUES(?1)", [hash])
                    .map_err(err)?;
            }
            install_package(&tx, &package, &digest(package_text))?;
            tx.commit().map_err(err)?;
        } else {
            let (schema, checksum): (u32, String) = conn
                .query_row(
                    "SELECT version,checksum FROM schema_migrations ORDER BY version DESC LIMIT 1",
                    [],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .map_err(err)?;
            if schema != 1 || checksum != digest(MIGRATION) {
                return Err("数据库结构版本不兼容，请使用匹配的应用版本".into());
            }
            let installed: Option<(String, String)> = conn
                .query_row(
                    "SELECT version,content_hash FROM expert_packages WHERE id=?1",
                    [&package.id],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .optional()
                .map_err(err)?;
            let needs_install = match installed {
                Some((v, h)) if v == package.version => {
                    if h != digest(package_text) {
                        return Err("同版本专家包内容发生变化，拒绝覆盖".into());
                    }
                    false
                }
                Some((v, _)) => version(&package.version)? > version(&v)?,
                None => true,
            };
            if needs_install {
                backup_connection(&conn, directory)?;
                let tx = conn.transaction().map_err(err)?;
                install_package(&tx, &package, &digest(package_text))?;
                tx.commit().map_err(err)?;
            }
        }
        Ok(Self {
            conn,
            directory: directory.to_path_buf(),
        })
    }
    pub fn read(&self) -> Result<Store> {
        let mut statement = self.conn.prepare("SELECT id,origin,title,content,metadata_json,created_at,updated_at FROM prompts ORDER BY updated_at DESC,id").map_err(err)?;
        let mut rows = statement.query([]).map_err(err)?;
        let mut prompts = Vec::new();
        while let Some(row) = rows.next().map_err(err)? {
            let id: String = row.get(0).map_err(err)?;
            let tags = self.conn.prepare("SELECT t.name FROM tags t JOIN prompt_tags pt ON t.id=pt.tag_id WHERE pt.prompt_id=?1 ORDER BY pt.rowid").map_err(err)?.query_map([&id], |r| r.get(0)).map_err(err)?.collect::<std::result::Result<Vec<String>,_>>().map_err(err)?;
            let variables = self.conn.prepare("SELECT name,description,default_value,required FROM prompt_variables WHERE prompt_id=?1 ORDER BY position").map_err(err)?.query_map([&id], |r| Ok(Variable { name:r.get(0)?, description:r.get(1)?, default_value:r.get(2)?, required:r.get(3)? })).map_err(err)?.collect::<std::result::Result<Vec<_>,_>>().map_err(err)?;
            let (favorite, pinned) = self
                .conn
                .query_row(
                    "SELECT favorite,pinned FROM prompt_user_state WHERE prompt_id=?1",
                    [&id],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .map_err(err)?;
            prompts.push(Prompt {
                id,
                origin: row.get(1).map_err(err)?,
                title: row.get(2).map_err(err)?,
                content: row.get(3).map_err(err)?,
                meta: serde_json::from_str(&row.get::<_, String>(4).map_err(err)?).map_err(err)?,
                created_at: row.get(5).map_err(err)?,
                updated_at: row.get(6).map_err(err)?,
                tags,
                variables,
                favorite,
                pinned,
            });
        }
        let text: String = self
            .conn
            .query_row("SELECT value_json FROM settings WHERE key='app'", [], |r| {
                r.get(0)
            })
            .map_err(err)?;
        Ok(Store {
            schema_version: 2,
            prompts,
            settings: serde_json::from_str(&text).map_err(err)?,
        })
    }
    pub fn save(&mut self, p: &Prompt) -> Result<()> {
        validate(std::slice::from_ref(p))?;
        if p.origin != "user" || p.id.starts_with("builtin:") || p.meta.package_id.is_some() {
            return Err("内置专家正文只读，请创建个人副本".into());
        }
        let tx = self.conn.transaction().map_err(err)?;
        let origin: Option<String> = tx
            .query_row("SELECT origin FROM prompts WHERE id=?1", [&p.id], |r| {
                r.get(0)
            })
            .optional()
            .map_err(err)?;
        if origin.as_deref() == Some("builtin") {
            return Err("不能覆盖内置专家".into());
        }
        write_prompt(&tx, p)?;
        tx.commit().map_err(err)
    }
    pub fn set_flags(&mut self, id: &str, favorite: bool, pinned: bool) -> Result<()> {
        let count = self
            .conn
            .execute(
                "UPDATE prompt_user_state SET favorite=?2,pinned=?3 WHERE prompt_id=?1",
                params![id, favorite, pinned],
            )
            .map_err(err)?;
        if count != 1 {
            return Err("模板不存在".into());
        }
        Ok(())
    }
    pub fn delete(&mut self, id: &str) -> Result<()> {
        if self
            .conn
            .execute("DELETE FROM prompts WHERE id=?1 AND origin='user'", [id])
            .map_err(err)?
            != 1
        {
            return Err("只能删除个人模板".into());
        }
        Ok(())
    }
    pub fn settings(&mut self, settings: &Settings) -> Result<()> {
        validate_settings(settings)?;
        self.conn
            .execute(
                "UPDATE settings SET value_json=?1 WHERE key='app'",
                [serde_json::to_string(settings).map_err(err)?],
            )
            .map_err(err)?;
        Ok(())
    }
    pub fn backup(&self) -> Result<String> {
        backup_connection(&self.conn, &self.directory)
    }
    pub fn import(&mut self, prompts: &[Prompt], action: &str) -> Result<()> {
        validate(prompts)?;
        if !["skip", "replace", "copy"].contains(&action) {
            return Err("导入冲突处理方式无效".into());
        }
        if prompts.iter().any(|p| {
            p.origin != "user" || p.id.starts_with("builtin:") || p.meta.package_id.is_some()
        }) {
            return Err("导入文件不能声明内置专家身份".into());
        }
        self.backup()?;
        let tx = self.conn.transaction().map_err(err)?;
        for (index, p) in prompts.iter().enumerate() {
            let existing: Option<String> = tx
                .query_row("SELECT origin FROM prompts WHERE id=?1", [&p.id], |r| {
                    r.get(0)
                })
                .optional()
                .map_err(err)?;
            if existing.as_deref() == Some("builtin") {
                return Err("导入不能覆盖内置专家".into());
            }
            if existing.is_some() && action == "skip" {
                continue;
            }
            let mut p = p.clone();
            if existing.is_some() && action == "copy" {
                p.id = format!("copy:{}:{}:{index}", unique_stamp(), p.id);
            }
            write_prompt(&tx, &p)?;
        }
        tx.commit().map_err(err)
    }
}
fn backup_connection(conn: &Connection, directory: &Path) -> Result<String> {
    let path = directory.join(format!("promptpad.backup-{}.db", unique_stamp()));
    // Reserve the name before using SQLite's consistent online backup API.
    OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&path)
        .map_err(err)?;
    let mut destination = Connection::open(&path).map_err(err)?;
    let backup = rusqlite::backup::Backup::new(conn, &mut destination).map_err(err)?;
    backup
        .run_to_completion(100, Duration::from_millis(10), None)
        .map_err(err)?;
    Ok(path.to_string_lossy().into_owned())
}
fn write_prompt(tx: &Transaction<'_>, p: &Prompt) -> Result<()> {
    tx.execute("INSERT INTO prompts(id,origin,package_id,expert_key,locale,title,content,metadata_json,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10) ON CONFLICT(id) DO UPDATE SET title=excluded.title,content=excluded.content,metadata_json=excluded.metadata_json,expert_key=excluded.expert_key,locale=excluded.locale,updated_at=excluded.updated_at",params![p.id,p.origin,p.meta.package_id,p.meta.expert_key,p.meta.locale,p.title,p.content,serde_json::to_string(&p.meta).map_err(err)?,p.created_at,p.updated_at]).map_err(err)?;
    tx.execute("INSERT INTO prompt_user_state VALUES(?1,?2,?3) ON CONFLICT(prompt_id) DO UPDATE SET favorite=excluded.favorite,pinned=excluded.pinned",params![p.id,p.favorite,p.pinned]).map_err(err)?;
    tx.execute("DELETE FROM prompt_variables WHERE prompt_id=?1", [&p.id])
        .map_err(err)?;
    for (position, v) in p.variables.iter().enumerate() {
        tx.execute(
            "INSERT INTO prompt_variables VALUES(?1,?2,?3,?4,?5,?6)",
            params![
                p.id,
                v.name,
                v.description,
                v.default_value,
                v.required,
                position as i64
            ],
        )
        .map_err(err)?;
    }
    tx.execute("DELETE FROM prompt_tags WHERE prompt_id=?1", [&p.id])
        .map_err(err)?;
    for tag in &p.tags {
        tx.execute("INSERT OR IGNORE INTO tags(name) VALUES(?1)", [tag])
            .map_err(err)?;
        tx.execute(
            "INSERT OR IGNORE INTO prompt_tags SELECT ?1,id FROM tags WHERE name=?2",
            params![p.id, tag],
        )
        .map_err(err)?;
    }
    Ok(())
}
fn install_package(tx: &Transaction<'_>, package: &ExpertPackage, hash: &str) -> Result<()> {
    tx.execute("INSERT INTO expert_packages VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET version=excluded.version,content_hash=excluded.content_hash",params![package.id,package.version,hash]).map_err(err)?;
    for p in &package.prompts {
        let mut p = p.clone();
        if let Some((favorite, pinned)) = tx
            .query_row(
                "SELECT favorite,pinned FROM prompt_user_state WHERE prompt_id=?1",
                [&p.id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(err)?
        {
            p.favorite = favorite;
            p.pinned = pinned;
        }
        let existing: Option<String> = tx
            .query_row("SELECT origin FROM prompts WHERE id=?1", [&p.id], |r| {
                r.get(0)
            })
            .optional()
            .map_err(err)?;
        if existing.as_deref() == Some("user") {
            return Err("专家 ID 与个人模板冲突".into());
        }
        if let Some((old_content, old_metadata)) = tx
            .query_row(
                "SELECT content,metadata_json FROM prompts WHERE id=?1",
                [&p.id],
                |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
            )
            .optional()
            .map_err(err)?
        {
            let old: Metadata = serde_json::from_str(&old_metadata).map_err(err)?;
            let old_version = version(old.content_version.as_deref().ok_or("已安装专家缺少版本")?)?;
            let next_version = version(p.meta.content_version.as_deref().ok_or("新专家缺少版本")?)?;
            if next_version < old_version
                || (old_content != p.content && next_version == old_version)
            {
                return Err("专家正文变化必须递增内容版本，不能降级".into());
            }
        }
        write_prompt(tx, &p)?;
    }
    Ok(())
}
