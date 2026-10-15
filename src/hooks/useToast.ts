// Toast notifications — push to global queue, auto-expire after 3s.

import { useEffect, useState } from "react";

export type ToastKind = "info" | "success" | "error";
export type Toast = { id: number; kind: ToastKind; message: string };

let seq = 0;
let toasts: Toast[] = [];
const listeners = new Set<() => void>();

export function pushToast(kind: ToastKind, message: string): void {
  const id = ++seq;
  toasts = [...toasts, { id, kind, message }];
  listeners.forEach((l) => l());
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    listeners.forEach((l) => l());
  }, 3000);
}

export function useToasts(): Toast[] {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return toasts;
}
