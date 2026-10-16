import Fuse from "fuse.js";
import type { Prompt } from "../types";

export type PromptSelection =
  | { kind: "all" | "favorites" | "pinned" | "recent" }
  | { kind: "tag"; tag: string };

export function selectPrompts(prompts: Prompt[], selection: PromptSelection, query: string): Prompt[] {
  let list = prompts;
  if (selection.kind === "favorites") list = list.filter((p) => p.favorite);
  if (selection.kind === "pinned") list = list.filter((p) => p.pinned);
  if (selection.kind === "recent") list = list.filter((p) => p.lastUsedAt);
  if (selection.kind === "tag") list = list.filter((p) => p.tags.includes(selection.tag));
  if (query.trim()) {
    return new Fuse(list, {
      keys: [{ name: "title", weight: 3 }, { name: "tags", weight: 2 }, { name: "content", weight: 1 }],
      threshold: 0.4,
      ignoreLocation: true,
    }).search(query.trim()).map((result) => result.item);
  }
  return [...list].sort((a, b) => {
    if (selection.kind === "recent") return (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "");
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
