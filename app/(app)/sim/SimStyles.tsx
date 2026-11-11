import type { SimItemResult, SimStyleResult, SimView } from '@/lib/sims';
import { TOP_UPGRADES, fightStyleLabel, itemVerdict, percentText, rankItems, simDpsLabel, slotLabel, VERDICT_TEXT } from '@/lib/sims-ui';

function GearRow({ item }: { item: SimItemResult }) {
  const v = itemVerdict(item);
  if (v === 'error' || item.deltaPercent === null) return null;
  const cls = v === 'upgrade' ? 'up' : v === 'downgrade' ? 'down' : 'flat';
  return (
    <li>
      <span className="sim-gear-name">{item.label}</span>
      <span className="sim-gear-slot">{slotLabel(item.slot)}</span>
      <span className={cls}>
        {percentText(item.deltaPercent)} · {VERDICT_TEXT[v]}
      </span>
    </li>
  );
}

function StyleBlock({ style, optimized }: { style: SimStyleResult; optimized: boolean }) {
  const { ranked, failed } = rankItems(style.items);
  const top = ranked.filter((i) => itemVerdict(i) === 'upgrade').slice(0, TOP_UPGRADES);
  return (
    <div className="sim-style">
      <h3>{fightStyleLabel(style.fightStyle)}</h3>
      {style.dps ? <p className="sim-dps">{simDpsLabel({ dps: style.dps })}</p> : <p className="error">{style.error ?? 'Kampstilen kunne ikke simuleres.'}</p>}
      {style.dps && optimized && (
        <>
          {ranked.length === 0 ? (
            <p className="muted">Ingen genstande kunne sammenlignes.</p>
          ) : (
            <>
              {top.length === 0 ? <p>Ingen opgraderinger fundet i dine tasker.</p> : <ul className="sim-gear" aria-label="Bedste opgraderinger">{top.map((i) => <GearRow key={`${i.index}-${i.slot}`} item={i} />)}</ul>}
              {ranked.length > top.length && (
                <details className="sim-all">
                  <summary>Vis alle ({ranked.length})</summary>
                  <ul className="sim-gear">{ranked.map((i) => <GearRow key={`${i.index}-${i.slot}`} item={i} />)}</ul>
                </details>
              )}
            </>
          )}
          {failed.length > 0 && (
            <>
              <p className="muted">Kunne ikke simuleres:</p>
              <ul className="sim-gear">
                {failed.map((i) => (
                  <li key={`${i.index}-${i.slot}`}>
                    <span className="sim-gear-name">{i.label}</span>
                    <span className="sim-gear-slot">{slotLabel(i.slot)}</span>
                    <span className="muted">kunne ikke simuleres</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function SimStyles({ sim }: { sim: SimView }) {
  const result = sim.result;
  if (!result) return null;
  const optimized = result.styles.some((s) => s.items.length > 0);
  const { requested, found, ignored, truncated } = sim.bags;
  return (
    <>
      {result.styles.map((s) => <StyleBlock key={s.fightStyle} style={s} optimized={optimized} />)}
      {requested && found === 0 && <p className="muted">Ingen genstande fundet i «Gear from Bags» i din tekst, så der blev ikke søgt efter bedre gear.</p>}
      {requested && found > 0 && (
        <p className="muted">
          {found} genstande fra dine tasker blev testet{ignored > 0 ? `, ${ignored} blev ignoreret` : ''}
          {truncated > 0 ? ` (højst 40 testes ad gangen)` : ''}.
        </p>
      )}
      {optimized && (
        <p className="muted">Hver genstand er testet alene i stedet for dit nuværende udstyr i samme plads. Kombinationer af flere skift er ikke testet.</p>
      )}
    </>
  );
}
