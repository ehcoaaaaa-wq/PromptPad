// Tauri command wrappers.
// Keeps plugin API surface in one place so components stay UI-only.

import type { Store, Prompt, Settings } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  open as openDialog,
  save as saveDialog,
  message as showMessage,
} from "@tauri-apps/plugin-dialog";
import {
  isEnabled,
  enable,
  disable,
} from "@tauri-apps/plugin-autostart";

export async function getDataDir(): Promise<string> {
  return invoke("get_data_dir");
}

export async function readStore(): Promise<Store> {
  return invoke("read_store");
}

export const savePrompt = (prompt: Prompt): Promise<Store> => invoke("save_prompt", { prompt });
export const removePrompt = (id: string): Promise<Store> => invoke("delete_prompt", { id });
export const saveFlags = (id: string, favorite: boolean, pinned: boolean): Promise<Store> => invoke("set_prompt_flags", { id, favorite, pinned });
export const saveSettings = (settings: Settings): Promise<Store> => invoke("save_settings", { settings });
export const importPrompts = (prompts: Prompt[], action: string): Promise<Store> => invoke("import_prompts", { prompts, action });

export async function backupStore(): Promise<string | null> {
  return invoke("backup_store");
}

export async function exportSkill(parentDir: string, name: string, content: string): Promise<string> {
  return invoke("export_skill", { parentDir, name, content });
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
  isEnabled,
  enable,
  disable,
};
