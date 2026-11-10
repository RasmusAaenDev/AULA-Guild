import { describe, expect, it } from 'vitest';
import {
  acceptFor, fileMessage, fileTypeLabel, formatBytes, formatFileDate, isAllowedOrigin, uploadDirWarning,
} from '@/lib/files-ui';

describe('formatBytes', () => {
  it('viser bytes, KB og MB på dansk', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2,5 MB');
  });
  it('går ikke i stykker på ugyldige værdier', () => {
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
  it('runder ikke op til en forkert enhed', () => {
    expect(formatBytes(1024 * 1024 - 1)).toBe('1023,9 KB');
  });
});

describe('filhjælpere', () => {
  it('giver danske typenavne', () => {
    expect(fileTypeLabel('application/pdf')).toBe('PDF');
    expect(fileTypeLabel('image/png')).toBe('Billede (PNG)');
    expect(fileTypeLabel('image/jpeg')).toBe('Billede (JPEG)');
    expect(fileTypeLabel('image/webp')).toBe('Billede (WebP)');
    expect(fileTypeLabel('image/gif')).toBe('Billede (GIF)');
    expect(fileTypeLabel('x/y')).toBe('Fil');
  });
  it('accept følger sektionen', () => {
    expect(acceptFor('galleri')).not.toContain('pdf');
    expect(acceptFor('filer')).toContain('application/pdf');
  });
  it('danske beskeder for forbidden og not_found', () => {
    expect(fileMessage('forbidden')).toBe('Du har ikke lov til det.');
    expect(fileMessage('not_found')).toBe('Filen findes ikke længere.');
  });
  it('viser datoen i dansk tid', () => {
    expect(formatFileDate(new Date('2026-11-15T23:30:00Z'))).toBe('16.11.2026');
  });
});

describe('isAllowedOrigin', () => {
  const auth = 'https://aula.example.com';
  it('tillader manglende Origin-header', () => {
    expect(isAllowedOrigin(null, auth, 'aula.example.com')).toBe(true);
  });
  it('tillader samme origin (også med sti i AUTH_URL)', () => {
    expect(isAllowedOrigin('https://aula.example.com', auth)).toBe(true);
    expect(isAllowedOrigin('https://aula.example.com', 'https://aula.example.com/')).toBe(true);
    expect(isAllowedOrigin('https://aula.example.com', 'https://aula.example.com/api/auth')).toBe(true);
  });
  it('afviser forkert vært, skema og port', () => {
    expect(isAllowedOrigin('https://evil.example.com', auth)).toBe(false);
    expect(isAllowedOrigin('http://aula.example.com', auth)).toBe(false);
    expect(isAllowedOrigin('https://aula.example.com:8443', auth)).toBe(false);
    expect(isAllowedOrigin('https://aula.example.com.evil.com', auth)).toBe(false);
  });
  it('afviser ugyldig eller «null»-Origin og tom streng', () => {
    expect(isAllowedOrigin('null', auth)).toBe(false);
    expect(isAllowedOrigin('not a url', auth)).toBe(false);
    expect(isAllowedOrigin('', auth)).toBe(false);
  });
  it('uden AUTH_URL sammenlignes med requestens Host', () => {
    expect(isAllowedOrigin('http://localhost:3000', undefined, 'localhost:3000')).toBe(true);
    expect(isAllowedOrigin('http://localhost:3000', '', 'localhost:3000')).toBe(true);
    expect(isAllowedOrigin('http://evil.com', undefined, 'localhost:3000')).toBe(false);
    expect(isAllowedOrigin('http://localhost:3000', undefined, null)).toBe(false);
  });
  it('ugyldig AUTH_URL falder tilbage til Host', () => {
    expect(isAllowedOrigin('http://localhost:3000', 'ikke en url', 'localhost:3000')).toBe(true);
    expect(isAllowedOrigin('http://evil.com', 'ikke en url', 'localhost:3000')).toBe(false);
  });
});

describe('uploadDirWarning', () => {
  it('advarer kun i produktion med relativ sti', () => {
    expect(uploadDirWarning('production', './data/uploads')).toMatch(/UPLOAD_DIR/);
    expect(uploadDirWarning('production', 'data/uploads')).not.toBeNull();
    expect(uploadDirWarning('production', '/app/data/uploads')).toBeNull();
    expect(uploadDirWarning('development', './data/uploads')).toBeNull();
    expect(uploadDirWarning(undefined, './data/uploads')).toBeNull();
  });
});
