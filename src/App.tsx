import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { useStore, initStore, addPrompt } from "./store";
import { Sidebar, type SidebarSelection } from "./components/Sidebar";
import { SearchBar } from "./components/SearchBar";
import { PromptList } from "./components/PromptList";
import { PromptEditor } from "./components/PromptEditor";
import { VariableFillDialog } from "./components/VariableFillDialog";
import { ImportExportMenu } from "./components/ImportExportMenu";
import { ToastList } from "./components/Toast";
import type { Prompt } from "./types";

export default function App() {
  const store = useStore();
  const [sel, setSel] = useState<SidebarSelection>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fillTarget, setFillTarget] = useState<Prompt | null>(null);

  useEffect(() => {
    void initStore();
  }, []);

  // Apply sidebar filter, then fuzzy search, then sort (pinned first, then
  // most recently updated).
  const filtered = useMemo(() => {
    let list = store.prompts;
    if (sel.kind === "favorites") list = list.filter((p) => p.favorite);
    if (sel.kind === "tag") list = list.filter((p) => p.tags.includes(sel.tag));
    if (query.trim()) {
      const fuse = new Fuse(list, {
        keys: ["title", "content", "tags"],
        threshold: 0.4,
        ignoreLocation: true,
      });
      list = fuse.search(query).map((r) => r.item);
    }
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [store.prompts, sel, query]);

  const selected = selectedId
    ? (store.prompts.find((p) => p.id === selectedId) ?? null)
    : null;

  const onNew = () => {
    const p = addPrompt({
      title: "新模板",
      content: "",
      tags: [],
      variables: [],
      favorite: false,
      pinned: false,
    });
    setSelectedId(p.id);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="font-semibold text-lg">PromptPad</div>
        <div className="flex-1 max-w-2xl">
          <SearchBar value={query} onChange={setQuery} />
        </div>
        <button
          onClick={onNew}
          className="px-3 py-1.5 rounded bg-blue-500 text-white text-sm hover:bg-blue-600"
        >
          + 新建
        </button>
        <ImportExportMenu />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar selection={sel} onSelect={setSel} />
        <div className="w-72 border-r border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
          <PromptList
            prompts={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            searchQuery={query}
          />
        </div>
        <PromptEditor prompt={selected} onUse={setFillTarget} />
      </div>
      {fillTarget && (
        <VariableFillDialog
          prompt={fillTarget}
          onClose={() => setFillTarget(null)}
        />
      )}
      <ToastList />
    </div>
  );
}
