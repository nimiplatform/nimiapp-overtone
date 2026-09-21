import abcjs from 'abcjs';
import { listABCVoices } from './abc.js';
import { ScoreError } from './model.js';

// @nimi-authority: rule.overtone.score.r004
export function prepareMidiConversion(source: string): { bytes: Uint8Array; losses: readonly string[] } {
  listABCVoices(source);
  const parsed = abcjs.parseOnly(source);
  if (parsed.length !== 1 || parsed[0]?.warnings?.length) throw new ScoreError('score-syntax-unsupported');
  const output: unknown = abcjs.synth.getMidiFile(source, { midiOutputType: 'binary', chordsOff: true });
  if (!Array.isArray(output) || output.length !== 1 || !(output[0] instanceof Uint8Array) || !output[0].length) throw new ScoreError('score-midi-output-invalid');
  const losses = new Set<string>();
  const lines = source.split(/\r?\n/u);
  if (lines.some(line => !/^[A-Za-z]:|^%/u.test(line.trim()) && /"/u.test(line))) losses.add('midi-no-chord-symbols');
  if (lines.some(line => /^%[^%]/u.test(line.trim()))) losses.add('abc-labels');
  for (const [field, loss] of [['M', 'abc-meter-changes'], ['Q', 'abc-tempo-changes'], ['K', 'abc-key-changes']] as const) {
    const values = lines.filter(line => line.startsWith(`${field}:`)).map(line => line.slice(2).trim().replace(/\s+/gu, ''));
    if (new Set(values).size > 1) losses.add(loss);
  }
  return { bytes: output[0], losses: [...losses] };
}
