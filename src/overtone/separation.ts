import { createNimiLocalAppRuntimeScenarioJobClient, type NimiLocalAppClient, type NimiLocalAppAudioSeparation } from '@nimiplatform/sdk/app';
import type { ScenarioJob } from '@nimiplatform/sdk/runtime/generated';
import { observeRuntimeAudioSeparation, runRuntimeAudioSeparation, type RuntimeAudioSeparationResult } from '@nimiplatform/kit/features/generation/runtime';
import { adoptMusicArtifacts, loadProjectAudio } from './runtime-workflow.js';
import type { MusicAudioCache } from './media-cache.js';
import { sameProjectAudio, makeId, type AudioInfoFacts, type OwnedAsset, type ProjectAudio, type RecoverableSeparation, type SeparationSongTake, type SeparationStem, type SongTake } from './types.js';

export type SeparationSubmit = Omit<RecoverableSeparation, 'jobId' | 'sourceArtifactId'>;
export type AdoptedSeparationRun = { readonly takes: readonly SongTake[] };
export type SeparationStages = 'preparing' | 'recovering' | 'pending' | 'running' | 'saving';
type Client = Pick<NimiLocalAppClient, 'ai' | 'storage'>;

const STEM_BY_PART: Record<string, SeparationStem> = { DRUMS: 'drums', BASS: 'bass', OTHER: 'other' };
// The native separation implementation's declared input domain: an already
// canonical source outside it is converted only through an explicit derived
// preparation record (rule.nimi.runtime.ai-provider.audio-separation).
const SEPARATION_DOMAIN = { sampleRateHz: 44100, channels: 2 } as const;

// @nimi-authority: rule.overtone.runtime.r005
export async function runSeparation(input: {
  readonly client: Client; readonly cache: MusicAudioCache;
  readonly operation: SeparationSubmit; readonly titles: Readonly<Record<SeparationStem, string>>;
  readonly signal: AbortSignal;
  readonly onStage?: (stage: SeparationStages) => void;
  readonly onPrepared: (operation: RecoverableSeparation) => Promise<void>;
  readonly onJobUpdate: (job: ScenarioJob) => void;
}): Promise<AdoptedSeparationRun> {
  const { client, signal, operation } = input; signal.throwIfAborted();
  const source = operation.sourceAudio; const range = operation.sourceRange;
  const full = range.startFrame === 0 && range.endFrame === source.frameCount;
  if (!Number.isSafeInteger(range.startFrame) || !Number.isSafeInteger(range.endFrame) || range.startFrame < 0
    || range.endFrame > source.frameCount || range.startFrame >= range.endFrame) throw new Error('OVERTONE_SEPARATION_RANGE');
  const asset = await client.storage.assets.stat(source.relativePath);
  if (asset.sha256 !== source.sha256 || asset.sizeBytes !== source.sizeBytes || asset.mediaType !== source.mimeType) {
    throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
  }
  signal.throwIfAborted(); input.onStage?.('preparing');
  let preparedSource = await client.ai.artifacts.upload({ source: { kind: 'app-asset', relativePath: source.relativePath },
    mimeType: 'audio/wav', audioPreparation: { profile: 'canonical-pcm-v1' } });
  signal.throwIfAborted();
  if (!preparedSource.audioInfo || preparedSource.mimeType !== source.mimeType || preparedSource.sizeBytes !== source.sizeBytes
    || !sameProjectAudio(source, { ...source, ...preparedSource.audioInfo })) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
  let inputPreparation: typeof operation.inputPreparation;
  if (preparedSource.audioInfo.sampleRateHz !== SEPARATION_DOMAIN.sampleRateHz || preparedSource.audioInfo.channels !== SEPARATION_DOMAIN.channels) {
    const channelMode = preparedSource.audioInfo.channels === 1 ? 'MONO_TO_STEREO' as const
      : preparedSource.audioInfo.channels === 2 ? 'PRESERVE' as const : 'STEREO_TO_MONO' as const;
    inputPreparation = { profile: 'canonical-pcm-v1', targetSampleRateHz: SEPARATION_DOMAIN.sampleRateHz, channelMode };
    preparedSource = await client.ai.artifacts.upload({ source: { kind: 'artifact', artifactId: preparedSource.artifactId },
      mimeType: 'audio/wav', audioPreparation: inputPreparation });
    signal.throwIfAborted();
    const converted = preparedSource.audioInfo;
    if (!converted || converted.sampleRateHz !== SEPARATION_DOMAIN.sampleRateHz || converted.channels !== SEPARATION_DOMAIN.channels
      || converted.frameCount < 1) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
  }
  const captured: RecoverableSeparation = { ...operation, sourceArtifactId: preparedSource.artifactId,
    ...(inputPreparation ? { inputPreparation } : {}) };
  await input.onPrepared(captured); signal.throwIfAborted();
  input.onStage?.('pending');
  const submittedRange = inputPreparation ? separationSubmitRange(range, source, preparedSource.audioInfo!.frameCount) : range;
  // The protected audio.separate submission admits no clientSubmissionId; the
  // captured jobId is the only recovery identity.
  const result = await runRuntimeAudioSeparation({ runtime: { ai: createNimiLocalAppRuntimeScenarioJobClient(client.ai) },
    appId: 'nimi.overtone', scenarioId: 'overtone.audio.separate', surfaceId: 'nimi.overtone.separation',
    mimeType: 'audio/wav', sourceAudio: { artifactId: preparedSource.artifactId, ...(full ? {} : { range: submittedRange }) },
    ...(operation.requestedInstrumentParts ? { includeInstrumentParts: true } : {}),
    signal, onJobUpdate: input.onJobUpdate });
  if (!result.ok) throw result.error;
  input.onStage?.('saving');
  return finishSeparation({ client, cache: input.cache, operation: captured, titles: input.titles, signal }, result);
}

// @nimi-authority: rule.overtone.data-model.r007
export async function recoverSeparation(input: {
  readonly client: Client; readonly cache: MusicAudioCache;
  readonly operation: RecoverableSeparation; readonly titles: Readonly<Record<SeparationStem, string>>;
  readonly signal: AbortSignal;
  readonly onStage?: (stage: SeparationStages) => void;
  readonly onJobUpdate?: (job: ScenarioJob) => void;
}): Promise<AdoptedSeparationRun> {
  const { client, operation, signal } = input; signal.throwIfAborted();
  if (!operation.jobId) throw new Error('OVERTONE_SEPARATION_NO_JOB');
  input.onStage?.('recovering');
  const result = await observeRuntimeAudioSeparation({ runtime: { ai: createNimiLocalAppRuntimeScenarioJobClient(client.ai) },
    jobId: operation.jobId, signal, onJobUpdate: input.onJobUpdate });
  if (!result.ok) throw result.error;
  return finishSeparation({ client, cache: input.cache, operation, titles: input.titles, signal }, result);
}

async function finishSeparation(input: {
  client: Client; cache: MusicAudioCache; operation: RecoverableSeparation;
  titles: Readonly<Record<SeparationStem, string>>; signal: AbortSignal;
}, result: Extract<RuntimeAudioSeparationResult, { ok: true }>): Promise<AdoptedSeparationRun> {
  input.signal.throwIfAborted();
  const separation = result.output.separation;
  const artifactFacts = new Map(result.output.artifacts.map(artifact => [artifact.artifactId, artifact]));
  const stems: { stem: SeparationStem; artifactId: string }[] = [
    { stem: 'vocals', artifactId: separation.vocalsArtifactId },
    { stem: 'background', artifactId: separation.backgroundArtifactId },
    ...(separation.instrumentParts ?? []).map(part => ({ stem: STEM_BY_PART[part.kind], artifactId: part.artifactId })),
  ];
  if (stems.some(entry => !entry.stem) || new Set(stems.map(entry => entry.stem)).size !== stems.length) {
    throw new Error('OVERTONE_SEPARATION_INCOMPLETE');
  }
  return adoptMusicArtifacts({ client: input.client, cache: input.cache, signal: input.signal }, result.output.jobId,
    result.output.artifacts.map(artifact => ({ artifactId: artifact.artifactId, mimeType: artifact.mimeType,
      sizeBytes: artifact.sizeBytes, sha256: artifact.sha256 })), async adopted => {
    const takes: SongTake[] = [];
    for (const entry of stems) {
      input.signal.throwIfAborted();
      const asset = adopted.get(entry.artifactId);
      const facts = artifactFacts.get(entry.artifactId);
      if (!asset || asset.mimeType !== 'audio/wav' || !facts) throw new Error('OVERTONE_RESULT_UNAVAILABLE');
      // Runtime reports exact stem frames; a millisecond duration is floored and
      // cannot reconstruct the canonical frame count.
      if (!Number.isSafeInteger(facts.frameCount) || Number(facts.frameCount) < 1) throw new Error('OVERTONE_RESULT_UNAVAILABLE');
      const audio: ProjectAudio = { ...asset, sampleRateHz: facts.sampleRateHz, channels: facts.channels,
        frameCount: Number(facts.frameCount), durationMs: facts.durationMs };
      await loadProjectAudio({ ...input, audio });
      const take: SeparationSongTake = {
        takeId: makeId('take'), parentTakeId: input.operation.sourceTakeId, title: input.titles[entry.stem],
        origin: 'runtime-result', capability: 'audio.separate', jobId: result.output.jobId,
        separation: { separationId: input.operation.separationId, sourceTakeId: input.operation.sourceTakeId,
          sourceArtifactId: input.operation.sourceArtifactId, sourceAudio: input.operation.sourceAudio,
          sourceRange: input.operation.sourceRange, stem: entry.stem, requestedInstrumentParts: input.operation.requestedInstrumentParts,
          ...(input.operation.inputPreparation ? { inputPreparation: input.operation.inputPreparation } : {}) },
        audio, promptSnapshot: '', durationSeconds: audio.frameCount / audio.sampleRateHz,
        favorite: false, discarded: false, createdAt: input.operation.createdAt,
      };
      takes.push(take);
    }
    return { takes };
  });
}

// The recorded author range stays on the source take's timeline; the submit
// range is the same wall-clock selection on the converted input's timeline.
// The source end maps to the converted end, never one rounded frame past it.
export function separationSubmitRange(range: { startFrame: number; endFrame: number },
  source: { sampleRateHz: number; frameCount: number }, convertedFrames: number): { startFrame: number; endFrame: number } {
  const toDomain = (frame: number) => frame === source.frameCount ? convertedFrames
    : Math.min(convertedFrames, Math.round(frame * SEPARATION_DOMAIN.sampleRateHz / source.sampleRateHz));
  const mapped = { startFrame: toDomain(range.startFrame), endFrame: toDomain(range.endFrame) };
  if (mapped.startFrame >= mapped.endFrame) throw new Error('OVERTONE_SEPARATION_RANGE');
  return mapped;
}

export function separationStemTakes(takes: readonly SongTake[], jobId: string): SeparationSongTake[] {
  return takes.filter((take): take is SeparationSongTake =>
    take.origin === 'runtime-result' && take.capability === 'audio.separate' && take.jobId === jobId);
}

export type { OwnedAsset, AudioInfoFacts };
