import { Icon } from '@/components/icons';
import { formatAbsolute, formatRelativeDay } from '@/lib/posts-ui';
import type { DatedSatire, SatireComment } from '@/lib/satire';

const displayName = (name: string) => name.replace(/\s*\(fiktiv\)\s*$/i, '');

/** Antal kommentarer der vises direkte; resten ligger bag en lukket <details>. */
export const SATIRE_COMMENTS_SHOWN = 3;
/** Antal farver til initial-avatarerne (`--sat-av-0` … i globals.css). */
export const SATIRE_AVATAR_COLORS = 6;

/** Deterministisk farveindeks ud fra afsenderens navn, så samme person altid har samme farve. */
export function avatarIndex(name: string): number {
  let h = 0;
  for (const ch of displayName(name)) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % SATIRE_AVATAR_COLORS;
}

/** Svar til en bestemt («Til Oscars far: …») indrykkes lidt. */
const isReply = (body: string) => /^Til [^:]{2,40}:/.test(body);

function Comment({ c }: { c: SatireComment }) {
  const name = displayName(c.author);
  return (
    <li className={isReply(c.body) ? 'satire-comment is-reply' : 'satire-comment'}>
      <span className={`satire-avatar sat-av-${avatarIndex(c.author)}`} aria-hidden="true">
        {name.charAt(0).toUpperCase()}
      </span>
      <div className="satire-bubble">
        <strong className="satire-comment-name">{name}</strong>
        <p>{c.body}</p>
      </div>
    </li>
  );
}

/**
 * Fiktivt opslag. Tidspunktet vises som på ægte opslag. Mærkningen er kun visuel (klovneikon i overskriften og stiplet kant), uden tekst.
 * Skærmlæsere får aria-label. Ingen bogmærke, kommentarformular, læst-status eller detaljeside. Kommentarer vises som enkelte beskeder
 * med initial-avatar; over SATIRE_COMMENTS_SHOWN ligger resten bag en native <details> (virker uden JS).
 */
export function SatireCard({ post, now }: { post: DatedSatire; now: Date }) {
  const paragraphs = post.body.split(/\n+/);
  const n = post.comments.length;
  const first = post.comments.slice(0, SATIRE_COMMENTS_SHOWN);
  const rest = post.comments.slice(SATIRE_COMMENTS_SHOWN);
  return (
    <article className="card post-card satire-card" aria-label="Fake opslag (satire)">
      {post.important && (
        <div className="satire-head">
          <span className="badge">Vigtig</span>
        </div>
      )}
      <p className="satire-meta">
        <strong>{displayName(post.author)}</strong>
        <time className="muted" dateTime={post.at.toISOString()} title={formatAbsolute(post.at)}>
          {formatRelativeDay(post.at, now)}
        </time>
      </p>
      <h3 className="satire-title">
        <span className="satire-mask" aria-hidden="true"><Icon name="klovn" size={26} /></span>
        {post.title}
      </h3>
      {paragraphs.map((p, i) => (
        <p key={i} className="satire-body">{p}</p>
      ))}
      {n > 0 && (
        <section className="satire-comments">
          <h4>Kommentarer ({n})</h4>
          <ol className="satire-comment-list">
            {first.map((c, i) => <Comment key={i} c={c} />)}
          </ol>
          {rest.length > 0 && (
            <details className="satire-more">
              <summary>{rest.length === 1 ? 'Vis 1 kommentar mere' : `Vis ${rest.length} flere kommentarer`}</summary>
              <ol className="satire-comment-list" start={SATIRE_COMMENTS_SHOWN + 1}>
                {rest.map((c, i) => <Comment key={i} c={c} />)}
              </ol>
            </details>
          )}
        </section>
      )}
    </article>
  );
}
