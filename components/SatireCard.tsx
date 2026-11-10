import { Icon } from '@/components/icons';
import type { SatirePost } from '@/lib/satire';

const displayName = (name: string) => name.replace(/\s*\(fiktiv\)\s*$/i, '');

/**
 * Fiktivt opslag. Mærkningen er permanent og ligger inde i selve kortet (ikon i overskriften, fodlinje, stiplet kant, «Fiktive kommentarer»), så et
 * skærmbillede ikke kan forveksles med et ægte opslag. Ingen bogmærke, kommentarformular, læst-status eller detaljeside.
 */
export function SatireCard({ post }: { post: SatirePost }) {
  const paragraphs = post.body.split(/\n+/);
  return (
    <article className="card post-card satire-card" aria-label="Fake opslag (satire)">
      {post.important && (
        <div className="satire-head">
          <span className="badge">Vigtig (fiktivt)</span>
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
          <h4>Fiktive kommentarer ({post.comments.length})</h4>
          {post.comments.map((c, i) => (
            <p key={i}>
              <strong>{displayName(c.author)}</strong> <span className="badge">fiktiv</span>
              <br />
              {c.body}
            </p>
          ))}
        </div>
      )}
      <p className="satire-foot">Dette er et fiktivt opslag. Alle personer er opdigtede.</p>
    </article>
  );
}
