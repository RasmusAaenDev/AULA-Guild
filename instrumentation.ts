export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const g = globalThis as unknown as { __aulaStarted?: boolean };
  if (g.__aulaStarted) return;
  g.__aulaStarted = true;

  const { env } = await import('@/lib/env');
  const config = env();

  if (config.AUTO_MIGRATE) {
    const { getDb } = await import('@/lib/db');
    const { runMigrations } = await import('@/lib/db/migrate');
    await runMigrations(getDb());
    console.log('Migrationer kørt');
  }

  if (config.SYNC_ENABLED) {
    const { startScheduler } = await import('@/lib/scheduler');
    const { runScheduledJobs } = await import('@/lib/services');
    startScheduler({
      run: async () => {
        const r = await runScheduledJobs();
        console.log('Planlagte jobs', r);
      },
    });
    console.log('Time-planlægger startet');
  }
}
