import { linkify } from '@/lib/linkify';

/** Ren tekst med rigtige links som React-noder (aldrig HTML). */
export function LinkedText({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((p, i) =>
        p.type === 'link' && p.href ? (
          <a key={i} className="chat-link" href={p.href} target="_blank" rel="noopener noreferrer nofollow">{p.text}</a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
