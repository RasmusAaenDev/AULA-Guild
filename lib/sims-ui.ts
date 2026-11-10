import type { SimStatus } from '@/lib/db/schema';
import type { SimResult } from '@/lib/sims';

export function simStatusLabel(status: SimStatus): string {
  switch (status) {
    case 'queued': return 'Venter i kø';
    case 'running': return 'Kører';
    case 'done': return 'Færdig';
    default: return 'Fejlede';
  }
}

const int = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });

/** «DPS ≈ 1.234 ± 12» (da-DK, kun heltal). */
export function simDpsLabel(r: Pick<SimResult, 'dps'>): string {
  const base = `DPS ≈ ${int.format(r.dps.mean)}`;
  return r.dps.meanStdDev !== null ? `${base} ± ${int.format(r.dps.meanStdDev)}` : base;
}
