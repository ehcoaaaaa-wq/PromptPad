import { useToasts } from "../hooks/useToast";

export function ToastList() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={
            "px-4 py-2 rounded-xl shadow-lg text-[13px] font-medium animate-in fade-in slide-in-from-bottom-2 " +
            (t.kind === "success"
              ? "bg-emerald-500 text-white"
              : t.kind === "error"
                ? "bg-rose-500 text-white"
                : "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900")
          }
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
