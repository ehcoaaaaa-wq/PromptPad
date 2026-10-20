import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { listen } from "@tauri-apps/api/event";
import { Plus, Sun, Moon, Monitor, Settings } from "lucide-react";
import { useStore, initStore, addPrompt, copyPrompt, flushWrites, setSettings } from "./store";
import { quitApp } from "./lib/commands";
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

export default function App() {
  const store = useStore();
  const [sel, setSel] = useState<SidebarSelection>({ kind: "experts" });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fillTarget, setFillTarget] = useState<Prompt | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = editorDirty;
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [language, setLanguage] = useState("zh-CN");
  const [creating, setCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const load = () => {
    setLoadError(null);
    void initStore().then(() => setLoaded(true)).catch(e => setLoadError(String(e)));
  };
  useEffect(load, []);

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

  // Keep search relevance; use pinned/recent ordering only without a query.
  const filtered = useMemo(() => {
    let list = store.prompts;
    if (sel.kind === "experts") list = list.filter(p => p.origin === "builtin" && (!language || p.locale === language));
    if (sel.kind === "personal") list = list.filter(p => p.origin !== "builtin");
    if (sel.kind === "favorites") list = list.filter((p) => p.favorite);
    if (sel.kind === "pinned") list = list.filter((p) => p.pinned);
    if (sel.kind === "tag") list = list.filter((p) => p.tags.includes(sel.tag));
    if (query.trim()) {
      const fuse = new Fuse(list, {
        keys: [{ name: "title", weight: 3 }, { name: "description", weight: 2 }, "content", "tags"],
        threshold: 0.4,
        ignoreLocation: true,
      });
      return fuse.search(query).map((r) => r.item);
    }
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [store.prompts, sel, query, language]);

  const selected = selectedId
    ? (store.prompts.find((p) => p.id === selectedId) ?? null)
    : null;

  const onNew = async () => {
    if (!loaded || creating) return;
    if (editorDirty && !confirm("当前模板有未保存修改，放弃修改并新建？")) return;
    setCreating(true);
    try {
      const p = await addPrompt({
        title: "新模板",
        content: "",
        tags: [],
        variables: [],
        favorite: false,
        pinned: false,
      });
      setSel({ kind: "personal" });
      setQuery("");
      setSelectedId(p.id);
    } catch { /* Store reports the error. */ }
    finally { setCreating(false); }
  };

  const onCopyPrompt = async (prompt: Prompt) => {
    try {
      const copy = await copyPrompt(prompt);
      setSel({ kind: "personal" });
      setQuery("");
      setSelectedId(copy.id);
    } catch { /* Store reports the error. */ }
  };

  const onSelectPrompt = (id: string) => {
    if (id === selectedId) return;
    if (editorDirty && !confirm("当前模板有未保存修改，放弃修改并切换？")) return;
    setSelectedId(id);
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

  if (loadError) {
    return <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-sm">
      <h1 className="font-semibold">模板库未能加载</h1>
      <p className="max-w-xl break-words text-red-600">{loadError}</p>
      <p>请检查数据目录、磁盘空间或旧文件格式，修复后重试。原 JSON 文件会保留。</p>
      <button className="px-4 py-2 rounded bg-blue-500 text-white" onClick={load}>重新加载</button>
    </div>;
  }
  if (!loaded) {
    return <div className="h-full flex items-center justify-center text-sm text-zinc-500">正在读取模板库…</div>;
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="font-semibold text-[15px] tracking-tight pl-1">PromptPad</div>
        <div className="flex-1 max-w-2xl">
          <SearchBar value={query} onChange={setQuery} />
        </div>
        <button
          onClick={onNew}
          disabled={!loaded || creating}
          className="w-8 h-8 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors flex items-center justify-center text-zinc-600 dark:text-zinc-300"
          title="新建"
        >
          <Plus className="w-4 h-4" />
        </button>
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
        <div className="w-72 border-r border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
          {sel.kind === "experts" && <label className="p-3 text-sm border-b border-zinc-200 dark:border-zinc-800">专家语言
            <select aria-label="专家语言" value={language} onChange={e => setLanguage(e.target.value)} className="ml-2 bg-transparent">
              <option value="zh-CN">中文</option><option value="en">English</option><option value="">全部语言</option>
            </select>
          </label>}
          <PromptList
            prompts={filtered}
            selectedId={selectedId}
            onSelect={onSelectPrompt}
            searchQuery={query}
          />
        </div>
        <PromptEditor key={selected?.id ?? "empty"} onCopy={onCopyPrompt} prompt={selected} onUse={setFillTarget} onDirtyChange={setEditorDirty} />
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
