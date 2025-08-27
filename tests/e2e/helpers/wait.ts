export async function waitFor<T>(fn: () => Promise<T>, predicate: (x: T) => boolean, opts?: { timeoutMs?: number, intervalMs?: number }) {
  const timeout = opts?.timeoutMs ?? 4000;
  const interval = opts?.intervalMs ?? 100;
  const start = Date.now();
  while (true) {
    const value = await fn();
    if (predicate(value)) return value;
    if (Date.now() - start > timeout) throw new Error('waitFor: timeout');
    await new Promise(res => setTimeout(res, interval));
  }
}