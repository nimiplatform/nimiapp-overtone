// Runtime workflow helpers: scenario job status translation, music-iteration
// extension builder, and Runtime-backed text generation. Authority:
// .nimi/spec/overtone/kernel/runtime-integration-contract.md (OVT-RT-*).

import {
  toNimiRuntimeProtoStruct,
  type Runtime,
  type NimiRuntimeScenarioJob,
  type NimiRuntimeScenarioJobSubmitRequest,
} from '@nimiplatform/sdk/runtime';
import { createNimiRuntimeAIModel, runNimiTextGenerate } from '@nimiplatform/sdk/ai';
import type { NimiJsonObject } from '@nimiplatform/sdk/contracts';
import { createNimiClientId } from '@nimiplatform/sdk/types';
import {
  ExecutionMode,
  FallbackPolicy,
  RoutePolicy,
  ScenarioJobStatus,
  ScenarioType,
  type SubmitScenarioJobRequest,
} from '@nimiplatform/sdk/runtime/generated';
import { appId } from '../shell/auth/runtime-platform.js';
import type { GenerationJob, TakeOrigin } from './types.js';

export function scenarioJobStatusToGenerationStatus(status: ScenarioJobStatus): GenerationJob['status'] {
  switch (status) {
    case ScenarioJobStatus.SUBMITTED:
    case ScenarioJobStatus.QUEUED:
      return 'pending';
    case ScenarioJobStatus.RUNNING:
      return 'running';
    case ScenarioJobStatus.COMPLETED:
      return 'completed';
    case ScenarioJobStatus.TIMEOUT:
      return 'timeout';
    case ScenarioJobStatus.CANCELED:
      return 'canceled';
    case ScenarioJobStatus.FAILED:
    default:
      return 'failed';
  }
}

export function scenarioJobStatusLabel(status: ScenarioJobStatus): string {
  switch (status) {
    case ScenarioJobStatus.SUBMITTED: return 'Submitted to runtime';
    case ScenarioJobStatus.QUEUED:    return 'Queued by runtime';
    case ScenarioJobStatus.RUNNING:   return 'Generating audio';
    case ScenarioJobStatus.COMPLETED: return 'Completed';
    case ScenarioJobStatus.TIMEOUT:   return 'Timed out';
    case ScenarioJobStatus.CANCELED:  return 'Canceled';
    case ScenarioJobStatus.FAILED:
    default:                          return 'Failed';
  }
}

export function scenarioJobProgressLabel(job: NimiRuntimeScenarioJob): string {
  const base = scenarioJobStatusLabel(job.status);
  if (job.reasonDetail) return job.reasonDetail;
  if (job.progressPercent > 0) return `${base} (${job.progressPercent}%)`;
  if (job.progressTotalSteps > 0) return `${base} (${job.progressCurrentStep}/${job.progressTotalSteps})`;
  return base;
}

export interface MusicSubmitOptions {
  model: string;
  connectorId: string;
  prompt: string;
  lyrics?: string;
  style?: string;
  title?: string;
  durationSeconds?: number;
  instrumental?: boolean;
  extensions?: readonly MusicScenarioExtension[];
}

export type MusicScenarioExtension = NimiRuntimeScenarioJobSubmitRequest['extensions'][number];

export interface RuntimeTextGenerationInput {
  readonly runtime: Runtime;
  readonly model: string;
  readonly connectorId: string;
  readonly input: string;
  readonly system: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export async function generateRuntimeText(input: RuntimeTextGenerationInput): Promise<string> {
  const model = createNimiRuntimeAIModel({
    runtime: input.runtime,
    appId,
    routePolicy: 'cloud',
    connectorId: input.connectorId,
    model: {
      providerId: input.connectorId,
      modelId: input.model,
    },
  });
  const result = await runNimiTextGenerate({
    runtime: { model },
    request: {
      model: model.model,
      messages: [
        { role: 'system', content: [{ type: 'text', text: input.system }] },
        { role: 'user', content: [{ type: 'text', text: input.input }] },
      ],
      parameters: {
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      },
    },
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.text;
}

export function copyArtifactBytesToArrayBuffer(bytes: Uint8Array | undefined): ArrayBuffer | null {
  if (!bytes || bytes.byteLength === 0) return null;
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export interface CompletedMusicArtifactProjection {
  artifactId: string;
  mimeType: string;
  fileExtension: string;
  byteLength: number;
  durationSeconds?: number;
  buffer: ArrayBuffer;
}

export function requireCompletedMusicArtifact(input: {
  readonly job: {
    readonly jobId: string;
    readonly status: ScenarioJobStatus;
    readonly reasonDetail?: string | null;
  };
  readonly artifacts: readonly {
    readonly artifactId?: string | null;
    readonly mimeType?: string | null;
    readonly bytes?: Uint8Array;
    readonly sizeBytes?: string | number | null;
    readonly durationMs?: string | number | null;
  }[];
}): CompletedMusicArtifactProjection {
  if (input.job.status !== ScenarioJobStatus.COMPLETED) {
    throw new Error(input.job.reasonDetail || scenarioJobStatusLabel(input.job.status));
  }
  const artifact = input.artifacts[0];
  if (!artifact) {
    throw new Error(`Runtime job ${input.job.jobId} completed without an audio artifact.`);
  }
  const artifactId = String(artifact.artifactId || '').trim();
  if (!artifactId) {
    throw new Error(`Runtime job ${input.job.jobId} returned an audio artifact without artifactId.`);
  }
  const mimeType = String(artifact.mimeType || '').trim().toLowerCase();
  if (!mimeType || !mimeType.startsWith('audio/')) {
    throw new Error(`Runtime job ${input.job.jobId} returned an artifact without a valid audio MIME type.`);
  }
  const buffer = copyArtifactBytesToArrayBuffer(artifact.bytes);
  if (!buffer) {
    throw new Error(`Runtime artifact ${artifactId} has no decoded audio bytes.`);
  }
  return {
    artifactId,
    mimeType,
    fileExtension: audioMimeToExtension(mimeType),
    byteLength: normalizeByteLength(artifact.sizeBytes, buffer.byteLength),
    durationSeconds: normalizeDurationSeconds(artifact.durationMs),
    buffer,
  };
}

function audioMimeToExtension(mimeType: string): string {
  switch (mimeType.split(';', 1)[0]) {
    case 'audio/mpeg':
    case 'audio/mp3':
      return 'mp3';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav';
    case 'audio/aac':
      return 'aac';
    case 'audio/flac':
      return 'flac';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/mp4':
    case 'audio/m4a':
      return 'm4a';
    default:
      return 'audio';
  }
}

function normalizeByteLength(value: string | number | null | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeDurationSeconds(value: string | number | null | undefined): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed / 1000;
}

// OVT-FLOW-06 / OVT-RT-05: app-owned music iteration extension builder.
// The renderer MUST construct iteration payloads through this helper. The
// only admitted namespace is `nimi.scenario.music_generate.request`.
export interface MusicIterationExtensionInput {
  mode: Exclude<TakeOrigin, 'prompt'>;
  sourceAudioBase64?: string;
  sourceMimeType?: string;
  sourceTakeId?: string;
  trimStartSec?: number;
  trimEndSec?: number;
}

export function buildMusicIterationExtensions(
  input: MusicIterationExtensionInput,
): readonly MusicScenarioExtension[] {
  const sourceMimeType = input.sourceMimeType;
  if (input.sourceAudioBase64 && !sourceMimeType) {
    throw new Error('Music iteration source audio requires a MIME type.');
  }
  const payload: Record<string, NimiJsonObject[string]> = {
    mode: input.mode,
  };
  if (input.sourceTakeId) {
    payload.source_take_id = input.sourceTakeId;
  }
  if (input.sourceAudioBase64 && sourceMimeType) {
    payload.source_audio = {
      mime_type: sourceMimeType,
      data_base64: input.sourceAudioBase64,
    };
  }
  if (typeof input.trimStartSec === 'number') {
    payload.trim_start_sec = input.trimStartSec;
  }
  if (typeof input.trimEndSec === 'number') {
    payload.trim_end_sec = input.trimEndSec;
  }
  return [{
    namespace: 'nimi.scenario.music_generate.request',
    payload: toNimiRuntimeProtoStruct(payload),
  }];
}

export function buildMusicGenerateScenarioRequest(input: MusicSubmitOptions): SubmitScenarioJobRequest {
  const requestId = createScenarioId('overtone-music');
  return {
    head: {
      appId,
      subjectUserId: '',
      modelId: input.model,
      routePolicy: RoutePolicy.CLOUD,
      fallback: FallbackPolicy.DENY,
      timeoutMs: 0,
      connectorId: input.connectorId,
    },
    scenarioType: ScenarioType.MUSIC_GENERATE,
    executionMode: ExecutionMode.ASYNC_JOB,
    spec: {
      spec: {
        oneofKind: 'musicGenerate',
        musicGenerate: {
          prompt: input.prompt,
          negativePrompt: '',
          lyrics: input.lyrics || '',
          style: input.style || '',
          title: input.title || '',
          durationSeconds: input.durationSeconds || 0,
          instrumental: Boolean(input.instrumental),
        },
      },
    },
    requestId,
    idempotencyKey: requestId,
    labels: {
      appId,
      scenario: 'music.generate',
    },
    extensions: [...(input.extensions ?? [])],
  };
}

function createScenarioId(prefix: string): string {
  return createNimiClientId(prefix);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary);
}
