'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { acceptFor } from '@/lib/files-ui';
import type { FileSection } from '@/lib/files';

const GENERIC_ERROR = 'Upload mislykkedes. Prøv igen.';

/** Sender præcis tre dele i rækkefølgen section, title, file til /api/filer. Serveren afgør alt; tjek her er kun en hjælp. */
export function UploadForm({ section, maxMb }: { section: FileSection; maxMb: number }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (uploading) return;
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Vælg en fil.');
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setError(`Filen er for stor. Den må højst fylde ${maxMb} MB.`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append('section', section);
      body.append('title', title);
      body.append('file', file);
      const res = await fetch('/api/filer', { method: 'POST', body });
      let data: { ok?: boolean; error?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (res.ok && data?.ok) {
        setTitle('');
        if (fileRef.current) fileRef.current.value = '';
        router.refresh();
      } else {
        setError(data?.error ?? GENERIC_ERROR);
      }
    } catch {
      setError('Upload mislykkedes. Tjek forbindelsen og prøv igen.');
    } finally {
      setUploading(false);
    }
  }

  const id = `upload-${section}`;
  return (
    <form onSubmit={onSubmit} className="card">
      <div className="field">
        <label htmlFor={`${id}-title`}>Titel</label>
        <input
          id={`${id}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          autoComplete="off"
          disabled={uploading}
          placeholder="Tom titel bruger filnavnet"
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-file`}>Fil (højst {maxMb} MB)</label>
        <input id={`${id}-file`} ref={fileRef} type="file" accept={acceptFor(section)} required disabled={uploading} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn" disabled={uploading}>{uploading ? 'Uploader …' : 'Upload'}</button>
    </form>
  );
}
