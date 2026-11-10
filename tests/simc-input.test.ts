import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALLOWED_KEYS, CLASS_KEYS, MAX_INPUT_BYTES, validateSimcInput } from '@/lib/simc-input';

const root = path.join(__dirname, '..', 'simc-worker');
const hunter = readFileSync(path.join(root, 'test', 'fixtures', 'hunter-11.simc'), 'utf8');
const ok = `hunter="Fallochli"\nlevel=11\nrace=dwarf`;
const err = (s: unknown) => {
  const r = validateSimcInput(s);
  if (r.ok) throw new Error('forventede fejl');
  return r.error;
};

async function worker() {
  const p = path.join(root, 'sanitize.mjs');
  return (await import(/* @vite-ignore */ p)) as {
    ALLOWED_KEYS: Set<string>; CLASS_KEYS: Set<string>; MAX_INPUT_BYTES: number;
    sanitizeProfile: (s: string) => { ok: boolean; lines?: string[]; className?: string; error?: string };
  };
}

describe('validateSimcInput', () => {
  it('godkender hunter-eksempelprofilen og fjerner kommentarer', () => {
    const r = validateSimcInput(hunter);
    expect(r).toMatchObject({ ok: true, className: 'hunter' });
    if (r.ok) {
      expect(r.input).toContain('hunter="Fallochli"');
      expect(r.input).not.toContain('#');
      expect(r.input).not.toMatch(/^\s*$/m);
    }
  });
  it('normaliserer linjeskift og trimmer', () => {
    const r = validateSimcInput(`\r\n  hunter="A"\r  level=5 \r\n\r\n`);
    expect(r).toEqual({ ok: true, input: 'hunter="A"\nlevel=5', className: 'hunter' });
  });
  it('afviser tom og ikke-tekst', () => {
    expect(err('   ')).toMatch(/Indsæt/);
    expect(err(undefined)).toMatch(/Indsæt/);
    expect(err(42)).toMatch(/Indsæt/);
  });
  it('afviser farlige nøgler med linjenummer', () => {
    for (const k of ['input', 'html', 'json2', 'apikey', 'armory', 'output']) {
      expect(err(`${ok}\n${k}=x`)).toMatch(/^Linje 4: nøglen/);
    }
  });
  it('afviser flere spillere og manglende spiller', () => {
    expect(err(`${ok}\nmage="B"`)).toMatch(/^Linje 4: .*én spillerlinje/);
    expect(err('level=5')).toMatch(/præcis én spillerlinje/);
  });
  it('afviser klasser, der ikke findes i WoW Forever', () => {
    for (const c of ['monk', 'evoker', 'deathknight', 'demonhunter']) {
      expect(err(`${c}="X"\nlevel=5`)).toBe('Klassen støttes ikke i WoW Forever-simulatoren.');
    }
  });
  it('afviser for stor tekst (bytes, ikke tegn)', () => {
    expect(err(`${ok}\n# ${'x'.repeat(MAX_INPUT_BYTES)}`)).toMatch(/32 KB/);
    expect(err(`${ok}\n# ${'æ'.repeat(MAX_INPUT_BYTES / 2)}`)).toMatch(/32 KB/);
  });
  it('afviser kontroltegn men tillader tab (som bliver mellemrum)', () => {
    expect(err(`${ok}\nlevel=5\u0000`)).toMatch(/^Linje 4: .*kontroltegn/);
    expect(err(`${ok}\nlevel=5\u001b[0m`)).toMatch(/kontroltegn/);
    const r = validateSimcInput(`hunter="A"\n\tlevel=5\t`);
    expect(r).toEqual({ ok: true, input: 'hunter="A"\nlevel=5', className: 'hunter' });
  });
  it('afviser ukendte nøgler, dårligt format, lange værdier og farlige værdier', () => {
    expect(err(`${ok}\nfoo=1`)).toMatch(/^Linje 4: nøglen «foo»/);
    expect(err(`${ok}\njusttext`)).toMatch(/^Linje 4: ugyldigt format/);
    expect(err(`${ok}\n=5`)).toMatch(/ugyldigt format/);
    expect(err(`${ok}\ntalents=${'a'.repeat(513)}`)).toMatch(/for lang/);
    for (const v of ['http://x', 'a;b', '../x', '$(x)', 'a|b', 'a`b']) {
      expect(err(`${ok}\ntalents=${v}`), v).toMatch(/^Linje 4: .*ikke er tilladt/);
    }
  });
  it('kræver pænt spillernavn', () => {
    for (const bad of ['hunter=Bob', 'hunter=""', 'hunter="B0b"', `hunter="${'a'.repeat(41)}"`]) {
      expect(err(bad), bad).toMatch(/anførselstegn/);
    }
    expect(validateSimcInput('hunter="Æbleø-Å\'s."').ok).toBe(true);
  });
  it('ekkoer aldrig mere end 40 tegn af indholdet', () => {
    const long = 'x'.repeat(300);
    for (const bad of [`${ok}\n${long}`, `${ok}\n${long}=1`, `${ok}\ntalents=1\n${long}\u0007`]) {
      const e = err(bad);
      expect(e).not.toContain('x'.repeat(41));
      expect(e.length).toBeLessThan(200);
    }
    expect(err(`${ok}\n${'y'.repeat(100)}`)).toContain('y'.repeat(40) + '…');
  });
});

describe('synk med simc-worker/sanitize.mjs', () => {
  it('har samme hvidlister og størrelsesgrænse', async () => {
    const w = await worker();
    expect([...ALLOWED_KEYS].sort()).toEqual([...w.ALLOWED_KEYS].sort());
    expect([...CLASS_KEYS].sort()).toEqual([...w.CLASS_KEYS].sort());
    expect(MAX_INPUT_BYTES).toBe(w.MAX_INPUT_BYTES);
  });
  it('giver samme afgørelse og samme rensede linjer som workeren', async () => {
    const w = await worker();
    const cases = [
      hunter, ok, `${ok}\ninput=x`, `${ok}\nmage="B"`, `${ok}\ntalents=http://x`, `${ok}\nfoo=1`, 'level=5', `hunter="A"\n# c\n\nlevel=5`,
      `hunter="Bob`, `${ok}\nlevel=${'1'.repeat(600)}`, `${ok}\nmain_hand=,id=123,enchant=1`,
    ];
    for (const c of cases) {
      const mine = validateSimcInput(c);
      const theirs = w.sanitizeProfile(c);
      expect(mine.ok, c.slice(0, 60)).toBe(theirs.ok);
      if (mine.ok) expect(mine.input.split('\n')).toEqual(theirs.lines);
      // appens rensede output skal også godkendes uændret af workeren
      if (mine.ok) expect(w.sanitizeProfile(mine.input)).toMatchObject({ ok: true, lines: theirs.lines });
    }
  });
});
