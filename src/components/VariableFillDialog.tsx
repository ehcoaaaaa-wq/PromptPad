import { useEffect, useState } from "react";
import type { Prompt } from "../types";
import {
  BUILTIN_VARS,
  builtinValues,
  renderTemplate,
  reconcileVariables,
  extractVariableNames,
} from "../lib/variables";
import { writeText, readText } from "../lib/commands";
import { pushToast } from "../hooks/useToast";
import { Copy, X } from "lucide-react";

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
      if (!BUILTIN_VARS.has(v.name)) init[v.name] = v.defaultValue ?? "";
    });
    setValues(init);
    if (contentVars.includes("clipboard")) {
      readText().then(setClipboard).catch(() => setClipboard(""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt.id]);

  const onCopy = async () => {
    const missing = variables.filter(v => v.required && !BUILTIN_VARS.has(v.name) && !(values[v.name] ?? "").trim());
    if (missing.length) { pushToast("error", "请填写必填变量：" + missing.map(v => v.name).join("、")); return; }
    const result = renderTemplate(prompt.content, values, clipboard);
    try {
      await writeText(result);
      pushToast("success", "已复制到剪贴板");
      onClose();
    } catch (e) {
      pushToast("error", "复制失败：" + String(e));
    }
  };

  const builtins = builtinValues(clipboard);

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md p-5 flex flex-col gap-3 max-h-[80vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <div className="text-base font-semibold truncate flex-1 tracking-tight">
            {prompt.title || "(未命名)"}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center text-zinc-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {variables.length === 0 && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            此模板没有变量，直接复制即可。
          </div>
        )}
        {variables.map((v) => {
          const builtin = BUILTIN_VARS.has(v.name);
          const displayValue = builtin ? builtins[v.name] : (values[v.name] ?? "");
          return (
            <label key={v.name} className="flex flex-col gap-1 text-sm">
              <span className="font-medium flex items-center gap-2">
                <span className="font-mono text-blue-600 dark:text-blue-400">
                  {`{{${v.name}}}`}
                </span>
                {builtin && (
                  <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    内置
                  </span>
                )}
                {v.description && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
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
                className="px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 focus:bg-white dark:focus:bg-zinc-900 disabled:opacity-60 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
          );
        })}
        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onCopy}
            className="px-3 py-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Copy className="w-3.5 h-3.5" />
            复制到剪贴板
          </button>
        </div>
      </div>
    </div>
  );
}
