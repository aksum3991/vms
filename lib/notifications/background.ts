export function enqueueAfter(task: () => Promise<void>): void {
  // Best-effort background execution.
  // In serverless, prefer QStash (see dispatcher.ts) for reliability.
  try {
    queueMicrotask(() => {
      void task();
    });
  } catch {
    setTimeout(() => {
      void task();
    }, 0);
  }
}
