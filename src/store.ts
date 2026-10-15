// Global store with React subscription.
// Tiny pub/sub keeps the surface small; no Redux/Zustand for an MVP.
//
// Persistence model: any mutation triggers an async writeStore() via
// the Rust command. We don't await the write in the mutation path — the UI
// is already updated; errors are logged. This keeps typing snappy.

import { useEffect, useState } from "react";
import type { Store, Prompt, Settings } from "./types";
import { DEFAULT_STORE } from "./types";
import { readStore, writeStore } from "./lib/commands";
import { pushToast } from "./hooks/useToast";
import { normalizePrompts } from "./lib/import";

let state: Store = DEFAULT_STORE;
const listeners = new Set<() => void>();
let initialized = false;
let writeQueue: Promise<void> = Promise.resolve();
let lastWriteError: unknown = null;

export function getState(): Store {
  return state;
}

function notify(): void {
  listeners.forEach((l) => l());
}

function persist(): Promise<void> {
  const snapshot = JSON.stringify(state, null, 2);
  const write = writeQueue.then(() => writeStore(snapshot));
  writeQueue = write.then(
    () => { lastWriteError = null; },
    (e) => {
      lastWriteError = e;
      console.error("writeStore failed", e);
      pushToast("error", "保存失败，请检查数据目录或磁盘空间");
    },
  );
  return write;
}

export async function flushWrites(): Promise<void> {
  await writeQueue;
  if (lastWriteError) throw lastWriteError;
}

export function setState(updater: (s: Store) => Store): Promise<void> {
  state = updater(state);
  notify();
  return persist();
}

// --- mutation helpers ---

export function addPrompt(
  p: Omit<Prompt, "id" | "createdAt" | "updatedAt">,
): Prompt {
  const now = new Date().toISOString();
  const newPrompt: Prompt = {
    ...p,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  setState((s) => ({ ...s, prompts: [newPrompt, ...s.prompts] }));
  return newPrompt;
}

export function updatePrompt(id: string, patch: Partial<Prompt>): Promise<void> {
  return setState((s) => ({
    ...s,
    prompts: s.prompts.map((p) =>
      p.id === id
        ? { ...p, ...patch, updatedAt: new Date().toISOString() }
        : p,
    ),
  }));
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
  return state;
}

export async function initStore(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    const json = await readStore();
    const parsed = JSON.parse(json) as Partial<Store>;
    if (parsed?.schemaVersion !== 1 || !parsed.settings ||
      typeof parsed.settings !== "object" || Array.isArray(parsed.settings)) {
      throw new Error("不支持的数据文件格式");
    }
    const settings = parsed.settings;
    state = {
      schemaVersion: 1,
      prompts: normalizePrompts(parsed.prompts, true),
      settings: {
        autoLaunch: settings.autoLaunch === true,
        theme: ["light", "dark", "system"].includes(settings.theme) ? settings.theme : "system",
      },
    };
    notify();
  } catch (e) {
    console.error("init store failed", e);
    pushToast("error", "无法读取模板库；请先检查或备份数据文件");
  }
}
