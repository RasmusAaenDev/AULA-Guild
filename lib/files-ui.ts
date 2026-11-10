import type { FileSection } from '@/lib/files';

const dateFormatter = new Intl.DateTimeFormat('da-DK', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Copenhagen',
});

/** Dato i dansk tid, fx «16.11.2026». */
export function formatFileDate(date: Date): string {
  return dateFormatter.format(date);
}

function oneDecimal(n: number): string {
  // Rund ned, så en værdi lige under næste enhed ikke vises som f.eks. «1024 KB».
  const v = Math.floor(n * 10) / 10;
  return String(v).replace('.', ',');
}

/** «1,5 KB», «10 MB» med dansk decimalkomma. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.floor(bytes)} B`;
  if (bytes < 1024 * 1024) return `${oneDecimal(bytes / 1024)} KB`;
  return `${oneDecimal(bytes / (1024 * 1024))} MB`;
}

const TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'Billede (PNG)',
  'image/jpeg': 'Billede (JPEG)',
  'image/webp': 'Billede (WebP)',
  'image/gif': 'Billede (GIF)',
};

export function fileTypeLabel(mime: string): string {
  return TYPE_LABELS[mime] ?? 'Fil';
}

/** Kun en hjælp i filvælgeren; serveren afgør typen ud fra filens indhold. */
export function acceptFor(section: FileSection): string {
  const images = 'image/png,image/jpeg,image/webp,image/gif';
  return section === 'galleri' ? images : `${images},application/pdf`;
}

export function fileMessage(reason: 'forbidden' | 'not_found'): string {
  return reason === 'forbidden' ? 'Du har ikke lov til det.' : 'Filen findes ikke længere.';
}

function originOf(value: string): string | null {
  try {
    const u = new URL(value);
    return u.origin === 'null' ? null : u.origin;
  } catch {
    return null;
  }
}

/**
 * CSRF-værn for upload: findes `Origin`, skal den være lig AUTH_URL's origin. Mangler AUTH_URL (eller er den
 * ugyldig), sammenlignes Origin's vært med requestens egen `Host`. Manglende Origin tillades (ikke-browsere).
 */
export function isAllowedOrigin(
  originHeader: string | null | undefined,
  authUrl: string | null | undefined,
  host?: string | null,
): boolean {
  if (originHeader === null || originHeader === undefined) return true;
  const origin = originOf(originHeader);
  if (!origin) return false;
  const expected = authUrl ? originOf(authUrl) : null;
  if (expected) return origin === expected;
  if (!host) return false;
  return new URL(origin).host === host.toLowerCase();
}

/** Advarsel til opstartsloggen, hvis uploadmappen er relativ i produktion (så ender filerne uden for volumen). */
export function uploadDirWarning(nodeEnv: string | undefined, uploadDir: string): string | null {
  if (nodeEnv !== 'production' || /^(\/|[A-Za-z]:[\\/])/.test(uploadDir)) return null;
  return `Advarsel: UPLOAD_DIR er en relativ sti (${uploadDir}) i produktion. Brug en absolut sti til en monteret volumen, ellers mister I filerne ved ny container.`;
}
