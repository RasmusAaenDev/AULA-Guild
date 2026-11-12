import { getDb } from '@/lib/db';
import { env } from '@/lib/env';
import { listFiles } from '@/lib/files';
import { fileTypeLabel, formatBytes, formatFileDate } from '@/lib/files-ui';
import { requireGuildMember } from '@/lib/session';
import { ConfirmForm } from '@/components/ConfirmForm';
import { UploadForm } from '@/components/UploadForm';
import { deleteFileAction } from './actions';
import { FilePinForm } from './FilePinForm';

export const dynamic = 'force-dynamic';

export default async function FilesPage() {
  const member = await requireGuildMember();
  const items = await listFiles(getDb(), 'filer');
  return (
    <>
      <h1>Filer</h1>
      <UploadForm section="filer" maxMb={env().MAX_UPLOAD_MB} />
      {items.length === 0 ? (
        <section className="card"><p className="muted">Der er ingen filer endnu.</p></section>
      ) : (
        <section className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Titel</th><th>Type</th><th>Størrelse</th><th>Uploadet af</th><th>Dato</th><th><span className="sr-only">Handlinger</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => {
                const canDelete = member.isOfficer || f.uploadedBy === member.userId;
                return (
                  <tr key={f.id}>
                    <td>
                      <a href={`/api/filer/${f.id}`}>{f.title}</a>
                      {f.pinned && <> <span className="badge">Fastgjort</span></>}
                    </td>
                    <td>{fileTypeLabel(f.mime)}</td>
                    <td>{formatBytes(f.sizeBytes)}</td>
                    <td>{f.uploaderName}</td>
                    <td>{formatFileDate(f.createdAt)}</td>
                    <td>
                      <div className="actions">
                        <a className="btn secondary" href={`/api/filer/${f.id}`}>Hent</a>
                        {member.isOfficer && <FilePinForm fileId={f.id} pinned={f.pinned} />}
                        {canDelete && (
                          <ConfirmForm
                            action={deleteFileAction}
                            fields={{ fileId: f.id }}
                            label="Slet"
                            confirmText={`Slet «${f.title}»? Det kan ikke fortrydes.`}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
