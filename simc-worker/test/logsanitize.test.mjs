import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeLogLine, LogCollector, MAX_LOG_LINE, TRUNCATED_NOTICE } from '../logsanitize.mjs';

const collect = (opts, ...chunks) => {
  const out = [];
  const c = new LogCollector({ emit: (t) => out.push(t), ...opts });
  for (const ch of chunks) c.feed(ch);
  c.end();
  return out.join('');
};

test('erstatter job-mappen og andre absolutte stier med <mappe>', () => {
  const dir = '/tmp/simc-AbC123';
  assert.equal(sanitizeLogLine(`Læser ${dir}/in-Patchwerk.simc`, { dir }), 'Læser <mappe>');
  assert.equal(sanitizeLogLine('fil /opt/simc/data/x.json fundet'), 'fil <mappe> fundet');
  assert.equal(sanitizeLogLine('app: /app/server.mjs og /tmp/x'), 'app: <mappe> og <mappe>');
  assert.equal(sanitizeLogLine('Fejl i "/home/worker/a/b.txt".'), 'Fejl i "<mappe>".');
  assert.doesNotMatch(sanitizeLogLine('x /var/lib/foo/bar y'), /var/);
});
test('rører ikke tal, brøker og kampstilsnavne', () => {
  assert.equal(sanitizeLogLine('Generating: 10/100 (Patchwerk/DungeonSlice) 50% N/A'), 'Generating: 10/100 (Patchwerk/DungeonSlice) 50% N/A');
});
test('fjerner kontroltegn og ANSI, beholder tab', () => {
  assert.equal(sanitizeLogLine('a\u0000b\u001b[31mrød\u001b[0m\u0007c\td\u007fe\u0085f'), 'abrødc\tdef');
});
test('afkorter linjer til 300 tegn', () => {
  const t = sanitizeLogLine('x'.repeat(1000));
  assert.equal(t.length, MAX_LOG_LINE);
  assert.ok(t.endsWith('…'));
});
test('LogCollector: \\r-fremdrift giver kun seneste tilstand ved afsluttet linje', () => {
  const t = collect({}, 'start\nBar 10%\rBar 50%\rBar 100%\nslut\n');
  assert.equal(t, 'start\nBar 100%\nslut\n');
});
test('LogCollector: flush sender kun seneste fremdriftstilstand, ikke dubletter', () => {
  const out = [];
  const c = new LogCollector({ emit: (t) => out.push(t) });
  c.feed('Bar 10%\rBar 20%\rBar 30%');
  c.flush();
  c.feed('\rBar 40%');
  c.flush();
  c.flush(); // uændret: intet nyt
  c.feed('\rBar 100%\n');
  c.end();
  assert.deepEqual(out, ['Bar 30%\n', 'Bar 40%\n', 'Bar 100%\n']);
});
test('LogCollector: \\r\\n er et almindeligt linjeskift, også delt over chunks', () => {
  assert.equal(collect({}, 'a\r\nb\r', '\nc\n'), 'a\nb\nc\n');
});
test('LogCollector: delte chunks og uafsluttet sidste linje', () => {
  assert.equal(collect({}, 'hel', 'lo\nver', 'den'), 'hello\nverden\n');
});
test('LogCollector: stier renses også når de er delt over chunks', () => {
  assert.equal(collect({ dir: '/tmp/simc-X' }, 'ud: /tmp/si', 'mc-X/out.json\n'), 'ud: <mappe>\n');
});
test('LogCollector: volumenloft sender afkortet-note præcis én gang og dropper resten', () => {
  const t = collect({ maxBytes: 100 }, `${'abcdefghi\n'.repeat(50)}`);
  const lines = t.split('\n');
  assert.equal(t.split(TRUNCATED_NOTICE).length - 1, 1);
  assert.ok(t.endsWith(TRUNCATED_NOTICE));
  assert.ok(Buffer.byteLength(t.replace(TRUNCATED_NOTICE, '')) <= 100);
  assert.ok(lines.length < 20);
});
test('LogCollector: standardloftet er 64 KB', () => {
  const t = collect({}, 'x'.repeat(200).concat('\n').repeat(1000));
  assert.ok(Buffer.byteLength(t) <= 64 * 1024 + TRUNCATED_NOTICE.length);
  assert.ok(t.endsWith(TRUNCATED_NOTICE));
});
test('LogCollector: tomme fremdriftslinjer udelades', () => {
  assert.equal(collect({}, 'a\n\r\r\nb\n'), 'a\nb\n');
});
