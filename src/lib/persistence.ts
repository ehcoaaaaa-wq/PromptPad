// Publish state only after a successful write; failed updates leave it unchanged.
export function createPersistence<T>(initial: T, write: (value: T) => Promise<void>, notify: () => void) {
  let state = initial;
  let ready = false;
  let queue: Promise<void> = Promise.resolve();
  let lastError: unknown = null;
  return {
    get: () => state,
    initialize(value: T) {
      state = value;
      ready = true;
      notify();
    },
    update(updater: (value: T) => T, onCommit?: (previous: T, next: T) => void): Promise<void> {
      if (!ready) return Promise.reject(new Error("模板库尚未成功读取，已禁止写入"));
      const operation = queue.then(async () => {
        const next = updater(state);
        await write(next);
        onCommit?.(state, next);
        state = next;
        notify();
      });
      queue = operation.then(() => { lastError = null; }, (error) => { lastError = error; });
      return operation;
    },
    async flush() {
      await queue;
      if (lastError) throw lastError;
    },
  };
}
