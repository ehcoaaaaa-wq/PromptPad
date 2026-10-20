// PromptPad - Rust backend
//
// Responsibilities:
//   - Register Tauri plugins (clipboard, dialog, fs, autostart, opener).
//   - Serialize SQLite operations on a blocking worker.
//   - Embed the validated offline expert package through promptpad-storage.
//
// Data directory policy:
//   - Windows default: D:\PromptPad\  (user feedback: avoid C: drive).
//   - macOS / Linux:  ~/PromptPad/
//   - Override at any time with the PROMPTPAD_DATA_DIR env var.
//   - We bypass Tauri's app_data_dir() intentionally so the data lives
//     on D: by default and is easy to back up / find.

use std::fs;
use std::path::PathBuf;
use tauri::{
    Emitter, Manager, WindowEvent,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};

use promptpad_storage::{Database, Prompt, Settings, Store};
use std::sync::{Arc, Mutex};

#[derive(Clone, Default)]
struct DatabaseState(Arc<Mutex<Option<Database>>>);

async fn with_database<T: Send + 'static>(
    state: DatabaseState,
    work: impl FnOnce(&mut Database) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut guard = state.0.lock().map_err(|_| "数据库锁不可用")?;
        let db = guard.as_mut().ok_or("模板库未成功加载，已禁止写入")?;
        work(db)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_data_dir() -> Result<String, String> {
    Ok(data_dir().to_string_lossy().into_owned())
}

#[tauri::command]
async fn read_store(state: tauri::State<'_, DatabaseState>) -> Result<Store, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut guard = state.0.lock().map_err(|_| "数据库锁不可用")?;
        if guard.is_none() {
            *guard = Some(Database::open(&data_dir())?);
        }
        guard.as_ref().ok_or("数据库未加载")?.read()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_prompt(
    state: tauri::State<'_, DatabaseState>,
    prompt: Prompt,
) -> Result<Store, String> {
    with_database(state.inner().clone(), move |db| {
        db.save(&prompt)?;
        db.read()
    })
    .await
}
#[tauri::command]
async fn delete_prompt(
    state: tauri::State<'_, DatabaseState>,
    id: String,
) -> Result<Store, String> {
    with_database(state.inner().clone(), move |db| {
        db.delete(&id)?;
        db.read()
    })
    .await
}
#[tauri::command]
async fn set_prompt_flags(
    state: tauri::State<'_, DatabaseState>,
    id: String,
    favorite: bool,
    pinned: bool,
) -> Result<Store, String> {
    with_database(state.inner().clone(), move |db| {
        db.set_flags(&id, favorite, pinned)?;
        db.read()
    })
    .await
}
#[tauri::command]
async fn save_settings(
    state: tauri::State<'_, DatabaseState>,
    settings: Settings,
) -> Result<Store, String> {
    with_database(state.inner().clone(), move |db| {
        db.settings(&settings)?;
        db.read()
    })
    .await
}
#[tauri::command]
async fn import_prompts(
    state: tauri::State<'_, DatabaseState>,
    prompts: Vec<Prompt>,
    action: String,
) -> Result<Store, String> {
    with_database(state.inner().clone(), move |db| {
        db.import(&prompts, &action)?;
        db.read()
    })
    .await
}
#[tauri::command]
async fn backup_store(state: tauri::State<'_, DatabaseState>) -> Result<String, String> {
    with_database(state.inner().clone(), |db| db.backup()).await
}

#[tauri::command]
async fn export_skill(parent_dir: String, name: String, content: String) -> Result<String, String> {
    export_skill_to_dir(parent_dir, name, content)
}

fn export_skill_to_dir(
    parent_dir: String,
    name: String,
    content: String,
) -> Result<String, String> {
    if name.is_empty()
        || name.len() > 64
        || name.starts_with('-')
        || name.ends_with('-')
        || !name
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
    {
        return Err("Skill 名称只能包含小写英文字母、数字和连字符，长度不超过 64".into());
    }
    if content.is_empty() || content.len() > 1_000_000 {
        return Err("Skill 内容为空或超过 1 MB".into());
    }
    let parent = PathBuf::from(parent_dir);
    if !parent.is_dir() {
        return Err("请选择已存在的目标目录".into());
    }
    let skill_dir = parent.join(name);
    fs::create_dir(&skill_dir).map_err(|e| {
        if e.kind() == std::io::ErrorKind::AlreadyExists {
            "同名 Skill 文件夹已存在，请修改名称或选择其他目录".to_string()
        } else {
            format!("创建 Skill 文件夹失败：{e}")
        }
    })?;
    let skill_file = skill_dir.join("SKILL.md");
    if let Err(e) = fs::write(&skill_file, content) {
        let _ = fs::remove_file(&skill_file);
        let _ = fs::remove_dir(&skill_dir);
        return Err(format!("写入 SKILL.md 失败：{e}"));
    }
    Ok(skill_dir.to_string_lossy().to_string())
}

#[cfg(test)]
mod skill_export_tests {
    use super::export_skill_to_dir;

    #[test]
    fn export_creates_skill_and_never_overwrites_existing_folder() {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("promptpad-skill-test-{unique}"));
        std::fs::create_dir(&root).unwrap();
        let parent = root.to_string_lossy().to_string();
        let first = export_skill_to_dir(parent.clone(), "my-skill".into(), "first".into()).unwrap();
        assert_eq!(
            std::fs::read_to_string(std::path::Path::new(&first).join("SKILL.md")).unwrap(),
            "first"
        );
        assert!(export_skill_to_dir(parent.clone(), "my-skill".into(), "second".into()).is_err());
        assert_eq!(
            std::fs::read_to_string(std::path::Path::new(&first).join("SKILL.md")).unwrap(),
            "first"
        );
        assert!(export_skill_to_dir(parent, "../escape".into(), "bad".into()).is_err());
        std::fs::remove_file(std::path::Path::new(&first).join("SKILL.md")).unwrap();
        std::fs::remove_dir(first).unwrap();
        std::fs::remove_dir(root).unwrap();
    }
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

// Resolve the data directory. Order:
//   1. PROMPTPAD_DATA_DIR env var (lets the user override at any time).
//   2. Platform default: D:\PromptPad on Windows, ~/PromptPad elsewhere.
fn data_dir() -> PathBuf {
    if let Ok(p) = std::env::var("PROMPTPAD_DATA_DIR") {
        if !p.is_empty() {
            return PathBuf::from(p);
        }
    }
    #[cfg(windows)]
    {
        return PathBuf::from(r"D:\PromptPad");
    }
    #[cfg(not(windows))]
    {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home).join("PromptPad");
        }
        PathBuf::from("PromptPad")
    }
}

fn handle_window_event(window: &tauri::Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        let _ = window.hide();
        api.prevent_close();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DatabaseState::default())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .invoke_handler(tauri::generate_handler![
            get_data_dir,
            read_store,
            save_prompt,
            delete_prompt,
            set_prompt_flags,
            save_settings,
            import_prompts,
            backup_store,
            export_skill,
            quit_app
        ])
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出 PromptPad", true, None::<&str>)?;
            let force_quit = MenuItem::with_id(app, "force_quit", "强制退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit, &force_quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().expect("window icon").clone())
                .tooltip("PromptPad")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                        let _ = app.emit("promptpad-quit-requested", ());
                    }
                    "force_quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            if std::env::args_os().any(|arg| arg.to_string_lossy() == "--autostart") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            Ok(())
        })
        .on_window_event(handle_window_event)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
