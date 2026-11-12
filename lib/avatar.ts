// Runde initial-avatarer (satire-kommentarer og chatbeskeder). Farverne er `--sat-av-0` … i globals.css og kontrasttestes.

/** Antal farver til initial-avatarerne (`--sat-av-0` … `--sat-av-5`). */
export const AVATAR_COLORS = 6;

/** Deterministisk farveindeks ud fra et navn, så samme person altid har samme farve. */
export function avatarColor(name: string): number {
  let h = 0;
  for (const ch of name.trim()) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % AVATAR_COLORS;
}

/** Første bogstav eller ciffer i navnet som stort bogstav; `?` hvis der ikke er noget. */
export function initialOf(name: string): string {
  const m = /[\p{L}\p{N}]/u.exec(name);
  return m ? m[0].toLocaleUpperCase('da-DK') : '?';
}
