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
use tauri::WindowEvent;

const STORE_FILE: &str = "prompts.json";

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
    let path = store_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create parent: {e}"))?;
    }
    // Atomic write: write to .tmp, then rename. Avoids partial corruption if interrupted.
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, &content).map_err(|e| format!("write tmp: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("rename: {e}"))?;
    Ok(())
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
    // Versioned empty store — keep the same shape as the TS Store type.
    r#"{"schemaVersion":1,"prompts":[],"settings":{"autoLaunch":false}}"#.to_string()
}

// Window close → hide to tray (closing the window should NOT exit the app).
// Quit only happens through the explicit "Quit" menu item.
fn handle_window_event(window: &tauri::Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        let _ = window.hide();
        api.prevent_close();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .invoke_handler(tauri::generate_handler![
            get_data_dir,
            read_store,
            write_store
        ])
        .on_window_event(handle_window_event)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}