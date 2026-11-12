import { Icon } from '@/components/icons';
import type { SimView } from '@/lib/sims';
import { fightStyleName, lastLogLine, logProgress, pickStreamerJob, simStatusLabel, type SimSubject } from '@/lib/sims-ui';

/**
 * Kompakt live-linje i «Ny simulation»-panelet, mens noget venter eller kører: status (role="status"), karakter og
 * kampstil, fremdriftsbjælke og seneste logbid. Opdateres af sidens polling (AutoRefresh) hvert 2. sekund.
 * Kun status-delen er en live-region, så fremdriftstallene ikke læses op hvert 2. sekund.
 */
export function SimStreamer({ sims, subjects }: { sims: SimView[]; subjects: SimSubject[] }) {
  const pick = pickStreamerJob(sims);
  if (!pick) return null;
  const { job, queued } = pick;
  const subject = subjects[sims.indexOf(job)];
  const name = subject?.name ?? (job.source === 'simc' ? 'SimC-tekst' : 'Simulation');
  const styles = job.fightStyles.map(fightStyleName).join(' + ');
  const p = job.status === 'running' ? logProgress(job.log, job.fightStyles.length) : null;
  const pct = p ? Math.round(p.fraction * 100) : 0;
  const line = job.status === 'running' ? lastLogLine(job.log, 70) : null;
  return (
    <div className={`sim-streamer sim-streamer-${job.status}`}>
      <p className="sim-streamer-status" role="status">
        {job.status === 'running' ? <span className="sim-spinner" aria-hidden="true" /> : <Icon name="ur" size={16} />}
        <strong>{simStatusLabel(job.status)}</strong>
        <span className="sim-streamer-who">{name} · {styles}</span>
        {queued > 0 && <span className="badge">+{queued} i kø</span>}
        <a className="sim-streamer-link" href={`#sim-${job.id}`}>Se kortet{' '}<span aria-hidden="true">↓</span></a>
      </p>
      {job.status === 'running' && (
        <div className="sim-bar sim-streamer-bar" role="progressbar" aria-label="Fremdrift" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={p ? `${pct} %: ${p.text}` : 'starter'}>
          <div className="sim-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className="sim-streamer-line muted">
        {job.status === 'running' ? <>{p ? `${p.text} · ${pct} %` : 'Starter SimulationCraft …'}{line && <code>{line}</code>}</> : 'Simulatoren tager jobbene ét ad gangen.'}
      </p>
    </div>
  );
}
