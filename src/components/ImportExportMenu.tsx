import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { openDialog, saveDialog } from "../lib/commands";
import { useStore, replaceAll } from "../store";
import type { Prompt } from "../types";
import { pushToast } from "../hooks/useToast";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export function ImportExportMenu() {
  const store = useStore();
  const [open, setOpen] = useState(false);
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
    try {
      const path = await saveDialog({
        defaultPath: `${(p.title || "prompt").replace(/[^\w一-龥\-]+/g, "_")}.md`,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!path) return;
      const frontmatter = [
        "---",
        `title: ${JSON.stringify(p.title)}`,
        `tags: [${p.tags.map((t) => JSON.stringify(t)).join(", ")}]`,
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
    try {
      const path = await openDialog({
        multiple: false,
        filters: [
          { name: "JSON / Markdown", extensions: ["json", "md"] },
        ],
      });
      if (!path || typeof path !== "string") return;
      const text = await readTextFile(path);
      let incoming: Prompt[] = [];
      if (path.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) incoming = parsed;
        else if (parsed?.prompts) incoming = parsed.prompts;
        else throw new Error("JSON 格式不正确");
      } else {
        const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (!m) throw new Error("Markdown 缺少 frontmatter");
        const fm = m[1];
        const content = m[2];
        const title =
          /title:\s*(.+)/.exec(fm)?.[1]?.replace(/^["']|["']$/g, "") ??
          "未命名";
        const tagsMatch = /tags:\s*\[(.*?)\]/g.exec(fm)?.[1];
        const tags = tagsMatch
          ? tagsMatch
              .split(",")
              .map((s) => s.trim().replace(/^["']|["']$/g, ""))
              .filter(Boolean)
          : [];
        incoming = [
          {
            id: crypto.randomUUID(),
            title,
            content,
            tags,
            variables: [],
            favorite: false,
            pinned: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      }
      // Merge — existing id wins, incoming fills gaps.
      const byId = new Map(store.prompts.map((p) => [p.id, p]));
      for (const p of incoming) byId.set(p.id, p);
      replaceAll({ ...store, prompts: Array.from(byId.values()) });
      pushToast("success", `已导入 ${incoming.length} 个模板`);
    } catch (e) {
      pushToast("error", "导入失败：" + String(e));
    }
  };

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
          {store.prompts.length > 0 && (
            <>
              <div className="border-t border-zinc-200 dark:border-zinc-800 my-1" />
              <div className="px-3 py-1 text-[11px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                导出单个为 Markdown
              </div>
              {store.prompts.slice(0, 8).map((p) => (
                <MenuItem
                  key={p.id}
                  label={p.title || "(未命名)"}
                  onClick={() => exportOne(p)}
                />
              ))}
              {store.prompts.length > 8 && (
                <div className="px-3 py-1 text-xs text-zinc-400 dark:text-zinc-500">
                  还有 {store.prompts.length - 8} 个未显示...
                </div>
              )}
            </>
          )}
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
