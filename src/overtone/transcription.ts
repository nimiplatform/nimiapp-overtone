import { createNimiLocalAppRuntimeScenarioJobClient, type NimiLocalAppClient } from '@nimiplatform/sdk/app';
import type { ScenarioJob } from '@nimiplatform/sdk/runtime/generated';
import { observeRuntimeMusicTranscription, runRuntimeMusicTranscribe, type RuntimeMusicTranscribeResult } from '@nimiplatform/kit/features/generation/runtime';
import { adoptMusicArtifacts } from './runtime-workflow.js';
import { makeId, sameProjectAudio, type MusicTranscriptionDocument, type RecoverableMusicTranscription, type ScoreDocument } from './types.js';

export type AdoptedTranscription = { readonly document: MusicTranscriptionDocument; readonly scores: ScoreDocument[] };
type Client = Pick<NimiLocalAppClient, 'ai' | 'aiConfig' | 'storage'>;

// @nimi-authority: rule.overtone.transcription.r001
export async function transcribeRecording(input: {
  readonly client: Client; readonly operation: Omit<RecoverableMusicTranscription, 'sourceArtifactId'>;
  readonly signal: AbortSignal; readonly onPrepared: (operation: RecoverableMusicTranscription) => Promise<void>;
  readonly onJobUpdate: (job: ScenarioJob) => void;
}): Promise<AdoptedTranscription> {
  const { client, signal, operation } = input; signal.throwIfAborted();
  const selection = (await client.aiConfig.get()).effectiveSelections.find(item => item.capabilityContract === 'music.transcribe');
  const resource = selection?.resource;
  const profiles = resource?.oneofKind === 'local' ? resource.local.musicInput?.transcription : resource?.oneofKind === 'cloud' ? resource.cloud.target?.musicInput?.transcription : undefined;
  const source = operation.sourceAudio; const range = operation.sourceRange;
  const full = range.startFrame === 0 && range.endFrame === source.frameCount;
  const profile = profiles?.find(item => item.parts.includes(operation.requestedPart)
    && operation.requestedFormats.every(format => item.formats.includes(format)) && (full || item.supportsRange));
  if (selection?.state !== 'ready' || !profile || source.sizeBytes > profile.maxSourceBytes
    || source.frameCount / source.sampleRateHz > profile.maxDurationSeconds) throw new Error('OVERTONE_TRANSCRIPTION_CONFIGURATION');
  if (!Number.isSafeInteger(range.startFrame) || !Number.isSafeInteger(range.endFrame) || range.startFrame < 0
    || range.endFrame > source.frameCount || range.startFrame >= range.endFrame) throw new Error('OVERTONE_TRANSCRIPTION_RANGE');
  const asset = await client.storage.assets.stat(source.relativePath);
  if (asset.sha256 !== source.sha256 || asset.sizeBytes !== source.sizeBytes || asset.mediaType !== source.mimeType) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
  signal.throwIfAborted();
  const prepared = await client.ai.artifacts.upload({ source: { kind: 'app-asset', relativePath: source.relativePath },
    mimeType: 'audio/wav', audioPreparation: { profile: 'canonical-pcm-v1' } });
  signal.throwIfAborted();
  if (!prepared.audioInfo || prepared.mimeType !== source.mimeType || prepared.sizeBytes !== source.sizeBytes
    || !sameProjectAudio(source, { ...source, ...prepared.audioInfo })) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
  const captured: RecoverableMusicTranscription = { ...operation, sourceArtifactId: prepared.artifactId };
  await input.onPrepared(captured); signal.throwIfAborted();
  const api = client.ai;
  const protectedAI = { ...api, scenarioJobs: { ...api.scenarioJobs,
    submit: (spec: Parameters<typeof api.scenarioJobs.submit>[0], options?: Parameters<typeof api.scenarioJobs.submit>[1]) => api.scenarioJobs.submit(spec, { ...options, clientSubmissionId: operation.clientSubmissionId }),
  } };
  const result = await runRuntimeMusicTranscribe({ runtime: { ai: createNimiLocalAppRuntimeScenarioJobClient(protectedAI) },
    appId: 'nimi.overtone', scenarioId: 'overtone.music.transcribe', surfaceId: 'nimi.overtone.transcription',
    sourceAudio: { artifactId: prepared.artifactId, range }, requestedFormats: operation.requestedFormats, requestedParts: [operation.requestedPart],
    signal, onJobUpdate: input.onJobUpdate });
  if (!result.ok) throw result.error;
  return adoptTranscription(client, captured, result, signal);
}

// @nimi-authority: rule.overtone.transcription.r002
export async function recoverRecordingTranscription(input: {
  readonly client: Client; readonly operation: RecoverableMusicTranscription; readonly signal: AbortSignal;
  readonly onJobUpdate?: (job: ScenarioJob) => void;
}): Promise<AdoptedTranscription> {
  const { client, operation, signal } = input; signal.throwIfAborted();
  const found = await client.ai.scenarioJobs.lookupSubmission(operation.clientSubmissionId);
  if (operation.jobId && operation.jobId !== found.job.jobId) throw new Error('OVERTONE_TRANSCRIPTION_IDENTITY');
  const result = await observeRuntimeMusicTranscription({ runtime: { ai: createNimiLocalAppRuntimeScenarioJobClient(client.ai) },
    jobId: found.job.jobId, signal, onJobUpdate: input.onJobUpdate });
  if (!result.ok) throw result.error;
  return adoptTranscription(client, operation, result, signal);
}

async function adoptTranscription(client: Client, operation: RecoverableMusicTranscription,
  result: Extract<RuntimeMusicTranscribeResult, { ok: true }>, signal: AbortSignal): Promise<AdoptedTranscription> {
  const value = result.output.transcription;
  if (value.sourceArtifactId !== operation.sourceArtifactId || !sameProjectAudio(operation.sourceAudio, { ...operation.sourceAudio, ...value.sourceInfo })
    || value.inputRange.startFrame !== operation.sourceRange.startFrame || value.inputRange.endFrame !== operation.sourceRange.endFrame) throw new Error('OVERTONE_TRANSCRIPTION_IDENTITY');
  const expected = new Set(operation.requestedFormats.filter(format => format !== 'timeline').map(format => `${format}:${operation.requestedPart}`));
  if (value.scores.length !== expected.size || value.scores.some(score => !expected.delete(`${score.format}:${score.part}`))
    || Boolean(value.timelineArtifactId) !== operation.requestedFormats.includes('timeline')) throw new Error('OVERTONE_TRANSCRIPTION_INCOMPLETE');
  return adoptMusicArtifacts({ client, signal }, result.output.jobId, result.output.artifacts, async adopted => {
    const transcriptionId = makeId('transcription');
    const scores: ScoreDocument[] = value.scores.map(score => {
      const asset = adopted.get(score.artifactId); if (!asset) throw new Error('OVERTONE_TRANSCRIPTION_INCOMPLETE');
      return { scoreId: makeId('score'), asset, format: score.format, origin: 'transcription-estimate', sourceTakeId: operation.sourceTakeId,
        transcriptionId, transcriptionPart: score.part, ...(value.completeness === 'truncated' ? { truncated: true } : {}),
        title: operation.title, createdAt: operation.createdAt };
    });
    const timeline = value.timelineArtifactId ? adopted.get(value.timelineArtifactId) : undefined;
    if (value.timelineArtifactId && !timeline) throw new Error('OVERTONE_TRANSCRIPTION_INCOMPLETE');
    signal.throwIfAborted();
    return { document: { transcriptionId, jobId: result.output.jobId, clientSubmissionId: operation.clientSubmissionId,
      sourceTakeId: operation.sourceTakeId, sourceAudio: operation.sourceAudio, sourceRange: value.inputRange, scoreIds: scores.map(score => score.scoreId),
      ...(timeline ? { timeline } : {}), completeness: value.completeness, createdAt: operation.createdAt }, scores };
  });
}
