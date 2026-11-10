// Fuldt karakternavn (Blizzard: fornavn i `name`, efternavn i `surname`, slug = «fornavn-efternavn» i små bogstaver).

function capitalizeFirst(s: string): string {
  const first = String.fromCodePoint(s.codePointAt(0) ?? 0);
  return first.toLocaleUpperCase('da') + s.slice(first.length);
}

export function fullName(c: { name: string; surname?: string | null; slug: string }): string {
  const name = c.name.normalize('NFC');
  const surname = (c.surname ?? '').normalize('NFC').trim();
  if (surname !== '') return `${name} ${surname}`;
  const slug = c.slug.normalize('NFC');
  const prefix = name.toLowerCase() + '-';
  if (slug.startsWith(prefix) && slug.length > prefix.length) return `${name} ${capitalizeFirst(slug.slice(prefix.length))}`;
  return name;
}

export function initials(full: string): string {
  const words = full.normalize('NFC').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = (w: string) => String.fromCodePoint(w.codePointAt(0) ?? 0).toLocaleUpperCase('da');
  return words.length === 1 ? first(words[0]) : first(words[0]) + first(words[words.length - 1]);
}
