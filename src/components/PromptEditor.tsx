import { useEffect, useState } from "react";
import type { Prompt } from "../types";
import { updatePrompt, deletePrompt } from "../store";
import {
  extractVariableNames,
  reconcileVariables,
} from "../lib/variables";
import { pushToast } from "../hooks/useToast";

export function PromptEditor({
  prompt,
  onUse,
}: {
  prompt: Prompt | null;
  onUse: (p: Prompt) => void;
}) {
  const [draft, setDraft] = useState<Prompt | null>(null);

  // Re-seed draft when the user switches to a different prompt.
  useEffect(() => {
    setDraft(prompt);
  }, [prompt?.id]);

  if (!draft) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
        选择一个模板查看，或点 + 新建
      </div>
    );
  }

  const contentVars = extractVariableNames(draft.content);
  const variables = reconcileVariables(draft.variables, contentVars);

  const sync = (patch: Partial<Prompt>) =>
    setDraft({ ...draft, ...patch });

  const save = () => {
    if (!draft.title.trim()) {
      pushToast("error", "标题不能为空");
      return;
    }
    updatePrompt(draft.id, { ...draft, variables });
    pushToast("success", "已保存");
  };

  const remove = () => {
    if (!confirm(`删除模板"${draft.title || "(未命名)"}"？`)) return;
    deletePrompt(draft.id);
    pushToast("info", "已删除");
  };

  return (
    <div className="flex-1 flex flex-col p-3 gap-2 overflow-hidden">
      <input
        value={draft.title}
        onChange={(e) => sync({ title: e.target.value })}
        placeholder="模板标题"
        className="text-lg font-semibold px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
      />
      <div className="flex gap-1 items-center flex-wrap min-h-6">
        {variables.length === 0 && (
          <span className="text-xs text-zinc-400">
            在正文中使用 {`{{var_name}}`} 添加变量
          </span>
        )}
        {variables.map((v) => (
          <span
            key={v.name}
            className="text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200"
            title={v.description || v.name}
          >
            {`{{${v.name}}}`}
          </span>
        ))}
      </div>
      <textarea
        value={draft.content}
        onChange={(e) => sync({ content: e.target.value })}
        placeholder={"模板正文，使用 {{var}} 占位符\n例如：请把以下代码重构：\n{{code}}"}
        className="flex-1 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-sm resize-none"
      />
      <input
        value={draft.tags.join(", ")}
        onChange={(e) =>
          sync({
            tags: e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
        placeholder="标签（逗号分隔）"
        className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
      />
      <div className="flex gap-2 items-center text-sm">
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.favorite}
            onChange={(e) => sync({ favorite: e.target.checked })}
          />
          收藏
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.pinned}
            onChange={(e) => sync({ pinned: e.target.checked })}
          />
          置顶
        </label>
        <div className="flex-1" />
        <button
          onClick={remove}
          className="px-3 py-1 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30"
        >
          删除
        </button>
        <button
          onClick={save}
          className="px-3 py-1 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700"
        >
          保存
        </button>
        <button
          onClick={() => onUse(draft)}
          className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
        >
          📋 使用
        </button>
      </div>
    </div>
  );
}
