import { createNimiClientId } from '@nimiplatform/sdk/types';
import type { NimiMusicInputCapabilities } from '@nimiplatform/sdk/ai';
import type { NimiLocalAppVoiceConvertTargetVoice, NimiMusicTranscriptionFormat, NimiMusicTranscriptionPart, NimiVoiceConvertInputProfile, NimiVoiceConversionLengthRelation } from '@nimiplatform/sdk/app';

// Renderer-side typed entities for Overtone. Authority:
// .nimi/spec/overtone/canonical/data-model.authority.yaml

export type TakeOrigin = 'runtime-result' | 'imported-recording' | 'local-render';

export interface OwnedAsset {
  readonly relativePath: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}
export interface ProjectAudio extends OwnedAsset {
  readonly sampleRateHz: number;
  readonly channels: number;
  readonly frameCount: number;
  readonly durationMs: number;
}
export interface ScoreDocument {
  readonly scoreId: string;
  readonly asset: OwnedAsset;
  readonly format: 'abc' | 'midi';
  readonly origin: 'generated-plan' | 'transcription-estimate' | 'imported' | 'author-edit' | 'explicit-conversion';
  readonly parentScoreId?: string;
  readonly sourceTakeId?: string;
  readonly transcriptionId?: string;
  readonly transcriptionPart?: NimiMusicTranscriptionPart;
  readonly truncated?: boolean;
  readonly title: string;
  readonly createdAt: number;
  readonly losses?: readonly string[];
}

export interface AudioFrameRange { readonly startFrame: number; readonly endFrame: number }
export interface MusicTranscriptionDocument {
  readonly transcriptionId: string;
  readonly jobId: string;
  readonly clientSubmissionId: string;
  readonly sourceTakeId: string;
  readonly sourceAudio: ProjectAudio;
  readonly sourceRange: AudioFrameRange;
  readonly scoreIds: readonly string[];
  readonly timeline?: OwnedAsset;
  readonly completeness: 'unknown' | 'complete' | 'truncated';
  readonly createdAt: number;
}
export interface RecoverableMusicTranscription {
  readonly clientSubmissionId: string;
  readonly projectId: string;
  readonly jobId?: string;
  readonly sourceTakeId: string;
  readonly sourceArtifactId: string;
  readonly sourceAudio: ProjectAudio;
  readonly sourceRange: AudioFrameRange;
  readonly requestedFormats: readonly NimiMusicTranscriptionFormat[];
  readonly requestedPart: NimiMusicTranscriptionPart;
  readonly title: string;
  readonly createdAt: number;
}

// Author-side target voice choice before its reference recording is uploaded.
// Overtone offers only a project recording as the target voice; preset and
// voice-asset carriers first need a compatible Runtime-projected resource.
export type VoiceConvertTargetChoice = { kind: 'reference-audio'; range?: AudioFrameRange };
export type VoiceConvertTargetVoice = Extract<NimiLocalAppVoiceConvertTargetVoice, { kind: 'reference-audio' }>;

// Durable author intent for one voice conversion run; job status remains a
// fresh Runtime projection and the 24h protected recovery window applies.
export interface RecoverableVoiceConvert {
  readonly clientSubmissionId: string;
  readonly projectId: string;
  readonly jobId?: string;
  readonly title: string;
  readonly sourceTakeId: string;
  readonly sourceArtifactId: string;
  readonly sourceAudio: ProjectAudio;
  readonly sourceRange: AudioFrameRange;
  readonly targetVoice: VoiceConvertTargetVoice;
  readonly targetTakeId: string;
  readonly targetAudio: ProjectAudio;
  readonly semitoneShift?: number;
  readonly retainedAccompanimentTakeId: string;
  readonly retainedAccompanimentArtifactId: string;
  readonly retainedAccompaniment: ProjectAudio;
  readonly createdAt: number;
}

// Durable author intent for one audio.separate run. The protected submission
// admits no clientSubmissionId, so recovery observes the captured jobId only;
// an entry without a jobId can only be forgotten.
export interface RecoverableSeparation {
  readonly separationId: string;
  readonly projectId: string;
  readonly jobId?: string;
  readonly title: string;
  readonly sourceTakeId: string;
  readonly sourceArtifactId: string;
  readonly sourceAudio: ProjectAudio;
  readonly sourceRange: AudioFrameRange;
  readonly requestedInstrumentParts: boolean;
  readonly inputPreparation?: AudioPreparationRecord;
  readonly createdAt: number;
}

export interface SongBrief {
  title: string;
  genre: string;
  mood: string;
  tempo: string;
  description: string;
}

export interface LyricsDocument {
  text: string;
  source: 'assistant' | 'manual' | 'mixed';
  updatedAt: number;
}

export interface SongSection {
  kind: 'intro' | 'verse' | 'pre-chorus' | 'chorus' | 'bridge' | 'outro';
  name: string;
  arrangement: string;
  lyrics: string;
}

// App-owned writing draft; this is creative intent, not an audio analysis or job.
export interface FullSongDraft {
  sourceTakeId: string;
  sourceTitle: string;
  sourcePrompt: string;
  sourceLyrics: string;
  title: string;
  durationSeconds: 90 | 120 | 180;
  sections: SongSection[];
}

interface SongVersionFields {
  takeId: string;
  parentTakeId?: string;
  title: string;
  audio: ProjectAudio;
  scoreId?: string;
  inputScoreId?: string;
  scoreConditioning?: 'melody-only' | 'melody-and-harmony';
  promptSnapshot: string;
  lyricsSnapshot?: string;
  styleSnapshot?: string;
  durationSeconds?: number;
  targetDurationSeconds?: number;
  creationMode?: 'sketch' | 'song';
  favorite: boolean;
  discarded: boolean;
  createdAt: number;
}

export interface AudioInfoFacts {
  readonly sampleRateHz: number;
  readonly channels: number;
  readonly frameCount: number;
  readonly durationMs: number;
}

// Explicit derived audio conversion; the only sanctioned rate or channel change.
export interface AudioPreparationRecord {
  readonly profile: 'canonical-pcm-v1';
  readonly targetSampleRateHz: number;
  readonly channelMode: 'PRESERVE' | 'MONO_TO_STEREO' | 'STEREO_TO_MONO';
}

export interface DerivedAudioRecord {
  readonly sourceArtifactId: string;
  readonly artifactId: string;
  readonly preparation: AudioPreparationRecord;
  readonly audio: ProjectAudio;
}

// Mix alignment facts on one source timeline: the converted vocal is placed at
// vocalStartFrame of the mix domain and the retained accompaniment keeps its
// zero point and full length. renderProjectMix never trims or stretches a track.
// Both tracks are summed at unity gain without limiting or normalization; peak
// is the measured maximum absolute float sample of the stored mix. A peak above
// 1.0 is kept in the float WAV and clips on fixed-point playback or conversion.
export interface VoiceMixRecord {
  readonly mixTakeId: string;
  readonly outputFrameCount: number;
  readonly lengthPolicy: 'longest-track';
  readonly vocalStartFrame: number;
  readonly vocalFrameCount: number;
  readonly accompanimentFrameCount: number;
  readonly peak: number;
}

export interface VoiceConvertDerivation {
  readonly sourceTakeId: string;
  readonly sourceArtifactId: string;
  readonly sourceRange: AudioFrameRange;
  readonly sourceInfo: AudioInfoFacts;
  readonly targetVoice: VoiceConvertTargetVoice;
  readonly semitoneShift?: number;
  readonly convertedVocalArtifactId: string;
  readonly inputRange: AudioFrameRange;
  readonly vocalInfo: AudioInfoFacts;
  readonly lengthRelation: NimiVoiceConversionLengthRelation;
  readonly durationDeltaMs: number;
  readonly retainedAccompanimentTakeId: string;
  readonly retainedAccompanimentArtifactId: string;
  readonly retainedAccompaniment: ProjectAudio;
  readonly mixDomain: { readonly sampleRateHz: number; readonly channels: number };
  readonly derived: readonly DerivedAudioRecord[];
  readonly mix: VoiceMixRecord;
}

export type SeparationStem = 'vocals' | 'background' | 'drums' | 'bass' | 'other';

// One adopted stem of one protected audio.separate result. Every stem of the
// same separation shares separationId, jobId and its exact source identity.
// sourceRange is the separated selection on the source take's timeline, so the
// stem's frame zero is that range start. inputPreparation records the explicit
// derived conversion into the native separation domain when one was needed.
export interface AudioSeparationRecord {
  readonly separationId: string;
  readonly sourceTakeId: string;
  readonly sourceArtifactId: string;
  readonly sourceAudio: ProjectAudio;
  readonly sourceRange: AudioFrameRange;
  readonly stem: SeparationStem;
  readonly requestedInstrumentParts: boolean;
  readonly inputPreparation?: AudioPreparationRecord;
}

export type SongTake = SongVersionFields & (
  | { origin: 'runtime-result'; jobId: string; clientSubmissionId: string; capability: 'music.generate'; termination: 'model-end' | 'budget-limit' | 'unknown'; actualSeed?: number }
  | { origin: 'runtime-result'; jobId: string; clientSubmissionId: string; capability: 'audio.voice.convert'; derivation: VoiceConvertDerivation }
  | { origin: 'runtime-result'; jobId: string; capability: 'audio.separate'; separation: AudioSeparationRecord }
  | { origin: 'imported-recording'; originalAsset: OwnedAsset; jobId?: never }
  | { origin: 'local-render'; mixRecipe: { sourceTakeIds: readonly string[] }; jobId?: never }
);
export type SeparationSongTake = Extract<SongTake, { capability: 'audio.separate' }>;

export interface GenerationJob {
  jobId: string;
  capability?: 'music.generate' | 'music.transcribe' | 'audio.voice.convert' | 'audio.separate';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled' | 'timeout';
}

// Durable author intent; job status remains a fresh Runtime projection.
export interface RecoverableMusicResult {
  clientSubmissionId: string;
  projectId: string;
  jobId?: string;
  title: string;
  parentTakeId?: string;
  promptSnapshot: string;
  lyricsSnapshot: string;
  styleSnapshot?: string;
  targetDurationSeconds: number;
  creationMode: 'sketch' | 'song';
  createdAt: number;
  inputScoreId?: string;
  scoreConditioning?: 'melody-only' | 'melody-and-harmony';
  seed?: number;
  instrumental?: boolean;
  returnGeneratedScore?: boolean;
}

export interface ReadinessSnapshot {
  runtimeStatus: 'checking' | 'ready' | 'unavailable';
  runtimeErrorMessage?: string;
  textCapabilityAvailable: boolean;
  musicCapabilityAvailable: boolean;
  musicInput?: NimiMusicInputCapabilities;
  musicTranscriptionAvailable?: boolean;
  musicTranscriptionInput?: NimiMusicInputCapabilities['transcription'];
  voiceConvertAvailable?: boolean;
  voiceConvertInput?: readonly NimiVoiceConvertInputProfile[];
  audioSeparateAvailable?: boolean;
}

export interface SongProject {
  schemaVersion: 2;
  projectId: string;
  createdAt: number;
  brief: SongBrief | null;
  lyrics: LyricsDocument | null;
  takes: SongTake[];
  selectedTakeId: string | null;
  comparedTakeIds: [string | null, string | null];
  scores: ScoreDocument[];
  selectedScoreId: string | null;
  generationScoreId?: string | null;
  scoreBudgetSeconds?: number;
  fullSong?: FullSongDraft | null;
  recoverableResults?: RecoverableMusicResult[];
  transcriptions?: MusicTranscriptionDocument[];
  recoverableTranscriptions?: RecoverableMusicTranscription[];
  recoverableVoiceConversions?: RecoverableVoiceConvert[];
  recoverableSeparations?: RecoverableSeparation[];
}

export function makeId(prefix: string): string {
  return createNimiClientId(prefix);
}

export function sameProjectAudio(left: ProjectAudio, right: ProjectAudio): boolean {
  return (['relativePath', 'mimeType', 'sizeBytes', 'sha256', 'sampleRateHz', 'channels', 'frameCount', 'durationMs'] as const).every(key => left[key] === right[key]);
}

export function scoreSourceTakeId(project: SongProject, scoreId: string): string | undefined {
  const seen = new Set<string>();
  let score = project.scores.find(item => item.scoreId === scoreId);
  while (score && !seen.has(score.scoreId)) {
    seen.add(score.scoreId);
    const sourceTakeId = score.sourceTakeId;
    if (sourceTakeId) return project.takes.find(take => take.takeId === sourceTakeId)?.takeId;
    const parent = score.parentScoreId;
    score = parent ? project.scores.find(item => item.scoreId === parent) : undefined;
  }
  return undefined;
}
