import Fuse from "fuse.js";
import type { Prompt } from "../types";

export type PromptSelection =
  | { kind: "all" | "favorites" | "pinned" | "recent" | "trash" }
  | { kind: "folder"; folderId: string }
  | { kind: "tag"; tag: string };

export type PromptSort = "default" | "updated-desc" | "updated-asc" | "title-asc" | "title-desc" | "most-used" | "last-used";

export function selectPrompts(prompts: Prompt[], selection: PromptSelection, query: string, sort: PromptSort = "default"): Prompt[] {
  let list = prompts;
  if (selection.kind === "favorites") list = list.filter((p) => p.favorite);
  if (selection.kind === "pinned") list = list.filter((p) => p.pinned);
  if (selection.kind === "recent") list = list.filter((p) => p.lastUsedAt);
  if (selection.kind === "tag") list = list.filter((p) => p.tags.includes(selection.tag));
  if (selection.kind === "folder") list = list.filter((p) => p.folderIds?.includes(selection.folderId));
  const matches = query.trim()
    ? new Fuse(list, {
      keys: [{ name: "title", weight: 3 }, { name: "tags", weight: 2 }, { name: "content", weight: 1 }],
      threshold: 0.4,
      ignoreLocation: true,
    }).search(query.trim()).map((result) => result.item)
    : [...list];

  if (sort === "default") {
    if (query.trim()) return matches;
    return matches.sort((a, b) => {
      if (selection.kind === "recent") return (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "");
      if (selection.kind !== "trash" && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  return matches.sort((a, b) => {
    if (selection.kind !== "trash" && selection.kind !== "recent" && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    switch (sort) {
      case "updated-desc": return b.updatedAt.localeCompare(a.updatedAt);
      case "updated-asc": return a.updatedAt.localeCompare(b.updatedAt);
      case "title-asc": return a.title.localeCompare(b.title, "zh-CN", { numeric: true, sensitivity: "base" });
      case "title-desc": return b.title.localeCompare(a.title, "zh-CN", { numeric: true, sensitivity: "base" });
      case "most-used": return (b.useCount ?? 0) - (a.useCount ?? 0) || b.updatedAt.localeCompare(a.updatedAt);
      case "last-used": return (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "");
      default: return 0;
    }
  });
}
