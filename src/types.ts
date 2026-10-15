// Data model — mirrors the Rust `Store` JSON shape.
// Keep in sync with src-tauri/src/lib.rs default_store_json().

export type Variable = {
  name: string;
  description?: string;
  defaultValue?: string;
};

export type Prompt = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  variables: Variable[];
  favorite: boolean;
  pinned: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
};

export type Settings = {
  autoLaunch: boolean;
  theme: "light" | "dark" | "system";
};

export type Store = {
  schemaVersion: 1;
  prompts: Prompt[];
  settings: Settings;
};

export const DEFAULT_STORE: Store = {
  schemaVersion: 1,
  prompts: [],
  settings: { autoLaunch: false, theme: "system" },
};
