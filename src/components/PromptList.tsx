import type { Prompt } from "../types";

export function PromptList({
  prompts,
  selectedId,
  onSelect,
  searchQuery,
}: {
  prompts: Prompt[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
}) {
  if (prompts.length === 0) {
    return (
      <div className="p-4 text-zinc-400 text-sm">
        {searchQuery ? "没有匹配的模板" : "还没有模板，点 + 新建一个"}
      </div>
    );
  }
  return (
    <ul className="overflow-y-auto text-sm flex-1">
      {prompts.map((p) => (
        <li
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={
            "px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 cursor-pointer " +
            (p.id === selectedId
              ? "bg-blue-50 dark:bg-blue-900/30"
              : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50")
          }
        >
          <div className="flex items-center gap-1">
            {p.pinned && <span className="text-amber-500 text-xs">📌</span>}
            {p.favorite && <span className="text-rose-500 text-xs">★</span>}
            <span className="font-medium truncate flex-1">
              {p.title || "(未命名)"}
            </span>
          </div>
          {p.tags.length > 0 && (
            <div className="text-xs text-zinc-500 mt-0.5 truncate">
              {p.tags.map((t) => "#" + t).join(" ")}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
