import Link from 'next/link';
import { Icon } from '@/components/icons';
import { galleryHeading, galleryImageUrl, type GalleryItem } from '@/lib/overview-gallery';
import { formatAbsolute, formatRelativeDay } from '@/lib/posts-ui';

/** Nye galleribilleder i Overblik: kort med galleri-ikon og et lille gitter af miniaturer. Al tekst er rene React-noder. */
export function GalleryItemCard({ item, now }: { item: GalleryItem; now: Date }) {
  return (
    <article className="card post-card gallery-item-card">
      <div className="post-head">
        <p className="post-meta">
          <time className="muted" dateTime={item.at.toISOString()} title={formatAbsolute(item.at)}>
            {formatRelativeDay(item.at, now)}
          </time>
        </p>
      </div>
      <h3 className="chat-item-title">
        <Icon name="galleri" size={22} />
        <span>{galleryHeading(item.uploader, item.count)}</span>
      </h3>
      <ul className="gallery-thumbs">
        {item.thumbs.map((t) => (
          <li key={t.id}>
            <Link href={item.href}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={galleryImageUrl(t.id)} alt={t.alt || t.name || 'Billede'} loading="lazy" width={96} height={72} />
            </Link>
          </li>
        ))}
      </ul>
      <p><Link href={item.href}>Se i Galleri</Link></p>
    </article>
  );
}
