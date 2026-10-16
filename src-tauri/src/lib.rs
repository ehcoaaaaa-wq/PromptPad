// PromptPad - Rust backend
//
// Responsibilities:
//   - Register Tauri plugins (clipboard, dialog, fs, autostart, opener).
//   - Provide storage commands: get_data_dir, read_store, write_store.
//   - Atomic file writes (write to .tmp then rename) to avoid corruption.
//
// Data directory policy:
//   - Windows default: D:\PromptPad\  (user feedback: avoid C: drive).
//   - macOS / Linux:  ~/PromptPad/
//   - Override at any time with the PROMPTPAD_DATA_DIR env var.
//   - We bypass Tauri's app_data_dir() intentionally so the data lives
//     on D: by default and is easy to back up / find.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{
    AppHandle, Emitter, Manager, State, WindowEvent,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

const STORE_FILE: &str = "prompts.json";
const DEFAULT_GLOBAL_SHORTCUT: &str = "CommandOrControl+Shift+Space";

struct ShortcutConfig(Mutex<String>);

#[tauri::command]
fn set_global_shortcut(app: AppHandle, state: State<'_, ShortcutConfig>, shortcut: String) -> Result<(), String> {
    if !shortcut_has_modifier(&shortcut) {
        return Err("快捷键必须包含修饰键，例如 CommandOrControl+Shift+Space".into());
    }
    let mut current = state.0.lock().map_err(|e| format!("读取快捷键状态失败：{e}"))?;
    if *current == shortcut { return Ok(()); }
    app.global_shortcut().register(shortcut.as_str()).map_err(|e| format!("无法注册快捷键（可能已被占用）：{e}"))?;
    if !current.is_empty() {
        if let Err(error) = app.global_shortcut().unregister(current.as_str()) {
        let _ = app.global_shortcut().unregister(shortcut.as_str());
        return Err(format!("无法替换原快捷键：{error}"));
        }
    }
    *current = shortcut;
    Ok(())
}

fn shortcut_has_modifier(shortcut: &str) -> bool {
    let parts: Vec<_> = shortcut.split('+').map(str::trim).collect();
    parts.len() >= 2 && parts[..parts.len() - 1].iter().any(|part| {
        matches!(part.to_ascii_lowercase().as_str(), "commandorcontrol" | "ctrl" | "control" | "cmd" | "command" | "alt" | "option" | "shift")
    })
}

fn saved_global_shortcut() -> String {
    fs::read_to_string(store_path()).ok()
        .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
        .and_then(|value| value.pointer("/settings/globalShortcut").and_then(|v| v.as_str()).map(str::to_owned))
        .filter(|value| shortcut_has_modifier(value))
        .unwrap_or_else(|| DEFAULT_GLOBAL_SHORTCUT.to_string())
}

// Tauri commands are async to avoid blocking the UI thread on disk I/O.

#[tauri::command]
async fn get_data_dir() -> Result<String, String> {
    let dir = data_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("create data dir: {e}"))?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
async fn read_store() -> Result<String, String> {
    let path = store_path();
    if !path.exists() {
        // Return empty store on first run rather than erroring.
        return Ok(default_store_json());
    }
    fs::read_to_string(&path).map_err(|e| format!("read store: {e}"))
}

#[tauri::command]
async fn write_store(content: String) -> Result<(), String> {
    let parsed: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("invalid store JSON: {e}"))?;
    if !valid_store(&parsed) {
        return Err("invalid store structure".into());
    }

    let path = store_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create parent: {e}"))?;
    }
    // Preserve an unreadable store before replacing it with valid data.
    if path.exists() {
        let existing =
            fs::read_to_string(&path).map_err(|e| format!("read existing store: {e}"))?;
        if !serde_json::from_str::<serde_json::Value>(&existing)
            .is_ok_and(|value| valid_store(&value))
        {
            let stamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| format!("system clock: {e}"))?
                .as_secs();
            let backup = path.with_file_name(format!("prompts.corrupt-{stamp}.json"));
            fs::copy(&path, &backup).map_err(|e| format!("back up damaged store: {e}"))?;
        }
    }
    // Write to .tmp, then replace the existing file.
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, &content).map_err(|e| format!("write tmp: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("rename: {e}"))?;
    Ok(())
}

fn valid_store(value: &serde_json::Value) -> bool {
    let Some(prompts) = value.get("prompts").and_then(|v| v.as_array()) else {
        return false;
    };
    value.get("schemaVersion").and_then(|v| v.as_u64()) == Some(1)
        && value.get("settings").is_some_and(|v| v.is_object())
        && prompts.iter().all(|prompt| {
            prompt
                .get("id")
                .and_then(|v| v.as_str())
                .is_some_and(|v| !v.is_empty())
                && prompt.get("title").is_some_and(|v| v.is_string())
                && prompt.get("content").is_some_and(|v| v.is_string())
                && prompt
                    .get("tags")
                    .and_then(|v| v.as_array())
                    .is_some_and(|tags| tags.iter().all(|v| v.is_string()))
                && prompt
                    .get("variables")
                    .and_then(|v| v.as_array())
                    .is_some_and(|variables| {
                        variables
                            .iter()
                            .all(|v| v.get("name").is_some_and(|name| name.is_string()))
                    })
        })
}

#[tauri::command]
async fn backup_store() -> Result<Option<String>, String> {
    let path = store_path();
    if !path.exists() {
        return Ok(None);
    }
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("system clock: {e}"))?
        .as_millis();
    let backup = path.with_file_name(format!("prompts.backup-{stamp}.json"));
    fs::copy(&path, &backup).map_err(|e| format!("back up store: {e}"))?;
    Ok(Some(backup.to_string_lossy().to_string()))
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

fn store_path() -> PathBuf {
    data_dir().join(STORE_FILE)
}

fn default_store_json() -> String {
    r#"{"schemaVersion":1,"prompts":[],"projects":[],"settings":{"autoLaunch":false,"activeProjectId":null,"globalShortcut":"CommandOrControl+Shift+Space"}}"#.to_string()
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
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().with_handler(|app, _shortcut, event| {
            if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = app.emit("promptpad-global-shortcut", ());
                }
            }
        }).build())
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
            write_store,
            backup_store,
            export_skill,
            set_global_shortcut,
            quit_app
        ])
        .setup(|app| {
            let requested_shortcut = saved_global_shortcut();
            let shortcut = match app.global_shortcut().register(requested_shortcut.as_str()) {
                Ok(()) => requested_shortcut,
                Err(error) => {
                    eprintln!("Saved global shortcut unavailable ({error}); trying default");
                    if requested_shortcut != DEFAULT_GLOBAL_SHORTCUT {
                        match app.global_shortcut().register(DEFAULT_GLOBAL_SHORTCUT) {
                            Ok(()) => DEFAULT_GLOBAL_SHORTCUT.to_string(),
                            Err(fallback) => {
                                eprintln!("Default global shortcut unavailable ({fallback}); shortcut disabled");
                                String::new()
                            }
                        }
                    } else {
                        eprintln!("Default global shortcut unavailable; shortcut disabled");
                        String::new()
                    }
                }
            };
            app.manage(ShortcutConfig(Mutex::new(shortcut)));
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
