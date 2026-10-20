import { useMemo } from "react";
import { Star, Pin, Hash } from "lucide-react";
import { useStore } from "../store";

export type SidebarSelection =
  | { kind: "all" }
  | { kind: "experts" }
  | { kind: "personal" }
  | { kind: "favorites" }
  | { kind: "pinned" }
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
    <aside className="w-52 shrink-0 p-2 overflow-y-auto text-sm border-r border-zinc-200 dark:border-zinc-800">
      <SectionTitle>视图</SectionTitle>
      <Item label="内置专家" active={selection.kind === "experts"} onClick={() => onSelect({ kind: "experts" })} count={store.prompts.filter(p => p.origin === "builtin").length} />
      <Item label="我的模板" active={selection.kind === "personal"} onClick={() => onSelect({ kind: "personal" })} count={store.prompts.filter(p => p.origin !== "builtin").length} />
      <Item
        icon={<Hash className="w-3.5 h-3.5" />}
        label="全部"
        active={selection.kind === "all"}
        onClick={() => onSelect({ kind: "all" })}
        count={store.prompts.length}
      />
      <Item
        icon={<Star className="w-3.5 h-3.5" />}
        label="收藏"
        iconClass="text-rose-500 fill-rose-500"
        active={selection.kind === "favorites"}
        onClick={() => onSelect({ kind: "favorites" })}
        count={store.prompts.filter((p) => p.favorite).length}
      />
      <Item
        icon={<Pin className="w-3.5 h-3.5" />}
        label="置顶"
        iconClass="text-amber-500 fill-amber-500"
        active={selection.kind === "pinned"}
        onClick={() => onSelect({ kind: "pinned" })}
        count={store.prompts.filter((p) => p.pinned).length}
      />

      <SectionTitle>标签</SectionTitle>
      {tags.length === 0 && (
        <div className="px-2.5 py-1 text-zinc-400 dark:text-zinc-500 text-xs">
          暂无标签
        </div>
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-2.5 pt-2 pb-1">
      {children}
    </div>
  );
}

function Item({
  label,
  icon,
  iconClass,
  active,
  onClick,
  count,
}: {
  label: string;
  icon?: React.ReactNode;
  iconClass?: string;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 mb-0.5 transition-colors " +
        (active
          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300")
      }
    >
      {icon && <span className={iconClass ?? "text-zinc-400"}>{icon}</span>}
      <span className="truncate flex-1">{label}</span>
      <span
        className={
          "text-[11.5px] " + (active ? "text-blue-500/70" : "text-zinc-400 dark:text-zinc-500")
        }
      >
        {count}
      </span>
    </button>
  );
}
