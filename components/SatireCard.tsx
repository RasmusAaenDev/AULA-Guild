import { Icon } from '@/components/icons';
import type { SatirePost } from '@/lib/satire';

/**
 * Fiktivt opslag. Mærkningen er permanent og ligger inde i selve kortet (badge, fodlinje, stiplet kant), så et
 * skærmbillede ikke kan forveksles med et ægte opslag. Ingen bogmærke, kommentarformular, læst-status eller detaljeside.
 */
export function SatireCard({ post }: { post: SatirePost }) {
  const paragraphs = post.body.split(/\n{2,}/);
  return (
    <article className="card post-card satire-card" aria-label="Fake opslag (satire)">
      <span className="sr-only">Fake opslag (satire)</span>
      <div className="satire-head">
        <span className="satire-mask" aria-hidden="true"><Icon name="maske" size={26} /></span>
        <span className="satire-badge">
          <Icon name="fake" size={16} />
          FAKE · SATIRE
        </span>
        {post.important && <span className="badge">Vigtig (fiktivt)</span>}
      </div>
      <p className="satire-meta">
        <strong>{post.author}</strong>
        <span className="satire-label">Satire</span>
      </p>
      <h3>{post.title}</h3>
      {paragraphs.map((p, i) => (
        <p key={i} className="satire-body">{p}</p>
      ))}
      {post.comments.length > 0 && (
        <div className="satire-comments">
          <h4>Fiktive kommentarer ({post.comments.length})</h4>
          {post.comments.map((c, i) => (
            <p key={i}>
              <strong>{c.author}</strong> <span className="badge">fiktiv</span>
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
