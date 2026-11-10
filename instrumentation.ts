export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const g = globalThis as unknown as { __aulaStarted?: boolean };
  if (g.__aulaStarted) return;
  g.__aulaStarted = true;

  const { env } = await import('@/lib/env');
  const config = env();

  const { uploadDirWarning } = await import('@/lib/files-ui');
  const warning = uploadDirWarning(process.env.NODE_ENV, config.UPLOAD_DIR);
  if (warning) console.warn(warning);
  try {
    const { filesDeps } = await import('@/lib/services');
    const { cleanupStaleUploads } = await import('@/lib/files');
    const removed = await cleanupStaleUploads(filesDeps().uploadDir, new Date(), 60 * 60 * 1000);
    if (removed > 0) console.log(`Ryddede ${removed} efterladte uploadfiler`);
  } catch (err) {
    console.error('Oprydning af uploadmappen mislykkedes', err);
  }

  if (config.AUTO_MIGRATE) {
    const { getDb } = await import('@/lib/db');
    const { runMigrations } = await import('@/lib/db/migrate');
    await runMigrations(getDb());
    console.log('Migrationer kørt');
  }

  if (config.SIMC_WORKER_URL) {
    try {
      const { getDb } = await import('@/lib/db');
      const { resetStaleRunning } = await import('@/lib/sims');
      const { kickSimQueue } = await import('@/lib/services');
      const reset = await resetStaleRunning(getDb());
      if (reset > 0) console.log(`Lagde ${reset} hængende simulationer tilbage i køen`);
      kickSimQueue();
    } catch (err) {
      console.error('Opstart af sim-køen mislykkedes', err);
    }
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
