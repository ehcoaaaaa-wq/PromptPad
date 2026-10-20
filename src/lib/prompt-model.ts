import type { Prompt, PromptMetadata } from "../types.ts";
export const metadataKeys: (keyof PromptMetadata)[] = ["expertKey", "locale", "domain", "description", "useWhen", "packageId", "contentVersion", "contentHash", "sourcePath", "sourceCommit", "derivedFromId", "baseVersion"];
export function personalCopy(prompt: Prompt): Prompt {
  const now = new Date().toISOString();
  return { ...prompt, id: crypto.randomUUID(), title: `${prompt.title}（个人副本）`,
    origin: "user", packageId: undefined, contentVersion: undefined, contentHash: undefined,
    derivedFromId: prompt.origin === "builtin" ? prompt.id : prompt.derivedFromId,
    baseVersion: prompt.contentVersion ?? prompt.baseVersion,
    favorite: false, pinned: false, createdAt: now, updatedAt: now };
}
export function markdownExport(p: Prompt): string {
  const fields = ["id", "title", "tags", "variables", "favorite", "pinned", "createdAt", "updatedAt", "origin", ...metadataKeys] as const;
  return ["---", "schemaVersion: 2", ...fields.flatMap(key => p[key] === undefined ? [] : [`${key}: ${JSON.stringify(p[key])}`]), "---", p.content].join("\n");
}
