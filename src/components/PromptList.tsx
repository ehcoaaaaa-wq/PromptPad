import { Pin, Star } from "lucide-react";
import type { Prompt } from "../types";
import type { PromptSort } from "../lib/prompt-list";

const SORT_OPTIONS: { value: PromptSort; label: string }[] = [
  { value: "default", label: "默认顺序" },
  { value: "updated-desc", label: "最近更新" },
  { value: "updated-asc", label: "最早更新" },
  { value: "title-asc", label: "标题 A→Z" },
  { value: "title-desc", label: "标题 Z→A" },
  { value: "most-used", label: "使用最多" },
  { value: "last-used", label: "最近使用" },
];

export function PromptList({
  prompts,
  selectedId,
  onSelect,
  searchQuery,
  sortOrder,
  onSortOrderChange,
  selectionMode,
  selectedIds,
  allowSelection,
  onToggleSelectionMode,
  onTogglePromptSelection,
  onToggleSelectAll,
  onDeleteSelected,
  onCancelSelection,
}: {
  prompts: Prompt[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  sortOrder: PromptSort;
  onSortOrderChange: (sort: PromptSort) => void;
  selectionMode: boolean;
  selectedIds: string[];
  allowSelection: boolean;
  onToggleSelectionMode: () => void;
  onTogglePromptSelection: (id: string) => void;
  onToggleSelectAll: () => void;
  onDeleteSelected: () => void;
  onCancelSelection: () => void;
}) {
  const allVisibleSelected = prompts.length > 0 && prompts.every((prompt) => selectedIds.includes(prompt.id));
  return (
    <div className="prompt-list-wrap flex flex-col flex-1 min-h-0">
      <div className="prompt-list-toolbar shrink-0">
        {selectionMode ? (
          <>
            <button type="button" onClick={onToggleSelectAll} className="prompt-toolbar-button">
              {allVisibleSelected ? "取消全选" : "全选当前"}
            </button>
            <span className="prompt-selection-count">已选 {selectedIds.length}</span>
            <button type="button" onClick={onDeleteSelected} disabled={selectedIds.length === 0} className="prompt-toolbar-button prompt-delete-button">
              删除
            </button>
            <button type="button" onClick={onCancelSelection} className="prompt-toolbar-button">取消</button>
          </>
        ) : (
          <>
            <label htmlFor="prompt-sort" className="prompt-sort-label">排序</label>
            <select id="prompt-sort" aria-label="模板排序方式" value={sortOrder} onChange={(event) => onSortOrderChange(event.target.value as PromptSort)} className="prompt-sort-select">
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {allowSelection && <button type="button" onClick={onToggleSelectionMode} className="prompt-toolbar-button">多选</button>}
          </>
        )}
      </div>
      {prompts.length === 0 ? (
        <div className="prompt-empty p-4 text-zinc-400 dark:text-zinc-500 text-sm">
          {searchQuery ? "没有匹配的模板" : "还没有模板，点 + 新建一个"}
        </div>
      ) : (
        <ul className="prompt-list overflow-y-auto text-sm flex-1 py-1">
          {prompts.map((p) => {
            const checked = selectedIds.includes(p.id);
            return (
              <li key={p.id} className="px-1.5 flex items-stretch gap-1">
                {selectionMode && <input type="checkbox" aria-label={`选择模板：${p.title || "未命名"}`} checked={checked} onChange={() => onTogglePromptSelection(p.id)} className="prompt-select-checkbox" />}
                <button
                  type="button"
                  onClick={() => selectionMode ? onTogglePromptSelection(p.id) : onSelect(p.id)}
                  aria-pressed={selectionMode ? checked : p.id === selectedId}
                  className={
                    "prompt-row min-w-0 flex-1 text-left px-2.5 py-2 rounded-md transition-colors " +
                    (selectionMode && checked
                      ? "is-active bg-blue-500/10"
                      : p.id === selectedId
                        ? "is-active bg-blue-500/10"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60")
                  }
                >
                  <div className="flex items-center gap-1.5">
                    {p.pinned && <Pin className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                    {p.favorite && <Star className="w-3 h-3 text-rose-500 fill-rose-500 shrink-0" />}
                    <span className={"font-medium truncate flex-1 " + (p.id === selectedId ? "is-active text-blue-600 dark:text-blue-400" : "text-zinc-900 dark:text-zinc-100")}>
                      {p.title || "(未命名)"}
                    </span>
                  </div>
                  {p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.tags.slice(0, 3).map((t) => (
                        <span key={t} className="prompt-tag text-[10.5px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
