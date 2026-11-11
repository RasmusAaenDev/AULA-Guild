// Sanering og afgrænsning af simcs konsol-output, før det streames til klienten.
// Ren logik uden I/O: server.mjs binder den til HTTP-streamen.

export const MAX_LOG_LINE = 300;
export const MAX_LOG_BYTES = 64 * 1024;
export const TRUNCATED_NOTICE = '[log afkortet]\n';

const ANSI_RE = /\u001b(?:\[[0-9;?]*[ -/]*[@-~]|[@-Z\\-_])/g;
// Alle kontroltegn undtagen \n (0x0a) og \t (0x09), plus DEL/C1 og linje-/afsnitsseparatorer.
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029]/g;
// Kendte rod-mapper (med evt. understi) eller enhver absolut sti med mindst to led.
const ABS_PATH_RE = /(?<![\w<>.\-:/])\/(?:(?:tmp|opt|app|home|usr|var|etc|root|proc|sys|srv|mnt|run|dev|lib|bin|sbin)(?:\/[^\s"'`<>|,;)\]]*)?(?![\w.-])|[\w.\-+@~]+(?:\/[\w.\-+@~]+)+\/?)/g;

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Renser ÉN linje (uden \n/\r): ANSI, kontroltegn, stier, længde. */
export function sanitizeLogLine(line, { dir = null } = {}) {
  let t = String(line).replace(ANSI_RE, '').replace(CONTROL_RE, '');
  if (dir) t = t.replace(new RegExp(escapeRe(dir) + '(?:/[^\\s"\'`<>|,;)\\]]*)?', 'g'), '<mappe>');
  t = t.replace(ABS_PATH_RE, '<mappe>');
  t = t.trimEnd();
  if (t.length > MAX_LOG_LINE) t = `${t.slice(0, MAX_LOG_LINE - 1)}…`;
  return t;
}

/**
 * Samler rå tekstbrudstykker til rensede linjer.
 * - \r-baserede fremdriftslinjer overskriver hinanden; ved flush() sendes kun seneste tilstand.
 * - Samlet volumen ud (inkl. linjeskift) er begrænset; derefter sendes TRUNCATED_NOTICE én gang.
 * emit(text) kaldes med færdige, rensede linjer (hver afsluttet med \n).
 */
export class LogCollector {
  constructor({ emit, dir = null, maxBytes = MAX_LOG_BYTES } = {}) {
    this.emit = emit;
    this.dir = dir;
    this.maxBytes = maxBytes;
    this.bytes = 0;
    this.truncated = false;
    this.cur = '';
    this.crSeen = false;
    this.crPending = false;
    this.lastProgress = null;
    this.out = [];
  }

  feed(chunk) {
    for (const c of String(chunk)) {
      if (this.crPending) {
        this.crPending = false;
        if (c !== '\n') { this.cur = ''; this.crSeen = true; }
      }
      if (c === '\r') this.crPending = true;
      else if (c === '\n') this._finishLine();
      else if (this.cur.length < 4096) this.cur += c; // rå linje afkortes tidligt mod hukommelsesbrug
    }
  }

  _finishLine() {
    const line = this.cur;
    const progress = this.crSeen;
    this.cur = ''; this.crSeen = false;
    if (progress) {
      if (!line.trim() || line === this.lastProgress) { this.lastProgress = null; return; }
    }
    this.lastProgress = null;
    this._push(line);
  }

  _push(raw) {
    if (this.truncated) return;
    const text = sanitizeLogLine(raw, { dir: this.dir });
    const size = Buffer.byteLength(text, 'utf8') + 1;
    if (this.bytes + size > this.maxBytes) {
      this.truncated = true;
      this.out.push(null);
      return;
    }
    this.bytes += size;
    this.out.push(text);
  }

  _drain() {
    if (!this.out.length) return;
    let text = '';
    for (const l of this.out) text += l === null ? TRUNCATED_NOTICE : `${l}\n`;
    this.out = [];
    this.emit(text);
  }

  /** Sender det der er klar; en igangværende fremdriftslinje sendes som sin seneste tilstand. */
  flush() {
    if (this.crSeen && this.cur.trim() && this.cur !== this.lastProgress) {
      this.lastProgress = this.cur;
      this._push(this.cur);
    }
    this._drain();
  }

  /** Afslut: send resten, også en uafsluttet sidste linje. */
  end() {
    if (this.cur.trim() && !(this.crSeen && this.cur === this.lastProgress)) this._push(this.cur);
    this.cur = ''; this.crSeen = false;
    this._drain();
  }

  /** Egen note fra workeren (ikke simc-output). */
  note(text) { this._push(text); this._drain(); }
}
