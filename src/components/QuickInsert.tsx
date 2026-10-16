import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CornerDownLeft, Search, X } from "lucide-react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { Prompt } from "../types";
import { extractVariableNames } from "../lib/variables";
import { selectPrompts } from "../lib/prompt-list";
import { initStore, recordPromptUse, refreshStore, useStore } from "../store";
import { writeText } from "../lib/commands";
import { VariableFillDialog } from "./VariableFillDialog";
import { resolvePromptContent } from "../lib/blocks";

export function QuickInsert() {
  const store = useStore();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [fillTarget, setFillTarget] = useState<Prompt | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchablePrompts = useMemo(() => store.prompts.map((prompt) => ({ ...prompt, content: resolvePromptContent(prompt, store.snippets) })), [store.prompts, store.snippets]);
  const results = useMemo(() => selectPrompts(searchablePrompts, { kind: "all" }, query).slice(0, 8), [searchablePrompts, query]);
  const quickWindow = getCurrentWindow();

  useEffect(() => { void initStore().then(() => setLoaded(true)).catch(() => setLoadError(true)); }, []);
  useEffect(() => {
    const theme = store.settings.theme ?? "system";
    const applyTheme = () => document.documentElement.setAttribute("data-theme", theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme);
    applyTheme();
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [store.settings.theme]);
  useEffect(() => { setActiveIndex(0); }, [query]);
  useEffect(() => {
    let active = true;
    const unlisteners: (() => void)[] = [];
    void Promise.all([
      listen("promptpad-global-shortcut", async () => {
        try { await refreshStore(); } catch { /* Keep the last readable snapshot. */ }
        if (!active) return;
        setQuery(""); setFillTarget(null); setActiveIndex(0);
        requestAnimationFrame(() => inputRef.current?.focus());
      }),
      listen("promptpad-store-updated", () => { void refreshStore().catch(() => {}); }),
    ]).then((dispose) => { if (active) unlisteners.push(...dispose); else dispose.forEach((fn) => fn()); });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); void quickWindow.hide(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { active = false; unlisteners.forEach((fn) => fn()); document.removeEventListener("keydown", onKey); };
  }, [quickWindow]);

  const choose = async (prompt: Prompt) => {
    const resolved = { ...prompt, content: resolvePromptContent(prompt, store.snippets) };
    const needsInput = extractVariableNames(resolved.content).length > 0 || Boolean(store.settings.activeProjectId);
    if (needsInput) { setFillTarget(resolved); return; }
    await writeText(resolved.content);
    await recordPromptUse(resolved.id);
    await quickWindow.hide();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); }
    if (event.key === "Enter" && results[activeIndex]) { event.preventDefault(); void choose(results[activeIndex]); }
  };

  return <main className="h-screen w-screen bg-transparent p-3 text-zinc-900 dark:text-zinc-100">
    <section className="h-full overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white/95 dark:bg-zinc-900/95 shadow-2xl backdrop-blur-xl flex flex-col">
      <div className="flex items-center gap-3 px-5 border-b border-zinc-200 dark:border-zinc-800">
        <Search className="w-5 h-5 text-blue-500" />
        <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handleKeyDown} placeholder="搜索提示词，回车复制或填写…" autoFocus className="h-16 flex-1 bg-transparent text-lg outline-none placeholder:text-zinc-400" />
        <button onClick={() => void quickWindow.hide()} title="关闭（Esc）" className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {!loaded ? <p className="p-5 text-sm text-zinc-500">{loadError ? "无法读取模板库，请从系统托盘打开 PromptPad 检查数据。" : "正在读取模板…"}</p> : results.length === 0 ? <p className="p-5 text-sm text-zinc-500">{query ? "没有匹配的提示词" : "还没有提示词"}</p> : results.map((prompt, index) => <button key={prompt.id} onMouseEnter={() => setActiveIndex(index)} onClick={() => void choose(prompt)} className={"w-full rounded-xl px-4 py-3 text-left flex items-center gap-3 " + (index === activeIndex ? "bg-blue-500/10" : "hover:bg-zinc-100 dark:hover:bg-zinc-800/70")}>
          <div className="min-w-0 flex-1"><div className="font-medium truncate">{prompt.title || "（未命名）"}</div><div className="text-xs text-zinc-500 truncate mt-1">{prompt.content.replace(/\s+/g, " ").slice(0, 120)}</div></div>
          {prompt.tags.slice(0, 2).map((tag) => <span key={tag} className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-[11px] text-zinc-500">{tag}</span>)}
          {index === activeIndex && <CornerDownLeft className="w-4 h-4 text-blue-500" />}
        </button>)}
      </div>
      <footer className="flex items-center gap-4 px-5 py-2.5 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500">
        <span>↑ ↓ 选择</span><span>Enter 使用</span><span>Esc 关闭</span><button onClick={() => void WebviewWindow.getByLabel("main").then(async (main) => { if (main) { await main.show(); await main.setFocus(); } await quickWindow.hide(); })} className="ml-auto hover:text-blue-500">管理模板</button><span>会复制到剪贴板</span>
      </footer>
    </section>
    {fillTarget && <VariableFillDialog prompt={fillTarget} onClose={() => { setFillTarget(null); void quickWindow.hide(); }} />}
  </main>;
}
