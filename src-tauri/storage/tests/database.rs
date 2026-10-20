use promptpad_storage::{BUILTIN_PACKAGE, Database, Prompt, Store};
use rusqlite::Connection;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::fs;
fn personal(id: &str) -> Prompt {
    serde_json::from_value(json!({"id":id,"title":"个人测试","content":"正文 {{code}}","tags":["代码","测试"],"variables":[{"name":"code","description":"代码片段","defaultValue":"示例"}],"favorite":true,"pinned":true,"createdAt":"2026-10-01T00:00:00Z","updatedAt":"2026-10-02T00:00:00Z"})).unwrap()
}
#[test]
fn first_run_is_offline_and_idempotent() {
    let dir = tempfile::tempdir().unwrap();
    let db = Database::open(dir.path()).unwrap();
    let store = db.read().unwrap();
    assert_eq!(store.schema_version, 2);
    assert_eq!(store.prompts.len(), 16);
    assert_eq!(
        store
            .prompts
            .iter()
            .filter(|p| p.meta.locale.as_deref() == Some("zh-CN"))
            .count(),
        8
    );
    drop(db);
    assert_eq!(
        Database::open(dir.path())
            .unwrap()
            .read()
            .unwrap()
            .prompts
            .len(),
        16
    );
}
#[test]
fn legacy_migration_preserves_fields_and_original_file() {
    let dir = tempfile::tempdir().unwrap();
    let p = personal("old-id");
    let old =
        json!({"schemaVersion":1,"prompts":[p],"settings":{"theme":"dark","autoLaunch":true}})
            .to_string();
    fs::write(dir.path().join("prompts.json"), &old).unwrap();
    let db = Database::open(dir.path()).unwrap();
    let store = db.read().unwrap();
    assert_eq!(store.prompts.iter().find(|p| p.id == "old-id").unwrap(), &p);
    assert_eq!(store.settings.theme, "dark");
    assert!(store.settings.auto_launch);
    assert_eq!(
        fs::read_to_string(dir.path().join("prompts.json")).unwrap(),
        old
    );
    let backups: Vec<_> = fs::read_dir(dir.path())
        .unwrap()
        .filter_map(|e| {
            let p = e.unwrap().path();
            p.file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("prompts.pre-sqlite-")
                .then_some(p)
        })
        .collect();
    assert_eq!(backups.len(), 1);
    assert_eq!(fs::read_to_string(&backups[0]).unwrap(), old);
    drop(db);
    assert_eq!(
        Database::open(dir.path())
            .unwrap()
            .read()
            .unwrap()
            .prompts
            .len(),
        17
    );
}
#[test]
fn corrupt_legacy_file_is_not_replaced_or_marked_migrated() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("prompts.json"), "{broken").unwrap();
    assert!(Database::open(dir.path()).is_err());
    assert_eq!(
        fs::read_to_string(dir.path().join("prompts.json")).unwrap(),
        "{broken"
    );
    let conn = Connection::open(dir.path().join("promptpad.db")).unwrap();
    assert_eq!(
        conn.query_row(
            "SELECT count(*) FROM sqlite_master WHERE name='schema_migrations'",
            [],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        0
    );
    fs::write(
        dir.path().join("prompts.json"),
        json!({"schemaVersion":1,"prompts":[],"settings":{}}).to_string(),
    )
    .unwrap();
    assert_eq!(
        Database::open(dir.path())
            .unwrap()
            .read()
            .unwrap()
            .prompts
            .len(),
        16
    );
}
#[test]
fn schema_failure_rolls_back_and_retry_succeeds() {
    let dir = tempfile::tempdir().unwrap();
    let conn = Connection::open(dir.path().join("promptpad.db")).unwrap();
    conn.execute_batch("CREATE TABLE tags(unrelated TEXT);")
        .unwrap();
    assert!(Database::open(dir.path()).is_err());
    assert_eq!(
        conn.query_row(
            "SELECT count(*) FROM sqlite_master WHERE name='schema_migrations'",
            [],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        0
    );
    conn.execute_batch("DROP TABLE tags;").unwrap();
    assert_eq!(
        Database::open(dir.path())
            .unwrap()
            .read()
            .unwrap()
            .prompts
            .len(),
        16
    );
}
#[test]
fn import_is_atomic_and_backup_is_restorable() {
    let dir = tempfile::tempdir().unwrap();
    let mut db = Database::open(dir.path()).unwrap();
    db.save(&personal("keep")).unwrap();
    let backup = db.backup().unwrap();
    let restored = tempfile::tempdir().unwrap();
    fs::copy(backup, restored.path().join("promptpad.db")).unwrap();
    assert_eq!(
        Database::open(restored.path())
            .unwrap()
            .read()
            .unwrap()
            .prompts
            .len(),
        17
    );
    let conn = Connection::open(dir.path().join("promptpad.db")).unwrap();
    conn.execute_batch("CREATE TRIGGER injected_failure BEFORE INSERT ON prompts WHEN NEW.id='bad' BEGIN SELECT RAISE(ABORT,'injected disk/write failure'); END;").unwrap();
    assert!(
        db.import(&[personal("good"), personal("bad")], "replace")
            .is_err()
    );
    assert_eq!(db.read().unwrap().prompts.len(), 17);
    assert!(!db.read().unwrap().prompts.iter().any(|p| p.id == "good"));
}
#[test]
fn builtin_content_is_protected_and_import_choices_work() {
    let dir = tempfile::tempdir().unwrap();
    let mut db = Database::open(dir.path()).unwrap();
    let mut builtin = db.read().unwrap().prompts[0].clone();
    assert!(db.save(&builtin).is_err());
    assert!(db.delete(&builtin.id).is_err());
    builtin.origin = "user".into();
    assert!(db.import(&[builtin], "replace").is_err());
    let original = personal("same");
    db.save(&original).unwrap();
    let mut incoming = original.clone();
    incoming.title = "新版".into();
    db.import(&[incoming.clone()], "skip").unwrap();
    assert_eq!(
        db.read()
            .unwrap()
            .prompts
            .iter()
            .find(|p| p.id == "same")
            .unwrap()
            .title,
        original.title
    );
    db.import(&[incoming.clone()], "replace").unwrap();
    assert_eq!(
        db.read()
            .unwrap()
            .prompts
            .iter()
            .find(|p| p.id == "same")
            .unwrap()
            .title,
        "新版"
    );
    db.import(&[incoming], "copy").unwrap();
    assert_eq!(db.read().unwrap().prompts.len(), 18);
}
#[test]
fn package_upgrade_preserves_flags_and_personal_forks() {
    let dir = tempfile::tempdir().unwrap();
    let mut db = Database::open(dir.path()).unwrap();
    let builtin = db.read().unwrap().prompts[0].clone();
    db.set_flags(&builtin.id, true, true).unwrap();
    let mut copy = personal("fork");
    copy.meta.derived_from_id = Some(builtin.id.clone());
    copy.meta.base_version = builtin.meta.content_version.clone();
    db.save(&copy).unwrap();
    drop(db);
    let mut package: Value = serde_json::from_str(BUILTIN_PACKAGE).unwrap();
    package["version"] = json!("1.1.0");
    for p in package["prompts"].as_array_mut().unwrap() {
        if p["id"] == builtin.id {
            p["content"] = json!("新版内容\n");
            p["contentHash"] = json!(format!("{:x}", Sha256::digest("新版内容\n".as_bytes())));
            p["contentVersion"] = json!("1.1.0");
        }
    }
    let new_package = serde_json::to_string(&package).unwrap();
    let db = Database::open_with_package(dir.path(), &new_package).unwrap();
    let store = db.read().unwrap();
    let new = store.prompts.iter().find(|p| p.id == builtin.id).unwrap();
    assert_eq!(new.content, "新版内容\n");
    assert!(new.favorite && new.pinned);
    assert_eq!(
        store.prompts.iter().find(|p| p.id == "fork").unwrap(),
        &copy
    );
    drop(db);
    // Older app keeps the newer package; it never silently downgrades it.
    assert_eq!(
        Database::open(dir.path())
            .unwrap()
            .read()
            .unwrap()
            .prompts
            .iter()
            .find(|p| p.id == builtin.id)
            .unwrap()
            .content,
        "新版内容\n"
    );
    package["prompts"][0]["title"] = json!("同版本改动");
    assert!(Database::open_with_package(dir.path(), &package.to_string()).is_err());
}
#[test]
fn duplicate_legacy_ids_fail_without_partial_import() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store {
        schema_version: 1,
        prompts: vec![personal("same"), personal("same")],
        settings: Default::default(),
    };
    fs::write(
        dir.path().join("prompts.json"),
        serde_json::to_string(&store).unwrap(),
    )
    .unwrap();
    assert!(Database::open(dir.path()).is_err());
}
