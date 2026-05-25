// Runtime workflow helpers: scenario job status translation, music-iteration
// extension builder, text-stream collector. Authority:
// .nimi/spec/overtone/kernel/runtime-integration-contract.md (OVT-RT-*).

import {
  ScenarioJobEventType,
  ScenarioJobStatus,
  type MusicGenerateOutput,
  type Runtime,
} from '@nimiplatform/sdk/runtime';
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

export function scenarioJobProgressLabel(job: MusicGenerateOutput['job']): string {
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
  extensions?: Record<string, unknown>;
}

export interface MusicGenerateJobResult {
  job: MusicGenerateOutput['job'];
  artifacts: MusicGenerateOutput['artifacts'];
}

function isTerminalScenarioStatus(status: ScenarioJobStatus): boolean {
  return status === ScenarioJobStatus.COMPLETED ||
    status === ScenarioJobStatus.FAILED ||
    status === ScenarioJobStatus.CANCELED ||
    status === ScenarioJobStatus.TIMEOUT;
}

function isTerminalScenarioEvent(eventType: ScenarioJobEventType): boolean {
  return eventType === ScenarioJobEventType.SCENARIO_JOB_EVENT_COMPLETED ||
    eventType === ScenarioJobEventType.SCENARIO_JOB_EVENT_FAILED ||
    eventType === ScenarioJobEventType.SCENARIO_JOB_EVENT_CANCELED ||
    eventType === ScenarioJobEventType.SCENARIO_JOB_EVENT_TIMEOUT;
}

// OVT-FLOW-05 / OVT-RT-04: use the job lifecycle surfaces directly so the
// renderer can project job progress and only fetch artifacts after completion.
export async function submitMusicGenerate(
  runtime: Runtime,
  input: MusicSubmitOptions,
  onJob?: (job: MusicGenerateOutput['job']) => void,
): Promise<MusicGenerateJobResult> {
  const submitted = await runtime.media.jobs.submit({ modal: 'music', input });
  onJob?.(submitted);

  let finalJob = submitted;
  const events = await runtime.media.jobs.subscribe(submitted.jobId);
  for await (const event of events) {
    if (event.job) {
      finalJob = event.job;
      onJob?.(event.job);
      if (isTerminalScenarioStatus(event.job.status)) break;
    }
    if (isTerminalScenarioEvent(event.eventType)) break;
  }

  if (!isTerminalScenarioStatus(finalJob.status)) {
    finalJob = await runtime.media.jobs.get(submitted.jobId);
    onJob?.(finalJob);
  }

  if (finalJob.status !== ScenarioJobStatus.COMPLETED) {
    return { job: finalJob, artifacts: [] };
  }

  const { artifacts } = await runtime.media.jobs.getArtifacts(finalJob.jobId);
  return { job: finalJob, artifacts };
}

export async function collectTextStream(
  output: AsyncIterable<{ type: string; text?: string; error?: unknown }> | { stream: AsyncIterable<{ type: string; text?: string; error?: unknown }> },
): Promise<string> {
  const iterable: AsyncIterable<{ type: string; text?: string; error?: unknown }> =
    'stream' in (output as { stream: AsyncIterable<unknown> })
      ? (output as { stream: AsyncIterable<{ type: string; text?: string; error?: unknown }> }).stream
      : (output as AsyncIterable<{ type: string; text?: string; error?: unknown }>);

  let text = '';
  for await (const part of iterable) {
    if (part.type === 'delta' && typeof part.text === 'string') {
      text += part.text;
      continue;
    }
    if (part.type === 'error') {
      throw part.error instanceof Error ? part.error : new Error(String(part.error || 'text stream error'));
    }
  }
  return text;
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
): Record<string, unknown> {
  const payload: Record<string, unknown> = { mode: input.mode };
  if (input.sourceTakeId) payload.source_take_id = input.sourceTakeId;
  if (input.sourceAudioBase64) {
    payload.source_audio = {
      mime_type: input.sourceMimeType || 'audio/mpeg',
      data_base64: input.sourceAudioBase64,
    };
  }
  if (typeof input.trimStartSec === 'number') payload.trim_start_sec = input.trimStartSec;
  if (typeof input.trimEndSec === 'number') payload.trim_end_sec = input.trimEndSec;
  return {
    'nimi.scenario.music_generate.request': payload,
  };
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary);
}
