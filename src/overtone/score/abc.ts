import { ScoreError, ZERO, add, asNumber, beat, compare, endOf, meterLength, multiply, scoreEnd, subtract, transposeNotes, validateDraft, type Beat, type Meter, type ScoreDraft, type ScoreNote } from './model.js';

export interface ABCVoice { readonly id: string; readonly label: string }
const MAX_SCORE_BYTES = 1024 * 1024;
const MAJOR_KEYS = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const MINOR_KEYS = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];
const NATURAL: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function checkSource(source: string) {
  if (!source.trim() || new TextEncoder().encode(source).length > MAX_SCORE_BYTES || source.includes('\0')) throw new ScoreError('score-size-invalid');
  if ((source.match(/^X:/gmu) ?? []).length !== 1) throw new ScoreError('score-single-tune-required');
}
export function listABCVoices(source: string): readonly ABCVoice[] {
  checkSource(source);
  const voices = new Map<string, ABCVoice>();
  for (const match of source.matchAll(/^V:\s*([^\s]+)([^\r\n]*)/gmu)) {
    const name = match[2]!.match(/(?:^|\s)name="([^"]*)"/u)?.[1];
    if (!voices.has(match[1]!) || name) voices.set(match[1]!, { id: match[1]!, label: name || match[1]! });
  }
  return voices.size ? [...voices.values()] : [{ id: 'melody', label: '' }];
}
export function keyAccidentals(value: string): Readonly<Record<string, number>> {
  const key = value.trim().match(/^([A-G][#b]?)(m(?:in(?:or)?)?|maj(?:or)?)?$/u);
  if (!key) throw new ScoreError('score-key-unsupported', value);
  const index = (key[2]?.startsWith('m') && !key[2].startsWith('maj') ? MINOR_KEYS : MAJOR_KEYS).indexOf(key[1]!);
  if (index < 0) throw new ScoreError('score-key-unsupported', value);
  const count = index - 7; const result: Record<string, number> = {};
  const order = count < 0 ? 'BEADGCF' : 'FCGDAEB';
  for (const name of order.slice(0, Math.abs(count))) result[name] = count < 0 ? -1 : 1;
  return result;
}
export function transposeScoreKey(draft: ScoreDraft, target: string): ScoreDraft {
  keyAccidentals(draft.key); const signature = keyAccidentals(target);
  const parse = (key: string) => {
    const m = key.match(/^([A-G])([#b]?)(.*)$/u)!;
    return { tonic: NATURAL[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0), minor: m[3]!.startsWith('m') && !m[3]!.startsWith('maj') };
  };
  const before = parse(draft.key); const after = parse(target);
  if (before.minor !== after.minor) throw new ScoreError('score-key-mode-change');
  const semitones = (after.tonic - before.tonic + 18) % 12 - 6;
  const next = transposeNotes(draft, draft.notes.map(n => n.id), semitones);
  const names = Object.values(signature).some(value => value < 0)
    ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const shift = (letter: string, accidental: string) => names[(NATURAL[letter]! + (accidental.startsWith('#') ? accidental.length : -accidental.length) + semitones + 24) % 12]!;
  return { ...next, key: target, chords: draft.chords.map(chord => ({ ...chord,
    symbol: chord.symbol.replace(/(^|\/)([A-G])(#{1,2}|b{1,2})?/gu, (_match, lead: string, letter: string, accidental: string | undefined) => lead + shift(letter, accidental ?? '')) })) };
}
function parseMeter(value: string): Meter {
  const meter = value.trim() === 'C' ? '4/4' : value.trim() === 'C|' ? '2/2' : value.trim();
  const match = meter.match(/^(\d+)\/(\d+)$/u);
  if (!match) throw new ScoreError('score-meter-unsupported', value);
  return { numerator: Number(match[1]), denominator: Number(match[2]) };
}
function fraction(value: string): Beat {
  const match = value.match(/^(\d+)\/(\d+)$/u);
  if (!match) throw new ScoreError('score-length-unsupported', value);
  return beat(Number(match[1]), Number(match[2]));
}
function noteLength(token: string): Beat {
  if (!token) return beat(1);
  const match = token.match(/^(\d+)?(\/+)?(\d+)?$/u);
  if (!match || (match[2]?.length !== 1 && match[3])) throw new ScoreError('score-length-unsupported', token);
  return beat(Number(match[1] || 1), match[3] ? Number(match[3]) : 2 ** (match[2]?.length ?? 0));
}

// @nimi-authority: rule.overtone.score.r002
export function parseABCLeadSheet(source: string, voiceId?: string): ScoreDraft {
  const voices = listABCVoices(source);
  if (voices.length > 1 && !voiceId) throw new ScoreError('score-voice-required');
  const selected = voiceId || voices[0]!.id;
  if (!voices.some(v => v.id === selected)) throw new ScoreError('score-voice-missing', selected);
  const notes: ScoreNote[] = []; const chords: { at: Beat; symbol: string }[] = [];
  const sections: { at: Beat; label: string }[] = []; const meters: { at: Beat; meter: Meter }[] = [];
  let title = ''; let key = ''; let tempo = 0; let unit: Beat | undefined; let meter: Meter | undefined;
  let at = ZERO; let currentVoice = voices.length === 1 ? selected : ''; let body = false;
  let signature: Readonly<Record<string, number>> = {}; let accidentals = new Map<string, number>();
  for (const [lineIndex, raw] of source.replace(/\r\n?/gu, '\n').split('\n').entries()) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('%%')) throw new ScoreError('score-directive-unsupported', `${lineIndex + 1}: ${line}`);
    if (line.startsWith('%')) {
      if (body && line.slice(1).trim()) sections.push({ at, label: line.slice(1).trim() });
      continue;
    }
    const field = line.match(/^([A-Za-z]):\s*(.*)$/u);
    if (field) {
      const name = field[1]!; const value = field[2]!.trim();
      if (name === 'V') {
        currentVoice = value.split(/\s+/u)[0]!;
        if (currentVoice === selected && /(?:octave|transpose)\s*=|clef=[^\s]*[+-]\d/u.test(value)) throw new ScoreError('score-voice-transposition-unsupported');
        continue;
      }
      if (body && currentVoice && currentVoice !== selected) continue;
      if (name === 'X') continue;
      if (name === 'T' && !body) { title = value; continue; }
      if (name === 'M') {
        meter = parseMeter(value);
        if (body) {
          const previous = meters[meters.length - 1];
          if (previous && compare(previous.at, at) === 0) meters[meters.length - 1] = { at, meter };
          else meters.push({ at, meter });
        }
        continue;
      }
      if (name === 'L') { unit = multiply(fraction(value), beat(4)); continue; }
      if (name === 'Q' && !body) {
        const q = value.match(/^(?:1\/4\s*=\s*)?(\d+(?:\.\d+)?)$/u);
        if (!q) throw new ScoreError('score-tempo-unsupported', value);
        tempo = Number(q[1]); continue;
      }
      if (name === 'K' && !body) {
        key = value; signature = keyAccidentals(key);
        if (!unit || !meter || !tempo) throw new ScoreError('score-headers-required', 'M, L, Q');
        meters.push({ at: ZERO, meter }); body = true; continue;
      }
      throw new ScoreError('score-field-unsupported', `${lineIndex + 1}: ${name}`);
    }
    if (!body) throw new ScoreError('score-key-required');
    if (!currentVoice) throw new ScoreError('score-voice-body-required');
    if (currentVoice !== selected) continue;
    let position = 0;
    while (position < line.length) {
      const rest = line.slice(position);
      const whitespace = rest.match(/^\s+/u);
      if (whitespace) { position += whitespace[0].length; continue; }
      if (rest.startsWith('%')) break;
      if (rest.startsWith('"')) {
        const chord = rest.match(/^"([^"]+)"/u);
        if (!chord) throw new ScoreError('score-chord-invalid', String(lineIndex + 1));
        chords.push({ at, symbol: chord[1]! }); position += chord[0].length; continue;
      }
      if (rest.startsWith(':') || /^\|:|^\[\d|^\|\d/u.test(rest)) throw new ScoreError('score-repeat-unsupported', String(lineIndex + 1));
      const bar = rest.match(/^(?:\[\||\|\]|\|\||\|)/u);
      if (bar) { accidentals = new Map(); position += bar[0].length; continue; }
      const note = rest.match(/^(\^\^|__|\^|_|=)?([A-Ga-gzZ])([,']*)((?:\d+)?(?:\/+\d*)?)(\s*-)?/u);
      if (!note) throw new ScoreError('score-syntax-unsupported', `${lineIndex + 1}: ${rest.slice(0, 24)}`);
      const letter = note[2]!; const isRest = letter === 'z' || letter === 'Z';
      let pitch: number | null = null;
      if (isRest && (note[1] || note[3] || note[5])) throw new ScoreError('score-rest-invalid');
      if (!isRest) {
        const octave = (letter === letter.toLowerCase() ? 1 : 0) + [...note[3]!].reduce((n, x) => n + (x === "'" ? 1 : -1), 0);
        const accidentalKey = `${letter.toUpperCase()}:${octave}`;
        if (note[1]) accidentals.set(accidentalKey, note[1] === '=' ? 0 : (note[1].startsWith('^') ? 1 : -1) * note[1].length);
        pitch = 60 + NATURAL[letter.toUpperCase()]! + octave * 12 + (accidentals.get(accidentalKey) ?? signature[letter.toUpperCase()] ?? 0);
      }
      if (letter === 'Z' && !/^\d*$/u.test(note[4]!)) throw new ScoreError('score-measure-rest-invalid');
      const duration = multiply(letter === 'Z' ? meterLength(meter!) : unit!, noteLength(note[4]!));
      notes.push({ id: `note-${notes.length + 1}`, start: at, duration, pitch, ...(note[5] ? { tieToNext: true } : {}) });
      at = add(at, duration); position += note[0].length;
    }
  }
  const draft: ScoreDraft = { title, voiceId: selected, key, tempo, notes, chords, sections, meters, losses: voices.length > 1 ? ['omitted-voices'] : [] };
  validateDraft(draft); return draft;
}

function pitchABC(pitch: number | null): string {
  if (pitch === null) return 'z';
  const names = ['=C', '^C', '=D', '^D', '=E', '=F', '^F', '=G', '^G', '=A', '^A', '=B'];
  const octave = Math.floor(pitch / 12) - 1;
  let name = names[pitch % 12]!;
  if (octave >= 5) name = name.toLowerCase() + "'".repeat(octave - 5);
  else if (octave < 4) name += ','.repeat(4 - octave);
  return name;
}
function lengthABC(duration: Beat): string {
  const value = multiply(duration, beat(4));
  return value.d === 1 ? (value.n === 1 ? '' : String(value.n)) : `${value.n}/${value.d}`;
}

// @nimi-authority: rule.overtone.score.r002
export function serializeABCLeadSheet(draft: ScoreDraft): string {
  validateDraft(draft); keyAccidentals(draft.key);
  const end = scoreEnd(draft); const boundaries = new Map<string, Beat>(); const bars = new Set<string>();
  const key = (v: Beat) => `${v.n}/${v.d}`;
  const include = (v: Beat) => { if (compare(v, ZERO) >= 0 && compare(v, end) <= 0) boundaries.set(key(v), v); };
  include(ZERO); include(end);
  for (const n of draft.notes) { include(n.start); include(endOf(n)); }
  // Split long MIDI gaps on quarter beats: lengths such as z10 at L:1/16
  // have no single rest glyph. Tied pitched fragments retain the event timing.
  for (let quarter = 1; quarter < asNumber(end); quarter += 1) {
    if (quarter > 65536) throw new ScoreError('score-too-long');
    include(beat(quarter));
  }
  for (const c of [...draft.chords, ...draft.sections]) include(c.at);
  draft.meters.forEach((entry, i) => {
    const until = draft.meters[i + 1]?.at ?? end;
    include(entry.at);
    for (let at = add(entry.at, meterLength(entry.meter)); compare(at, until) <= 0; at = add(at, meterLength(entry.meter))) {
      include(at); bars.add(key(at));
      if (boundaries.size > 65536) throw new ScoreError('score-too-long');
    }
  });
  const points = [...boundaries.values()].sort(compare);
  const initialMeter = draft.meters[0]!.meter;
  const lines = ['X:1', `T:${draft.title.replace(/[\r\n]/gu, ' ')}`, `M:${initialMeter.numerator}/${initialMeter.denominator}`, 'L:1/16', `Q:1/4=${draft.tempo}`, `K:${draft.key}`];
  let line = ''; let noteIndex = 0;
  const flush = () => { if (line) { lines.push(line); line = ''; } };
  for (let i = 0; i < points.length - 1; i += 1) {
    const at = points[i]!; const until = points[i + 1]!;
    if (bars.has(key(at))) { line += '|'; flush(); }
    const meter = draft.meters.slice(1).find(m => compare(m.at, at) === 0);
    if (meter) { flush(); lines.push(`M:${meter.meter.numerator}/${meter.meter.denominator}`); }
    for (const section of draft.sections.filter(s => compare(s.at, at) === 0)) { flush(); lines.push(`% ${section.label.replace(/[\r\n]/gu, ' ')}`); }
    for (const chord of draft.chords.filter(c => compare(c.at, at) === 0)) line += `"${chord.symbol}"`;
    while (noteIndex < draft.notes.length && compare(endOf(draft.notes[noteIndex]!), at) <= 0) noteIndex += 1;
    const candidate = draft.notes[noteIndex];
    const active = candidate && compare(candidate.start, at) <= 0 ? candidate : undefined;
    const tied = active?.pitch !== null && active !== undefined && (compare(endOf(active), until) > 0 || active.tieToNext);
    line += pitchABC(active?.pitch ?? null) + lengthABC(subtract(until, at)) + (tied ? '-' : '') + ' ';
  }
  line += '|]'; flush(); return lines.join('\n') + '\n';
}
