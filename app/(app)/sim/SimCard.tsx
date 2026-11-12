import { ConfirmForm } from '@/components/ConfirmForm';
import { Icon, type IconName } from '@/components/icons';
import { classKey } from '@/lib/character-switcher';
import { formatAbsolute, formatRelativeDay } from '@/lib/posts-ui';
import type { SimStatus } from '@/lib/db/schema';
import type { SimStyleResult, SimView } from '@/lib/sims';
import {
  NO_ROTATION_TEXT, SOURCE_LABELS, STATUS_STEPS, durationText, fightStyleHint, fightStyleName, formatInt, hasNoDps, isActiveStatus,
  itemVerdict, logProgress, percentText, playerDetail, simStatusLabel, statusStep, subjectInitial, visibleWarnings, type PreviousDps, type SimSubject,
} from '@/lib/sims-ui';
import { deleteSimAction } from './actions';
import { SimGear } from './SimGear';
import { SimLog } from './SimLog';

const STATUS_ICON: Record<SimStatus, IconName> = { queued: 'ur', running: 'sim', done: 'deltager', failed: 'udraab' };

function StatusPill({ status }: { status: SimStatus }) {
  return (
    <span className={`sim-status sim-status-${status}`} role="status">
      {status === 'running' ? <span className="sim-spinner" aria-hidden="true" /> : <Icon name={STATUS_ICON[status]} size={16} />}
      {simStatusLabel(status)}
    </span>
  );
}

/** Kø → Kører → Færdig som tre trin; det aktuelle er fremhævet, og teksten bærer meningen (ikke kun farven). */
function Steps({ status }: { status: SimStatus }) {
  const step = statusStep(status);
  return (
    <ol className="sim-steps" aria-label="Forløb">
      {STATUS_STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? 'done' : n === step ? 'current' : 'todo';
        return (
          <li key={label} className={`sim-step sim-step-${state}`} aria-current={n === step ? 'step' : undefined}>
            <span className="sim-step-dot" aria-hidden="true">{n < step ? '✓' : n}</span>
            {n === step && status === 'failed' ? 'Fejlede' : label}
          </li>
        );
      })}
    </ol>
  );
}

function Progress({ sim }: { sim: SimView }) {
  const p = logProgress(sim.log, sim.fightStyles.length);
  if (sim.status === 'queued') return <p className="muted sim-progress-text">Simulatoren tager jobbene ét ad gangen. Siden opdaterer sig selv.</p>;
  const pct = p ? Math.round(p.fraction * 100) : 0;
  return (
    <div className="sim-progress">
      <div className="sim-bar" role="progressbar" aria-label="Fremdrift" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={p ? `${pct} %: ${p.text}` : 'starter'}>
        <div className="sim-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="muted sim-progress-text">{p ? `${p.text} · ${pct} %` : 'Starter SimulationCraft …'}</p>
    </div>
  );
}

function DpsTile({ style, previous, single }: { style: SimStyleResult; previous: PreviousDps | null; single: boolean }) {
  const name = fightStyleName(style.fightStyle);
  const hint = fightStyleHint(style.fightStyle);
  return (
    <div className={single ? 'dps-tile dps-single' : 'dps-tile'}>
      <p className="dps-style">
        <Icon name={style.fightStyle === 'DungeonSlice' ? 'gruppe' : 'person'} size={18} />
        <span>{name}</span>
        {hint && <span className="muted">{hint}</span>}
      </p>
      {hasNoDps(style) ? (
        <p className="dps-none">{NO_ROTATION_TEXT}</p>
      ) : style.dps ? (
        <>
          <p className="dps-value">
            <span className="dps-number">{formatInt(style.dps.mean)}</span>
            <span className="dps-unit">DPS</span>
            {style.dps.meanStdDev !== null && <span className="dps-err muted">± {formatInt(style.dps.meanStdDev)}</span>}
          </p>
          {previous && <PreviousLine previous={previous} />}
        </>
      ) : (
        <p className="error"><Icon name="udraab" size={16} /> {style.error ?? 'Kampstilen kunne ikke simuleres.'}</p>
      )}
    </div>
  );
}

function PreviousLine({ previous }: { previous: PreviousDps }) {
  const v = itemVerdict({ deltaPercent: previous.deltaPercent });
  return (
    <p className={`dps-prev gear-${v}`}>
      <Icon name={v === 'upgrade' ? 'op' : v === 'downgrade' ? 'ned' : 'streg'} size={14} />
      <span>
        {v === 'neutral' ? 'Uændret' : percentText(previous.deltaPercent)} siden sidst ({formatInt(previous.mean)} DPS,{' '}
        <time dateTime={previous.createdAt}>{formatAbsolute(new Date(previous.createdAt))}</time>)
      </span>
    </p>
  );
}

export function SimCard({ sim, subject, previous, now }: { sim: SimView; subject: SimSubject; previous: Partial<Record<string, PreviousDps | null>>; now: Date }) {
  const active = isActiveStatus(sim.status);
  const detail = playerDetail(subject);
  const title = subject.name ?? (sim.source === 'simc' ? 'Simulation fra SimC-tekst' : 'Simulation');
  const cls = classKey(subject.className ?? '');
  const created = new Date(sim.createdAt);
  const result = sim.result;
  const notes = [...sim.notices, ...(result ? visibleWarnings(result.warnings) : [])];
  const meta = [
    SOURCE_LABELS[sim.source],
    result?.iterations !== null && result?.iterations !== undefined ? `${formatInt(result.iterations)} gennemløb` : null,
    result ? durationText(result.elapsedMs) : null,
  ].filter((x): x is string => x !== null);
  return (
    <li>
      <article className={`card sim-card sim-card-${sim.status}`} aria-labelledby={`sim-${sim.id}-h`}>
        <header className="sim-card-head">
          <span className={`sim-avatar cs-cls-${cls}`} aria-hidden="true">{subjectInitial(subject.name)}</span>
          <div className="sim-card-title">
            <h3 id={`sim-${sim.id}-h`}>{title}</h3>
            <p className="muted sim-card-meta">
              {detail && <span>{detail}</span>}
              <span>{meta.join(' · ')}</span>
              <time dateTime={sim.createdAt} title={formatAbsolute(created)}>{formatRelativeDay(created, now)}</time>
            </p>
          </div>
          <StatusPill status={sim.status} />
        </header>

        {active && (
          <div className="sim-running">
            <Steps status={sim.status} />
            <Progress sim={sim} />
          </div>
        )}

        {sim.status === 'failed' && (
          <p className="sim-failed" role="alert">
            <Icon name="udraab" size={20} />
            <span><strong>Simulationen fejlede.</strong> {sim.error ?? ''} Sker det igen, så skriv i Beskeder.</span>
          </p>
        )}

        {sim.status === 'done' && result && (
          <div className={result.styles.length > 1 ? 'dps-grid dps-grid-2' : 'dps-grid'}>
            {result.styles.map((s) => <DpsTile key={s.fightStyle} style={s} previous={previous[s.fightStyle] ?? null} single={result.styles.length === 1} />)}
          </div>
        )}

        {sim.status === 'done' && <SimGear sim={sim} />}

        {notes.length > 0 && (
          <ul className="sim-notes" aria-label="Bemærkninger">
            {notes.map((n, i) => <li key={i} className="sim-note"><Icon name="udraab" size={18} /><span>{n}</span></li>)}
          </ul>
        )}

        <footer className="sim-card-foot">
          <SimLog text={sim.log} active={active} />
          <ConfirmForm action={deleteSimAction} fields={{ simId: sim.id }} label="Slet" confirmText="Slet denne simulation?" />
        </footer>
      </article>
    </li>
  );
}
