import { ConfirmForm } from '@/components/ConfirmForm';
import { listMyCharacters } from '@/lib/characters';
import { getDb } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { isSimConfigured } from '@/lib/services';
import { requireMember } from '@/lib/session';
import { listMySims, type SimView } from '@/lib/sims';
import { SOURCE_LABELS, simStatusLabel, visibleWarnings } from '@/lib/sims-ui';
import { deleteSimAction } from './actions';
import { AutoRefresh } from './AutoRefresh';
import { ArmorySimForm } from './ArmorySimForm';
import { SimForm } from './SimForm';
import { SimStyles } from './SimStyles';

export const dynamic = 'force-dynamic';

function SimItem({ sim }: { sim: SimView }) {
  const p = sim.result?.player;
  const detail = p ? [p.className, p.spec, p.level !== null ? `level ${p.level}` : null].filter(Boolean).join(' · ') : '';
  return (
    <li className="sim-item">
      <div className="sim-head">
        <strong>{p?.name ?? 'Simulation'}</strong>
        <span className="badge">{simStatusLabel(sim.status)}</span>
        <span className="muted">Kilde: {SOURCE_LABELS[sim.source]}</span>
        <span className="muted">{formatDateTime(new Date(sim.createdAt))}</span>
      </div>
      {detail && <p className="muted">{detail}</p>}
      {sim.status === 'done' && sim.result && (
        <>
          <SimStyles sim={sim} />
          {sim.result.iterations !== null && <p className="muted">{sim.result.iterations.toLocaleString('da-DK')} gennemløb</p>}
          {visibleWarnings(sim.result.warnings).length > 0 && (
            <ul className="sim-warnings">{visibleWarnings(sim.result.warnings).map((w, i) => <li key={i}>{w}</li>)}</ul>
          )}
          <p className="muted">Vejledende: simulatoren til WoW Forever er ny, og rotationerne er simple. Sammenlign ikke tallene med retail.</p>
        </>
      )}
      {sim.status === 'failed' && <p className="error">{sim.error ?? 'Simulationen fejlede.'}</p>}
      <ConfirmForm action={deleteSimAction} fields={{ simId: sim.id }} label="Slet" confirmText="Slet denne simulation?" />
    </li>
  );
}

export default async function SimPage() {
  const member = await requireMember();
  if (!isSimConfigured()) {
    return (
      <>
        <h1>Skolehjem</h1>
        <section className="card"><p>Simulation er ikke sat op.</p></section>
      </>
    );
  }
  const [sims, mine] = await Promise.all([listMySims(getDb(), member.userId, 10), listMyCharacters(getDb(), member.userId)]);
  const active = sims.some((s) => s.status === 'queued' || s.status === 'running');
  return (
    <>
      <h1>Skolehjem</h1>
      <section className="card">
        <h2>Sim din karakter fra armory</h2>
        <ArmorySimForm characters={mine.map((c) => ({ id: c.id, fullName: c.fullName, className: c.className }))} />
      </section>
      <section className="card">
        <h2>Eller indsæt SimC-tekst</h2>
        <SimForm />
      </section>
      <section className="card">
        <h2>Dine seneste simulationer</h2>
        <AutoRefresh active={active} />
        {sims.length === 0 ? <p className="muted">Ingen simulationer endnu.</p> : <ul className="sim-list">{sims.map((s) => <SimItem key={s.id} sim={s} />)}</ul>}
      </section>
    </>
  );
}
