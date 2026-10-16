// Tauri command wrappers.
// Keeps plugin API surface in one place so components stay UI-only.

import { invoke } from "@tauri-apps/api/core";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  open as openDialog,
  save as saveDialog,
  message as showMessage,
} from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { readTextFile } from "@tauri-apps/plugin-fs";
import {
  isEnabled,
  enable,
  disable,
} from "@tauri-apps/plugin-autostart";

export async function getDataDir(): Promise<string> {
  return invoke("get_data_dir");
}

export async function readStore(): Promise<string> {
  return invoke("read_store");
}

export async function writeStore(content: string): Promise<void> {
  return invoke("write_store", { content });
}

export async function backupStore(): Promise<string | null> {
  return invoke("backup_store");
}

export async function exportSkill(parentDir: string, name: string, content: string): Promise<string> {
  return invoke("export_skill", { parentDir, name, content });
}

export async function setGlobalShortcut(shortcut: string): Promise<void> {
  return invoke("set_global_shortcut", { shortcut });
}

export async function quitApp(): Promise<void> {
  return invoke("quit_app");
}

export {
  readText,
  writeText,
  openDialog,
  saveDialog,
  showMessage,
  openUrl,
  readTextFile,
  isEnabled,
  enable,
  disable,
};
