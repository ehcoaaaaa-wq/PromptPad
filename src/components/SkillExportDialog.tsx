import { useState } from "react";
import type { Prompt } from "../types";
import { exportSkill, openDialog } from "../lib/commands";
import { buildSkillMarkdown, suggestedSkillName, validateSkillDetails } from "../lib/skill-export";
import { pushToast } from "../hooks/useToast";

export function SkillExportDialog({ prompt, onClose }: { prompt: Prompt; onClose: () => void }) {
  const [name, setName] = useState(() => suggestedSkillName(prompt));
  const [description, setDescription] = useState("");
  const [exporting, setExporting] = useState(false);
  const validation = validateSkillDetails(name, description);
  let preview = "";
  let previewError: string | null = null;
  if (!validation) {
    try {
      preview = buildSkillMarkdown(prompt, name, description);
    } catch (error) {
      previewError = String(error);
    }
  }

  const onExport = async () => {
    if (!preview || exporting) return;
    try {
      const selected = await openDialog({ directory: true, multiple: false, title: "选择 Skill 导出位置" });
      if (typeof selected !== "string") return;
      setExporting(true);
      const path = await exportSkill(selected, name, preview);
      pushToast("success", `Skill 已导出到 ${path}`);
      onClose();
    } catch (error) {
      pushToast("error", "导出 Skill 失败：" + String(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="skill-export-title" className="w-full max-w-2xl max-h-[90vh] flex flex-col gap-3 rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-xl border border-zinc-200 dark:border-zinc-800">
        <h2 id="skill-export-title" className="text-base font-semibold">导出为 Codex Skill</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">为“{prompt.title}”填写调用时机。预览确认后，选择保存文件夹。</p>
        <label className="flex flex-col gap-1 text-sm">
          Skill 名称
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={64} className="px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent" placeholder="例如 react-review" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          调用说明（适用场景）
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} className="px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent resize-none" placeholder="例如：当用户要求检查 React 页面性能并给出可验证的优化建议时使用。" />
        </label>
        {(validation || previewError) && <p className="text-xs text-amber-600 dark:text-amber-400">{validation || previewError}</p>}
        <div className="text-sm font-medium">SKILL.md 预览</div>
        <pre className="min-h-32 flex-1 overflow-auto rounded-lg bg-zinc-50 dark:bg-zinc-950 p-3 text-xs whitespace-pre-wrap break-words border border-zinc-200 dark:border-zinc-800">{preview || "填写有效名称和调用说明后显示预览。"}</pre>
        <div className="flex justify-end gap-2 text-sm">
          <button disabled={exporting} onClick={onClose} className="px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">取消</button>
          <button disabled={!preview || exporting} onClick={() => void onExport()} className="px-3 py-1.5 rounded-md bg-blue-500 text-white disabled:opacity-50">{exporting ? "导出中…" : "选择目录并导出"}</button>
        </div>
      </div>
    </div>
  );
}
