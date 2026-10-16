import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSkillMarkdown, suggestedSkillName, validateSkillDetails } from "../src/lib/skill-export.ts";

const prompt = {
  id: "b149e054-e621-4b8d-8a85-115279d86f8e",
  title: "React 性能分析",
  content: "检查 {{project}} 在 {{date}} 的慢操作，参考 {{clipboard}}。",
  tags: ["React"],
  variables: [{ name: "project", description: "项目路径" }],
  favorite: false,
  pinned: false,
  createdAt: "2026-10-16T00:00:00Z",
  updatedAt: "2026-10-16T00:00:00Z",
};

test("export creates a Codex skill with guidance for custom and built-in variables", () => {
  const result = buildSkillMarkdown(prompt, "react-performance", "分析 React 项目的性能问题");
  assert.match(result, /^---\nname: react-performance\ndescription: "分析 React 项目的性能问题"\n---/);
  assert.match(result, /\{\{project\}\}.*项目路径/);
  assert.match(result, /\{\{clipboard\}\}.*用户授权/);
  assert.match(result, /\{\{date\}\}.*当前任务环境/);
  assert.match(result, /## Template\n\n检查/);
});

test("Chinese-only titles get a stable safe suggested folder name", () => {
  assert.equal(suggestedSkillName({ ...prompt, title: "性能分析" }), "prompt-b149e054");
  assert.equal(validateSkillDetails("../bad", "描述"), "名称须为 1–64 位小写英文字母、数字或连字符，且不能以连字符开头或结尾");
  assert.throws(() => buildSkillMarkdown({ ...prompt, content: "  " }, "valid-name", "描述"), /正文不能为空/);
});
