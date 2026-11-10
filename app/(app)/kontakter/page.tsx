import { unlinkAction } from '@/app/(app)/actions';
import { listContacts } from '@/lib/characters';
import { getDb } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { roleLabel } from '@/lib/messages';
import { requireMember } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
  const member = await requireMember();
  const contacts = await listContacts(getDb());
  return (
    <>
      <h1>Kontakter</h1>
      <div className="card table-wrap">
        {contacts.length === 0 ? (
          <p>Ingen karakterer endnu.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Karakter</th><th>Spiller</th><th>Klasse</th><th>Rolle</th>
                <th>Item level</th><th>Rang</th><th>Sidst synkroniseret</th>
                {member.isOfficer && <th />}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className={c.inGuild ? undefined : 'left-guild'}>
                  <td>
                    <strong>{c.fullName}</strong>
                    {!c.inGuild && <> <span className="badge">forladt guild</span></>}
                  </td>
                  <td>{c.ownerName}</td>
                  <td>{c.className}{c.spec ? ` (${c.spec})` : ''}</td>
                  <td>{roleLabel(c.role)}</td>
                  <td>{c.itemLevel ?? '–'}</td>
                  <td>{c.guildRank ?? '–'}</td>
                  <td>{formatDateTime(c.lastSynced)}</td>
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
