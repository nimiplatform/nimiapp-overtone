import { asNumber, endOf, scoreEnd, validateDraft, type ScoreDraft } from './model.js';

// @nimi-authority: rule.overtone.score.r003
// A local monophonic synthesizer for checking notes, never generated singing.
export async function auditionScore(draft: ScoreDraft, onEnded: () => void): Promise<() => void> {
  validateDraft(draft);
  const context = new AudioContext();
  try {
    await context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle'; oscillator.connect(gain); gain.connect(context.destination);
    const base = context.currentTime + .03; const secondsPerBeat = 60 / draft.tempo;
    gain.gain.setValueAtTime(0, base);
    for (let index = 0; index < draft.notes.length; index += 1) {
      const note = draft.notes[index]!;
      if (note.pitch === null) continue;
      const start = base + asNumber(note.start) * secondsPerBeat;
      let end = base + asNumber(endOf(note)) * secondsPerBeat;
      while (draft.notes[index]?.tieToNext) { index += 1; end = base + asNumber(endOf(draft.notes[index]!)) * secondsPerBeat; }
      const edge = Math.min(.008, (end - start) / 4);
      oscillator.frequency.setValueAtTime(440 * 2 ** ((note.pitch - 69) / 12), start);
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.12, start + edge);
      gain.gain.setValueAtTime(.12, end - edge); gain.gain.linearRampToValueAtTime(0, end);
    }
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true; oscillator.onended = null;
      try { oscillator.stop(); } catch { /* Already ended. */ }
      oscillator.disconnect(); gain.disconnect(); void context.close(); onEnded();
    };
    oscillator.onended = stop;
    oscillator.start(base); oscillator.stop(base + asNumber(scoreEnd(draft)) * secondsPerBeat + .03);
    return stop;
  } catch (error) { await context.close(); throw error; }
}
