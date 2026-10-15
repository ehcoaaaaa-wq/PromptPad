import { Pin, Star } from "lucide-react";
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
      <div className="p-4 text-zinc-400 dark:text-zinc-500 text-sm">
        {searchQuery ? "没有匹配的模板" : "还没有模板，点 + 新建一个"}
      </div>
    );
  }
  return (
    <ul className="overflow-y-auto text-sm flex-1 py-1">
      {prompts.map((p) => (
        <li key={p.id} className="px-1.5">
          <button
            type="button"
            onClick={() => onSelect(p.id)}
            className={
              "w-full text-left px-2.5 py-2 rounded-md transition-colors " +
              (p.id === selectedId
                ? "bg-blue-500/10"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60")
            }
          >
            <div className="flex items-center gap-1.5">
              {p.pinned && (
                <Pin className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
              )}
              {p.favorite && (
                <Star className="w-3 h-3 text-rose-500 fill-rose-500 shrink-0" />
              )}
              <span
                className={
                  "font-medium truncate flex-1 " +
                  (p.id === selectedId
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-zinc-900 dark:text-zinc-100")
                }
              >
                {p.title || "(未命名)"}
              </span>
            </div>
            {p.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {p.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="text-[10.5px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
