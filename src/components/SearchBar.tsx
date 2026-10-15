import { Search } from "lucide-react";

export function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative w-full">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
      <input
        type="text"
        placeholder="搜索"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-8 pr-3 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800/60 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
      />
    </div>
  );
}
