import { createNimiLocalAppRuntimeScenarioJobClient, type NimiLocalAppClient } from '@nimiplatform/sdk/app';
import type { ScenarioJob } from '@nimiplatform/sdk/runtime/generated';
import { runRuntimeMusicGenerate } from '@nimiplatform/kit/features/generation/runtime';
import { MusicAudioCache, waitForAbort } from './media-cache.js';

export const TEXT_WAIT_TIMEOUT_MS = 90_000;
export interface RuntimeTextGenerationInput {
  readonly client: Pick<NimiLocalAppClient, 'ai'>; readonly input: string; readonly system: string;
  readonly temperature?: number; readonly maxTokens?: number; readonly signal?: AbortSignal;
}
// @nimi-authority: rule.overtone.runtime.r002
export async function generateRuntimeText(input: RuntimeTextGenerationInput): Promise<string> {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new DOMException('Text generation timed out', 'TimeoutError')), TEXT_WAIT_TIMEOUT_MS);
  const signal = input.signal ? AbortSignal.any([input.signal, deadline.signal]) : deadline.signal;
  let subscription: Awaited<ReturnType<NimiLocalAppClient['ai']['text']['streamTurn']>> | undefined;
  const cancel = () => { if (subscription) void subscription.cancel().catch(() => undefined); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    signal.throwIfAborted();
    const opening = input.client.ai.text.streamTurn({ messages: [{ role: 'system', text: input.system }, { role: 'user', text: input.input }], temperature: input.temperature, maxTokens: input.maxTokens });
    void opening.then(value => { if (signal.aborted) void value.cancel().catch(() => undefined); }).catch(() => undefined);
    subscription = await waitForAbort(opening, signal);
    const consume = async () => {
      let text = '';
      for await (const event of subscription!) {
        signal.throwIfAborted();
        if (event.type === 'delta') text += event.text;
        else if (event.type === 'failed') throw Object.assign(new Error(event.reasonCode), { reasonCode: event.reasonCode, actionHint: event.actionHint });
        else {
          if (event.finishReason !== 'stop' || !text.trim()) throw new Error('OVERTONE_TEXT_INCOMPLETE');
          return text.trim();
        }
      }
      throw new Error('OVERTONE_TEXT_INCOMPLETE');
    };
    return await waitForAbort(consume(), signal);
  } finally {
    clearTimeout(timer); signal.removeEventListener('abort', cancel);
    if (subscription) void subscription.cancel().catch(() => undefined);
  }
}
export function textFailureMessage(cause: unknown, t: (key: string) => string): string {
  if ((cause as Error)?.name === 'TimeoutError') return t('Overtone.text.timeout');
  if ((cause as Error)?.message === 'OVERTONE_TEXT_INCOMPLETE') return t('Overtone.text.incomplete');
  const error = cause as { reasonCode?: string; actionHint?: string; message?: string };
  return [error.reasonCode, error.message !== error.reasonCode ? error.message : '', error.actionHint].filter(Boolean).join(' · ') || String(cause);
}
export const SKETCH_DURATION_SECONDS = 20;
// @nimi-authority: rule.overtone.runtime.r003
// @nimi-authority: rule.overtone.runtime.r004
export async function generateRuntimeMusic(input: {
  readonly client: Pick<NimiLocalAppClient, 'ai'>; readonly cache: MusicAudioCache;
  readonly prompt: string; readonly lyrics: string; readonly durationSeconds: number;
  readonly signal: AbortSignal; readonly onJobUpdate: (job: ScenarioJob) => void;
}) {
  const result = await runRuntimeMusicGenerate({
    runtime: { ai: createNimiLocalAppRuntimeScenarioJobClient(input.client.ai) }, appId: 'nimi.overtone', prompt: input.prompt, lyrics: input.lyrics,
    durationSeconds: input.durationSeconds, scenarioId: 'overtone.music.generate', surfaceId: 'nimi.overtone.generate', signal: input.signal, onJobUpdate: input.onJobUpdate,
  });
  if (!result.ok) throw result.error;
  input.signal.throwIfAborted();
  return { jobId: result.output.jobId, ...await loadRuntimeMusicArtifact({ ...input, artifact: result.output.firstArtifact }) };
}
// @nimi-authority: rule.overtone.data-model.r007
export async function recoverRuntimeMusic(input: { client: Pick<NimiLocalAppClient,'ai'>; cache: MusicAudioCache; jobId: string; signal: AbortSignal }) {
  const { job } = await input.client.ai.scenarioJobs.get(input.jobId);
  input.signal.throwIfAborted();
  if (job.jobId !== input.jobId || job.status !== 'completed' || job.scenarioType !== 'music-generate') throw new Error('OVERTONE_RESULT_UNAVAILABLE');
  const artifact = job.artifacts.find(artifact => normalizeMime(artifact.mimeType).split(';')[0]!.startsWith('audio/'));
  if (!artifact) throw new Error('OVERTONE_RESULT_UNAVAILABLE');
  return { jobId: job.jobId, ...await loadRuntimeMusicArtifact({ ...input, artifact }) };
}
export type RuntimeMusicArtifact = { readonly artifactId: string; readonly mimeType?: string; readonly sizeBytes?: number };
const EXTENSIONS: Record<string,string> = { 'audio/wav':'wav', 'audio/x-wav':'wav', 'audio/wave':'wav', 'audio/mpeg':'mp3', 'audio/mp3':'mp3', 'audio/mp4':'m4a', 'audio/ogg':'ogg', 'audio/flac':'flac', 'audio/webm':'webm', 'audio/aac':'aac' };
export function normalizeMime(value: string): string {
  const [type, ...parameters] = value.split(';');
  const normalized = parameters.map(parameter => {
    const separator = parameter.indexOf('=');
    if (separator < 1) throw new Error('Runtime music MIME parameter is invalid.');
    const key = parameter.slice(0,separator).trim().toLowerCase();
    const val = parameter.slice(separator+1).trim().replace(/^"(.*)"$/, '$1');
    return `${key}=${val}`;
  }).sort();
  return [type!.trim().toLowerCase(), ...normalized].join(';');
}
// @nimi-authority: rule.overtone.data-model.r005
export async function readRuntimeMusicArtifact(input: { readonly client: Pick<NimiLocalAppClient,'ai'>; readonly artifact: RuntimeMusicArtifact; readonly signal: AbortSignal }) {
  input.signal.throwIfAborted();
  const artifact = input.artifact;
  const read = await input.client.ai.artifacts.read(artifact.artifactId);
  input.signal.throwIfAborted();
  const mimeType = normalizeMime(read.mimeType);
  const extension = EXTENSIONS[mimeType.split(';')[0]!];
  if (!extension || !read.bytes.byteLength || read.sizeBytes !== read.bytes.byteLength || artifact.sizeBytes !== read.bytes.byteLength || mimeType !== normalizeMime(artifact.mimeType ?? '')) throw new Error('Runtime music artifact metadata does not match its audio bytes.');
  return { artifactId: artifact.artifactId, mimeType, extension, buffer: Uint8Array.from(read.bytes).buffer };
}
export async function loadRuntimeMusicArtifact(input: { client: Pick<NimiLocalAppClient,'ai'>; cache: MusicAudioCache; artifact: RuntimeMusicArtifact; signal: AbortSignal }) {
  const audio = await input.cache.load(input.artifact.artifactId, async signal => (await readRuntimeMusicArtifact({ ...input, signal })).buffer, input.signal,
    { mimeType: normalizeMime(input.artifact.mimeType ?? ''), sizeBytes: input.artifact.sizeBytes ?? 0 });
  return { artifactId: input.artifact.artifactId, mimeType: normalizeMime(input.artifact.mimeType ?? ''), extension: EXTENSIONS[normalizeMime(input.artifact.mimeType ?? '').split(';')[0]!]!, buffer: audio.bytes, durationSeconds: audio.decoded.duration };
}
