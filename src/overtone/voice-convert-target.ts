import type { AudioFrameRange, VoiceConvertTargetChoice, VoiceConvertTargetVoice } from './types.js';

// Seconds typed by the author mapped to one frame range on the recording's own
// canonical timeline; null means the selection is not a usable range.
export function selectionFrames(audio: { sampleRateHz: number; frameCount: number }, rangeMode: string,
  startSeconds: string, endSeconds: string): AudioFrameRange | null {
  const start = startSeconds.trim(); const end = endSeconds.trim();
  const range = {
    startFrame: rangeMode === 'range' && start ? Math.round(Number(start) * audio.sampleRateHz) : 0,
    endFrame: rangeMode === 'range' && end ? Math.round(Number(end) * audio.sampleRateHz) : audio.frameCount,
  };
  return validFrameRange(range, audio.frameCount) ? range : null;
}

export function validFrameRange(range: AudioFrameRange, frameCount: number): boolean {
  return Number.isSafeInteger(range.startFrame) && Number.isSafeInteger(range.endFrame)
    && range.startFrame >= 0 && range.startFrame < range.endFrame && range.endFrame <= frameCount;
}

// UI-shaped target inputs mapped to the typed author choice. The reference
// range stays a nested AudioFrameRange on the choice and on the prepared
// target voice so the submitted request keeps the exact selection.
export function buildVoiceConvertTargetChoice(input: { reference: { sampleRateHz: number; frameCount: number };
  rangeMode: string; startSeconds: string; endSeconds: string }): VoiceConvertTargetChoice | null {
  const ranged = input.rangeMode === 'range' && Boolean(input.startSeconds.trim() || input.endSeconds.trim());
  if (!ranged) return { kind: 'reference-audio' };
  const range = selectionFrames(input.reference, 'range', input.startSeconds, input.endSeconds);
  return range ? { kind: 'reference-audio', range } : null;
}

export function preparedVoiceTarget(choice: VoiceConvertTargetChoice, referenceArtifactId: string): VoiceConvertTargetVoice {
  if (choice.kind !== 'reference-audio' || !referenceArtifactId) throw new Error('OVERTONE_VOICE_CONVERT_TARGET');
  return { kind: 'reference-audio', artifactId: referenceArtifactId, ...(choice.range ? { range: choice.range } : {}) };
}
