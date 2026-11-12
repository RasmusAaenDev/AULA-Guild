import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmForm } from '@/components/ConfirmForm';
import { getDb } from '@/lib/db';
import { parseId } from '@/lib/parse';
import { getPost } from '@/lib/posts';
import { authorLabel, formatAbsolute } from '@/lib/posts-ui';
import { requireUser } from '@/lib/session';
import { deleteCommentAction, deletePostAction } from '../actions';
import { BookmarkButton } from '../BookmarkButton';
import { CommentForm } from '../CommentForm';
import { MarkRead } from '../MarkRead';
import { PinForm } from '../PinForm';

export const dynamic = 'force-dynamic';

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const member = await requireUser();
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) notFound();
  const post = await getPost(getDb(), member.userId, id);
  if (!post) notFound();
  const canDelete = member.isOfficer || post.authorId === member.userId;

  return (
    <>
      <MarkRead postId={post.id} unread={post.unread} />
      <h1>{post.title}</h1>
      <section className="card">
        <div className="post-head">
          <p className="muted">
            {post.pinned && <span className="badge">Vigtig</span>} {authorLabel(post.authorName, post.authorCharacterFullName)} · {formatAbsolute(post.createdAt)}
          </p>
          <BookmarkButton postId={post.id} bookmarked={post.bookmarked} />
        </div>
        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{post.body}</p>
        {(canDelete || member.isOfficer) && (
          <div className="actions">
            {member.isOfficer && <PinForm postId={post.id} pinned={post.pinned} />}
            {canDelete && (
              <ConfirmForm
                action={deletePostAction}
                fields={{ postId: post.id }}
                label="Slet opslag"
                confirmText="Slet opslaget og dets kommentarer? Det kan ikke fortrydes."
              />
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Kommentarer ({post.comments.length})</h2>
        {post.comments.length === 0 && <p className="muted">Ingen kommentarer endnu.</p>}
        {post.comments.map((c) => (
          <div key={c.id} className="comment">
            <p className="muted">{authorLabel(c.authorName, c.authorCharacterFullName)} · {formatAbsolute(c.createdAt)}</p>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.body}</p>
            {(member.isOfficer || c.authorId === member.userId) && (
              <ConfirmForm
                action={deleteCommentAction}
                fields={{ postId: post.id, commentId: c.id }}
                label="Slet kommentar"
                confirmText="Slet kommentaren? Det kan ikke fortrydes."
              />
            )}
          </div>
        ))}
      </section>

      <section className="card">
        <CommentForm postId={post.id} />
      </section>
      <p><Link href="/">Tilbage til overblikket</Link></p>
    </>
  );
}
