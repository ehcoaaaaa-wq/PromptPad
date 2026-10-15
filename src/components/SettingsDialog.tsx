import { useEffect, useState } from "react";
import { disable, enable, getDataDir, isEnabled, writeText } from "../lib/commands";
import { setSettings } from "../store";
import { pushToast } from "../hooks/useToast";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [dataDir, setDataDir] = useState("");
  const [busy, setBusy] = useState(true);

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

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-xl border border-zinc-200 dark:border-zinc-800" onClick={(event) => event.stopPropagation()}>
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
