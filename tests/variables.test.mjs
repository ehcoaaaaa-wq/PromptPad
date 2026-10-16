import assert from "node:assert/strict";
import { test } from "node:test";
import { renderTemplate, missingRequiredVariables } from "../src/lib/variables.ts";

test("built-in variables keep their generated values even if custom input contains the same names", () => {
  const now = new Date(2026, 9, 15, 9, 5);
  const result = renderTemplate(
    "{{date}} {{time}} {{clipboard}} {{topic}}",
    { date: "", time: "", clipboard: "", topic: "重构" },
    "剪贴板内容",
    now,
  );
  assert.equal(result, "2026-10-15 09:05 剪贴板内容 重构");
});

test("required checks ignore unused metadata and allow explicit optional values", () => {
  assert.deepEqual(missingRequiredVariables("{{code}} {{note}} {{date}}", [
    { name: "note", required: false }, { name: "unused", required: true },
  ], { code: "  " }), ["code"]);
  assert.deepEqual(missingRequiredVariables("{{code}}", [], { code: "line1\nline2" }), []);
});

test("fixed preview time and multiline values produce identical copy text", () => {
  const now = new Date(2026, 9, 16, 10, 5);
  const content = "{{datetime}}\n{{code}}\n{{note}}";
  const values = { code: "first\nsecond", note: "" };
  const preview = renderTemplate(content, values, "", now);
  assert.equal(preview, "2026-10-16 10:05\nfirst\nsecond\n");
  assert.equal(renderTemplate(content, values, "", now), preview);
});
