import { getDb } from '@/lib/db';
import { env } from '@/lib/env';
import { listFiles } from '@/lib/files';
import { requireMember } from '@/lib/session';
import { ConfirmForm } from '@/components/ConfirmForm';
import { UploadForm } from '@/components/UploadForm';
import { deleteFileAction } from '../filer/actions';

export const dynamic = 'force-dynamic';

export default async function GalleryPage() {
  const member = await requireMember();
  const items = await listFiles(getDb(), 'galleri');
  return (
    <>
      <h1>Galleri</h1>
      <UploadForm section="galleri" maxMb={env().MAX_UPLOAD_MB} />
      {items.length === 0 ? (
        <section className="card"><p className="muted">Der er ingen billeder endnu.</p></section>
      ) : (
        <ul className="gallery">
          {items.map((f) => {
            const canDelete = member.isOfficer || f.uploadedBy === member.userId;
            return (
              <li key={f.id} className="gallery-item">
                <a href={`/api/filer/${f.id}`} target="_blank" rel="noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/filer/${f.id}`} alt={f.title} loading="lazy" />
                </a>
                <div className="gallery-caption">
                  <strong>{f.title}</strong>
                  <span className="muted">{f.uploaderName}</span>
                </div>
                {canDelete && (
                  <ConfirmForm
                    action={deleteFileAction}
                    fields={{ fileId: f.id }}
                    label="Slet"
                    confirmText={`Slet «${f.title}»? Det kan ikke fortrydes.`}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
