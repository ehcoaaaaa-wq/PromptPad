import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeIncoming, normalizePrompts, parseIncoming } from "../src/lib/import.ts";

const prompt = (id, title) => ({
  id, title, content: `请处理 {{code}}：${title}`, tags: ["代码"],
  variables: [{ name: "code", defaultValue: "示例" }], favorite: false,
  pinned: false, createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
});

test("invalid imported prompts are rejected before merging", () => {
  assert.throws(() => parseIncoming("prompts.json", JSON.stringify([
    { ...prompt("a", "正常"), tags: [42] },
  ])), /标签格式不正确/);
  assert.throws(() => parseIncoming("prompts.json", JSON.stringify([
    prompt("same", "一"), prompt("same", "二"),
  ])), /重复的模板 ID/);
});

test("stored prompts must retain stable IDs", () => {
  assert.throws(() => normalizePrompts([{ ...prompt("a", "测试"), id: undefined }], true), /缺少 ID/);
});

test("merge choices preserve, replace, or copy an existing prompt", () => {
  const current = prompt("same", "原模板");
  const imported = prompt("same", "导入模板");
  assert.equal(mergeIncoming([current], [imported], "skip")[0].title, "原模板");
  assert.equal(mergeIncoming([current], [imported], "replace")[0].title, "导入模板");
  const copied = mergeIncoming([current], [imported], "copy");
  assert.equal(copied.length, 2);
  assert.equal(copied[0].title, "原模板");
  assert.notEqual(copied[1].id, "same");
});

test("Markdown import restores variables and tags", () => {
  const markdown = [
    "---", 'id: "md-id"', 'title: "重构代码"', 'tags: ["代码", "重构"]',
    'variables: [{"name":"code","defaultValue":"示例"}]',
    "favorite: true", "pinned: false", "---", "请重构 {{code}}",
  ].join("\n");
  const [result] = parseIncoming("prompt.md", markdown);
  assert.equal(result.title, "重构代码");
  assert.deepEqual(result.tags, ["代码", "重构"]);
  assert.equal(result.variables[0].defaultValue, "示例");
  assert.equal(result.favorite, true);
});
