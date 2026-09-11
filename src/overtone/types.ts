import { createNimiClientId } from '@nimiplatform/sdk/types';

// Renderer-side typed entities for Overtone. Authority:
// .nimi/spec/overtone/canonical/data-model.authority.yaml

export type TakeOrigin = 'prompt';

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

export interface SongTake {
  takeId: string;
  parentTakeId?: string;
  origin: TakeOrigin;
  title: string;
  jobId: string;
  artifactId: string;
  artifactMimeType: string;
  artifactByteLength: number;
  artifactFileExtension: string;
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

export interface GenerationJob {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled' | 'timeout';
}

// Author-owned pending import: references a completed Runtime job, never a shadow job state.
export interface RecoverableMusicResult {
  jobId: string;
  title: string;
  parentTakeId?: string;
  promptSnapshot: string;
  lyricsSnapshot: string;
  styleSnapshot?: string;
  targetDurationSeconds: number;
  creationMode: 'sketch' | 'song';
  createdAt: number;
}

export interface ReadinessSnapshot {
  runtimeStatus: 'checking' | 'ready' | 'unavailable';
  runtimeErrorMessage?: string;
  textCapabilityAvailable: boolean;
  musicCapabilityAvailable: boolean;
}

export function makeId(prefix: string): string {
  return createNimiClientId(prefix);
}
