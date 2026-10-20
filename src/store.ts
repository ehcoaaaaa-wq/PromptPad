// SQLite is authoritative. Publish mutations only after the transaction commits.
import { useEffect, useState } from "react";
import type { Store, Prompt, Settings } from "./types";
import { DEFAULT_STORE } from "./types";
import { readStore, savePrompt, removePrompt, saveSettings, saveFlags, importPrompts } from "./lib/commands";
import { pushToast } from "./hooks/useToast";
import type { ConflictAction } from "./lib/import";
import { personalCopy } from "./lib/prompt-model";

let state: Store = DEFAULT_STORE;
const listeners = new Set<() => void>();
let initialized = false;
let initialization: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();
export const getState = (): Store => state;
function notify() { listeners.forEach(listener => listener()); }
function mutate(action: () => Promise<Store>): Promise<void> {
  const write = writeQueue.then(async () => {
    if (!initialized) throw new Error("模板库未成功加载，已禁止写入");
    state = await action();
    notify();
  });
  writeQueue = write.catch(error => { pushToast("error", "保存失败：" + String(error)); });
  return write;
}
export async function flushWrites(): Promise<void> { await writeQueue; }
export async function addPrompt(p: Omit<Prompt, "id" | "createdAt" | "updatedAt">): Promise<Prompt> {
  const now = new Date().toISOString();
  const prompt: Prompt = { ...p, id: crypto.randomUUID(), origin: "user", createdAt: now, updatedAt: now };
  await mutate(() => savePrompt(prompt));
  return prompt;
}
export async function copyPrompt(p: Prompt): Promise<Prompt> {
  const copy = personalCopy(p);
  await mutate(() => savePrompt(copy));
  return copy;
}
export function updatePrompt(id: string, patch: Partial<Prompt>): Promise<void> {
  return mutate(() => {
    const current = state.prompts.find(p => p.id === id);
    if (!current) throw new Error("模板不存在");
    const prompt = { ...current, ...patch, id };
    if (current.origin === "builtin") {
      const stripFlags = (p: Prompt) => ({ ...p, favorite: false, pinned: false });
      if (JSON.stringify(stripFlags(prompt)) !== JSON.stringify(stripFlags(current))) throw new Error("请先创建个人副本");
      return saveFlags(id, prompt.favorite, prompt.pinned);
    }
    return savePrompt({ ...prompt, updatedAt: new Date().toISOString() });
  });
}
export const deletePrompt = (id: string) => mutate(() => removePrompt(id));
export const setSettings = (patch: Partial<Settings>) => mutate(() => saveSettings({ ...state.settings, ...patch }));
export const applyImport = (prompts: Prompt[], action: ConflictAction) => mutate(() => importPrompts(prompts, action));
export function useStore(): Store {
  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force(x => x + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return state;
}
export function initStore(): Promise<void> {
  if (initialized) return Promise.resolve();
  if (initialization) return initialization;
  initialization = readStore().then(next => {
    state = next;
    initialized = true;
    notify();
  }).finally(() => { initialization = null; });
  return initialization;
}
