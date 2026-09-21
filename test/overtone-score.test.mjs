import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import abcjs from 'abcjs';
import midiPackage from '@tonejs/midi';
import { loadSource } from './load-source.mjs';

const { Midi } = midiPackage;
const { listABCVoices, parseABCLeadSheet, serializeABCLeadSheet, transposeScoreKey } = await loadSource('../src/overtone/score/abc.ts');
const { beat, editNote, transposeNotes, auditionWindow, includeTiedNotes } = await loadSource('../src/overtone/score/model.ts');
const { draftFromMidi } = await loadSource('../src/overtone/score/midi.ts');
const { prepareMidiConversion } = await loadSource('../src/overtone/score/export-midi.ts');
const fixture = name => readFileSync(new URL(`fixtures/scores/${name}.abc`, import.meta.url), 'utf8');
const midiFromABC = abc => new Midi(abcjs.synth.getMidiFile(abc, { midiOutputType: 'binary', chordsOff: true })[0]);
const events = midi => midi.tracks.filter(track => track.notes.length).map(track => track.notes.map(n => [n.midi, n.ticks, n.durationTicks]));

// Actual pinned-engine outputs from the music iteration packet. YuE2 uses our
// own lyrics; SheetSage is the previously authorized full-song transcription.
// Library event comparisons verify notation conversion, not model accuracy.
for (const [name, counts] of [['yue2-generated', [37, 26]], ['sheetsage-estimated', [305, 20]]]) {
  test(`explicit voice derivation preserves actual ${name} note events`, () => {
    const original = fixture(name);
    assert.throws(() => parseABCLeadSheet(original), error => error.code === 'score-voice-required');
    const originalEvents = events(midiFromABC(original));
    assert.deepEqual(originalEvents.map(track => track.length), counts);
    listABCVoices(original).forEach((voice, index) => {
      const draft = parseABCLeadSheet(original, voice.id);
      assert.deepEqual(draft.losses, ['omitted-voices']);
      const serialized = serializeABCLeadSheet(draft);
      assert.deepEqual(events(midiFromABC(serialized)), [originalEvents[index]]);
      assert.deepEqual(parseABCLeadSheet(serialized).meters, draft.meters);
    });
    assert.equal(fixture(name), original, 'derivation never modifies the source');
  });
}

test('score edits alter the selected pitch and reject overlaps, broken ties and invalid durations', () => {
  const abc = 'X:1\nM:4/4\nL:1/8\nQ:1/4=100\nK:C\nC2 D2 E2-F2|';
  assert.throws(() => parseABCLeadSheet(abc), error => error.code === 'score-tie-invalid');
  const before = parseABCLeadSheet(abc.replace('E2-F2', 'E2-E2'));
  const after = transposeNotes(before, [before.notes[0].id], 2);
  assert.equal(after.notes[0].pitch, before.notes[0].pitch + 2);
  assert.deepEqual(after.notes.slice(1), before.notes.slice(1));
  assert.equal(events(midiFromABC(serializeABCLeadSheet(after)))[0][0][0], 62);
  assert.throws(() => editNote(before, before.notes[1].id, { start: beat(1, 2) }), error => error.code === 'score-overlap');
  assert.throws(() => editNote(before, before.notes[0].id, { duration: beat(0) }), error => error.code === 'score-note-invalid');
  assert.throws(() => transposeNotes(before, [before.notes[2].id], 1), error => error.code === 'score-tie-invalid');
});

test('unsupported ABC is rejected for structured editing instead of silently flattened', () => {
  const header = 'X:1\nM:4/4\nL:1/8\nQ:1/4=100\nK:C\n';
  for (const body of ['[CEG]2', '(3CDE', '{c}C2', 'C2|:D2:|', 'C2!trill!D2', '^/C2', 'C2 & D2']) {
    assert.throws(() => parseABCLeadSheet(header + body), error => error.name === 'ScoreError', body);
  }
});

test('changing key transposes notes and chord roots together and preserves the source', () => {
  const original = parseABCLeadSheet('X:1\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\n"C/E"C2 "Dm"D2|');
  const next = transposeScoreKey(original, 'D');
  assert.deepEqual(next.notes.map(n => n.pitch), [62, 64]);
  assert.deepEqual(next.chords.map(c => c.symbol), ['D/F#', 'Em']);
  assert.deepEqual(original.notes.map(n => n.pitch), [60, 62]);
  assert.throws(() => transposeScoreKey(original, 'Dm'), error => error.code === 'score-key-mode-change');
});

test('auditioning a visible range skips the full-score intro and does not crop the saved draft', () => {
  const original = parseABCLeadSheet(fixture('yue2-generated'), 'Vocal');
  const before = JSON.stringify(original);
  const window = auditionWindow(original, beat(20), beat(36));
  assert.ok(window.notes.some(n => n.pitch !== null));
  assert.equal(window.notes[0].start.n, 0);
  assert.ok(window.notes.every(n => n.start.n / n.start.d < 16));
  assert.equal(window.notes.at(-1).tieToNext, undefined);
  assert.equal(JSON.stringify(original), before);
});

test('MIDI conversion exposes quantization and omitted information from an actual encoded file', () => {
  const original = new Midi();
  original.header.setTempo(100);
  original.header.timeSignatures = [{ ticks: 0, measures: 0, timeSignature: [4, 4] }];
  original.header.tempos.push({ ticks: 480, bpm: 120 });
  original.header.update();
  const lead = original.addTrack(); lead.name = 'Lead';
  lead.addNote({ midi: 60, ticks: 33, durationTicks: 220, velocity: 0.4 });
  lead.addNote({ midi: 62, ticks: 300, durationTicks: 180, velocity: 0.9 });
  original.addTrack().addNote({ midi: 48, ticks: 0, durationTicks: 480 });
  const bytes = original.toArray(); const copy = Uint8Array.from(bytes);
  const parsed = new Midi(bytes);
  const draft = draftFromMidi(parsed, 0, 4);
  for (const loss of ['quantization', 'omitted-tracks', 'tempo-changes', 'midi-dynamics', 'midi-no-chord-symbols']) assert.ok(draft.losses.includes(loss), loss);
  assert.deepEqual(draft.notes.map(n => n.pitch), [60, 62]);
  assert.deepEqual(draft.notes.map(n => n.start), [beat(0), beat(3, 4)]);
  assert.deepEqual(bytes, copy);
  const roundTrip = midiFromABC(serializeABCLeadSheet(draft));
  assert.deepEqual(events(roundTrip)[0].map(n => n[0]), [60, 62]);
});

test('polyphonic MIDI needs a supported melody choice instead of losing simultaneous notes', () => {
  const midi = new Midi(); const track = midi.addTrack();
  track.addNote({ midi: 60, ticks: 0, durationTicks: 480 });
  track.addNote({ midi: 64, ticks: 0, durationTicks: 480 });
  assert.throws(() => draftFromMidi(new Midi(midi.toArray()), 0), error => error.code === 'score-midi-polyphony');
});

test('phrase selection includes tied notes beyond the visible boundary before transposing', () => {
  const draft = parseABCLeadSheet('X:1\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\nC4-|C4-|C2 D2|');
  const selected = includeTiedNotes(draft, [draft.notes[1].id]);
  assert.deepEqual(selected, draft.notes.slice(0, 3).map(n => n.id));
  const after = transposeNotes(draft, selected, 1);
  assert.deepEqual(after.notes.map(n => n.pitch), [61, 61, 61, 62]);
});

test('ABC to MIDI conversion exposes header changes and symbols that the encoded MIDI loses', () => {
  const source = 'X:1\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\n% Verse\n"C"C4|\nM:3/4\nQ:1/4=120\nK:G\nG3|';
  const conversion = prepareMidiConversion(source);
  const encoded = new Midi(conversion.bytes);
  for (const loss of ['midi-no-chord-symbols', 'abc-labels', 'abc-meter-changes', 'abc-tempo-changes', 'abc-key-changes']) assert.ok(conversion.losses.includes(loss), loss);
  assert.equal(encoded.header.tempos.length, 1);
  assert.equal(encoded.header.timeSignatures.length, 1);
  assert.equal(encoded.header.keySignatures.length, 1);
  assert.deepEqual(events(encoded)[0].map(n => n[0]), [60, 67]);
  assert.equal(prepareMidiConversion(fixture('yue2-generated')).bytes.length > 0, true);
});

test('MIDI gaps produce renderable rests without moving the melody', () => {
  const midi = new Midi(); midi.header.setTempo(87);
  midi.header.timeSignatures = [{ ticks: 0, measures: 0, timeSignature: [3, 4] }];
  const track = midi.addTrack();
  track.addNote({ midi: 72, ticks: midi.header.ppq * 14.5, durationTicks: midi.header.ppq * 0.5 });
  track.addNote({ midi: 70, ticks: midi.header.ppq * 15, durationTicks: midi.header.ppq * 1.5 });
  const abc = serializeABCLeadSheet(draftFromMidi(new Midi(midi.toArray()), 0));
  assert.equal(abcjs.parseOnly(abc)[0].warnings, undefined);
  assert.deepEqual(events(midiFromABC(abc)), events(midi));
});
