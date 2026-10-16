import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { setState, useStore } from "../store";
import { pushToast } from "../hooks/useToast";
import type { PromptSnippet } from "../types";

export function SnippetLibraryDialog({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [snippets, setSnippets] = useState(store.snippets);
  const [saving, setSaving] = useState(false);
  const add = () => setSnippets((items) => [...items, { id: crypto.randomUUID(), name: "新片段", content: "" }]);
  const patch = (id: string, next: Partial<PromptSnippet>) => setSnippets((items) => items.map((item) => item.id === id ? { ...item, ...next } : item));
  const save = async () => {
    if (snippets.some((item) => !item.name.trim())) { pushToast("error", "片段名称不能为空"); return; }
    setSaving(true);
    try { await setState((state) => ({ ...state, snippets: snippets.map((item) => ({ ...item, name: item.name.trim() })) })); pushToast("success", "文本片段已保存"); onClose(); }
    catch { /* The store reports the write failure. */ }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="文本片段库" onClick={(event) => event.stopPropagation()} className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5">
      <header className="flex items-center gap-2"><h2 className="flex-1 text-base font-semibold">文本片段库</h2><button onClick={onClose} aria-label="关闭"><X className="w-4 h-4" /></button></header>
      <p className="mt-1 text-xs text-zinc-500">保存常用指令或代码片段，在模板的多片段编辑器中引用。</p>
      <div className="mt-4 space-y-3">{snippets.map((snippet) => <div key={snippet.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
        <div className="flex gap-2"><input value={snippet.name} onChange={(event) => patch(snippet.id, { name: event.target.value })} aria-label="片段名称" className="min-w-0 flex-1 px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-950 text-sm" /><button onClick={() => setSnippets((items) => items.filter((item) => item.id !== snippet.id))} title="移除片段" className="text-rose-500"><Trash2 className="w-4 h-4" /></button></div>
        <textarea value={snippet.content} onChange={(event) => patch(snippet.id, { content: event.target.value })} rows={3} placeholder="片段内容；可包含 {{变量}}" className="mt-2 w-full resize-y rounded bg-zinc-50 dark:bg-zinc-950 p-2 font-mono text-xs" />
      </div>)}</div>
      <div className="mt-4 flex justify-between"><button onClick={add} className="text-sm text-blue-600"><Plus className="inline w-4 h-4 mr-1" />添加片段</button><div className="flex gap-2"><button onClick={onClose} className="px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">取消</button><button disabled={saving} onClick={() => void save()} className="px-3 py-1.5 rounded-md bg-blue-500 text-white disabled:opacity-50">{saving ? "保存中…" : "保存片段"}</button></div></div>
    </section>
  </div>;
}
