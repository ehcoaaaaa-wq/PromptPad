import { useMemo } from "react";
import { useStore } from "../store";

export type SidebarSelection =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "tag"; tag: string };

export function Sidebar({
  selection,
  onSelect,
}: {
  selection: SidebarSelection;
  onSelect: (s: SidebarSelection) => void;
}) {
  const store = useStore();

  const tags = useMemo(() => {
    const set = new Set<string>();
    store.prompts.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [store.prompts]);

  return (
    <aside className="w-48 border-r border-zinc-200 dark:border-zinc-800 p-2 overflow-y-auto text-sm shrink-0">
      <div className="font-semibold text-zinc-500 px-2 py-1">视图</div>
      <Item
        label="全部"
        active={selection.kind === "all"}
        onClick={() => onSelect({ kind: "all" })}
        count={store.prompts.length}
      />
      <Item
        label="★ 收藏"
        active={selection.kind === "favorites"}
        onClick={() => onSelect({ kind: "favorites" })}
        count={store.prompts.filter((p) => p.favorite).length}
      />
      <div className="font-semibold text-zinc-500 px-2 py-1 mt-2">标签</div>
      {tags.length === 0 && (
        <div className="px-2 py-1 text-zinc-400 text-xs">暂无标签</div>
      )}
      {tags.map((t) => (
        <Item
          key={t}
          label={t}
          active={selection.kind === "tag" && selection.tag === t}
          onClick={() => onSelect({ kind: "tag", tag: t })}
          count={store.prompts.filter((p) => p.tags.includes(t)).length}
        />
      ))}
    </aside>
  );
}

function Item({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "w-full text-left px-2 py-1 rounded flex items-center justify-between mb-0.5 " +
        (active
          ? "bg-blue-500 text-white"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800")
      }
    >
      <span className="truncate">{label}</span>
      <span className="text-xs opacity-60 ml-2">{count}</span>
    </button>
  );
}
