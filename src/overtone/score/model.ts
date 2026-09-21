// @nimi-authority: rule.overtone.score.r003
export interface Beat { readonly n: number; readonly d: number }
export interface ScoreNote {
  readonly id: string;
  readonly start: Beat;
  readonly duration: Beat;
  readonly pitch: number | null;
  readonly tieToNext?: boolean;
}
export interface Meter { readonly numerator: number; readonly denominator: number }
export interface ScoreDraft {
  readonly title: string;
  readonly voiceId: string;
  readonly tempo: number;
  readonly key: string;
  readonly notes: readonly ScoreNote[];
  readonly chords: readonly { readonly at: Beat; readonly symbol: string }[];
  readonly sections: readonly { readonly at: Beat; readonly label: string }[];
  readonly meters: readonly { readonly at: Beat; readonly meter: Meter }[];
  readonly losses: readonly string[];
}

export class ScoreError extends Error {
  constructor(readonly code: string, readonly detail = '') { super(`${code}${detail ? `: ${detail}` : ''}`); this.name = 'ScoreError'; }
}
export function beat(n: number, d = 1): Beat {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d <= 0) throw new ScoreError('score-number-invalid');
  let a = Math.abs(n); let b = d;
  while (b) { const r = a % b; a = b; b = r; }
  return { n: n / (a || 1), d: d / (a || 1) };
}
export const ZERO = beat(0);
export const add = (a: Beat, b: Beat): Beat => beat(a.n * b.d + b.n * a.d, a.d * b.d);
export const subtract = (a: Beat, b: Beat): Beat => beat(a.n * b.d - b.n * a.d, a.d * b.d);
export const multiply = (a: Beat, b: Beat): Beat => beat(a.n * b.n, a.d * b.d);
export const compare = (a: Beat, b: Beat): number => Math.sign(subtract(a, b).n);
export const asNumber = (a: Beat): number => a.n / a.d;
export const endOf = (n: ScoreNote): Beat => add(n.start, n.duration);
export const meterLength = (m: Meter): Beat => beat(m.numerator * 4, m.denominator);
export const scoreEnd = (s: ScoreDraft): Beat => s.notes.length ? endOf(s.notes[s.notes.length - 1]!) : ZERO;

export function validateDraft(draft: ScoreDraft): void {
  if (!Number.isFinite(draft.tempo) || draft.tempo < 20 || draft.tempo > 400) throw new ScoreError('score-tempo-invalid');
  if (!draft.notes.length || draft.notes.length > 16384) throw new ScoreError('score-note-count');
  const ids = new Set<string>();
  draft.notes.forEach((note, i) => {
    beat(note.start.n, note.start.d); beat(note.duration.n, note.duration.d);
    if (ids.has(note.id) || !note.id || compare(note.start, ZERO) < 0 || compare(note.duration, ZERO) <= 0
      || (note.pitch !== null && (!Number.isInteger(note.pitch) || note.pitch < 0 || note.pitch > 127))) throw new ScoreError('score-note-invalid', note.id);
    ids.add(note.id);
    const previous = draft.notes[i - 1];
    if (previous && compare(endOf(previous), note.start) > 0) throw new ScoreError('score-overlap', note.id);
    if (note.tieToNext) {
      const next = draft.notes[i + 1];
      if (note.pitch === null || !next || next.pitch !== note.pitch || compare(endOf(note), next.start) !== 0) throw new ScoreError('score-tie-invalid', note.id);
    }
  });
  if (!draft.meters.length || compare(draft.meters[0]!.at, ZERO) !== 0) throw new ScoreError('score-meter-required');
  draft.meters.forEach((entry, i) => {
    if (!Number.isInteger(entry.meter.numerator) || entry.meter.numerator < 1 || entry.meter.numerator > 32
      || ![1, 2, 4, 8, 16, 32, 64].includes(entry.meter.denominator)
      || (i > 0 && compare(draft.meters[i - 1]!.at, entry.at) >= 0)) throw new ScoreError('score-meter-invalid');
  });
  for (const chord of draft.chords) {
    if (!/^[A-G](?:#{1,2}|b{1,2})?[A-Za-z0-9+#b°ø()\-]*(?:\/[A-G](?:#{1,2}|b{1,2})?)?$/u.test(chord.symbol)
      || compare(chord.at, ZERO) < 0 || compare(chord.at, scoreEnd(draft)) > 0) throw new ScoreError('score-chord-invalid', chord.symbol);
  }
}

export function editNote(draft: ScoreDraft, id: string, change: Partial<Pick<ScoreNote, 'pitch' | 'start' | 'duration'>>): ScoreDraft {
  if (!draft.notes.some(n => n.id === id)) throw new ScoreError('score-note-missing', id);
  const next = { ...draft, notes: draft.notes.map(n => n.id === id ? { ...n, ...change } : n).sort((a, b) => compare(a.start, b.start)) };
  validateDraft(next); return next;
}

export function transposeNotes(draft: ScoreDraft, ids: readonly string[], semitones: number): ScoreDraft {
  if (!Number.isInteger(semitones)) throw new ScoreError('score-transpose-invalid');
  const selected = new Set(ids);
  const next = { ...draft, notes: draft.notes.map(n => selected.has(n.id) && n.pitch !== null ? { ...n, pitch: n.pitch + semitones } : n) };
  validateDraft(next); return next;
}

export function includeTiedNotes(draft: ScoreDraft, ids: readonly string[]): readonly string[] {
  const selected = new Set(ids);
  let group: string[] = [];
  for (const note of draft.notes) {
    group.push(note.id);
    if (!note.tieToNext) {
      if (group.some(id => selected.has(id))) group.forEach(id => selected.add(id));
      group = [];
    }
  }
  return draft.notes.filter(note => selected.has(note.id)).map(note => note.id);
}

export function auditionWindow(draft: ScoreDraft, from: Beat, until: Beat): ScoreDraft {
  if (compare(from, ZERO) < 0 || compare(until, from) <= 0) throw new ScoreError('score-window-invalid');
  const notes = draft.notes.filter(n => compare(endOf(n), from) > 0 && compare(n.start, until) < 0).map(n => {
    const start = compare(n.start, from) < 0 ? from : n.start;
    const end = compare(endOf(n), until) > 0 ? until : endOf(n);
    return { ...n, start: subtract(start, from), duration: subtract(end, start) };
  });
  if (notes.length) { const { tieToNext: _tie, ...last } = notes[notes.length - 1]!; notes[notes.length - 1] = last; }
  const atStart = [...draft.meters].reverse().find(m => compare(m.at, from) <= 0) ?? draft.meters[0]!;
  const within = (at: Beat) => compare(at, from) >= 0 && compare(at, until) < 0;
  const next: ScoreDraft = { ...draft, notes,
    meters: [{ at: ZERO, meter: atStart.meter }, ...draft.meters.filter(m => compare(m.at, from) > 0 && within(m.at)).map(m => ({ ...m, at: subtract(m.at, from) }))],
    chords: draft.chords.filter(c => within(c.at)).map(c => ({ ...c, at: subtract(c.at, from) })),
    sections: draft.sections.filter(s => within(s.at)).map(s => ({ ...s, at: subtract(s.at, from) })),
  };
  validateDraft(next); return next;
}
