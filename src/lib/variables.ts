// Variable extraction + substitution for {{var_name}} placeholders.
//
// Built-in variables: date / time / datetime / clipboard
// Custom variables: anything else matched by VAR_REGEX; provided by user via the
// fill-in dialog at "use" time.

import type { Variable } from "../types";

const VAR_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export const BUILTIN_VARS = new Set(["date", "time", "datetime", "clipboard"]);

export function extractVariableNames(content: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  // Reset lastIndex defensively in case the regex object is shared.
  VAR_REGEX.lastIndex = 0;
  while ((m = VAR_REGEX.exec(content)) !== null) {
    found.add(m[1]);
  }
  return Array.from(found);
}

export function substitute(
  content: string,
  values: Record<string, string>,
): string {
  VAR_REGEX.lastIndex = 0;
  return content.replace(VAR_REGEX, (_, name) => {
    return values[name] ?? `{{${name}}}`;
  });
}

// Build the runtime map of built-in values; custom vars are filled in by the user.
export function builtinValues(
  clipboard: string,
  now = new Date(),
): Record<string, string> {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    datetime: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate(),
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
    clipboard,
  };
}

// Merge declared variable metadata (description / defaultValue) with
// any custom variables detected in content. Declared values win on conflict.
export function reconcileVariables(
  declared: Variable[],
  contentVars: string[],
): Variable[] {
  const byName = new Map(declared.map((v) => [v.name, v]));
  for (const name of contentVars) {
    if (!byName.has(name)) byName.set(name, { name });
  }
  return Array.from(byName.values());
}
