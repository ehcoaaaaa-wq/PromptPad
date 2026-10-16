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
