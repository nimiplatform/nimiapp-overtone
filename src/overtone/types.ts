import { createNimiClientId } from '@nimiplatform/sdk/types';
import type { NimiMusicInputCapabilities } from '@nimiplatform/sdk/ai';

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
  readonly truncated?: boolean;
  readonly title: string;
  readonly createdAt: number;
  readonly losses?: readonly string[];
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
export type SongTake = SongVersionFields & (
  | { origin: 'runtime-result'; jobId: string; clientSubmissionId: string; capability: 'music.generate'; termination: 'model-end' | 'budget-limit' | 'unknown'; actualSeed?: number }
  | { origin: 'imported-recording'; originalAsset: OwnedAsset; jobId?: never }
  | { origin: 'local-render'; mixRecipe: { sourceTakeIds: readonly string[] }; jobId?: never }
);

export interface GenerationJob {
  jobId: string;
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
}

export function makeId(prefix: string): string {
  return createNimiClientId(prefix);
}
