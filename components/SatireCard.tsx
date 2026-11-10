import { Icon } from '@/components/icons';
import type { SatirePost } from '@/lib/satire';

const displayName = (name: string) => name.replace(/\s*\(fiktiv\)\s*$/i, '');

/**
 * Fiktivt opslag. Mærkningen er kun visuel (klovneikon i overskriften og stiplet kant), uden tekst. Skærmlæsere får aria-label. Ingen bogmærke, kommentarformular, læst-status eller detaljeside.
 */
export function SatireCard({ post }: { post: SatirePost }) {
  const paragraphs = post.body.split(/\n+/);
  return (
    <article className="card post-card satire-card" aria-label="Fake opslag (satire)">
      {post.important && (
        <div className="satire-head">
          <span className="badge">Vigtig</span>
        </div>
      )}
      <p className="satire-meta">
        <strong>{displayName(post.author)}</strong>
      </p>
      <h3 className="satire-title">
        <span className="satire-mask" aria-hidden="true"><Icon name="klovn" size={26} /></span>
        {post.title}
      </h3>
      {paragraphs.map((p, i) => (
        <p key={i} className="satire-body">{p}</p>
      ))}
      {post.comments.length > 0 && (
        <div className="satire-comments">
          <h4>Kommentarer ({post.comments.length})</h4>
          {post.comments.map((c, i) => (
            <p key={i}>
              <strong>{displayName(c.author)}</strong>
              <br />
              {c.body}
            </p>
          ))}
        </div>
      )}
    </article>
  );
}
