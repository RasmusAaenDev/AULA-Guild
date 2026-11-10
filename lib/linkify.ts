// Ren funktion der deler en tekst i tekst- og linkstykker. Kun http/https; teksten bevares tegn for tegn undtagen
// de `<`/`>` der omslutter et link i Discords `<url>`-form. Ingen HTML: kalderen laver React-noder.

export type LinkPart = { type: 'text' | 'link'; text: string; href?: string };

export const MAX_LINK_DISPLAY = 60;

const URL_RE = /<?https?:\/\/[^\s<>]+>?/gi;
const TRAILING = /[.,;:!?'"]/;
const PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

function count(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

/** Fjerner afsluttende tegnsætning og ubalancerede lukkeparenteser; returnerer det der blev klippet af. */
function trimUrl(url: string): string {
  let u = url;
  for (;;) {
    const last = u.at(-1) ?? '';
    if (TRAILING.test(last)) { u = u.slice(0, -1); continue; }
    const open = PAIRS[last];
    if (open && count(u, last) > count(u, open)) { u = u.slice(0, -1); continue; }
    return u;
  }
}

export function shortenLink(url: string, max = MAX_LINK_DISPLAY): string {
  const chars = [...url];
  return chars.length <= max ? url : chars.slice(0, max - 1).join('') + '…';
}

function isSafe(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== '';
  } catch {
    return false;
  }
}

export function linkify(text: string): LinkPart[] {
  const parts: LinkPart[] = [];
  let pos = 0;
  const pushText = (t: string) => {
    if (t === '') return;
    const prev = parts.at(-1);
    if (prev?.type === 'text') prev.text += t;
    else parts.push({ type: 'text', text: t });
  };
  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0];
    const open = raw.startsWith('<');
    const close = raw.endsWith('>');
    const body = raw.slice(open ? 1 : 0, close ? -1 : undefined);
    // Discords `<url>`-form er præcis; ellers klippes afsluttende tegnsætning af.
    const url = open && close ? body : trimUrl(body);
    if (!isSafe(url)) continue;
    pushText(text.slice(pos, m.index));
    if (open && !close) pushText('<');
    parts.push({ type: 'link', text: shortenLink(url), href: url });
    if (!(open && close)) pushText(body.slice(url.length) + (close ? '>' : ''));
    pos = m.index + raw.length;
  }
  pushText(text.slice(pos));
  return parts;
}
