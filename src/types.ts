// Data model — mirrors the Rust `Store` JSON shape.
// Keep in sync with src-tauri/src/lib.rs default_store_json().

export type Variable = {
  name: string;
  description?: string;
  defaultValue?: string;
  required?: boolean; // Custom variables are required unless explicitly disabled.
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
  lastUsedAt?: string;
  useCount?: number;
  includesProjectContext?: boolean;
};

export type ProjectProfile = {
  id: string;
  name: string;
  background: string;
};

export type Settings = {
  autoLaunch: boolean;
  theme: "light" | "dark" | "system";
  activeProjectId?: string | null;
  globalShortcut?: string;
};

export type Store = {
  schemaVersion: 1;
  prompts: Prompt[];
  projects: ProjectProfile[];
  settings: Settings;
};

export const DEFAULT_STORE: Store = {
  schemaVersion: 1,
  prompts: [],
  projects: [],
  settings: { autoLaunch: false, theme: "system", activeProjectId: null, globalShortcut: "CommandOrControl+Shift+Space" },
};
