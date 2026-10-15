export function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      placeholder="搜索标题、内容或标签..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}
