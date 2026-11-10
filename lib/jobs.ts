import type { SyncResult } from '@/lib/sync';

export type JobsResult = {
  sync: SyncResult | { error: string };
  series: { created: number } | { error: string };
};

type Deps = {
  sync: () => Promise<SyncResult>;
  generate: () => Promise<{ created: number }>;
  log?: (message: string, err?: unknown) => void;
};

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Kører synkronisering og seriegenerator hver for sig, så den ene aldrig blokerer den anden. */
export async function runJobs(deps: Deps): Promise<JobsResult> {
  const log = deps.log ?? ((m, e) => console.error(m, e));
  let sync: JobsResult['sync'];
  try {
    sync = await deps.sync();
  } catch (err) {
    log('Roster-synkronisering fejlede', err);
    sync = { error: message(err) };
  }
  let series: JobsResult['series'];
  try {
    series = await deps.generate();
  } catch (err) {
    log('Seriegenerator fejlede', err);
    series = { error: message(err) };
  }
  return { sync, series };
}
