// Global store with React subscription.
// Tiny pub/sub keeps the surface small; no Redux/Zustand for an MVP.
//
// Mutations are queued and published after successful disk writes.
// Editor drafts remain separate so a failed save stays visibly unsaved.

import { useEffect, useState } from "react";
import type { Store, Prompt, Settings } from "./types";
import { DEFAULT_STORE } from "./types";
import { readStore, writeStore } from "./lib/commands";
import { pushToast } from "./hooks/useToast";
import { normalizePrompts, normalizeProjectProfiles } from "./lib/import";
import { createPersistence } from "./lib/persistence";

const listeners = new Set<() => void>();
let initialized = false;
let loading: Promise<void> | null = null;
const persistence = createPersistence<Store>(DEFAULT_STORE, (value) => writeStore(JSON.stringify(value, null, 2)), notify);

export function getState(): Store {
  return persistence.get();
}

function notify(): void {
  listeners.forEach((l) => l());
}

export async function flushWrites(): Promise<void> {
  await persistence.flush();
}

export async function setState(updater: (s: Store) => Store): Promise<void> {
  try {
    await persistence.update(updater);
  } catch (e) {
    pushToast("error", "保存失败，修改尚未保存，请重试：" + String(e));
    throw e;
  }
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
    : p) }));
}

export function deletePrompt(id: string): Promise<void> {
  return setState((s) => ({ ...s, prompts: s.prompts.filter((p) => p.id !== id) }));
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
    persistence.initialize({
      schemaVersion: 1,
      prompts: normalizePrompts(parsed.prompts, true),
      projects,
      settings: {
        autoLaunch: settings.autoLaunch === true,
        theme: ["light", "dark", "system"].includes(settings.theme) ? settings.theme : "system",
        activeProjectId: typeof settings.activeProjectId === "string" && projects.some((project) => project.id === settings.activeProjectId) ? settings.activeProjectId : null,
        globalShortcut: typeof settings.globalShortcut === "string" && settings.globalShortcut.trim() ? settings.globalShortcut : "CommandOrControl+Shift+Space",
      },
    });
    initialized = true;
  } catch (e) {
    console.error("init store failed", e);
    pushToast("error", "无法读取模板库；请先检查或备份数据文件");
    throw e;
  }
}

