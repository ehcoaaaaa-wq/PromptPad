// Global store with React subscription.
// Tiny pub/sub keeps the surface small; no Redux/Zustand for an MVP.
//
// Mutations are queued and published after successful disk writes.
// Editor drafts remain separate so a failed save stays visibly unsaved.

import { useEffect, useState } from "react";
import type { Store, Prompt, Settings, PromptFolder, PromptSnippet } from "./types";
import { DEFAULT_STORE } from "./types";
import { readStore, writeStore } from "./lib/commands";
import { pushToast } from "./hooks/useToast";
import { normalizeFolders, normalizePrompts, normalizeProjectProfiles, normalizeSnippets, normalizeTrash } from "./lib/import";
import { createPersistence } from "./lib/persistence";
import { emitTo } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

const listeners = new Set<() => void>();
const undoStack: Store[] = [];
const redoStack: Store[] = [];
const HISTORY_LIMIT = 20;
let initialized = false;
let loading: Promise<void> | null = null;
const persistence = createPersistence<Store>(DEFAULT_STORE, (value) => writeStore(JSON.stringify(value, null, 2)), notify);

export function getState(): Store {
  return persistence.get();
}

function notify(): void {
  listeners.forEach((l) => l());
}

const cloneStore = (value: Store): Store => JSON.parse(JSON.stringify(value)) as Store;
function preserveUsage(target: Store, current: Store): Store {
  const usage = new Map(current.prompts.map((prompt) => [prompt.id, { useCount: prompt.useCount, lastUsedAt: prompt.lastUsedAt }]));
  for (const item of current.trash) usage.set(item.prompt.id, { useCount: item.prompt.useCount, lastUsedAt: item.prompt.lastUsedAt });
  const withUsage = (prompt: Prompt) => {
    const saved = usage.get(prompt.id);
    return saved ? { ...prompt, useCount: saved.useCount, lastUsedAt: saved.lastUsedAt } : prompt;
  };
  return { ...target, prompts: target.prompts.map(withUsage), trash: target.trash.map((item) => ({ ...item, prompt: withUsage(item.prompt) })) };
}
export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;

export async function flushWrites(): Promise<void> {
  await persistence.flush();
}

export async function setState(updater: (s: Store) => Store, trackHistory = true): Promise<void> {
  try {
    await persistence.update(updater, (previous) => {
      if (!trackHistory) return;
      undoStack.push(cloneStore(previous));
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
      redoStack.length = 0;
    });
    await announceChanged();
  } catch (e) {
    pushToast("error", "保存失败，修改尚未保存，请重试：" + String(e));
    throw e;
  }
}

async function announceChanged(): Promise<void> {
  const otherWindow = getCurrentWindow().label === "quick" ? "main" : "quick";
  try { await emitTo(otherWindow, "promptpad-store-updated"); } catch { /* The other window may not be open. */ }
}

export async function undo(): Promise<void> {
  const target = undoStack[undoStack.length - 1];
  if (!target) return;
  await persistence.update((current) => preserveUsage(target, current), (previous) => {
    undoStack.pop();
    redoStack.push(cloneStore(previous));
  });
  await announceChanged();
}

export async function redo(): Promise<void> {
  const target = redoStack[redoStack.length - 1];
  if (!target) return;
  await persistence.update((current) => preserveUsage(target, current), (previous) => {
    redoStack.pop();
    undoStack.push(cloneStore(previous));
  });
  await announceChanged();
}

// --- mutation helpers ---

export async function addPrompt(
  p: Omit<Prompt, "id" | "createdAt" | "updatedAt">,
): Promise<Prompt> {
  const now = new Date().toISOString();
  const newPrompt: Prompt = {
    ...p,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await setState((s) => ({ ...s, prompts: [newPrompt, ...s.prompts] }));
  return newPrompt;
}

export function updatePrompt(id: string, patch: Partial<Prompt>): Promise<void> {
  return setState((s) => ({
    ...s,
    prompts: s.prompts.map((p) =>
      p.id === id
        ? { ...p, ...patch, lastUsedAt: p.lastUsedAt, useCount: p.useCount, updatedAt: new Date().toISOString() }
        : p,
    ),
  }));
}

export function recordPromptUse(id: string): Promise<void> {
  return setState((s) => ({ ...s, prompts: s.prompts.map((p) => p.id === id
    ? { ...p, useCount: (p.useCount ?? 0) + 1, lastUsedAt: new Date().toISOString() }
    : p) }), false);
}

export function deletePrompt(id: string): Promise<void> {
  return deletePrompts([id]);
}

export function deletePrompts(ids: string[]): Promise<void> {
  const selectedIds = new Set(ids);
  if (selectedIds.size === 0) return Promise.resolve();
  const deletedAt = new Date().toISOString();
  return setState((s) => {
    const removed = s.prompts.filter((prompt) => selectedIds.has(prompt.id));
    if (removed.length === 0) return s;
    return {
      ...s,
      prompts: s.prompts.filter((prompt) => !selectedIds.has(prompt.id)),
      trash: [...s.trash, ...removed.map((prompt) => ({ prompt, deletedAt }))],
    };
  });
}

export function restorePrompt(id: string): Promise<void> {
  return setState((s) => {
    const entry = s.trash.find((item) => item.prompt.id === id);
    if (!entry) return s;
    const prompts = s.prompts.some((prompt) => prompt.id === id) ? s.prompts : [entry.prompt, ...s.prompts];
    return { ...s, trash: s.trash.filter((item) => item.prompt.id !== id), prompts };
  });
}

export function permanentlyDeletePrompt(id: string): Promise<void> {
  return setState((s) => ({ ...s, trash: s.trash.filter((item) => item.prompt.id !== id) }), false).then(() => {
    undoStack.length = 0;
    redoStack.length = 0;
    notify();
  });
}

export function addFolder(name: string, parentId?: string): Promise<PromptFolder> {
  const folder: PromptFolder = { id: crypto.randomUUID(), name: name.trim(), ...(parentId ? { parentId } : {}) };
  return setState((s) => ({ ...s, folders: [...s.folders, folder] })).then(() => folder);
}

export function updateFolder(id: string, patch: Partial<PromptFolder>): Promise<void> {
  return setState((s) => ({ ...s, folders: s.folders.map((folder) => folder.id === id ? { ...folder, ...patch } : folder) }));
}

export function deleteFolder(id: string): Promise<void> {
  return setState((s) => {
    const folder = s.folders.find((item) => item.id === id);
    if (!folder) return s;
    const folders = s.folders.filter((item) => item.id !== id).map((item) => {
      if (item.parentId !== id) return item;
      return folder.parentId ? { ...item, parentId: folder.parentId } : { id: item.id, name: item.name };
    });
    const removeFolderId = (prompt: Prompt) => ({ ...prompt, folderIds: (prompt.folderIds ?? []).filter((folderId) => folderId !== id) });
    return { ...s, folders, prompts: s.prompts.map(removeFolderId), trash: s.trash.map((item) => ({ ...item, prompt: removeFolderId(item.prompt) })) };
  });
}

export function saveSnippet(snippet: PromptSnippet): Promise<void> {
  return setState((s) => ({ ...s, snippets: [...s.snippets.filter((item) => item.id !== snippet.id), snippet] }));
}

export function deleteSnippet(id: string): Promise<void> {
  return setState((s) => ({ ...s, snippets: s.snippets.filter((item) => item.id !== id) }));
}

export function setSettings(patch: Partial<Settings>): Promise<void> {
  return setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function replaceAll(next: Store): Promise<void> {
  return setState(() => next);
}

// --- React binding ---

export function useStore(): Store {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return persistence.get();
}

export async function initStore(): Promise<void> {
  if (initialized) return;
  if (loading) return loading;
  loading = loadStore();
  try { await loading; } finally { loading = null; }
}

export async function refreshStore(): Promise<void> {
  await loadStore();
}

async function loadStore(): Promise<void> {
  try {
    const json = await readStore();
    const parsed = JSON.parse(json) as Partial<Store>;
    if (parsed?.schemaVersion !== 1 || !parsed.settings ||
      typeof parsed.settings !== "object" || Array.isArray(parsed.settings)) {
      throw new Error("不支持的数据文件格式");
    }
    const settings = parsed.settings;
    const projects = normalizeProjectProfiles(parsed.projects);
    const folders = normalizeFolders(parsed.folders);
    const prompts = normalizePrompts(parsed.prompts, true).map((prompt) => ({ ...prompt, folderIds: (prompt.folderIds ?? []).filter((id) => folders.some((folder) => folder.id === id)) }));
    const snippets = normalizeSnippets(parsed.snippets);
    const allTrash = normalizeTrash(parsed.trash);
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const trash = allTrash.filter((item) => Date.parse(item.deletedAt) > cutoff).map((item) => ({ ...item, prompt: { ...item.prompt, folderIds: (item.prompt.folderIds ?? []).filter((id) => folders.some((folder) => folder.id === id)) } }));
    persistence.initialize({
      schemaVersion: 1,
      prompts,
      projects,
      folders,
      snippets,
      trash,
      settings: {
        autoLaunch: settings.autoLaunch === true,
        theme: ["light", "dark", "system"].includes(settings.theme) ? settings.theme : "system",
        activeProjectId: typeof settings.activeProjectId === "string" && projects.some((project) => project.id === settings.activeProjectId) ? settings.activeProjectId : null,
        globalShortcut: typeof settings.globalShortcut === "string" && settings.globalShortcut.trim() ? settings.globalShortcut : "CommandOrControl+Shift+Space",
      },
    });
    initialized = true;
    if (trash.length !== allTrash.length) {
      try { await persistence.update((state) => ({ ...state, trash })); }
      catch (error) { pushToast("info", "清理过期回收站内容失败，将在下次启动时重试：" + String(error)); }
    }
  } catch (e) {
    console.error("init store failed", e);
    pushToast("error", "无法读取模板库；请先检查或备份数据文件");
    throw e;
  }
}

