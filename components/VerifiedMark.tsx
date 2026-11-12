import { Icon } from './icons';

/** Forklaringen bruges både i title og som synlig hjælpetekst ved lister med uverificerede karakterer. */
export const UNVERIFIED_HELP =
  'Ikke verificeret: karakteren står ikke på din Battle.net-konto (tilføjet med navn). Den tæller ikke til guild-medlemskab eller officer-rang.';

/**
 * Verificeret: diskret flueben med skjult tekst «verificeret». Uverificeret: tydeligt mærke «ikke verificeret».
 * Ren server-komponent (ingen JavaScript).
 */
export function VerifiedMark({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span className="verified-mark" title="Verificeret via Battle.net">
        <Icon name="deltager" size={14} />
        <span className="sr-only">verificeret</span>
      </span>
    );
  }
  return (
    <span className="badge unverified" title={UNVERIFIED_HELP}>
      ikke verificeret
    </span>
  );
}
