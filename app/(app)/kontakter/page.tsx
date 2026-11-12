import { unlinkAction } from '@/app/(app)/actions';
import { listContacts } from '@/lib/characters';
import { getDb } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { roleLabel } from '@/lib/messages';
import { armoryUrl } from '@/lib/armory';
import { QuickSim } from '@/components/QuickSim';
import { isSimConfigured } from '@/lib/services';
import { requireUser } from '@/lib/session';
import { GuildStar } from '@/components/GuildStar';
import { VerifiedMark } from '@/components/VerifiedMark';
import { RefreshButton } from './RefreshButton';

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
  const member = await requireUser();
  const contacts = await listContacts(getDb());
  const simEnabled = isSimConfigured();
  return (
    <>
      <div className="section-head">
        <h1>Kontakter</h1>
        <RefreshButton />
      </div>
      <p className="muted">
        <GuildStar /> = i guilden · <VerifiedMark verified /> = verificeret (står på spillerens Battle.net-konto) ·{' '}
        «ikke verificeret» = tilføjet med navn; tæller ikke til guild-medlemskab eller officer-rang.
      </p>
      <div className="card table-wrap">
        {contacts.length === 0 ? (
          <p>Ingen karakterer endnu.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Karakter</th><th>Spiller</th><th>Klasse</th><th>Rolle</th>
                <th>Level</th><th>Item level</th><th>Rang</th><th>Sidst synkroniseret</th>
                {simEnabled && <th>Simulér</th>}
                {member.isOfficer && <th />}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{armoryUrl(c.slug) ? <a href={armoryUrl(c.slug)!} target="_blank" rel="noopener noreferrer" title="Åbn i WoW-armory">{c.fullName}</a> : c.fullName}</strong>
                    {c.inGuild && <GuildStar />}
                    <VerifiedMark verified={c.verified} />
                  </td>
                  <td>{c.ownerName}</td>
                  <td>{c.className}{c.spec ? ` (${c.spec})` : ''}</td>
                  <td>{roleLabel(c.role)}</td>
                  <td>{c.level ?? '–'}</td>
                  <td>{c.itemLevel ?? '–'}</td>
                  <td>{c.guildRank ?? '–'}</td>
                  <td>{formatDateTime(c.lastSynced)}</td>
                  {simEnabled && <td>{c.ownerId === member.userId ? <QuickSim characterId={c.id} /> : <span className="muted">–</span>}</td>}
                  {member.isOfficer && (
                    <td>
                      <form action={unlinkAction}>
                        <input type="hidden" name="characterId" value={c.id} />
                        <button type="submit" className="btn danger">Frakobl</button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
