import { useEffect, useRef, useState } from "react";
import type { Prompt } from "../types";
import {
  BUILTIN_VARS,
  builtinValues,
  renderTemplate,
  reconcileVariables,
  extractVariableNames,
  missingRequiredVariables,
} from "../lib/variables";
import { openUrl, writeText, readText } from "../lib/commands";
import { pushToast } from "../hooks/useToast";
import { ArrowUpRight, Copy, X } from "lucide-react";
import { recordPromptUse, setSettings, useStore } from "../store";

export function VariableFillDialog({
  prompt,
  onClose,
}: {
  prompt: Prompt;
  onClose: () => void;
}) {
  const store = useStore();
  const [projectId, setProjectId] = useState(store.settings.activeProjectId ?? "");
  const project = store.projects.find((item) => item.id === projectId);
  const contentVars = extractVariableNames(prompt.content);
  const variables = reconcileVariables(prompt.variables, contentVars)
    .filter((v) => contentVars.includes(v.name) && v.name !== "project_context");

  const [values, setValues] = useState<Record<string, string>>({});
  const [clipboard, setClipboard] = useState("");
  const [previewTime] = useState(() => new Date());
  const [copying, setCopying] = useState(false);
  const copyingRef = useRef(false);
  const [clipboardLoading, setClipboardLoading] = useState(contentVars.includes("clipboard"));
  const [clipboardError, setClipboardError] = useState(false);
  const close = () => { if (!copyingRef.current) onClose(); };

  useEffect(() => {
    // Seed declared defaults; clipboard is read once on mount.
    const init: Record<string, string> = {};
    variables.forEach((v) => {
      if (!BUILTIN_VARS.has(v.name)) init[v.name] = v.defaultValue ?? "";
    });
    setValues(init);
    let active = true;
    if (contentVars.includes("clipboard")) {
      readText().then((text) => { if (active) setClipboard(text); })
        .catch(() => { if (active) setClipboardError(true); })
        .finally(() => { if (active) setClipboardLoading(false); });
    }
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt.id]);

  const missing = missingRequiredVariables(prompt.content, variables, values);
  const contextValue = project?.background ?? "";
  const rendered = renderTemplate(prompt.content, values, clipboard, previewTime, contextValue);
  const contextPrefix = project && contextValue.trim() && !prompt.includesProjectContext && !contentVars.includes("project_context")
    ? "项目背景（" + project.name + "）：\n" + contextValue.trim() + "\n\n"
    : "";
  const result = contextPrefix + rendered;
  const onCopy = async (openCodex = false) => {
    if (copyingRef.current || clipboardLoading || missing.length) return;
    copyingRef.current = true;
    setCopying(true);
    try {
      await writeText(result);
      let usageRecordFailed = false;
      try {
        await recordPromptUse(prompt.id);
      } catch {
        usageRecordFailed = true;
      }
      if (openCodex) {
        const encodedPrompt = encodeURIComponent(result);
        if (encodedPrompt.length > 12000) {
          pushToast("info", "提示词已复制；内容较长，未通过深链接传入 Codex，请切换到 Codex 后粘贴");
          onClose();
          return;
        }
        try {
          await openUrl(`codex://new?prompt=${encodedPrompt}`);
          pushToast(usageRecordFailed ? "info" : "success", usageRecordFailed
            ? "已在 Codex 中填入提示词，但使用记录未保存；请检查数据目录"
            : "已在 Codex 新对话中填入提示词，请检查后发送");
        } catch {
          pushToast("info", usageRecordFailed
            ? "提示词已复制，但无法打开 Codex，使用记录也未保存；请检查数据目录后手动粘贴"
            : "提示词已复制，但无法打开 Codex；请切换到 Codex 后粘贴");
        }
      } else {
        pushToast(usageRecordFailed ? "info" : "success", usageRecordFailed
          ? "内容已复制，但使用记录未保存；请检查数据目录"
          : "已复制到剪贴板");
      }
      onClose();
    } catch (e) {
      pushToast("error", "复制失败：" + String(e));
    } finally {
      copyingRef.current = false;
      setCopying(false);
    }
  };

  const builtins = builtinValues(clipboard, previewTime, contextValue);

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={close}
    >
      <div
        role="dialog" aria-modal="true" aria-label="填写变量与复制预览"
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl p-5 flex flex-col gap-3 max-h-[80vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <div className="text-base font-semibold truncate flex-1 tracking-tight">
            {prompt.title || "(未命名)"}
          </div>
          <button
            onClick={close} disabled={copying} aria-label="关闭"
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
        {store.projects.length > 0 && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">项目背景</span>
            <select
              value={projectId}
              disabled={copying}
              onChange={(event) => {
                const nextId = event.target.value;
                setProjectId(nextId);
                void setSettings({ activeProjectId: nextId || null }).catch(() => {
                  setProjectId(store.settings.activeProjectId ?? "");
                });
              }}
              className="px-2.5 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
            >
              <option value="">不使用项目背景</option>
              {store.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {project && <span className="text-xs text-zinc-500">{prompt.includesProjectContext || contentVars.includes("project_context") ? "模板正文负责放置项目背景" : "项目背景会添加在模板内容前"}。复制前可在预览中检查。</span>}
          </label>
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
                {!builtin && <span className="text-xs text-zinc-500">{v.required === false ? "可选" : "必填"}</span>}
              </span>
              <textarea
                value={displayValue}
                rows={builtin && v.name !== "clipboard" ? 1 : 3}
                disabled={(builtin && v.name !== "clipboard") || copying}
                required={!builtin && v.required !== false}
                onChange={(e) =>
                  v.name === "clipboard" ? setClipboard(e.target.value) : setValues({ ...values, [v.name]: e.target.value })
                }
                className="px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 focus:bg-white dark:focus:bg-zinc-900 disabled:opacity-60 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
          );
        })}
        {clipboardLoading && <p className="text-xs text-zinc-500">正在读取剪贴板…</p>}
        {clipboardError && <p role="alert" className="text-xs text-amber-600">剪贴板读取失败，请在上方手动填写内容。</p>}
        {missing.length > 0 && <p className="text-xs text-amber-600">请填写必填变量：{missing.join("、")}</p>}
        <section className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
          <h3 className="text-sm font-medium mb-2">复制预览</h3>
          <pre className="whitespace-pre-wrap break-words text-xs bg-zinc-50 dark:bg-zinc-950 p-3 rounded-md max-h-60 overflow-auto">{result || "（内容为空）"}</pre>
          <p className="text-xs text-zinc-500 mt-1">复制内容与此预览一致；日期时间以打开本窗口时为准。</p>
        </section>
        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={close} disabled={copying}
            className="px-3 py-1.5 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => void onCopy()}
            disabled={copying || clipboardLoading || missing.length > 0}
            className="px-3 py-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Copy className="w-3.5 h-3.5" />
            {copying ? "正在复制…" : "复制到剪贴板"}
          </button>
          <button
            onClick={() => void onCopy(true)}
            disabled={copying || clipboardLoading || missing.length > 0}
            title="打开 Codex 新对话并预填提示词；不会自动发送"
            className="px-3 py-1.5 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5 shadow-sm"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            {copying ? "正在处理…" : "复制并打开 Codex"}
          </button>
        </div>
      </div>
    </div>
  );
}
