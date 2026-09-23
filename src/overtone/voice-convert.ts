import { createNimiLocalAppRuntimeScenarioJobClient, type NimiLocalAppClient } from '@nimiplatform/sdk/app';
import type { ScenarioJob } from '@nimiplatform/sdk/runtime/generated';
import { observeRuntimeVoiceConversion, runRuntimeVoiceConvert, type RuntimeVoiceConvertInput, type RuntimeVoiceConvertResult } from '@nimiplatform/kit/features/generation/runtime';
import { adoptVoiceConversion, createVoiceConvertVersions, type AdoptedVoiceConversion } from './runtime-workflow.js';
import { preparedVoiceTarget, validFrameRange } from './voice-convert-target.js';
import type { MusicAudioCache } from './media-cache.js';
import { sameProjectAudio, type RecoverableVoiceConvert, type SongTake, type VoiceConvertTargetChoice, type VoiceConvertTargetVoice } from './types.js';

export type AdoptedVoiceConvertRun = { readonly take: SongTake; readonly mixTake: SongTake };
export type VoiceConvertSubmit = Omit<RecoverableVoiceConvert, 'jobId' | 'sourceArtifactId' | 'targetVoice' | 'retainedAccompanimentArtifactId'>
  & { readonly targetChoice: VoiceConvertTargetChoice };
type Client = Pick<NimiLocalAppClient, 'ai' | 'aiConfig' | 'storage'>;

export type VoiceConvertStages = 'preparing' | 'recovering' | 'pending' | 'running' | 'deriving' | 'mixing' | 'saving';

export { buildVoiceConvertTargetChoice, preparedVoiceTarget, selectionFrames } from './voice-convert-target.js';

function protectedScenarioJobs(client: Client, clientSubmissionId: string) {
  const api = client.ai;
  return createNimiLocalAppRuntimeScenarioJobClient({ ...api, scenarioJobs: { ...api.scenarioJobs,
    submit: (spec: Parameters<typeof api.scenarioJobs.submit>[0], options?: Parameters<typeof api.scenarioJobs.submit>[1]) =>
      api.scenarioJobs.submit(spec, { ...options, clientSubmissionId }),
  } });
}

// @nimi-authority: rule.overtone.runtime.r005
export async function runVoiceConvert(input: {
  readonly client: Client; readonly cache: MusicAudioCache;
  readonly operation: VoiceConvertSubmit;
  readonly mixTitle: string; readonly signal: AbortSignal;
  readonly onStage?: (stage: VoiceConvertStages) => void;
  readonly onPrepared: (operation: RecoverableVoiceConvert) => Promise<void>;
  readonly onJobUpdate: (job: ScenarioJob) => void;
}): Promise<AdoptedVoiceConvertRun> {
  const { client, signal, operation } = input; signal.throwIfAborted();
  const choice = operation.targetChoice;
  const selection = (await client.aiConfig.get()).effectiveSelections.find(item => item.capabilityContract === 'audio.voice.convert');
  const resource = selection?.resource;
  const profiles = resource?.oneofKind === 'local' ? resource.local.musicInput?.voiceConvert
    : resource?.oneofKind === 'cloud' ? resource.cloud.target?.musicInput?.voiceConvert : undefined;
  const profile = profiles?.find(item => item.sourceKinds.includes('singing') && item.targetKinds.includes('reference-audio'));
  const source = operation.sourceAudio; const range = operation.sourceRange;
  const full = range.startFrame === 0 && range.endFrame === source.frameCount;
  const semitone = operation.semitoneShift;
  const reference = operation.targetAudio;
  const targetFull = !choice.range || choice.range.startFrame === 0 && choice.range.endFrame === reference.frameCount;
  // Ranges are checked before any upload or recovery write so an unusable
  // selection never becomes a durable operation.
  if (choice.kind !== 'reference-audio' || !validFrameRange(range, source.frameCount)
    || (choice.range && !validFrameRange(choice.range, reference.frameCount))) throw new Error('OVERTONE_VOICE_CONVERT_RANGE');
  if (selection?.state !== 'ready' || !profile || source.sizeBytes > profile.maxSourceBytes
    || source.frameCount / source.sampleRateHz > profile.maxSourceSeconds || (!full && !profile.supportsRange)
    || (semitone !== undefined && (!profile.supportsSemitoneShift || semitone < profile.minSemitoneShift || semitone > profile.maxSemitoneShift))
    || reference.sizeBytes > profile.maxTargetBytes || reference.frameCount / reference.sampleRateHz > profile.maxTargetSeconds
    || (!targetFull && !profile.supportsRange)) {
    throw new Error('OVERTONE_VOICE_CONVERT_CONFIGURATION');
  }
  for (const audio of [source, operation.retainedAccompaniment, reference]) {
    const asset = await client.storage.assets.stat(audio.relativePath);
    if (asset.sha256 !== audio.sha256 || asset.sizeBytes !== audio.sizeBytes || asset.mediaType !== audio.mimeType) {
      throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
    }
  }
  signal.throwIfAborted(); input.onStage?.('preparing');
  const upload = async (relativePath: string) => {
    const prepared = await client.ai.artifacts.upload({ source: { kind: 'app-asset', relativePath },
      mimeType: 'audio/wav', audioPreparation: { profile: 'canonical-pcm-v1' } });
    signal.throwIfAborted();
    return prepared;
  };
  const preparedSource = await upload(source.relativePath);
  if (!preparedSource.audioInfo || preparedSource.mimeType !== source.mimeType || preparedSource.sizeBytes !== source.sizeBytes
    || !sameProjectAudio(source, { ...source, ...preparedSource.audioInfo })) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
  const preparedAccompaniment = await upload(operation.retainedAccompaniment.relativePath);
  if (!preparedAccompaniment.audioInfo || preparedAccompaniment.mimeType !== operation.retainedAccompaniment.mimeType
    || preparedAccompaniment.sizeBytes !== operation.retainedAccompaniment.sizeBytes
    || !sameProjectAudio(operation.retainedAccompaniment, { ...operation.retainedAccompaniment, ...preparedAccompaniment.audioInfo })) {
    throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
  }
  const preparedReference = await upload(reference.relativePath);
  if (!preparedReference.audioInfo || preparedReference.mimeType !== reference.mimeType || preparedReference.sizeBytes !== reference.sizeBytes
    || !sameProjectAudio(reference, { ...reference, ...preparedReference.audioInfo })) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
  const preparedTarget: VoiceConvertTargetVoice = preparedVoiceTarget(choice, preparedReference.artifactId);
  const base: Omit<RecoverableVoiceConvert, 'jobId' | 'sourceArtifactId' | 'targetVoice' | 'retainedAccompanimentArtifactId'> = {
    clientSubmissionId: operation.clientSubmissionId, projectId: operation.projectId, title: operation.title,
    sourceTakeId: operation.sourceTakeId, sourceAudio: operation.sourceAudio, sourceRange: operation.sourceRange,
    targetTakeId: operation.targetTakeId, targetAudio: reference,
    ...(operation.semitoneShift !== undefined ? { semitoneShift: operation.semitoneShift } : {}),
    retainedAccompanimentTakeId: operation.retainedAccompanimentTakeId, retainedAccompaniment: operation.retainedAccompaniment,
    createdAt: operation.createdAt,
  };
  const captured: RecoverableVoiceConvert = { ...base, sourceArtifactId: preparedSource.artifactId,
    targetVoice: preparedTarget, retainedAccompanimentArtifactId: preparedAccompaniment.artifactId };
  await input.onPrepared(captured); signal.throwIfAborted();
  input.onStage?.('pending');
  const spec: Omit<RuntimeVoiceConvertInput, 'runtime' | 'appId' | 'scenarioId' | 'surfaceId'> = {
    sourceVocal: { artifactId: preparedSource.artifactId, ...(full ? {} : { range }) }, sourceKind: 'singing',
    targetVoice: preparedTarget, ...(semitone !== undefined ? { semitoneShift: semitone } : {}),
    signal, onJobUpdate: input.onJobUpdate,
  };
  const result = await runRuntimeVoiceConvert({ ...spec, runtime: { ai: protectedScenarioJobs(client, operation.clientSubmissionId) },
    appId: 'nimi.overtone', scenarioId: 'overtone.voice.convert', surfaceId: 'nimi.overtone.voice-convert' });
  if (!result.ok) throw result.error;
  input.onStage?.('deriving');
  return finishVoiceConvert({ client, cache: input.cache, operation: captured, mixTitle: input.mixTitle, signal }, result);
}

// @nimi-authority: rule.overtone.data-model.r007
export async function recoverVoiceConvert(input: {
  readonly client: Client; readonly cache: MusicAudioCache; readonly operation: RecoverableVoiceConvert;
  readonly mixTitle: string; readonly signal: AbortSignal;
  readonly onStage?: (stage: VoiceConvertStages) => void;
  readonly onJobUpdate?: (job: ScenarioJob) => void;
}): Promise<AdoptedVoiceConvertRun> {
  const { client, operation, signal } = input; signal.throwIfAborted();
  const found = await client.ai.scenarioJobs.lookupSubmission(operation.clientSubmissionId);
  if (operation.jobId && operation.jobId !== found.job.jobId) throw new Error('OVERTONE_VOICE_CONVERT_IDENTITY');
  input.onStage?.('recovering');
  const result = await observeRuntimeVoiceConversion({ runtime: { ai: createNimiLocalAppRuntimeScenarioJobClient(client.ai) },
    jobId: found.job.jobId, signal, onJobUpdate: input.onJobUpdate });
  if (!result.ok) throw result.error;
  return finishVoiceConvert({ client, cache: input.cache, operation, mixTitle: input.mixTitle, signal }, result);
}

async function finishVoiceConvert(input: { client: Client; cache: MusicAudioCache; operation: RecoverableVoiceConvert; mixTitle: string; signal: AbortSignal },
  result: Extract<RuntimeVoiceConvertResult, { ok: true }>): Promise<AdoptedVoiceConvertRun> {
  input.signal.throwIfAborted();
  const adopted: AdoptedVoiceConversion = await adoptVoiceConversion(input, input.operation, result);
  input.signal.throwIfAborted();
  return createVoiceConvertVersions(input.operation, adopted, input.mixTitle);
}
