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

let state: Store = DEFAULT_STORE;
const listeners = new Set<() => void>();
let initialized = false;

export function getState(): Store {
  return state;
}

function emit(): void {
  listeners.forEach((l) => l());
  void writeStore(JSON.stringify(state, null, 2)).catch((e) => {
    // eslint-disable-next-line no-console
    console.error("writeStore failed", e);
  });
}

export function setState(updater: (s: Store) => Store): void {
  state = updater(state);
  emit();
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

export function updatePrompt(id: string, patch: Partial<Prompt>): void {
  setState((s) => ({
    ...s,
    prompts: s.prompts.map((p) =>
      p.id === id
        ? { ...p, ...patch, updatedAt: new Date().toISOString() }
        : p,
    ),
  }));
}

export function deletePrompt(id: string): void {
  setState((s) => ({ ...s, prompts: s.prompts.filter((p) => p.id !== id) }));
}

export function setSettings(patch: Partial<Settings>): void {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function replaceAll(next: Store): void {
  setState(() => next);
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
    const parsed = JSON.parse(json) as Store;
    if (parsed?.schemaVersion === 1) {
      state = parsed;
      emit();
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("init store failed; using defaults", e);
  }
}
