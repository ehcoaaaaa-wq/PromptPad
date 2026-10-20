// Exchange schema v2; mirrored by src-tauri/storage/src/models.rs.
// Optional metadata keeps legacy JSON/Markdown imports compatible.

export type Variable = {
  name: string;
  description?: string;
  defaultValue?: string;
  required?: boolean;
};

export type PromptMetadata = {
  expertKey?: string;
  locale?: string;
  domain?: string;
  description?: string;
  useWhen?: string;
  packageId?: string;
  contentVersion?: string;
  contentHash?: string;
  sourcePath?: string;
  sourceCommit?: string;
  derivedFromId?: string;
  baseVersion?: string;
};

export type Prompt = PromptMetadata & {
  origin?: "builtin" | "user";
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
  schemaVersion: 2;
  prompts: Prompt[];
  settings: Settings;
};

export const DEFAULT_STORE: Store = {
  schemaVersion: 2,
  prompts: [],
  settings: { autoLaunch: false, theme: "system" },
};
