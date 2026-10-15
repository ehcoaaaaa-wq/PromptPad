import { useEffect, useState } from "react";
import type { Prompt } from "../types";
import {
  BUILTIN_VARS,
  builtinValues,
  substitute,
  reconcileVariables,
  extractVariableNames,
} from "../lib/variables";
import { writeText, readText } from "../lib/commands";
import { pushToast } from "../hooks/useToast";

export function VariableFillDialog({
  prompt,
  onClose,
}: {
  prompt: Prompt;
  onClose: () => void;
}) {
  const contentVars = extractVariableNames(prompt.content);
  const variables = reconcileVariables(prompt.variables, contentVars);

  const [values, setValues] = useState<Record<string, string>>({});
  const [clipboard, setClipboard] = useState("");

  useEffect(() => {
    // Seed declared defaults; clipboard is read once on mount.
    const init: Record<string, string> = {};
    variables.forEach((v) => {
      init[v.name] = v.defaultValue ?? "";
    });
    setValues(init);
    readText().then(setClipboard).catch(() => setClipboard(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt.id]);

  const onCopy = async () => {
    const merged = { ...builtinValues(clipboard), ...values };
    const result = substitute(prompt.content, merged);
    try {
      await writeText(result);
      pushToast("success", "已复制到剪贴板");
      onClose();
    } catch (e) {
      pushToast("error", "复制失败：" + String(e));
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md p-4 flex flex-col gap-3 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-semibold truncate">
          使用模板：{prompt.title || "(未命名)"}
        </div>
        {variables.length === 0 && (
          <div className="text-sm text-zinc-500">
            此模板没有变量，直接复制即可。
          </div>
        )}
        {variables.map((v) => {
          const builtin = BUILTIN_VARS.has(v.name);
          const displayValue =
            builtin && v.name === "clipboard"
              ? clipboard
              : (values[v.name] ?? "");
          return (
            <label key={v.name} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                {`{{${v.name}}}`}
                {builtin && (
                  <span className="ml-2 text-xs text-amber-600">内置</span>
                )}
                {v.description && (
                  <span className="ml-2 text-xs text-zinc-500">
                    {v.description}
                  </span>
                )}
              </span>
              <input
                value={displayValue}
                disabled={builtin}
                onChange={(e) =>
                  setValues({ ...values, [v.name]: e.target.value })
                }
                className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-60"
              />
            </label>
          );
        })}
        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            取消
          </button>
          <button
            onClick={onCopy}
            className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
          >
            复制到剪贴板
          </button>
        </div>
      </div>
    </div>
  );
}
