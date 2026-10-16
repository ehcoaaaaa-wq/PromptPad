import { useEffect, useState } from "react";
import { disable, enable, getDataDir, isEnabled, writeText, setGlobalShortcut } from "../lib/commands";
import { setSettings, setState, useStore } from "../store";
import { pushToast } from "../hooks/useToast";
import type { ProjectProfile } from "../types";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [dataDir, setDataDir] = useState("");
  const [busy, setBusy] = useState(true);
  const [projects, setProjects] = useState<ProjectProfile[]>(store.projects);
  const [activeProjectId, setActiveProjectId] = useState(store.settings.activeProjectId ?? "");
  const [shortcut, setShortcut] = useState(store.settings.globalShortcut ?? "CommandOrControl+Shift+Space");
  const [savingProjects, setSavingProjects] = useState(false);
  const [savingShortcut, setSavingShortcut] = useState(false);

  useEffect(() => {
    void Promise.all([isEnabled(), getDataDir()])
      .then(([enabled, dir]) => {
        setAutoLaunch(enabled);
        setDataDir(dir);
      })
      .catch((e) => pushToast("error", "读取设置失败：" + String(e)))
      .finally(() => setBusy(false));
  }, []);

  const toggleAutoLaunch = async () => {
    setBusy(true);
    try {
      if (autoLaunch) await disable();
      else await enable();
      const enabled = await isEnabled();
      setAutoLaunch(enabled);
      await setSettings({ autoLaunch: enabled });
      pushToast("success", enabled ? "已开启开机自启" : "已关闭开机自启");
    } catch (e) {
      pushToast("error", "修改开机自启失败：" + String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveProjects = async () => {
    if (savingProjects) return;
    if (projects.some((project) => !project.name.trim() || !project.background.trim())) {
      pushToast("error", "请为每个项目填写名称和背景");
      return;
    }
    if (new Set(projects.map((project) => project.name.trim().toLocaleLowerCase())).size !== projects.length) {
      pushToast("error", "项目名称不能重复");
      return;
    }
    setSavingProjects(true);
    try {
      const selected = projects.some((project) => project.id === activeProjectId) ? activeProjectId : "";
      await setState((state) => ({ ...state, projects: projects.map((project) => ({ ...project, name: project.name.trim() })), settings: { ...state.settings, activeProjectId: selected || null } }));
      setActiveProjectId(selected);
      pushToast("success", "项目背景已保存");
    } catch {
      // The store reports the write failure; local drafts remain editable.
    } finally {
      setSavingProjects(false);
    }
  };

  const saveShortcut = async () => {
    const next = shortcut.trim();
    if (savingShortcut) return;
    if (!next.includes("+") || !/(CommandOrControl|Ctrl|Control|Cmd|Command|Alt|Option|Shift)/i.test(next)) {
      pushToast("error", "快捷键至少需要一个修饰键，例如 CommandOrControl+Shift+Space");
      return;
    }
    setSavingShortcut(true);
    const previous = store.settings.globalShortcut ?? "CommandOrControl+Shift+Space";
    try {
      await setGlobalShortcut(next);
      try {
        await setSettings({ globalShortcut: next });
      } catch (error) {
        await setGlobalShortcut(previous);
        throw error;
      }
      pushToast("success", `快捷键已设置为 ${next}`);
    } catch (error) {
      pushToast("error", `快捷键未更改：${String(error)}`);
    } finally {
      setSavingShortcut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-xl border border-zinc-200 dark:border-zinc-800" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">设置</h2>
          <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">关闭</button>
        </div>
        <div className="mt-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">开机自启</div>
            <div className="text-xs text-zinc-500 mt-1">启动后可通过系统托盘打开 PromptPad。</div>
          </div>
          <button disabled={busy} onClick={() => void toggleAutoLaunch()} className="px-3 py-1.5 rounded-md bg-blue-500 text-white text-sm disabled:opacity-50">
            {busy ? "读取中…" : autoLaunch ? "已开启" : "已关闭"}
          </button>
        </div>
        <section className="mt-6 border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <h3 className="text-sm font-medium">项目背景</h3>
          <p className="mt-1 text-xs text-zinc-500">只保存你输入的文字。使用模板时可选择背景，并预览组合结果。</p>
          <label className="mt-3 flex flex-col gap-1 text-xs">
            <span>默认项目</span>
            <select value={activeProjectId} onChange={(event) => setActiveProjectId(event.target.value)} className="px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent">
              <option value="">不默认选择</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name || "未命名项目"}</option>)}
            </select>
          </label>
          <div className="mt-3 max-h-64 overflow-y-auto space-y-3">
            {projects.map((project) => (
              <div key={project.id} className="rounded-md border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="flex gap-2">
                  <input aria-label="项目名称" value={project.name} onChange={(event) => setProjects((all) => all.map((item) => item.id === project.id ? { ...item, name: event.target.value } : item))} placeholder="项目名称" className="min-w-0 flex-1 px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent text-sm" />
                  <button onClick={() => { setProjects((all) => all.filter((item) => item.id !== project.id)); if (activeProjectId === project.id) setActiveProjectId(""); }} className="text-xs text-rose-500">删除</button>
                </div>
                <textarea aria-label={`${project.name || "项目"}的背景`} value={project.background} onChange={(event) => setProjects((all) => all.map((item) => item.id === project.id ? { ...item, background: event.target.value } : item))} placeholder="技术栈、代码规范、目标受众等" rows={3} className="mt-2 w-full resize-y px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent text-sm" />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between">
            <button onClick={() => setProjects((all) => [...all, { id: crypto.randomUUID(), name: "", background: "" }])} className="px-2.5 py-1.5 rounded-md text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">添加项目</button>
            <button disabled={savingProjects} onClick={() => void saveProjects()} className="px-3 py-1.5 rounded-md bg-blue-500 text-white text-sm disabled:opacity-50">{savingProjects ? "保存中…" : "保存项目背景"}</button>
          </div>
        </section>
        <section className="mt-6 border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <h3 className="text-sm font-medium">快速唤出</h3>
          <p className="mt-1 text-xs text-zinc-500">在其他应用中按下快捷键，会显示 PromptPad 并聚焦搜索框。</p>
          <div className="mt-2 flex gap-2">
            <input value={shortcut} onChange={(event) => setShortcut(event.target.value)} aria-label="全局快捷键" placeholder="CommandOrControl+Shift+Space" className="min-w-0 flex-1 px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent text-sm font-mono" />
            <button disabled={savingShortcut} onClick={() => void saveShortcut()} className="px-3 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-sm disabled:opacity-50">{savingShortcut ? "设置中…" : "设置快捷键"}</button>
          </div>
        </section>
        <div className="mt-6 border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <div className="text-sm font-medium">数据目录</div>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 min-w-0 break-all text-xs text-zinc-600 dark:text-zinc-300">{dataDir || "读取中…"}</code>
            <button disabled={!dataDir} onClick={() => void writeText(dataDir).then(() => pushToast("success", "路径已复制")).catch((e) => pushToast("error", "复制失败：" + String(e)))} className="shrink-0 px-2 py-1 text-xs rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50">复制路径</button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">每次导入前会在此目录自动保存一份备份。</p>
        </div>
      </div>
    </div>
  );
}
