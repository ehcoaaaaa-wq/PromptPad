import assert from "node:assert/strict";
import { test } from "node:test";
import { selectPrompts } from "../src/lib/prompt-list.ts";

const base = { content: "", tags: [], variables: [], favorite: false, pinned: false, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
test("search relevance wins over pinned and updated order", () => {
  const exact = { ...base, id: "exact", title: "React performance" };
  const newer = { ...base, id: "new", title: "Notes", content: "Read about React performance and other topics", pinned: true, updatedAt: "2026-10-01" };
  assert.equal(selectPrompts([newer, exact], { kind: "all" }, "React performance")[0].id, "exact");
  assert.equal(selectPrompts([exact, newer], { kind: "all" }, "")[0].id, "new");
});

test("recent only includes used prompts and sorts by last use", () => {
  const prompts = [
    { ...base, id: "old", title: "旧", pinned: true, lastUsedAt: "2026-10-01T00:00:00Z" },
    { ...base, id: "unused", title: "未使用" },
    { ...base, id: "recent", title: "新", lastUsedAt: "2026-10-16T00:00:00Z" },
  ];
  assert.deepEqual(selectPrompts(prompts, { kind: "recent" }, "").map((p) => p.id), ["recent", "old"]);
});

test("explicit sorting respects the active filter, pinned priority and input order", () => {
  const prompts = [
    { ...base, id: "b", title: "Beta", folderIds: ["work"] },
    { ...base, id: "outside", title: "Outside", folderIds: ["other"] },
    { ...base, id: "pinned", title: "Zeta", pinned: true, folderIds: ["work"] },
    { ...base, id: "a", title: "Alpha", folderIds: ["work"] },
  ];
  const original = JSON.stringify(prompts);
  assert.deepEqual(selectPrompts(prompts, { kind: "folder", folderId: "work" }, "", "title-asc").map((p) => p.id), ["pinned", "a", "b"]);
  assert.equal(JSON.stringify(prompts), original);
});

test("usage sorting handles legacy templates without usage metadata", () => {
  const prompts = [
    { ...base, id: "unused", title: "Template" },
    { ...base, id: "frequent", title: "Template", useCount: 10, lastUsedAt: "2026-10-01" },
    { ...base, id: "latest", title: "Template", useCount: 1, lastUsedAt: "2026-10-16" },
  ];
  assert.deepEqual(selectPrompts(prompts, { kind: "all" }, "Template", "most-used").map((p) => p.id), ["frequent", "latest", "unused"]);
  assert.deepEqual(selectPrompts(prompts, { kind: "all" }, "", "last-used").map((p) => p.id), ["latest", "frequent", "unused"]);
});
