import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';
const { createVoiceConvertVersions } = await loadSource('../src/overtone/runtime-workflow.ts');
const { parseSongProject, writeProject } = await loadSource('../src/overtone/project-storage.ts');
const { overtoneReducer } = await loadSource('../src/overtone/store.tsx');
const { buildVoiceConvertTargetChoice, preparedVoiceTarget, selectionFrames } = await loadSource('../src/overtone/voice-convert-target.ts');
const { separationSubmitRange } = await loadSource('../src/overtone/separation.ts');

const sha = letter => 'sha256:' + letter.repeat(64);
const audio = (relativePath, sampleRateHz, channels, frameCount) => ({
  relativePath, mimeType: 'audio/wav', sizeBytes: frameCount * channels * 4 + 44, sha256: sha('a'),
  sampleRateHz, channels, frameCount, durationMs: Math.floor(frameCount * 1000 / sampleRateHz),
});
const sourceAudio = audio('recordings/source.wav', 48000, 1, 96000);
const accompanimentAudio = audio('recordings/accomp.wav', 44100, 2, 88200);
const targetAudio = audio('recordings/target.wav', 44100, 1, 44100 * 8);
const vocalAudio = audio('music/results/vocal/result.asset', 24000, 1, 48000);
const derivedAudio = audio('music/results/derived/result.asset', 44100, 2, 44100);
const mixAudio = audio('music/results/mix/result.wav', 44100, 2, 88200);

const take = (takeId, extra) => ({ takeId, title: takeId, promptSnapshot: '', favorite: false, discarded: false, createdAt: 1, ...extra });
const imported = (takeId, value) => take(takeId, { origin: 'imported-recording', originalAsset: value, audio: value });
const sourceTake = imported('take-source', sourceAudio);
const accompanimentTake = imported('take-accomp', accompanimentAudio);
const targetTake = imported('take-target', targetAudio);

const operation = (overrides = {}) => ({
  clientSubmissionId: 'author-voice-one', projectId: 'project-one', title: 'Song · Voice 1',
  sourceTakeId: 'take-source', sourceArtifactId: 'source-artifact', sourceAudio,
  sourceRange: { startFrame: 0, endFrame: sourceAudio.frameCount },
  targetVoice: { kind: 'reference-audio', artifactId: 'target-artifact', range: { startFrame: 88200, endFrame: 264600 } },
  targetTakeId: 'take-target', targetAudio, semitoneShift: 3,
  retainedAccompanimentTakeId: 'take-accomp', retainedAccompanimentArtifactId: 'accomp-artifact',
  retainedAccompaniment: accompanimentAudio, createdAt: 1, ...overrides,
});
const adopted = (overrides = {}) => ({
  jobId: 'voice-job-one', vocalAudio, convertedVocalArtifactId: 'vocal-artifact', sourceArtifactId: 'source-artifact',
  sourceInfo: { sampleRateHz: sourceAudio.sampleRateHz, channels: sourceAudio.channels, frameCount: sourceAudio.frameCount, durationMs: sourceAudio.durationMs },
  inputRange: { startFrame: 0, endFrame: sourceAudio.frameCount },
  vocalInfo: { sampleRateHz: vocalAudio.sampleRateHz, channels: vocalAudio.channels, frameCount: vocalAudio.frameCount, durationMs: vocalAudio.durationMs },
  lengthRelation: 'MODEL_FRAME_ROUNDING', durationDeltaMs: 34,
  mixDomain: { sampleRateHz: 44100, channels: 2 },
  derived: [{ sourceArtifactId: 'vocal-artifact', artifactId: 'derived-artifact',
    preparation: { profile: 'canonical-pcm-v1', targetSampleRateHz: 44100, channelMode: 'MONO_TO_STEREO' }, audio: derivedAudio }],
  mixAudio, mixVocalStartFrame: 0, mixVocalFrameCount: derivedAudio.frameCount, mixAccompanimentFrameCount: accompanimentAudio.frameCount,
  mixOutputFrameCount: Math.max(derivedAudio.frameCount, accompanimentAudio.frameCount), mixPeak: 0.875,
  ...overrides,
});
const project = takes => ({ schemaVersion: 2, projectId: 'project-one', createdAt: 1, brief: null, lyrics: null,
  takes, scores: [], selectedScoreId: null, selectedTakeId: null, comparedTakeIds: [null, null] });

function mockStorage(failFirstWrite = false) {
  const written = [];
  let failures = failFirstWrite ? 1 : 0;
  return {
    written,
    async readJson() { throw Object.assign(new Error('not found'), { reasonCode: 'not_found' }); },
    async writeJson(path, value) {
      if (failures > 0) { failures -= 1; throw new Error('storage write failed'); }
      written.push({ path, value: JSON.parse(JSON.stringify(value)) });
    },
  };
}

test('a voice conversion creates one runtime version plus a local mix without touching the source takes', () => {
  const { take: convertTake, mixTake } = createVoiceConvertVersions(operation(), adopted(), 'Song · Mix 1');
  assert.equal(convertTake.origin, 'runtime-result');
  assert.equal(convertTake.capability, 'audio.voice.convert');
  assert.equal(convertTake.parentTakeId, 'take-source');
  assert.deepEqual(convertTake.audio, vocalAudio);
  assert.equal(mixTake.origin, 'local-render');
  assert.deepEqual([...mixTake.mixRecipe.sourceTakeIds], [convertTake.takeId, 'take-accomp']);
  const saved = project([sourceTake, targetTake, accompanimentTake, convertTake, mixTake]);
  assert.doesNotThrow(() => parseSongProject(structuredClone(saved)));
  const derivation = convertTake.derivation;
  assert.equal(derivation.retainedAccompanimentArtifactId, 'accomp-artifact');
  assert.equal(derivation.retainedAccompanimentTakeId, 'take-accomp');
  assert.deepEqual(derivation.sourceRange, { startFrame: 0, endFrame: sourceAudio.frameCount });
  assert.equal(derivation.semitoneShift, 3);
  assert.equal(derivation.lengthRelation, 'MODEL_FRAME_ROUNDING');
  assert.equal(derivation.durationDeltaMs, 34);
  assert.deepEqual(derivation.mixDomain, { sampleRateHz: 44100, channels: 2 });
  assert.equal(derivation.derived.length, 1);
  assert.deepEqual(derivation.derived[0].preparation, { profile: 'canonical-pcm-v1', targetSampleRateHz: 44100, channelMode: 'MONO_TO_STEREO' });
  assert.deepEqual(derivation.targetVoice, { kind: 'reference-audio', artifactId: 'target-artifact', range: { startFrame: 88200, endFrame: 264600 } });
  assert.equal(derivation.mix.peak, 0.875);
  assert.equal(derivation.mix.vocalStartFrame, 0);
  assert.equal(derivation.mix.outputFrameCount, Math.max(derivedAudio.frameCount, accompanimentAudio.frameCount));
  assert.equal(derivation.mix.vocalFrameCount, derivedAudio.frameCount);
  assert.equal(derivation.mix.accompanimentFrameCount, accompanimentAudio.frameCount);
  assert.equal(structuredClone(sourceTake).discarded, false);
});

test('a non-zero source selection keeps its source-time offset across the mix-domain rate change', () => {
  const longSource = audio('recordings/long.wav', 48000, 1, 60 * 48000);
  const longTake = imported('take-long', longSource);
  const sourceRange = { startFrame: 30 * 48000, endFrame: 40 * 48000 };
  const op = operation({ sourceTakeId: 'take-long', sourceAudio: longSource, sourceRange });
  const outputFrameCount = Math.max(Math.round(30 * 44100) + derivedAudio.frameCount, accompanimentAudio.frameCount);
  const base = adopted({ sourceArtifactId: 'source-artifact', inputRange: sourceRange,
    sourceInfo: { sampleRateHz: longSource.sampleRateHz, channels: longSource.channels, frameCount: longSource.frameCount, durationMs: longSource.durationMs },
    mixVocalStartFrame: Math.round(30 * 44100),
    mixVocalFrameCount: derivedAudio.frameCount,
    mixAudio: audio('music/results/mix-long/result.wav', 44100, 2, outputFrameCount),
    mixOutputFrameCount: outputFrameCount });
  const { take: convertTake, mixTake } = createVoiceConvertVersions(op, base, 'Song · Mix 1');
  assert.equal(convertTake.derivation.mix.vocalStartFrame, Math.round(30 * 44100));
  assert.equal(convertTake.derivation.mix.outputFrameCount,
    Math.max(Math.round(30 * 44100) + derivedAudio.frameCount, accompanimentAudio.frameCount));
  assert.doesNotThrow(() => parseSongProject(project([longTake, targetTake, accompanimentTake, convertTake, mixTake])));
  const wrongPlacement = createVoiceConvertVersions(op, { ...base, mixVocalStartFrame: 0,
    mixOutputFrameCount: Math.max(derivedAudio.frameCount, accompanimentAudio.frameCount),
    mixAudio: audio('music/results/mix-zero/result.wav', 44100, 2, Math.max(derivedAudio.frameCount, accompanimentAudio.frameCount)) }, 'Song · Mix 1');
  assert.throws(() => parseSongProject(project([longTake, targetTake, accompanimentTake, wrongPlacement.take, wrongPlacement.mixTake])), /VOICE_CONVERT_INVALID/);
});

test('same-domain vocals skip the derived conversion and still record the mix domain', () => {
  const value = { ...adopted(), derived: [], vocalAudio: derivedAudio,
    vocalInfo: { sampleRateHz: derivedAudio.sampleRateHz, channels: derivedAudio.channels, frameCount: derivedAudio.frameCount, durationMs: derivedAudio.durationMs },
    mixDomain: { sampleRateHz: 44100, channels: 2 }, mixVocalFrameCount: derivedAudio.frameCount,
    mixOutputFrameCount: Math.max(derivedAudio.frameCount, accompanimentAudio.frameCount) };
  const { take: convertTake, mixTake } = createVoiceConvertVersions(operation(), value, 'Song · Mix 1');
  assert.deepEqual(convertTake.derivation.derived, []);
  assert.doesNotThrow(() => parseSongProject(project([sourceTake, targetTake, accompanimentTake, convertTake, mixTake])));
});

test('voice conversion records fail closed on mixed identities and inconsistent derivations', () => {
  const { take: convertTake, mixTake } = createVoiceConvertVersions(operation(), adopted(), 'Song · Mix 1');
  const saved = () => JSON.parse(JSON.stringify(project([sourceTake, targetTake, accompanimentTake, convertTake, mixTake])));
  assert.throws(() => parseSongProject({ ...saved(), takes: [{ ...convertTake, derivation: undefined }, mixTake, sourceTake, accompanimentTake] }), /VERSION_INVALID/);
  assert.throws(() => parseSongProject({ ...saved(), takes: [{ ...convertTake, capability: 'music.generate' }, mixTake, sourceTake, accompanimentTake] }), /VERSION_INVALID/);
  assert.throws(() => parseSongProject({ ...saved(), takes: [{ ...convertTake, capability: 'audio.separate' }, mixTake, sourceTake, accompanimentTake] }), /VERSION_INVALID/);
  const mutated = mutate => { const invalid = structuredClone(saved()); mutate(invalid.takes.find(item => item.takeId === convertTake.takeId), invalid); assert.throws(() => parseSongProject(invalid)); };
  mutated(value => { value.derivation.lengthRelation = 'NEAR'; });
  mutated(value => { value.derivation.durationDeltaMs = '34'; });
  mutated(value => { value.derivation.semitoneShift = 24; });
  mutated(value => { value.derivation.derived[0].preparation.channelMode = 'DOWNMIX'; });
  mutated(value => { value.derivation.derived[0].sourceArtifactId = 'another-artifact'; });
  mutated(value => { value.derivation.mix.outputFrameCount += 1; });
  mutated(value => { value.derivation.mix.vocalStartFrame += 1; });
  mutated(value => { value.derivation.retainedAccompaniment.sha256 = sha('b'); });
  mutated(value => { value.derivation.sourceRange = { startFrame: 5, endFrame: 3 }; });
  mutated((value, invalid) => { invalid.takes = invalid.takes.filter(item => item.takeId !== 'take-accomp'); });
  mutated(value => { value.derivation.mix.mixTakeId = 'take-other'; });
  mutated(value => { delete value.derivation.mix.peak; });
  mutated(value => { value.derivation.mix.peak = -0.1; });
  mutated(value => { value.derivation.targetVoice = { kind: 'preset', presetVoiceId: 'preset-one' }; });
  mutated(value => { value.derivation.targetVoice = { kind: 'voice-asset', voiceAssetId: 'voice-one' }; });
});

test('an unlimited unity-gain mix above full scale stays a valid, visible record', () => {
  const { take: convertTake, mixTake } = createVoiceConvertVersions(operation(), adopted({ mixPeak: 1.42 }), 'Song · Mix 1');
  assert.equal(convertTake.derivation.mix.peak, 1.42);
  assert.doesNotThrow(() => parseSongProject(project([sourceTake, targetTake, accompanimentTake, convertTake, mixTake])));
});

test('stored projects keep loading old music.generate takes alongside the new capability union', () => {
  const legacy = { takeId: 'take-legacy', title: 'Song', origin: 'runtime-result', capability: 'music.generate', jobId: 'job-one', clientSubmissionId: 'author-one',
    termination: 'budget-limit', audio: sourceAudio, promptSnapshot: 'Folk', favorite: false, discarded: false, createdAt: 1 };
  assert.doesNotThrow(() => parseSongProject(project([legacy])));
  assert.throws(() => parseSongProject(project([{ ...legacy, jobId: 'job-two', capability: 'audio.voice.convert' }])), /VERSION_INVALID/);
});

test('voice conversion completes atomically: one transition, one valid write, pending cleared with the takes', async () => {
  const { take: convertTake, mixTake } = createVoiceConvertVersions(operation(), adopted(), 'Song · Mix 1');
  const entry = () => ({ ...operation() });
  const pending = { ...project([sourceTake, targetTake, accompanimentTake]), recoverableVoiceConversions: [entry()] };
  assert.doesNotThrow(() => parseSongProject(pending));
  let state = { project: structuredClone(pending), activeJobs: {}, readiness: {} };
  state = overtoneReducer(state, { type: 'voiceConvert/remember', operation: entry() });
  state = overtoneReducer(state, { type: 'voiceConvert/job', clientSubmissionId: 'author-voice-one', jobId: 'voice-job-one' });

  assert.throws(() => overtoneReducer(state, { type: 'take/add', take: convertTake }), /COMPLETE_REQUIRED/);
  assert.throws(() => overtoneReducer(state, { type: 'take/add', take: mixTake }), /COMPLETE_REQUIRED|VERSION_INVALID|REFERENCE_INVALID|INCOMPLETE/) ;
  const before = structuredClone(state.project);
  state = overtoneReducer(state, { type: 'voiceConvert/complete', take: convertTake, mixTake });
  assert.equal(state.project.recoverableVoiceConversions?.length ?? 0, 0);
  assert.equal(state.project.takes.length, 5);
  assert.doesNotThrow(() => parseSongProject(state.project));

  const failing = mockStorage(true);
  await assert.rejects(() => writeProject(failing, state.project), /storage write failed/);
  assert.equal(failing.written.length, 0);
  assert.equal(before.recoverableVoiceConversions.length, 1);
  assert.doesNotThrow(() => parseSongProject(before));

  const retry = mockStorage();
  await writeProject(retry, state.project);
  assert.equal(retry.written.length, 1);
  const persisted = parseSongProject(retry.written[0].value);
  assert.equal(persisted.takes.length, 5);
  assert.equal(persisted.recoverableVoiceConversions?.length ?? 0, 0);

  state = overtoneReducer(state, { type: 'voiceConvert/complete', take: convertTake, mixTake });
  assert.equal(state.project.takes.length, 5);
});

test('voice conversion recovery entries validate their three input identities and clear on the new version', () => {
  const entry = () => ({ ...operation() });
  const pending = { ...project([sourceTake, targetTake, accompanimentTake]), recoverableVoiceConversions: [entry()] };
  assert.doesNotThrow(() => parseSongProject(pending));
  assert.throws(() => parseSongProject({ ...pending, recoverableVoiceConversions: [entry(), entry()] }), /OPERATION/);
  assert.throws(() => parseSongProject({ ...pending, recoverableVoiceConversions: [{ ...entry(), retainedAccompaniment: sourceAudio }] }), /SOURCE/);
  assert.throws(() => parseSongProject({ ...pending, recoverableVoiceConversions: [{ ...entry(), sourceRange: { startFrame: 0, endFrame: sourceAudio.frameCount + 1 } }] }), /RANGE/);
  assert.throws(() => parseSongProject({ ...pending, recoverableVoiceConversions: [{ ...entry(), semitoneShift: -13 }] }), /OPERATION/);
  assert.throws(() => parseSongProject({ ...pending, recoverableVoiceConversions: [{ ...entry(), targetVoice: { kind: 'preset', presetVoiceId: 'preset-one' } }] }), /VOICE_CONVERT_INVALID/);
  assert.throws(() => parseSongProject({ ...pending, recoverableVoiceConversions: [{ ...entry(), targetVoice: { kind: 'reference-audio', artifactId: 'target-artifact', range: { startFrame: 0, endFrame: targetAudio.frameCount + 1 } } }] }), /RANGE/);
  assert.throws(() => parseSongProject({ ...pending, recoverableVoiceConversions: [{ ...entry(), targetTakeId: 'take-accomp' }] }), /SOURCE/);
  let state = { project: structuredClone(pending), activeJobs: {}, readiness: {} };
  state = overtoneReducer(state, { type: 'voiceConvert/forget', clientSubmissionId: 'author-voice-one' });
  assert.equal(state.project.recoverableVoiceConversions.length, 0);
  assert.throws(() => overtoneReducer({ ...state, project: structuredClone(pending) },
    { type: 'voiceConvert/remember', operation: { ...entry(), sourceAudio: accompanimentAudio } }), /IDENTITY/);
});

test('UI-shaped target reference ranges stay nested through choice and prepared target', () => {
  const reference = { sampleRateHz: 48000, frameCount: 96000 };
  const full = buildVoiceConvertTargetChoice({ reference, rangeMode: 'full', startSeconds: '', endSeconds: '' });
  assert.deepEqual(full, { kind: 'reference-audio' });
  const ranged = buildVoiceConvertTargetChoice({ reference, rangeMode: 'range', startSeconds: '1.5', endSeconds: '2' });
  assert.deepEqual(ranged, { kind: 'reference-audio', range: { startFrame: 72000, endFrame: 96000 } });
  const openEnded = buildVoiceConvertTargetChoice({ reference, rangeMode: 'range', startSeconds: '0.5', endSeconds: ' ' });
  assert.deepEqual(openEnded, { kind: 'reference-audio', range: { startFrame: 24000, endFrame: 96000 } });
  // Empty, reversed and out-of-recording selections never become a request.
  assert.equal(buildVoiceConvertTargetChoice({ reference, rangeMode: 'range', startSeconds: '2', endSeconds: '' }), null);
  assert.equal(buildVoiceConvertTargetChoice({ reference, rangeMode: 'range', startSeconds: '1.5', endSeconds: '1' }), null);
  assert.equal(buildVoiceConvertTargetChoice({ reference, rangeMode: 'range', startSeconds: '1', endSeconds: '3' }), null);
  const prepared = preparedVoiceTarget(ranged, 'target-artifact');
  assert.deepEqual(prepared, { kind: 'reference-audio', artifactId: 'target-artifact', range: { startFrame: 72000, endFrame: 96000 } });
  assert.deepEqual(preparedVoiceTarget(full, 'target-artifact'), { kind: 'reference-audio', artifactId: 'target-artifact' });
  assert.throws(() => preparedVoiceTarget(ranged, ''), /TARGET/);
  assert.throws(() => preparedVoiceTarget({ kind: 'preset', presetVoiceId: 'abc' }, 'target-artifact'), /TARGET/);
  assert.deepEqual(selectionFrames({ sampleRateHz: 44100, frameCount: 44100 * 60 }, 'range', '30', '40'), { startFrame: 1323000, endFrame: 1764000 });
  assert.equal(selectionFrames({ sampleRateHz: 44100, frameCount: 44100 * 20 }, 'range', '30', ''), null);
});

test('UI-shaped inputs reach the submitted voice-convert spec with the nested reference range', async () => {
  const { validateNimiLocalAppVoiceConvertSpec } = await import('@nimiplatform/sdk/app');
  const reference = { sampleRateHz: 48000, frameCount: 96000 };
  const choice = buildVoiceConvertTargetChoice({ reference, rangeMode: 'range', startSeconds: '1.5', endSeconds: '2' });
  const targetVoice = preparedVoiceTarget(choice, 'target-artifact');
  const spec = validateNimiLocalAppVoiceConvertSpec({
    type: 'audio-voice-convert',
    sourceVocal: { artifactId: 'source-artifact', range: { startFrame: 48000, endFrame: 96000 } },
    sourceKind: 'singing', targetVoice,
  });
  assert.deepEqual(spec.targetVoice, { kind: 'reference-audio', artifactId: 'target-artifact', range: { startFrame: 72000, endFrame: 96000 } });
  assert.deepEqual(spec.sourceVocal.range, { startFrame: 48000, endFrame: 96000 });
  assert.throws(() => validateNimiLocalAppVoiceConvertSpec({
    type: 'audio-voice-convert',
    sourceVocal: { artifactId: 'same-artifact' }, sourceKind: 'singing',
    targetVoice: { kind: 'reference-audio', artifactId: 'same-artifact' },
  }));
});

const stemTake = (takeId, stem, overrides = {}) => take(takeId, { origin: 'runtime-result', capability: 'audio.separate', jobId: 'separation-job',
  audio: audio('music/results/' + takeId + '/result.asset', 44100, 2, 441000),
  separation: { separationId: 'separation-one', sourceTakeId: 'take-mix', sourceArtifactId: 'mix-artifact',
    sourceAudio: audio('recordings/mix.wav', 48000, 2, 48000 * 191), sourceRange: { startFrame: 48000 * 30, endFrame: 48000 * 40 }, stem,
    requestedInstrumentParts: false, inputPreparation: { profile: 'canonical-pcm-v1', targetSampleRateHz: 44100, channelMode: 'PRESERVE' } },
  ...overrides });

test('separation stems keep the separated source range and fail closed on missing or mixed ranges', () => {
  const mixTake = imported('take-mix', audio('recordings/mix.wav', 48000, 2, 48000 * 191));
  const vocals = stemTake('take-vocals', 'vocals'); const background = stemTake('take-background', 'background');
  assert.doesNotThrow(() => parseSongProject(project([mixTake, vocals, background])));
  const withoutRange = structuredClone(vocals); delete withoutRange.separation.sourceRange;
  assert.throws(() => parseSongProject(project([mixTake, withoutRange, background])), /PROJECT_INVALID|VERSION_INVALID|RANGE/);
  const other = structuredClone(background); other.separation.sourceRange = { startFrame: 0, endFrame: 48000 * 10 };
  assert.throws(() => parseSongProject(project([mixTake, vocals, other])), /SEPARATION_INVALID/);
  const outside = structuredClone(vocals); outside.separation.sourceRange = { startFrame: 0, endFrame: 48000 * 192 };
  assert.throws(() => parseSongProject(project([mixTake, outside, background])), /RANGE/);
  let state = { project: project([mixTake]), activeJobs: {}, readiness: {} };
  state = overtoneReducer(state, { type: 'separation/complete', takes: [vocals, background] });
  state = overtoneReducer(state, { type: 'separation/complete', takes: [stemTake('take-vocals-2', 'vocals'), stemTake('take-background-2', 'background')] });
  assert.equal(state.project.takes.length, 3);
});

test('a separation selection maps into the native domain without passing the converted end', () => {
  const source = { sampleRateHz: 48000, frameCount: 9198504 };
  assert.deepEqual(separationSubmitRange({ startFrame: 48000 * 30, endFrame: 48000 * 40 }, source, 8451126), { startFrame: 1323000, endFrame: 1764000 });
  assert.deepEqual(separationSubmitRange({ startFrame: 48000 * 30, endFrame: source.frameCount }, source, 8451125), { startFrame: 1323000, endFrame: 8451125 });
  assert.throws(() => separationSubmitRange({ startFrame: source.frameCount - 1, endFrame: source.frameCount }, source, 8451125), /RANGE/);
});
