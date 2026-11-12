import Link from 'next/link';
import { deletePostAction } from '@/app/(app)/opslag/actions';
import { BookmarkButton } from '@/app/(app)/opslag/BookmarkButton';
import { ConfirmForm } from '@/components/ConfirmForm';
import type { PostListItem } from '@/lib/posts';
import { authorLabel, excerptText, formatAbsolute, formatRelativeDay } from '@/lib/posts-ui';

/**
 * Kortet for et ægte opslag i Overblik. Bruges både af siden og af «Indlæs flere» (server action),
 * så der kun er én kopi af markup'en.
 */
export function PostCard({ post: p, now, canDelete }: { post: PostListItem; now: Date; canDelete: boolean }) {
  return (
    <article className={p.unread ? 'card post-card unread' : 'card post-card'} data-post-id={p.id}>
      {(p.pinned || p.unread) && (
        <p className="post-badges">
          {p.pinned && <span className="badge">Vigtig</span>}
          {p.unread && <span className="badge new">Ny</span>}
        </p>
      )}
      <div className="post-head">
        <p className="post-meta">
          <strong>{authorLabel(p.authorName, p.authorCharacterFullName)}</strong>
          <span className="muted">Delt med hele guilden</span>
          <time className="muted" dateTime={p.createdAt.toISOString()} title={formatAbsolute(p.createdAt)}>
            {formatRelativeDay(p.createdAt, now)}
          </time>
        </p>
        <BookmarkButton postId={p.id} bookmarked={p.bookmarked} />
      </div>
      <h3><Link href={`/opslag/${p.id}`}>{p.title}</Link></h3>
      <p className="excerpt">{excerptText(p.excerpt)}</p>
      <p className="muted">{p.commentCount === 1 ? '1 kommentar' : `${p.commentCount} kommentarer`}</p>
      {canDelete && (
        <div className="actions">
          <ConfirmForm
            action={deletePostAction}
            fields={{ postId: p.id }}
            label="Slet opslag"
            confirmText="Slet opslaget og dets kommentarer? Det kan ikke fortrydes."
          />
        </div>
      )}
    </article>
  );
}
