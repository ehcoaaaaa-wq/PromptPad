import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Clipboard, FilePlus2, ImagePlus, Layers, Plus, Trash2 } from "lucide-react";
import type { Prompt, PromptBlock } from "../types";
import { updatePrompt, deletePrompt, permanentlyDeletePrompt, restorePrompt, undo, redo, useStore } from "../store";
import {
  extractVariableNames,
  reconcileVariables,
  BUILTIN_VARS,
} from "../lib/variables";
import { pushToast } from "../hooks/useToast";
import { legacyBlocks, renderBlocks } from "../lib/blocks";
import { openDialog } from "../lib/commands";
import { SnippetLibraryDialog } from "./SnippetLibraryDialog";

export function PromptEditor({
  prompt,
  onUse,
  onDirtyChange,
  isTrashed = false,
}: {
  prompt: Prompt | null;
  onUse: (p: Prompt) => void;
  onDirtyChange: (dirty: boolean) => void;
  isTrashed?: boolean;
}) {
  const store = useStore();
  const [draft, setDraft] = useState<Prompt | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);

  // Re-seed draft when the user switches to a different prompt.
  useEffect(() => {
    setDraft(prompt);
  }, [prompt?.id]);

  const currentContent = draft?.blocks ? renderBlocks(draft.blocks, store.snippets) : draft?.content ?? "";
  const dirty = Boolean(draft && prompt && draft.id === prompt.id && (
    draft.title !== prompt.title || currentContent !== prompt.content ||
    JSON.stringify(draft.tags) !== JSON.stringify(prompt.tags) ||
    JSON.stringify(draft.variables) !== JSON.stringify(prompt.variables) ||
    JSON.stringify(draft.folderIds ?? []) !== JSON.stringify(prompt.folderIds ?? []) ||
    JSON.stringify(draft.blocks ?? null) !== JSON.stringify(prompt.blocks ?? null) ||
    draft.favorite !== prompt.favorite || draft.pinned !== prompt.pinned ||
    draft.includesProjectContext !== prompt.includesProjectContext
  ));
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  if (!draft) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-500 text-sm">
        选择一个模板查看，或点 + 新建
      </div>
    );
  }

  const contentVars = extractVariableNames(currentContent);
  const variables = reconcileVariables(draft.variables, contentVars);

  const sync = (patch: Partial<Prompt>) =>
    setDraft({ ...draft, ...patch });

  const setBlocks = (blocks: PromptBlock[]) => sync({ blocks, content: renderBlocks(blocks, store.snippets) });
  const blocks = draft.blocks;
  const addBlock = (block: PromptBlock) => setBlocks([...(blocks ?? legacyBlocks(draft.content)), block]);
  const updateBlock = (id: string, patch: Partial<PromptBlock>) => setBlocks((blocks ?? legacyBlocks(draft.content)).map((block) => block.id === id ? { ...block, ...patch } as PromptBlock : block));
  const removeBlock = (id: string) => setBlocks((blocks ?? []).filter((block) => block.id !== id));
  const moveBlock = (index: number, delta: number) => {
    const next = [...(blocks ?? [])];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
  };

  const addFileBlock = async (kind: "file" | "image") => {
    try {
      const selected = await openDialog({ multiple: false, filters: [{ name: kind === "image" ? "图片" : "文件", extensions: kind === "image" ? ["png", "jpg", "jpeg", "webp", "gif"] : ["txt", "md", "json", "csv", "ts", "tsx", "js", "py", "rs"] }] });
      if (typeof selected === "string") addBlock({ id: crypto.randomUUID(), type: "file", kind, path: selected });
    } catch (error) { pushToast("error", "选择文件失败：" + String(error)); }
  };

  const save = async () => {
    if (saving) return;
    if (!draft.title.trim()) {
      pushToast("error", "标题不能为空");
      return;
    }
    if (draft.blocks?.some((block) => block.type === "variable" && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(block.name))) {
      pushToast("error", "请为每个变量片段填写有效名称");
      return;
    }
    setSaving(true);
    try {
      await updatePrompt(draft.id, { ...draft, content: currentContent, variables });
      setDraft({ ...draft, content: currentContent, variables });
      pushToast("success", "已保存");
    } catch {
      // The store reports the write failure and keeps the in-memory draft.
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await deletePrompt(draft.id);
      pushToast("info", "已移到回收站，可在 30 天内恢复");
    } catch {
      // The store reports the write failure.
    }
  };

  const usePrompt = async () => {
    if (saving) return;
    if (!draft.title.trim()) {
      pushToast("error", "标题不能为空");
      return;
    }
    if (draft.blocks?.some((block) => block.type === "variable" && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(block.name))) {
      pushToast("error", "请为每个变量片段填写有效名称");
      return;
    }
    const ready = { ...draft, content: currentContent, variables };
    if (dirty) {
      setSaving(true);
      try {
        await updatePrompt(draft.id, ready);
        setDraft(ready);
      } catch {
        return;
      } finally {
        setSaving(false);
      }
    }
    onUse(ready);
  };

  const charCount = currentContent.length;
  const updatedRel = relativeTime(prompt?.updatedAt ?? draft.updatedAt);

  return (
    <>
    <fieldset disabled={saving} onKeyDown={(event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z" || dirty) return;
      event.preventDefault();
      void (event.shiftKey ? redo() : undo()).catch(() => {});
    }} className="flex-1 min-w-0 flex flex-col p-5 gap-3 overflow-hidden">
      {isTrashed && <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">此模板在回收站中，可恢复或永久删除。</div>}
      <input
        disabled={isTrashed}
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
      {!blocks ? (
        <>
          <textarea disabled={isTrashed} value={draft.content} onChange={(e) => sync({ content: e.target.value })} placeholder={"模板正文，使用 {{var}} 占位符\n例如：请把以下代码重构：\n{{code}}"} className="flex-1 min-h-32 px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 focus:bg-white dark:focus:bg-zinc-900 font-mono text-[13px] leading-relaxed resize-none focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20" />
          {!isTrashed && <button type="button" onClick={() => sync({ blocks: legacyBlocks(draft.content) })} className="self-start text-xs text-blue-600 dark:text-blue-400">拆分为多片段模板</button>}
        </>
      ) : (
        <section className="flex-1 min-h-32 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-2 space-y-2">
          {blocks.map((block, index) => <div key={block.id} className="flex gap-1.5 items-start rounded-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2">
            <div className="flex flex-col shrink-0">
              <button disabled={isTrashed || index === 0} onClick={() => moveBlock(index, -1)} title="上移" className="p-0.5 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
              <button disabled={isTrashed || index === blocks.length - 1} onClick={() => moveBlock(index, 1)} title="下移" className="p-0.5 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-zinc-400 mb-1">{block.type === "text" ? "文本" : block.type === "variable" ? "变量" : block.type === "file" ? (block.kind === "image" ? "图片路径" : "文件引用") : "片段引用"}</div>
              {block.type === "text" && <textarea disabled={isTrashed} value={block.content} onChange={(event) => updateBlock(block.id, { content: event.target.value })} rows={Math.min(8, Math.max(2, block.content.split("\n").length))} placeholder="输入一段提示词文本" className="w-full resize-y bg-transparent text-sm font-mono focus:outline-none" />}
              {block.type === "variable" && <input disabled={isTrashed} value={block.name} onChange={(event) => updateBlock(block.id, { name: event.target.value.replace(/[^a-zA-Z0-9_]/g, "") })} placeholder="variable_name" className="w-full bg-transparent text-sm font-mono focus:outline-none" />}
              {block.type === "file" && <div className="flex gap-2 items-center"><span className="min-w-0 flex-1 truncate text-xs" title={block.path}>{block.path || "未选择文件"}</span><button disabled={isTrashed} onClick={() => void addFileBlock(block.kind)} className="text-xs text-blue-600">选择</button></div>}
              {block.type === "snippet" && <select disabled={isTrashed} value={block.snippetId} onChange={(event) => updateBlock(block.id, { snippetId: event.target.value })} className="w-full bg-transparent text-sm"><option value="">选择文本片段</option>{store.snippets.map((snippet) => <option key={snippet.id} value={snippet.id}>{snippet.name}</option>)}</select>}
            </div>
            <button disabled={isTrashed} onClick={() => removeBlock(block.id)} title="移除片段" className="p-1 text-zinc-400 hover:text-rose-500 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>)}
          <div className="flex flex-wrap gap-1.5">
            <button disabled={isTrashed} onClick={() => addBlock({ id: crypto.randomUUID(), type: "text", content: "" })} className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-xs disabled:opacity-40"><Plus className="inline w-3 h-3 mr-1" />文本</button>
            <button disabled={isTrashed} onClick={() => addBlock({ id: crypto.randomUUID(), type: "variable", name: "new_variable" })} className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-xs disabled:opacity-40">+ 变量</button>
            <button disabled={isTrashed} onClick={() => void addFileBlock("file")} className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-xs disabled:opacity-40"><FilePlus2 className="inline w-3 h-3 mr-1" />文件</button>
            <button disabled={isTrashed} onClick={() => void addFileBlock("image")} className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-xs disabled:opacity-40"><ImagePlus className="inline w-3 h-3 mr-1" />图片</button>
            <button disabled={isTrashed || !store.snippets.length} onClick={() => addBlock({ id: crypto.randomUUID(), type: "snippet", snippetId: store.snippets[0]?.id ?? "" })} className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-xs disabled:opacity-40"><Layers className="inline w-3 h-3 mr-1" />引用片段</button>
            {!isTrashed && <button onClick={() => setShowSnippets(true)} className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-xs">管理片段库</button>}
          </div>
        </section>
      )}
      <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
        <span>{charCount} 字</span>
        <span className="text-zinc-300 dark:text-zinc-600">·</span>
        <span>{variables.length} 变量</span>
        <span className="text-zinc-300 dark:text-zinc-600">·</span>
        <span>{updatedRel}</span>
        {dirty && <span className="text-amber-600 dark:text-amber-400">未保存</span>}
        {saving && <span className="text-blue-500">保存中…</span>}
      </div>
      {(variables.some((v) => !BUILTIN_VARS.has(v.name) && contentVars.includes(v.name)) || store.projects.length > 0) && (
        <details className="text-xs max-h-40 overflow-auto shrink-0">
          <summary className="cursor-pointer text-zinc-500">变量与项目设置</summary>
          {store.projects.length > 0 && (
            <label className="flex items-center gap-2 py-1">
              <input disabled={isTrashed} type="checkbox" checked={draft.includesProjectContext === true} onChange={(e) => sync({ includesProjectContext: e.target.checked })} />
              模板正文已包含项目背景，使用时不自动附加
            </label>
          )}
          {variables.filter((v) => !BUILTIN_VARS.has(v.name) && contentVars.includes(v.name)).map((v) => (
            <label key={v.name} className="flex items-center gap-2 py-1">
              <input disabled={isTrashed} type="checkbox" checked={v.required !== false} onChange={(e) => sync({ variables: variables.map((item) => item.name === v.name ? { ...item, required: e.target.checked } : item) })} />
              {`{{${v.name}}}`} 必填
            </label>
          ))}
        </details>
      )}
      {store.folders.length > 0 && <details className="text-xs max-h-28 overflow-auto shrink-0"><summary className="cursor-pointer text-zinc-500">所属文件夹</summary><div className="flex flex-wrap gap-x-4 gap-y-1 pt-2">{store.folders.map((folder) => <label key={folder.id} className="flex items-center gap-1"><input disabled={isTrashed} type="checkbox" checked={draft.folderIds?.includes(folder.id) ?? false} onChange={(event) => sync({ folderIds: event.target.checked ? [...new Set([...(draft.folderIds ?? []), folder.id])] : (draft.folderIds ?? []).filter((id) => id !== folder.id) })} />{folder.name}</label>)}</div></details>}
      <input
        disabled={isTrashed}
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
        {!isTrashed && <Toggle
          checked={draft.favorite}
          onChange={(v) => sync({ favorite: v })}
          label="收藏"
        />}
        {!isTrashed && <Toggle
          checked={draft.pinned}
          onChange={(v) => sync({ pinned: v })}
          label="置顶"
        />}
        <div className="flex-1" />
        {isTrashed ? <>
          <button onClick={() => void restorePrompt(draft.id).then(() => pushToast("success", "已恢复模板")).catch(() => {})} className="px-3 py-1.5 rounded-md bg-blue-500 text-white">恢复</button>
          <button onClick={() => { if (window.confirm("永久删除后无法恢复，确定删除？")) void permanentlyDeletePrompt(draft.id).then(() => pushToast("success", "已永久删除")).catch(() => {}); }} className="px-3 py-1.5 rounded-md text-rose-500 hover:bg-rose-500/10">永久删除</button>
        </> : <>
          <button onClick={() => void remove()} className="px-3 py-1.5 rounded-md text-rose-500 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />删除</button>
          <button onClick={() => void save()} className="px-3 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">保存</button>
          <button onClick={() => void usePrompt()} className="px-3 py-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center gap-1.5 shadow-sm"><Clipboard className="w-3.5 h-3.5" />使用</button>
        </>}
      </div>
    </fieldset>
    {showSnippets && <SnippetLibraryDialog onClose={() => setShowSnippets(false)} />}
    </>
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
