import type { Midi } from '@tonejs/midi';
import { ScoreError, ZERO, asNumber, beat, compare, validateDraft, type ScoreDraft } from './model.js';
import { keyAccidentals } from './abc.js';

export function listMidiTracks(midi: Midi) {
  return midi.tracks.flatMap((track, index) => track.notes.length ? [{ index, name: track.name, notes: track.notes.length, percussion: track.instrument.percussion }] : []);
}

// @nimi-authority: rule.overtone.score.r004
// The caller keeps the original MIDI asset and asks the author to accept the
// returned losses before saving this independently editable score document.
export function draftFromMidi(midi: Midi, trackIndex: number, subdivisionsPerQuarter = 4): ScoreDraft {
  if (![1, 2, 4, 8, 16].includes(subdivisionsPerQuarter)) throw new ScoreError('score-grid-invalid');
  const track = midi.tracks[trackIndex];
  if (!track?.notes.length || track.instrument.percussion) throw new ScoreError('score-melody-track-required');
  const ppq = midi.header.ppq;
  if (!Number.isSafeInteger(ppq) || ppq <= 0) throw new ScoreError('score-midi-timing-invalid');
  const losses = new Set<string>(['midi-no-chord-symbols']);
  if (listMidiTracks(midi).length > 1) losses.add('omitted-tracks');
  if (Object.values(track.controlChanges).some(events => events.length) || track.pitchBends.length) losses.add('midi-controllers');
  if (track.notes.some(n => n.velocity !== track.notes[0]!.velocity)) losses.add('midi-dynamics');
  const at = (ticks: number) => {
    if (!Number.isSafeInteger(ticks) || ticks < 0) throw new ScoreError('score-midi-timing-invalid');
    const exact = beat(ticks, ppq);
    const quantized = beat(Math.round(asNumber(exact) * subdivisionsPerQuarter), subdivisionsPerQuarter);
    if (compare(exact, quantized)) losses.add('quantization');
    return quantized;
  };
  const source = [...track.notes].sort((a, b) => a.ticks - b.ticks);
  const notes = source.map((note, i) => {
    if (i && source[i - 1]!.ticks + source[i - 1]!.durationTicks > note.ticks) throw new ScoreError('score-midi-polyphony');
    const start = at(note.ticks);
    let duration = at(note.durationTicks);
    if (compare(duration, ZERO) === 0) { duration = beat(1, subdivisionsPerQuarter); losses.add('quantization'); }
    return { id: `note-${i + 1}`, start, duration, pitch: note.midi };
  });
  if (midi.header.tempos.length > 1) losses.add('tempo-changes');
  const firstTempo = midi.header.tempos[0];
  if (!firstTempo || firstTempo.ticks !== 0) losses.add('implicit-tempo');
  const tempo = firstTempo?.ticks === 0 ? Math.round(firstTempo.bpm) : 120;
  if (firstTempo && Math.abs(firstTempo.bpm - tempo) > 0.001) losses.add('tempo-rounded');
  if (midi.header.keySignatures.length > 1) losses.add('key-changes');
  const signature = midi.header.keySignatures[0];
  const key = signature?.ticks === 0 ? `${signature.key}${signature.scale === 'minor' ? 'm' : ''}` : 'C';
  keyAccidentals(key);
  const meters = midi.header.timeSignatures.map(event => ({ at: at(event.ticks), meter: { numerator: event.timeSignature[0]!, denominator: event.timeSignature[1]! } }));
  if (!meters.length || compare(meters[0]!.at, ZERO) !== 0) {
    meters.unshift({ at: ZERO, meter: { numerator: 4, denominator: 4 } }); losses.add('implicit-meter');
  }
  const draft: ScoreDraft = { title: midi.name || track.name, voiceId: `midi-${trackIndex}`, tempo, key, notes,
    chords: [], sections: [], meters, losses: [...losses] };
  validateDraft(draft); return draft;
}
