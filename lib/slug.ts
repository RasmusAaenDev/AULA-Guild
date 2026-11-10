export function normalizeName(input: string): string {
  return input.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

const VALID = /^[\p{L}'-]+( [\p{L}'-]+)*$/u;

export function nameToSlug(input: string): string | null {
  const name = normalizeName(input);
  if (name.length === 0 || name.length > 60 || !VALID.test(name)) return null;
  return name.replace(/ /g, '-');
}
