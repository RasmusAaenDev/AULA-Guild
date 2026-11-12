import { Icon } from '@/components/icons';
import type { FightStyle, SimItemResult, SimView } from '@/lib/sims';
import { comparableRows, fightStyleName, itemVerdict, mergeGearRows, percentText, slotLabel, upgradeRows, VERDICT_TEXT, type GearRow } from '@/lib/sims-ui';

/** Én celle: pil + procent + ordet (aldrig kun farve). */
function Cell({ item, styleName, showStyle }: { item: SimItemResult | undefined; styleName: string; showStyle: boolean }) {
  if (!item) return <span className="gear-cell muted">{showStyle && <span className="gear-cell-style">{styleName}</span>}–</span>;
  const v = itemVerdict(item);
  if (v === 'error' || item.deltaPercent === null) {
    return <span className="gear-cell muted">{showStyle && <span className="gear-cell-style">{styleName}</span>}kunne ikke simuleres</span>;
  }
  return (
    <span className={`gear-cell gear-${v}`}>
      {showStyle && <span className="gear-cell-style">{styleName}</span>}
      <Icon name={v === 'upgrade' ? 'op' : v === 'downgrade' ? 'ned' : 'streg'} size={16} />
      <strong>{percentText(item.deltaPercent)}</strong>
      <span className="gear-word">{VERDICT_TEXT[v]}</span>
    </span>
  );
}

function Row({ row, styles, best }: { row: GearRow; styles: FightStyle[]; best: boolean }) {
  return (
    <li className={best ? 'gear-row gear-best' : 'gear-row'}>
      <span className="gear-name">
        {best && <span className="gear-best-tag">Bedste opgradering</span>}
        <strong>{row.label}</strong>
        <span className="muted"> · {slotLabel(row.slot)}</span>
      </span>
      {styles.map((s) => <Cell key={s} item={row.cells[s]} styleName={fightStyleName(s)} showStyle={styles.length > 1} />)}
    </li>
  );
}

/**
 * Gear-opgraderinger fra taskerne, én række pr. genstand med resultatet i hver kampstil side om side.
 * Først de bedste opgraderinger (højst 10), resten bag «Vis alle».
 */
export function SimGear({ sim }: { sim: SimView }) {
  const result = sim.result;
  if (!result) return null;
  const withItems = result.styles.filter((s) => s.items.length > 0 && s.dps && s.dps.mean > 0);
  const { requested, found, ignored, truncated } = sim.bags;
  if (requested && found === 0) {
    return <p className="sim-note"><Icon name="udraab" size={18} /><span>Ingen genstande fundet i «Gear from Bags» i din tekst, så der blev ikke søgt efter bedre gear.</span></p>;
  }
  if (withItems.length === 0) return null;
  const styles = withItems.map((s) => s.fightStyle);
  const rows = mergeGearRows(withItems);
  const comparable = comparableRows(rows);
  const top = upgradeRows(rows);
  const failed = rows.length - comparable.length;
  const tested = `${found} ${found === 1 ? 'genstand' : 'genstande'} fra taskerne testet${ignored > 0 ? `, ${ignored} ignoreret` : ''}${truncated > 0 ? ' (højst 40 ad gangen)' : ''}`;
  return (
    <section className="sim-gear" aria-labelledby={`gear-${sim.id}`}>
      <div className="sim-gear-head">
        <h3 id={`gear-${sim.id}`}>Bedre gear i taskerne</h3>
        <span className="muted">{tested}</span>
      </div>
      {comparable.length === 0 ? (
        <p className="muted">Ingen af genstandene kunne sammenlignes.</p>
      ) : top.length === 0 ? (
        <p className="sim-gear-none"><Icon name="deltager" size={18} /><span>Ingen opgraderinger: det, du har på, er bedst i {styles.length > 1 ? 'begge kampstile' : 'denne kampstil'}.</span></p>
      ) : (
        <ul className="gear-list" data-cols={styles.length} aria-label="Bedste opgraderinger">
          {top.map((r, i) => <Row key={r.key} row={r} styles={styles} best={i === 0} />)}
        </ul>
      )}
      {rows.length > top.length && (
        <details className="sim-all">
          <summary>Vis alle {rows.length} genstande{failed > 0 ? ` (${failed} kunne ikke simuleres)` : ''}</summary>
          <ul className="gear-list" data-cols={styles.length}>
            {rows.map((r) => <Row key={r.key} row={r} styles={styles} best={false} />)}
          </ul>
        </details>
      )}
      <p className="muted sim-gear-foot">Hver genstand er testet alene i stedet for det, du har på i samme plads; kombinationer er ikke testet.</p>
    </section>
  );
}
