// Runtime workflow helpers: scenario job status translation, music-iteration
// extension builder, and Runtime-backed text generation. Authority:
// .nimi/spec/overtone/kernel/runtime-integration-contract.md (OVT-RT-*).

import {
  runNimiRuntimeScenarioJob,
  toNimiRuntimeProtoStruct,
  type Runtime,
} from '@nimiplatform/sdk/runtime';
import { createNimiRuntimeAIModel, runNimiTextGenerate } from '@nimiplatform/sdk/ai';
import type { NimiJsonObject } from '@nimiplatform/sdk/contracts';
import {
  ExecutionMode,
  FallbackPolicy,
  RoutePolicy,
  ScenarioJobStatus,
  ScenarioType,
  type ScenarioArtifact,
  type ScenarioExtension,
  type ScenarioJob,
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

export function scenarioJobProgressLabel(job: ScenarioJob): string {
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
  extensions?: readonly ScenarioExtension[];
}

export interface MusicGenerateJobResult {
  job: ScenarioJob;
  artifacts: readonly ScenarioArtifact[];
}

function isTerminalScenarioStatus(status: ScenarioJobStatus): boolean {
  return status === ScenarioJobStatus.COMPLETED ||
    status === ScenarioJobStatus.FAILED ||
    status === ScenarioJobStatus.CANCELED ||
    status === ScenarioJobStatus.TIMEOUT;
}

// OVT-FLOW-05 / OVT-RT-04: use the job lifecycle surfaces directly so the
// renderer can project job progress and only fetch artifacts after completion.
export async function submitMusicGenerate(
  runtime: Runtime,
  input: MusicSubmitOptions,
  onJob?: (job: ScenarioJob) => void,
): Promise<MusicGenerateJobResult> {
  let lastJob: ScenarioJob | undefined;
  try {
    return await runNimiRuntimeScenarioJob({
      ai: runtime.ai,
      request: buildMusicGenerateScenarioRequest(input),
      onJobUpdate: (job) => {
        lastJob = job;
        onJob?.(job);
      },
    });
  } catch (error) {
    if (lastJob && isTerminalScenarioStatus(lastJob.status)) {
      return { job: lastJob, artifacts: [] };
    }
    throw error;
  }
}

export interface RuntimeTextGenerateInput {
  readonly runtime: Runtime;
  readonly model: string;
  readonly connectorId: string;
  readonly input: string;
  readonly system: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export async function generateRuntimeText(input: RuntimeTextGenerateInput): Promise<string> {
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
): readonly ScenarioExtension[] {
  const payload: NimiJsonObject = {
    mode: input.mode,
    ...(input.sourceTakeId ? { source_take_id: input.sourceTakeId } : {}),
    ...(input.sourceAudioBase64
      ? {
          source_audio: {
            mime_type: input.sourceMimeType || 'audio/mpeg',
            data_base64: input.sourceAudioBase64,
          },
        }
      : {}),
    ...(typeof input.trimStartSec === 'number' ? { trim_start_sec: input.trimStartSec } : {}),
    ...(typeof input.trimEndSec === 'number' ? { trim_end_sec: input.trimEndSec } : {}),
  };
  return [{
    namespace: 'nimi.scenario.music_generate.request',
    payload: toNimiRuntimeProtoStruct(payload),
  }];
}

function buildMusicGenerateScenarioRequest(input: MusicSubmitOptions): SubmitScenarioJobRequest {
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
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary);
}
