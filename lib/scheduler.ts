type Options = {
  run: () => Promise<unknown>;
  intervalMs?: number;
  initialDelayMs?: number;
  log?: (message: string, err?: unknown) => void;
};

export function startScheduler(opts: Options): () => void {
  const intervalMs = opts.intervalMs ?? 60 * 60 * 1000;
  const log = opts.log ?? ((m, e) => console.error(m, e));
  let running = false;
  let interval: ReturnType<typeof setInterval> | undefined;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await opts.run();
    } catch (err) {
      log('Planlagt synkronisering fejlede', err);
    } finally {
      running = false;
    }
  };

  const first = setTimeout(() => {
    void tick();
    interval = setInterval(() => void tick(), intervalMs);
    interval.unref?.();
  }, opts.initialDelayMs ?? 30_000);
  first.unref?.();

  return () => {
    clearTimeout(first);
    if (interval) clearInterval(interval);
  };
}
