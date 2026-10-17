import { useEffect, useMemo, useRef, useState } from "react";
import { selectPrompts, type PromptSort } from "./lib/prompt-list";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Plus, Redo2, Sun, Moon, Monitor, Settings, Undo2 } from "lucide-react";
import { useStore, initStore, addPrompt, canRedo, canUndo, deletePrompts, flushWrites, redo, refreshStore, setSettings, undo } from "./store";
import { quitApp, getDataDir } from "./lib/commands";
import { pushToast } from "./hooks/useToast";
import { Sidebar, type SidebarSelection } from "./components/Sidebar";
import { SearchBar } from "./components/SearchBar";
import { PromptList } from "./components/PromptList";
import { PromptEditor } from "./components/PromptEditor";
import { VariableFillDialog } from "./components/VariableFillDialog";
import { ImportExportMenu } from "./components/ImportExportMenu";
import { SettingsDialog } from "./components/SettingsDialog";
import { ToastList } from "./components/Toast";
import type { Prompt } from "./types";
import { QuickInsert } from "./components/QuickInsert";

export default function App() {
  return getCurrentWindow().label === "quick" ? <QuickInsert /> : <MainApp />;
}

function MainApp() {
  const store = useStore();
  const [sel, setSel] = useState<SidebarSelection>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<PromptSort>("default");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [fillTarget, setFillTarget] = useState<Prompt | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const dirtyRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  dirtyRef.current = editorDirty;
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataDirectory, setDataDirectory] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const load = async () => {
    setLoadError(null);
    try { await initStore(); setLoaded(true); }
    catch (e) { setLoadError(String(e)); }
  };
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listen("promptpad-quit-requested", async () => {
      if (dirtyRef.current && !confirm("当前模板有未保存修改，仍要退出？")) return;
      try {
        await flushWrites();
        await quitApp();
      } catch (e) {
        pushToast("error", "退出前保存失败：" + String(e));
      }
    }).then((dispose) => {
      if (active) unlisten = dispose;
      else dispose();
    }).catch((e) => pushToast("error", "托盘退出监听失败：" + String(e)));
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const handleUndoKeys = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !["z", "y"].includes(event.key.toLowerCase())) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']") || dirtyRef.current) return;
      event.preventDefault();
      void (event.key.toLowerCase() === "y" || event.shiftKey ? redo() : undo()).catch(() => {});
    };
    document.addEventListener("keydown", handleUndoKeys);
    return () => document.removeEventListener("keydown", handleUndoKeys);
  }, []);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listen("promptpad-store-updated", () => { if (active) void refreshStore().catch(() => {}); })
      .then((dispose) => { if (active) unlisten = dispose; else dispose(); });
    return () => { active = false; unlisten?.(); };
  }, []);

  // Sync the active theme to <html data-theme>; honor "system" via media query.
  useEffect(() => {
    const root = document.documentElement;
    const theme = store.settings.theme ?? "system";
    const apply = () => {
      if (theme === "system") {
        const mql = window.matchMedia("(prefers-color-scheme: dark)");
        root.setAttribute("data-theme", mql.matches ? "dark" : "light");
      } else {
        root.setAttribute("data-theme", theme);
      }
    };
    apply();
    if (theme === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply();
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
  }, [store.settings.theme]);

  const sourcePrompts = sel.kind === "trash" ? store.trash.map((entry) => entry.prompt) : store.prompts;
  const filtered = useMemo(() => selectPrompts(sourcePrompts, sel, query, sortOrder), [sourcePrompts, sel, query, sortOrder]);

  useEffect(() => {
    setSelectionMode(false);
    setSelectedPromptIds([]);
  }, [sel, query]);

  const selected = selectedId
    ? (sourcePrompts.find((p) => p.id === selectedId) ?? null)
    : null;

  const onNew = async () => {
    if (!loaded) return;
    if (editorDirty && !confirm("当前模板有未保存修改，放弃修改并新建？")) return;
    try {
      const p = await addPrompt({
        title: "新模板",
        content: "",
        tags: [],
        variables: [],
        favorite: false,
        pinned: false,
      });
      setSelectedId(p.id);
    } catch { /* The store reports the write failure. */ }
  };

  const onSelectPrompt = (id: string) => {
    if (id === selectedId) return;
    if (editorDirty && !confirm("当前模板有未保存修改，放弃修改并切换？")) return;
    setSelectedId(id);
  };

  const togglePromptSelection = (id: string) => {
    setSelectedPromptIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filtered.map((prompt) => prompt.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedPromptIds.includes(id));
    setSelectedPromptIds((current) => allSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  };

  const deleteSelectedPrompts = async () => {
    const visibleIds = new Set(filtered.map((prompt) => prompt.id));
    const ids = selectedPromptIds.filter((id) => visibleIds.has(id));
    if (ids.length === 0) return;
    const hasUnsavedSelectedPrompt = editorDirty && selectedId !== null && ids.includes(selectedId);
    const warning = hasUnsavedSelectedPrompt ? "\n当前模板尚未保存的修改也会丢弃。" : "";
    if (!window.confirm(`确定将选中的 ${ids.length} 个模板移到回收站？可在 30 天内恢复。${warning}`)) return;
    try {
      await deletePrompts(ids);
      if (selectedId && ids.includes(selectedId)) setSelectedId(null);
      setSelectedPromptIds([]);
      setSelectionMode(false);
      pushToast("info", `已将 ${ids.length} 个模板移到回收站，可在 30 天内恢复`);
    } catch {
      // The store reports the write failure.
    }
  };

  const cycleTheme = () => {
    const cur = store.settings.theme ?? "system";
    const next = cur === "light" ? "dark" : cur === "dark" ? "system" : "light";
    void setSettings({ theme: next }).catch(() => {});
  };

  const currentTheme = store.settings.theme ?? "system";
  const ThemeIcon =
    currentTheme === "light"
      ? Sun
      : currentTheme === "dark"
        ? Moon
        : Monitor;
  const themeLabel = {
    light: "浅色",
    dark: "深色",
    system: "跟随系统",
  }[currentTheme];

  if (!loaded) {
    if (loadError) return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-sm bg-white dark:bg-zinc-950 dark:text-zinc-100">
        <h1 className="text-lg font-semibold">无法读取模板库</h1>
        <p>已暂停编辑和写入。请先备份并检查数据文件，再重试。</p>
        <p role="alert" className="max-w-xl break-all text-rose-500">{loadError}</p>
        <div className="flex gap-4">
          <button onClick={() => void load()} className="px-3 py-2 rounded bg-blue-500 text-white">重新读取</button>
          <button onClick={() => void getDataDir().then(setDataDirectory).catch((e) => setDataDirectory(String(e)))}>查看数据目录</button>
        </div>
        {dataDirectory && <p className="select-text break-all">{dataDirectory}</p>}
      </div>
    );
    return <div className="h-full flex items-center justify-center text-sm text-zinc-500">正在读取模板库…</div>;
  }

  return (
    <div className="app-shell flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="app-toolbar flex items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="brand-lockup"><span className="brand-mark">P</span><span className="font-semibold text-[15px] tracking-tight">PromptPad</span></div>
        <div className="toolbar-search flex-1 max-w-2xl">
          <SearchBar value={query} onChange={setQuery} inputRef={searchRef} />
        </div>
        <button
          onClick={onNew}
          disabled={!loaded}
          className="w-8 h-8 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors flex items-center justify-center text-zinc-600 dark:text-zinc-300"
          title="新建"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button onClick={() => void undo().catch(() => {})} disabled={!canUndo()} title="撤销（Ctrl+Z）" className="w-8 h-8 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-35 flex items-center justify-center"><Undo2 className="w-4 h-4" /></button>
        <button onClick={() => void redo().catch(() => {})} disabled={!canRedo()} title="重做（Ctrl+Shift+Z）" className="w-8 h-8 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-35 flex items-center justify-center"><Redo2 className="w-4 h-4" /></button>
        <button
          onClick={cycleTheme}
          className="w-8 h-8 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors flex items-center justify-center text-zinc-500 dark:text-zinc-400"
          title={`主题：${themeLabel}（点击切换）`}
        >
          <ThemeIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="w-8 h-8 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors flex items-center justify-center text-zinc-500 dark:text-zinc-400"
          title="设置"
        >
          <Settings className="w-4 h-4" />
        </button>
        <ImportExportMenu selectedPrompt={selected} hasUnsavedChanges={editorDirty} />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar selection={sel} onSelect={setSel} />
        <div className="prompt-pane w-72 border-r border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
          <div className="prompt-pane-heading"><span>{selectionLabel(sel, store)}</span><span className="prompt-pane-count">{filtered.length}</span></div>
          <PromptList
            prompts={filtered}
            selectedId={selectedId}
            onSelect={onSelectPrompt}
            searchQuery={query}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            selectionMode={selectionMode}
            selectedIds={selectedPromptIds}
            allowSelection={sel.kind !== "trash"}
            onToggleSelectionMode={() => { setSelectedPromptIds([]); setSelectionMode(true); }}
            onTogglePromptSelection={togglePromptSelection}
            onToggleSelectAll={toggleSelectAllVisible}
            onDeleteSelected={() => void deleteSelectedPrompts()}
            onCancelSelection={() => { setSelectedPromptIds([]); setSelectionMode(false); }}
          />
        </div>
        <PromptEditor key={selected ? `${selected.id}:${selected.updatedAt}` : "empty"} prompt={selected} isTrashed={sel.kind === "trash"} onUse={setFillTarget} onDirtyChange={setEditorDirty} />
      </div>
      {fillTarget && (
        <VariableFillDialog
          prompt={fillTarget}
          onClose={() => setFillTarget(null)}
        />
      )}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      <ToastList />
    </div>
  );
}

function selectionLabel(selection: SidebarSelection, store: ReturnType<typeof useStore>) {
  if (selection.kind === "all") return "全部模板";
  if (selection.kind === "favorites") return "收藏";
  if (selection.kind === "pinned") return "置顶";
  if (selection.kind === "recent") return "最近使用";
  if (selection.kind === "trash") return "回收站";
  if (selection.kind === "tag") return `# ${selection.tag}`;
  if (selection.kind === "folder") return store.folders.find((folder) => folder.id === selection.folderId)?.name ?? "文件夹";
  return "模板";
}
