import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { backupStore, openDialog, saveDialog } from "../lib/commands";
import { flushWrites, getState, useStore, replaceAll } from "../store";
import type { Prompt } from "../types";
import { mergeIncoming, parseIncoming, type ConflictAction } from "../lib/import";
import { pushToast } from "../hooks/useToast";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export function ImportExportMenu({ selectedPrompt, hasUnsavedChanges }: { selectedPrompt: Prompt | null; hasUnsavedChanges: boolean }) {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Prompt[] | null>(null);
  const [applying, setApplying] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const exportAll = async () => {
    setOpen(false);
    if (hasUnsavedChanges) {
      pushToast("info", "请先保存当前模板，再导出模板库");
      return;
    }
    try {
      const path = await saveDialog({
        defaultPath: "prompts.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      await writeTextFile(path, JSON.stringify(store, null, 2));
      pushToast("success", "已导出全部模板");
    } catch (e) {
      pushToast("error", "导出失败：" + String(e));
    }
  };

  const exportOne = async (p: Prompt) => {
    setOpen(false);
    if (hasUnsavedChanges) {
      pushToast("info", "请先保存当前模板，再导出 Markdown");
      return;
    }
    try {
      const path = await saveDialog({
        defaultPath: `${(p.title || "prompt").replace(/[^\w一-龥\-]+/g, "_")}.md`,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!path) return;
      const frontmatter = [
        "---",
        `id: ${JSON.stringify(p.id)}`,
        `title: ${JSON.stringify(p.title)}`,
        `tags: [${p.tags.map((t) => JSON.stringify(t)).join(", ")}]`,
        `variables: ${JSON.stringify(p.variables)}`,
        `favorite: ${p.favorite}`,
        `pinned: ${p.pinned}`,
        `createdAt: ${JSON.stringify(p.createdAt)}`,
        `updatedAt: ${JSON.stringify(p.updatedAt)}`,
        "---",
        "",
      ].join("\n");
      await writeTextFile(path, frontmatter + p.content);
      pushToast("success", "已导出为 Markdown");
    } catch (e) {
      pushToast("error", "导出失败：" + String(e));
    }
  };

  const importFile = async () => {
    setOpen(false);
    if (hasUnsavedChanges) {
      pushToast("info", "请先保存当前模板，再导入文件");
      return;
    }
    try {
      const path = await openDialog({
        multiple: false,
        filters: [
          { name: "JSON / Markdown", extensions: ["json", "md"] },
        ],
      });
      if (!path || typeof path !== "string") return;
      const text = await readTextFile(path);
      const incoming = parseIncoming(path, text);
      if (incoming.length === 0) {
        pushToast("info", "文件中没有模板");
        return;
      }
      setPending(incoming);
    } catch (e) {
      pushToast("error", "导入失败：" + String(e));
    }
  };

  const applyImport = async (action: ConflictAction) => {
    if (!pending || applying) return;
    setApplying(true);
    try {
      const current = getState();
      const next = mergeIncoming(current.prompts, pending, action);
      await flushWrites();
      await backupStore();
      await replaceAll({ ...current, prompts: next });
      pushToast("success", `导入完成：当前共 ${next.length} 个模板`);
      setPending(null);
    } catch (e) {
      pushToast("error", "导入失败：" + String(e));
    } finally {
      setApplying(false);
    }
  };

  const conflicts = pending
    ? pending.filter((p) => store.prompts.some((existing) => existing.id === p.id)).length
    : 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((x) => !x)}
        className="w-8 h-8 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors flex items-center justify-center text-zinc-500 dark:text-zinc-400"
        title="导入 / 导出"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl z-30 py-1 overflow-hidden">
          <MenuItem label="📥 导入..." onClick={importFile} />
          <MenuItem label="📤 导出全部..." onClick={exportAll} />
          {selectedPrompt && (
            <>
              <div className="border-t border-zinc-200 dark:border-zinc-800 my-1" />
              <MenuItem label="📄 导出当前模板为 Markdown" onClick={() => exportOne(selectedPrompt)} />
            </>
          )}
        </div>
      )}
      {pending && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-xl border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-base font-semibold">确认导入</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              文件包含 {pending.length} 个模板，其中 {conflicts} 个与现有模板 ID 相同。导入前会在数据目录创建备份。
            </p>
            <div className="mt-3 max-h-32 overflow-y-auto text-xs text-zinc-500">
              {pending.slice(0, 5).map((p) => <div key={p.id} className="truncate py-0.5">{p.title}</div>)}
              {pending.length > 5 && <div>另有 {pending.length - 5} 个模板</div>}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2 text-sm">
              <button disabled={applying} onClick={() => setPending(null)} className="px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">取消</button>
              {conflicts > 0 && <button disabled={applying} onClick={() => void applyImport("skip")} className="px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">跳过重复</button>}
              {conflicts > 0 && <button disabled={applying} onClick={() => void applyImport("copy")} className="px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">作为新模板</button>}
              <button disabled={applying} onClick={() => void applyImport(conflicts > 0 ? "replace" : "skip")} className="px-3 py-1.5 rounded-md bg-blue-500 text-white disabled:opacity-50">
                {applying ? "导入中…" : conflicts > 0 ? "覆盖重复" : "导入"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors truncate"
    >
      {label}
    </button>
  );
}
