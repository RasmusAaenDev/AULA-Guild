/**
 * Stjerne ved karakterer, der er i guilden. Som standard annonceres den som «I guilden»; `decorative` skjuler den for
 * skærmlæsere, hvor omgivende tekst (fx aria-label på en knap) allerede siger det.
 */
export function GuildStar({ decorative = false }: { decorative?: boolean }) {
  if (decorative) return <span className="guild-star" aria-hidden="true">★</span>;
  return <span className="guild-star" role="img" aria-label="I guilden" title="I guilden">★</span>;
}
