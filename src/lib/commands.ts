// Tauri command wrappers.
// Keeps plugin API surface in one place so components stay UI-only.

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

export async function readStore(): Promise<string> {
  return invoke("read_store");
}

export async function writeStore(content: string): Promise<void> {
  return invoke("write_store", { content });
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
