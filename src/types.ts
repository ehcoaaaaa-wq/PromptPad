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
  folderIds?: string[];
  blocks?: PromptBlock[];
};

export type PromptBlock =
  | { id: string; type: "text"; content: string }
  | { id: string; type: "variable"; name: string }
  | { id: string; type: "file"; kind: "file" | "image"; path: string }
  | { id: string; type: "snippet"; snippetId: string };

export type PromptFolder = { id: string; name: string; parentId?: string };
export type PromptSnippet = { id: string; name: string; content: string };
export type TrashedPrompt = { prompt: Prompt; deletedAt: string };

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
  folders: PromptFolder[];
  snippets: PromptSnippet[];
  trash: TrashedPrompt[];
  settings: Settings;
};

export const DEFAULT_STORE: Store = {
  schemaVersion: 1,
  prompts: [],
  projects: [],
  folders: [],
  snippets: [],
  trash: [],
  settings: { autoLaunch: false, theme: "system", activeProjectId: null, globalShortcut: "CommandOrControl+Shift+Space" },
};
