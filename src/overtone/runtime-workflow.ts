import { createNimiLocalAppRuntimeScenarioJobClient, type NimiLocalAppClient } from '@nimiplatform/sdk/app';
import type { ScenarioJob } from '@nimiplatform/sdk/runtime/generated';
import { observeRuntimeMusicGeneration, runRuntimeMusicGenerate, type RuntimeMusicGenerateResult } from '@nimiplatform/kit/features/generation/runtime';
import { makeId, type OwnedAsset, type ProjectAudio, type RecoverableMusicResult, type ScoreDocument, type SongTake } from './types.js';
import { MusicAudioCache, waitForAbort } from './media-cache.js';
import { projectWaveform } from './pcm-media.js';

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
        else if (event.type === 'completed') {
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
type MusicClient = Pick<NimiLocalAppClient, 'ai' | 'storage'>;
export interface AdoptedMusicResult {
  readonly jobId: string;
  readonly audio: ProjectAudio;
  readonly score?: ScoreDocument;
  readonly termination: 'model-end' | 'budget-limit' | 'unknown';
  readonly actualSeed?: number;
  readonly durationSeconds: number;
}

export function createMusicVersion(operation: RecoverableMusicResult, result: AdoptedMusicResult): { take: SongTake; score?: ScoreDocument } {
  const takeId = makeId('take');
  const score = result.score ? { ...result.score, sourceTakeId: takeId, title: operation.title } : undefined;
  return { take: {
    takeId, parentTakeId: operation.parentTakeId, title: operation.title, origin: 'runtime-result', capability: 'music.generate',
    jobId: result.jobId, clientSubmissionId: operation.clientSubmissionId, audio: result.audio, scoreId: score?.scoreId,
    inputScoreId: operation.inputScoreId, scoreConditioning: operation.scoreConditioning,
    promptSnapshot: operation.promptSnapshot, lyricsSnapshot: operation.lyricsSnapshot, styleSnapshot: operation.styleSnapshot,
    durationSeconds: result.durationSeconds, targetDurationSeconds: operation.targetDurationSeconds, creationMode: operation.creationMode,
    termination: result.termination, actualSeed: result.actualSeed, favorite: false, discarded: false, createdAt: operation.createdAt,
  }, ...(score ? { score } : {}) };
}

// @nimi-authority: rule.overtone.runtime.r003
export async function generateRuntimeMusic(input: {
  readonly client: MusicClient; readonly cache: MusicAudioCache;
  readonly operation: RecoverableMusicResult; readonly score?: ScoreDocument;
  readonly signal: AbortSignal; readonly onJobUpdate: (job: ScenarioJob) => void;
}): Promise<AdoptedMusicResult> {
  const operation = input.operation;
  let score: { artifactId: string; format: 'abc' } | undefined;
  if (input.score) {
    if (input.score.format !== 'abc') throw new Error('OVERTONE_SCORE_FORMAT_UNSUPPORTED');
    const bytes = await readOwnedAsset(input.client, input.score.asset, input.signal, 1024 * 1024);
    const uploaded = await input.client.ai.artifacts.upload({ bytes, mimeType: 'text/vnd.abc' });
    score = { artifactId: uploaded.artifactId, format: 'abc' };
  }
  const ai = input.client.ai;
  const capturedAI: NimiLocalAppClient['ai'] = { ...ai, scenarioJobs: { ...ai.scenarioJobs,
    submit: (spec, options) => ai.scenarioJobs.submit(spec, { ...options, clientSubmissionId: operation.clientSubmissionId }),
  } };
  const result = await runRuntimeMusicGenerate({
    runtime: { ai: createNimiLocalAppRuntimeScenarioJobClient(capturedAI) }, appId: 'nimi.overtone',
    prompt: operation.promptSnapshot, lyrics: operation.lyricsSnapshot, durationSeconds: operation.targetDurationSeconds,
    ...(operation.seed !== undefined ? { seed: operation.seed } : {}),
    ...(operation.instrumental !== undefined ? { instrumental: operation.instrumental } : {}),
    ...(operation.returnGeneratedScore !== undefined ? { returnGeneratedScore: operation.returnGeneratedScore } : {}),
    ...(score ? { score, scoreConditioning: operation.scoreConditioning ?? 'melody-and-harmony' } : {}),
    scenarioId: 'overtone.music.generate', surfaceId: 'nimi.overtone.generate', signal: input.signal, onJobUpdate: input.onJobUpdate,
  });
  if (!result.ok) throw result.error;
  return adoptMusicResult(input, result);
}

// @nimi-authority: rule.overtone.data-model.r007
export async function recoverRuntimeMusic(input: {
  client: MusicClient; cache: MusicAudioCache; operation: RecoverableMusicResult; signal: AbortSignal;
  onJobUpdate?: (job: ScenarioJob) => void;
}): Promise<AdoptedMusicResult> {
  const jobId = input.operation.jobId ?? (await input.client.ai.scenarioJobs.lookupSubmission(input.operation.clientSubmissionId)).job.jobId;
  const result = await observeRuntimeMusicGeneration({ runtime: { ai: createNimiLocalAppRuntimeScenarioJobClient(input.client.ai) },
    jobId, signal: input.signal, onJobUpdate: input.onJobUpdate });
  if (!result.ok) throw result.error;
  return adoptMusicResult(input, result);
}

async function adoptMusicResult(input: { client: MusicClient; cache: MusicAudioCache; signal: AbortSignal },
  result: Extract<RuntimeMusicGenerateResult, { ok: true }>): Promise<AdoptedMusicResult> {
  input.signal.throwIfAborted();
  const adopted = new Map<string, OwnedAsset>();
  const created: string[] = [];
  try {
    for (const artifact of result.output.artifacts) {
      input.signal.throwIfAborted();
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${result.output.jobId}:${artifact.artifactId}`)));
      const token = [...digest].map(b => b.toString(16).padStart(2, '0')).join('');
      const prefix = `music/results/${token}/`;
      const retained = await input.client.storage.assets.list({ prefix, pageSize: 2 });
      if (retained.nextCursor || retained.assets.length > 1) throw new Error('OVERTONE_ASSET_COLLISION');
      let asset = retained.assets[0];
      if (!asset) {
        asset = await input.client.storage.assets.adoptArtifact({ artifactId: artifact.artifactId, relativePath: `${prefix}result.asset`, overwrite: false });
        created.push(asset.relativePath);
      }
      if (!asset.relativePath.startsWith(`${prefix}result.`) || asset.sha256 !== `sha256:${artifact.sha256.replace(/^sha256:/u, '')}`
        || asset.sizeBytes !== artifact.sizeBytes || asset.mediaType !== artifact.mimeType) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
      adopted.set(artifact.artifactId, { relativePath: asset.relativePath, mimeType: artifact.mimeType, sizeBytes: asset.sizeBytes, sha256: asset.sha256 });
    }
    const generation = result.output.generation;
    const mix = adopted.get(generation.mixArtifactId);
    if (!mix || mix.mimeType !== 'audio/wav') throw new Error('OVERTONE_RESULT_UNAVAILABLE');
    const audio: ProjectAudio = { ...mix, ...generation.audioInfo };
    await loadProjectAudio({ ...input, audio });
    let score: ScoreDocument | undefined;
    if (generation.generatedScore) {
      if (generation.generatedScore.origin !== 'generated-plan') throw new Error('OVERTONE_SCORE_ORIGIN_INVALID');
      const file = adopted.get(generation.generatedScore.artifactId);
      if (!file || file.mimeType !== 'text/vnd.abc') throw new Error('OVERTONE_RESULT_UNAVAILABLE');
      score = { scoreId: makeId('score'), asset: file, format: generation.generatedScore.format,
        origin: generation.generatedScore.origin, truncated: generation.generatedScore.truncated, title: '', createdAt: Date.now() };
    }
    return { jobId: result.output.jobId, audio, score, termination: generation.termination,
      ...(generation.actualSeed !== undefined ? { actualSeed: generation.actualSeed } : {}), durationSeconds: audio.frameCount / audio.sampleRateHz };
  } catch (error) {
    const failures: string[] = [];
    for (const path of created.reverse()) {
      input.cache.remove(path);
      try { await input.client.storage.assets.remove(path); } catch (cause) { failures.push(String(cause)); }
    }
    if (failures.length) throw new Error(`${String(error)}; asset cleanup: ${failures.join('; ')}`);
    throw error;
  }
}

// @nimi-authority: rule.overtone.data-model.r005
export async function readOwnedAsset(client: Pick<NimiLocalAppClient, 'storage'>, asset: OwnedAsset, signal: AbortSignal, maxBytes: number): Promise<Uint8Array> {
  signal.throwIfAborted();
  if (!Number.isSafeInteger(asset.sizeBytes) || asset.sizeBytes < 1 || asset.sizeBytes > maxBytes) throw new Error('OVERTONE_ASSET_TOO_LARGE');
  const source = await client.storage.assets.read({ relativePath: asset.relativePath });
  if (source.asset.mediaType !== asset.mimeType || source.asset.sizeBytes !== asset.sizeBytes || source.asset.sha256 !== asset.sha256) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
  const bytes = new Uint8Array(asset.sizeBytes); let offset = 0;
  for await (const chunk of source.body) {
    signal.throwIfAborted();
    if (offset + chunk.byteLength > bytes.length) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
    bytes.set(chunk, offset); offset += chunk.byteLength;
  }
  if (offset !== bytes.length) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
  signal.throwIfAborted(); return bytes;
}
export async function loadProjectAudio(input: { client: Pick<NimiLocalAppClient, 'storage'>; cache: MusicAudioCache; audio: ProjectAudio; signal: AbortSignal }) {
  return input.cache.load(input.audio.relativePath, async signal => {
    const { wav, peaks } = await projectWaveform(input.client, input.audio, signal);
    return { info: wav.info, peaks, mimeType: input.audio.mimeType, sizeBytes: input.audio.sizeBytes, sha256: input.audio.sha256 };
  }, input.signal, input.audio);
}
