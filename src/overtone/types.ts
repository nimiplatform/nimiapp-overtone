// Renderer-side typed entities for Overtone. Authority: .nimi/spec/overtone/kernel/data-model-contract.md

export type TakeOrigin = 'prompt' | 'extend' | 'remix' | 'reference';

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

export interface SongTake {
  takeId: string;
  parentTakeId?: string;
  origin: TakeOrigin;
  title: string;
  jobId: string;
  artifactId?: string;
  promptSnapshot: string;
  lyricsSnapshot?: string;
  styleSnapshot?: string;
  durationSeconds?: number;
  instrumental?: boolean;
  favorite: boolean;
  discarded: boolean;
  createdAt: number;
}

export interface GenerationJob {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled' | 'timeout';
  progressLabel?: string;
  errorMessage?: string;
}

export type PublishSourceMode = 'prompt-only' | 'uploaded-audio' | 'derived-take';

export interface PublishDraft {
  takeId: string;
  title: string;
  description: string;
  tags: string[];
  sourceMode: PublishSourceMode;
  provenanceConfirmed: boolean;
}

export type PublishStatus = 'idle' | 'uploading' | 'creating' | 'done' | 'error';

export interface ReadinessSnapshot {
  runtimeStatus: 'checking' | 'ready' | 'degraded' | 'unavailable';
  runtimeErrorMessage?: string;
  textConnectorAvailable: boolean;
  musicConnectorAvailable: boolean;
  selectedTextConnectorId?: string;
  selectedTextModelId?: string;
  selectedMusicConnectorId?: string;
  selectedMusicModelId?: string;
  realmConfigured: boolean;
  realmAuthenticated: boolean;
}

export const ORIGIN_TO_SOURCE_MODE: Record<TakeOrigin, PublishSourceMode> = {
  prompt: 'prompt-only',
  extend: 'derived-take',
  remix: 'derived-take',
  reference: 'uploaded-audio',
};

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
