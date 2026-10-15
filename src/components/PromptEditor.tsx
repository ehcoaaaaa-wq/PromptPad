import { useEffect, useState } from "react";
import { Clipboard, Trash2 } from "lucide-react";
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
  onDirtyChange,
}: {
  prompt: Prompt | null;
  onUse: (p: Prompt) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<Prompt | null>(null);

  // Re-seed draft when the user switches to a different prompt.
  useEffect(() => {
    setDraft(prompt);
  }, [prompt?.id]);

  const dirty = Boolean(draft && prompt && draft.id === prompt.id && (
    draft.title !== prompt.title || draft.content !== prompt.content ||
    JSON.stringify(draft.tags) !== JSON.stringify(prompt.tags) ||
    draft.favorite !== prompt.favorite || draft.pinned !== prompt.pinned
  ));
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  if (!draft) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-500 text-sm">
        选择一个模板查看，或点 + 新建
      </div>
    );
  }

  const contentVars = extractVariableNames(draft.content);
  const variables = reconcileVariables(draft.variables, contentVars);

  const sync = (patch: Partial<Prompt>) =>
    setDraft({ ...draft, ...patch });

  const save = async () => {
    if (!draft.title.trim()) {
      pushToast("error", "标题不能为空");
      return;
    }
    try {
      await updatePrompt(draft.id, { ...draft, variables });
      pushToast("success", "已保存");
    } catch {
      // The store reports the write failure and keeps the in-memory draft.
    }
  };

  const remove = async () => {
    if (!confirm(`删除模板"${draft.title || "(未命名)"}"？`)) return;
    try {
      await deletePrompt(draft.id);
      pushToast("info", "已删除");
    } catch {
      // The store reports the write failure.
    }
  };

  const usePrompt = async () => {
    if (!draft.title.trim()) {
      pushToast("error", "标题不能为空");
      return;
    }
    const ready = { ...draft, variables };
    if (dirty) {
      try {
        await updatePrompt(draft.id, ready);
      } catch {
        return;
      }
    }
    onUse(ready);
  };

  const charCount = draft.content.length;
  const updatedRel = relativeTime(draft.updatedAt);

  return (
    <div className="flex-1 flex flex-col p-5 gap-3 overflow-hidden">
      <input
        value={draft.title}
        onChange={(e) => sync({ title: e.target.value })}
        placeholder="模板标题"
        className="text-[20px] font-semibold tracking-tight px-2 py-1.5 -mx-2 rounded-md border-0 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/60 focus:bg-zinc-100 dark:focus:bg-zinc-800/60 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      />
      <div className="flex gap-1.5 items-center flex-wrap min-h-6">
        {variables.length === 0 && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            在正文中使用 {`{{var_name}}`} 添加变量
          </span>
        )}
        {variables.map((v) => (
          <span
            key={v.name}
            className="text-[11.5px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400"
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
        className="flex-1 px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 focus:bg-white dark:focus:bg-zinc-900 font-mono text-[13px] leading-relaxed resize-none focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
      />
      <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
        <span>{charCount} 字</span>
        <span className="text-zinc-300 dark:text-zinc-600">·</span>
        <span>{variables.length} 变量</span>
        <span className="text-zinc-300 dark:text-zinc-600">·</span>
        <span>{updatedRel}</span>
        {dirty && <span className="text-amber-600 dark:text-amber-400">未保存</span>}
      </div>
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
        className="px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
      />
      <div className="flex gap-1.5 items-center text-sm pt-1">
        <Toggle
          checked={draft.favorite}
          onChange={(v) => sync({ favorite: v })}
          label="收藏"
        />
        <Toggle
          checked={draft.pinned}
          onChange={(v) => sync({ pinned: v })}
          label="置顶"
        />
        <div className="flex-1" />
        <button
          onClick={() => void remove()}
          className="px-3 py-1.5 rounded-md text-rose-500 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          删除
        </button>
        <button
          onClick={() => void save()}
          className="px-3 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          保存
        </button>
        <button
          onClick={() => void usePrompt()}
          className="px-3 py-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Clipboard className="w-3.5 h-3.5" />
          使用
        </button>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none px-1.5 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
      <span
        className={
          "relative inline-block w-7 h-4 rounded-full transition-colors " +
          (checked ? "bg-blue-500" : "bg-zinc-300 dark:bg-zinc-700")
        }
      >
        <span
          className={
            "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform " +
            (checked ? "translate-x-3.5" : "translate-x-0.5")
          }
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span>{label}</span>
    </label>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚更新";
  if (m < 60) return `${m} 分钟前更新`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前更新`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前更新`;
  return new Date(iso).toLocaleDateString("zh-CN");
}
