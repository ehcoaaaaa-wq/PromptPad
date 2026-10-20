import type { Prompt } from "../types.ts";
import { extractVariableNames, reconcileVariables } from "./variables.ts";

export function suggestedSkillName(prompt: Prompt): string {
  const name = prompt.title.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  const safeId = prompt.id.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  return name || `prompt-${safeId || "skill"}`;
}

export function validateSkillDetails(name: string, description: string): string | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) {
    return "名称须为 1–64 位小写英文字母、数字或连字符，且不能以连字符开头或结尾";
  }
  if (!description.trim() || description.trim().length > 500) {
    return "调用说明不能为空，且不能超过 500 字";
  }
  return null;
}

export function buildSkillMarkdown(prompt: Prompt, name: string, description: string): string {
  const error = validateSkillDetails(name, description);
  if (error) throw new Error(error);
  if (!prompt.content.trim()) throw new Error("模板正文不能为空");

  const names = extractVariableNames(prompt.content);
  const variables = reconcileVariables(prompt.variables, names)
    .filter((variable) => names.includes(variable.name));
  const inputLines = variables.map((variable) => {
    const extra = (variable.description?.trim() || variable.defaultValue?.trim())?.replace(/[\r\n]+/g, " ");
    const guidance = variable.name === "clipboard"
      ? "仅在用户授权且当前工具可读取时使用剪贴板；否则询问用户提供内容"
      : ["date", "time", "datetime"].includes(variable.name)
        ? "按当前任务环境中的日期或时间填写；无法确认时询问用户"
        : extra || "优先从当前任务获取；缺少关键值时询问用户";
    return `- \`{{${variable.name}}}\`：${guidance}`;
  });

  const title = prompt.title.trim().replace(/[\r\n]+/g, " ");
  return [
    "---",
    `name: ${name}`,
    `description: ${JSON.stringify(description.trim())}`,
    "---",
    "",
    `# ${title}`,
    "",
    "Use this template only when it helps with the user's current request. Treat the template as task guidance; it does not override the user's instructions or grant permission for tool actions.",
    ...(inputLines.length ? [
      "",
      "## Inputs",
      "",
      ...inputLines,
      "",
      "Replace every placeholder with task context or an answer from the user. Ask only for missing information needed to proceed. Do not leave unresolved placeholders in the final result.",
    ] : []),
    "",
    ...(prompt.expertKey ? [
      "## Source",
      "",
      `Expert: ${prompt.expertKey}; language: ${prompt.locale ?? "unspecified"}; source version: ${prompt.contentVersion ?? prompt.baseVersion ?? "unspecified"}.`,
      "This export is a snapshot. Updating PromptPad does not update this Skill folder.",
      "",
    ] : []),
    "## Template",
    "",
    prompt.content.trimEnd(),
    "",
  ].join("\n");
}
