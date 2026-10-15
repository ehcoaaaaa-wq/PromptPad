import assert from "node:assert/strict";
import { test } from "node:test";
import { renderTemplate } from "../src/lib/variables.ts";

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
