import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePrompts, parseIncoming } from "../src/lib/import.ts";

test("legacy templates load with zero uses; new metadata survives JSON and Markdown", () => {
  const old = { id: "a", title: "模板", content: "{{code}}", variables: [{ name: "code", required: false }] };
  assert.equal(normalizePrompts([old])[0].useCount, 0);
  const current = { ...old, useCount: 3, lastUsedAt: "2026-10-16T00:00:00.000Z" };
  const json = parseIncoming("prompts.json", JSON.stringify({ schemaVersion: 1, prompts: [current] }))[0];
  assert.equal(json.useCount, 3);
  assert.equal(json.lastUsedAt, current.lastUsedAt);
  const markdown = `---\nid: "a"\ntitle: "模板"\nvariables: ${JSON.stringify(old.variables)}\nuseCount: 3\nlastUsedAt: "${current.lastUsedAt}"\n---\n{{code}}`;
  const result = parseIncoming("prompt.md", markdown)[0];
  assert.equal(result.variables[0].required, false);
  assert.equal(result.useCount, 3);
  assert.equal(result.lastUsedAt, current.lastUsedAt);
});

test("invalid usage and required metadata is rejected", () => {
  const prompt = { title: "模板", content: "内容" };
  for (const metadata of [{ useCount: -1 }, { useCount: 0.5 }, { lastUsedAt: "invalid" }, { variables: [{ name: "x", required: "yes" }] }]) {
    assert.throws(() => normalizePrompts([{ ...prompt, ...metadata }]));
  }
});
