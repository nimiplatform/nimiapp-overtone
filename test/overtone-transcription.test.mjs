import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';
const { transcribeRecording, recoverRecordingTranscription } = await loadSource('../src/overtone/transcription.ts');
const { overtoneReducer } = await loadSource('../src/overtone/store.tsx');
const { parseSongProject } = await loadSource('../src/overtone/project-storage.ts');
const { scoreSourceTakeId } = await loadSource('../src/overtone/types.ts');
const info = { sampleRateHz: 48000, channels: 2, frameCount: 1200000, durationMs: 25000 };
const audio = { relativePath: 'recordings/source.wav', mimeType: 'audio/wav', sizeBytes: 9600058, sha256: 'sha256:' + 'a'.repeat(64), ...info };
const operation = { clientSubmissionId: 'transcribe-author', projectId: 'project-one', sourceTakeId: 'take-one', sourceArtifactId: 'source-owned',
  sourceAudio: audio, sourceRange: { startFrame: 240000, endFrame: 720000 }, requestedFormats: ['abc','timeline'], requestedPart: 'lead-sheet', title: 'Recording', createdAt: 1 };
const take = { takeId: 'take-one', title: 'Recording', origin: 'imported-recording', originalAsset: audio, audio, promptSnapshot: '', favorite: false, discarded: false, createdAt: 1 };
const project = { schemaVersion: 2, projectId: 'project-one', createdAt: 1, brief: null, lyrics: null, takes: [take], scores: [], selectedScoreId: null, selectedTakeId: take.takeId, comparedTakeIds: [null,null] };
const signal = () => new AbortController().signal;

function sourceClient() {
  return { aiConfig: { get: async () => ({ effectiveSelections: [{ capabilityContract: 'music.transcribe', state: 'ready', resource: { oneofKind: 'local', local: { musicInput: {
    generation: [], transcription: [{ formats: ['abc','timeline'], parts: ['lead-sheet'], supportsRange: true, maxSourceBytes: 536870912, maxDurationSeconds: 600 }],
  } } } }] }) }, storage: { assets: { stat: async () => ({ ...audio, mediaType: audio.mimeType }) } }, ai: { artifacts: {}, scenarioJobs: {} } };
}

test('transcription rejects changed source before upload and does not submit canceled preparation', async () => {
  const client = sourceClient(); let uploads = 0; let remembered = 0;
  client.ai.artifacts.upload = async () => { uploads++; throw Error('unexpected upload'); };
  client.storage.assets.stat = async () => ({ ...audio, mediaType: audio.mimeType, sha256: 'sha256:' + 'b'.repeat(64) });
  await assert.rejects(transcribeRecording({ client, operation, signal: signal(), onPrepared: async () => { remembered++; }, onJobUpdate() {} }), /METADATA_CHANGED/);
  assert.equal(uploads, 0);
  client.storage.assets.stat = async () => ({ ...audio, mediaType: audio.mimeType });
  let finish; const controller = new AbortController();
  client.ai.artifacts.upload = () => new Promise(resolve => { finish = resolve; });
  const running = transcribeRecording({ client, operation, signal: controller.signal, onPrepared: async () => { remembered++; }, onJobUpdate() {} });
  const rejected = assert.rejects(running, { name: 'AbortError' });
  await new Promise(resolve => setImmediate(resolve)); controller.abort();
  finish({ artifactId: 'source-owned', mimeType: 'audio/wav', sizeBytes: audio.sizeBytes, audioInfo: info });
  await rejected; assert.equal(remembered, 0);
});

test('transcription recovery adopts all outputs, rolls back only new files, and commits one source-bound estimate', async () => {
  // Contract fault injection only; model quality and protected App acceptance are separate.
  let failTimeline = true; let submits = 0; const assets = new Map(); const removals = [];
  const artifacts = [{ artifactId: 'score-owned', mimeType: 'text/vnd.abc', sizeBytes: 258, sha256: 'b'.repeat(64) },
    { artifactId: 'timeline-owned', mimeType: 'application/vnd.nimi.music-timeline+json', sizeBytes: 3031, sha256: 'c'.repeat(64) }]
    .map(value => ({ ...value, bytes: [], durationMs: 0, sampleRateHz: 0, channels: 0, width: 0, height: 0 }));
  const job = { jobId: 'transcription-job', scenarioType: 'music-transcribe', status: 'completed', progressPercent: 100, progressCurrentStep: 0, progressTotalSteps: 0,
    reasonCode: 'action-executed', reasonDetail: '', traceId: 'trace', createdAt: null, updatedAt: null, transcriptionText: '', artifacts,
    musicTranscription: { sourceArtifactId: operation.sourceArtifactId, sourceInfo: info, inputRange: operation.sourceRange, origin: 'transcribed-estimate', completeness: 'unknown',
      scores: [{ artifactId: 'score-owned', format: 'abc', part: 'lead-sheet' }], timelineArtifactId: 'timeline-owned' } };
  const client = { aiConfig: { get() { throw Error('recovery must not resolve a new configuration'); } },
    ai: { scenarioJobs: { submit: async () => { submits++; }, lookupSubmission: async id => { assert.equal(id, operation.clientSubmissionId); return { job }; }, get: async () => ({ job }) } },
    storage: { assets: {
      list: async ({ prefix }) => ({ assets: [...assets.values()].filter(asset => asset.relativePath.startsWith(prefix)), nextCursor: '' }),
      adoptArtifact: async ({ artifactId, relativePath }) => {
        if (artifactId === 'timeline-owned' && failTimeline) throw Error('timeline adoption failed');
        const original = artifacts.find(item => item.artifactId === artifactId);
        const asset = { relativePath: relativePath.replace('.asset', '.bin'), mediaType: original.mimeType, sizeBytes: original.sizeBytes, sha256: 'sha256:' + original.sha256 };
        assets.set(asset.relativePath, asset); return asset;
      },
      remove: async path => { removals.push(path); assets.delete(path); },
    } },
  };
  await assert.rejects(recoverRecordingTranscription({ client, operation, signal: signal() }), /timeline adoption failed/);
  assert.equal(assets.size, 0); assert.equal(removals.length, 1);
  failTimeline = false;
  const result = await recoverRecordingTranscription({ client, operation, signal: signal() });
  assert.equal(assets.size, 2); assert.equal(result.document.completeness, 'unknown');
  let state = { project: structuredClone(project), activeJobs: {}, readiness: {} };
  state = overtoneReducer(state, { type: 'transcription/remember', operation });
  state = overtoneReducer(state, { type: 'transcription/complete', ...result });
  assert.equal(state.project.transcriptions.length, 1); assert.equal(state.project.scores.length, 1); assert.equal(state.project.recoverableTranscriptions.length, 0);
  assert.deepEqual(state.project.takes, project.takes);
  assert.deepEqual(parseSongProject(state.project), state.project);
  const derived = { ...result.scores[0], scoreId: 'author-score', origin: 'author-edit', parentScoreId: result.scores[0].scoreId };
  delete derived.transcriptionId; delete derived.transcriptionPart; delete derived.sourceTakeId;
  const withAuthorEdit = { ...state.project, scores: [...state.project.scores, derived] };
  assert.equal(scoreSourceTakeId(withAuthorEdit, derived.scoreId), take.takeId);
  assert.doesNotThrow(() => parseSongProject(withAuthorEdit));
  const cyclic = structuredClone(withAuthorEdit); cyclic.scores[0].parentScoreId = derived.scoreId;
  assert.throws(() => parseSongProject(cyclic), /REFERENCE_INVALID/);
  const recoveredAgain = await recoverRecordingTranscription({ client, operation, signal: signal() });
  state = overtoneReducer(state, { type: 'transcription/complete', ...recoveredAgain });
  assert.equal(state.project.transcriptions.length, 1); assert.equal(state.project.scores.length, 1); assert.equal(submits, 0);
  for (const mutate of [
    value => { value.transcriptions[0].sourceAudio.sha256 = 'sha256:' + 'd'.repeat(64); },
    value => { value.transcriptions[0].sourceRange.endFrame = info.frameCount + 1; },
    value => { value.transcriptions[0].scoreIds = ['missing']; },
    value => { value.scores[0].transcriptionId = 'another-estimate'; },
  ]) { const invalid = structuredClone(state.project); mutate(invalid); assert.throws(() => parseSongProject(invalid), /TRANSCRIPTION/); }
  job.musicTranscription.sourceArtifactId = 'another-owned-source';
  await assert.rejects(recoverRecordingTranscription({ client, operation, signal: signal() }), /IDENTITY/);
  assert.equal(assets.size, 2); assert.equal(removals.length, 1);
});
