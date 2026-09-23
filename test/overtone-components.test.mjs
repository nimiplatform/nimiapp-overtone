import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { loadSource } from './load-source.mjs';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

// Real React/Kit components, with isolated storage and an audio sink that records
// playback commands. These tests do not claim Runtime, decoding or speaker success.
const dom = new JSDOM('<div id="root"></div>', { url: 'http://component-test.invalid/' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLCanvasElement', 'Node', 'MutationObserver', 'localStorage', 'getComputedStyle']) globalThis[name] = dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const sources = [];
// Media length per relative path; unlisted media keeps the 20 second default.
const mediaSeconds = new Map();
globalThis.Audio = class extends dom.window.EventTarget {
  constructor() { super(); sources.push(this); }
  currentTime = 0; duration = 20; readyState = 0; paused = true; src = '';
  load() { this.readyState = 0; if (this.src) queueMicrotask(() => { this.duration = mediaSeconds.get(new URL(this.src).pathname.slice(1)) ?? 20; this.readyState = 4; this.dispatchEvent(new dom.window.Event('loadedmetadata')); }); }
  async play() { this.paused = false; this.dispatchEvent(new dom.window.Event('play')); }
  pause() { this.paused = true; this.dispatchEvent(new dom.window.Event('pause')); }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
};
const openMedia = async path => ({ url: 'https://component-test.invalid/' + path, revoke: async () => {} });
await i18next.use(initReactI18next).init({ lng: 'en', fallbackLng: 'en', resources: { en: { translation: {} } } });
const { ComponentHarness } = await loadSource('./fixtures/overtone-components.tsx');
let root, observed, writeFailure = false;
const documents = new Map();
const storage = {
  async readJson(path) {
    if (!documents.has(path)) throw Object.assign(new Error('absent'), { reasonCode: 'APP_STORAGE_ENTRY_NOT_FOUND' });
    return { value: structuredClone(documents.get(path)) };
  },
  async writeJson(path, value) {
    if (writeFailure) throw new Error('Isolated storage fault');
    documents.set(path, structuredClone(value)); return { value };
  },
};
const storedProject = () => JSON.stringify([...documents.entries()].find(([key]) => key.startsWith('workspace/projects/'))?.[1]);
async function mount() {
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(ComponentHarness, { storage, openMedia, observe: value => { observed = value; } })));
}
async function unmount() { if (root) { await act(async () => root.unmount()); root = null; } }
async function change(fn) { await act(async () => fn(observed)); }
async function click(label, times = 1) {
  for (let i = 0; i < times; i++) await act(async () => {
    const button = document.querySelector(`button[aria-label="${label}"]`);
    assert.ok(button, `Missing actual control ${label}`); button.click();
  });
}
test.beforeEach(async () => { writeFailure = false; documents.clear(); localStorage.clear(); sources.length = 0; await mount(); });
test.afterEach(unmount);
test.after(() => dom.window.close());

test('switching cached takes starts and loops B over its visible default range, not A trim', async () => {
  await change(({ actions }) => actions.startProject());
  await change(async ({ cache, actions, state }) => {
    for (const id of ['a', 'b']) {
      await cache.load(`media/${id}.wav`, async () => ({ info: { sampleRateHz: 8000, channels: 1, frameCount: 160000 }, peaks: [0, 0.5], mimeType: 'audio/wav', sizeBytes: 8, sha256: 'sha256:'+'a'.repeat(64) }), new AbortController().signal);
      await actions.addTake(state.project.projectId, { takeId: id, title: id, jobId: id, clientSubmissionId: id, origin: 'runtime-result', capability: 'music.generate', termination: 'unknown',
        audio: { relativePath: `media/${id}.wav`, mimeType: 'audio/wav', sizeBytes: 8, sha256: 'sha256:'+ 'a'.repeat(64), sampleRateHz: 8000, channels: 1, frameCount: 160000, durationMs: 20000 },
        durationSeconds: 20, promptSnapshot: 'Test input', lyricsSnapshot: 'Test input', favorite: false, discarded: false, createdAt: 0 });
    }
    actions.selectTake('a');
  });
  await click('Overtone.player.trimStartIncreaseAria', 3);
  await click('Overtone.player.trimEndDecreaseAria', 12);
  await click('Overtone.playground.loop');
  await change(({ playback }) => playback.requestTake('a'));
  assert.equal(sources.at(-1).currentTime, 3); assert.equal(sources.at(-1).paused, false);
  await change(({ playback }) => playback.requestTake('b'));
  assert.equal(sources.at(-1).currentTime, 0); assert.equal(sources.at(-1).paused, false);
  await act(async () => { sources.at(-1).currentTime = 20; sources.at(-1).dispatchEvent(new dom.window.Event('ended')); });
  assert.equal(sources.at(-1).currentTime, 0);
  assert.equal(document.querySelector('[aria-label="Overtone.player.trimStartAria"]').textContent, '0');
  assert.equal(document.querySelector('[aria-label="Overtone.player.trimEndAria"]').textContent, '20');
});

test('failed draft persistence is visible; retry saves the same completed reference across remount', async () => {
  await change(({ actions }) => actions.startProject('Original draft'));
  assert.equal(observed.persistence.status, 'saved');
  const oldStored = storedProject();
  writeFailure = true;
  await change(async ({ actions, state }) => assert.rejects(actions.rememberResult({ clientSubmissionId: 'author-action', projectId: state.project.projectId, jobId: 'test-reference', title: 'Writing snapshot',
    promptSnapshot: 'Draft to preserve', lyricsSnapshot: 'Unchanged words', createdAt: 0, creationMode: 'song', targetDurationSeconds: 120 }, state.project.projectId), /Isolated storage fault/));
  assert.equal(observed.persistence.status, 'failed');
  assert.equal(observed.state.project.recoverableResults.length, 1);
  assert.equal(storedProject(), oldStored);
  assert.ok(document.querySelector('.ot-draft-save-alert'));
  await act(async () => document.querySelector('.ot-draft-save-alert button').click());
  assert.equal(observed.persistence.status, 'failed');
  writeFailure = false;
  await act(async () => document.querySelector('.ot-draft-save-alert button').click());
  assert.equal(observed.persistence.status, 'saved');
  assert.equal(document.querySelector('.ot-draft-save-alert'), null);
  await unmount(); await mount();
  assert.equal(observed.state.project.recoverableResults[0].jobId, 'test-reference');
  assert.equal(observed.state.project.recoverableResults[0].lyricsSnapshot, 'Unchanged words');
});

test('a full-song result returns to the existing arrangement; a different source still needs confirmation', async () => {
  const draft = { sourceTakeId: 'source', sourceTitle: 'Source', sourcePrompt: 'Direction', sourceLyrics: 'Hook',
    title: 'Manually edited title', durationSeconds: 120, sections: [] };
  await change(({ actions }) => { actions.startProject(); actions.setFullSong(draft); });
  await change(({ creative }) => creative.startSong({ takeId: 'result', parentTakeId: 'source', creationMode: 'song' }));
  assert.equal(observed.creative.stage, 'song'); assert.equal(observed.creative.pendingSong, null);
  assert.equal(observed.state.project.fullSong, draft);
  await change(({ creative }) => creative.setStage('explore'));
  await change(({ creative }) => creative.startSong({ takeId: 'different', parentTakeId: 'source', creationMode: 'sketch' }));
  assert.equal(observed.creative.pendingSong.takeId, 'different'); assert.equal(observed.creative.stage, 'explore');
  assert.equal(observed.state.project.fullSong, draft);
});

test('a late adopted version is saved to its original project without changing the active project or save indicator', async () => {
  await change(({ actions }) => actions.startProject('First'));
  const first = observed.state.project.projectId;
  await change(({ actions }) => actions.startProject('Second'));
  const second = observed.state.project.projectId;
  await change(({ actions }) => actions.addTake(first, { takeId: 'late-take', title: 'Late result', jobId: 'late-job', clientSubmissionId: 'late-author',
    origin: 'runtime-result', capability: 'music.generate', termination: 'budget-limit',
    audio: { relativePath: 'music/late.wav', mimeType: 'audio/wav', sizeBytes: 90, sha256: 'sha256:' + 'a'.repeat(64), sampleRateHz: 8000, channels: 1, frameCount: 8, durationMs: 1 },
    promptSnapshot: 'First', favorite: false, discarded: false, createdAt: 1 }));
  assert.equal(observed.state.project.projectId, second);
  assert.equal(observed.state.project.takes.length, 0);
  assert.equal(documents.get(`workspace/projects/${first}.json`).takes.length, 1);
  assert.equal(documents.get('workspace/current.json').projectId, second);
  assert.equal(observed.persistence.status, 'saved');
});

test('the full-song action withholds incomplete edited arrangements and recovers after correction', async () => {
  const draft = { sourceTakeId: 'source', sourceTitle: 'Source', sourcePrompt: 'Direction', sourceLyrics: 'Hook',
    title: 'A whole song', durationSeconds: 120,
    sections: Array.from({ length: 6 }, (_, i) => ({ kind: i % 2 ? 'chorus' : 'verse', name: 'Section ' + i,
      arrangement: 'Piano enters', lyrics: 'One\nTwo\nThree\nFour' })) };
  await change(({ actions, creative }) => {
    actions.startProject(); actions.setFullSong(draft);
    actions.setReadiness({ runtimeStatus: 'ready', textCapabilityAvailable: true, musicCapabilityAvailable: true, musicInput: { generation: [{ scoreMode: 'unsupported' }] } });
    creative.setStage('song');
  });
  const generate = () => document.querySelector('[data-next-action="generate-song"]');
  assert.equal(generate().disabled, false);
  for (const sections of [draft.sections.map((section, i) => i ? section : { ...section, arrangement: '' }),
    draft.sections.map(section => ({ ...section, lyrics: '' }))]) {
    await change(({ actions }) => actions.setFullSong({ ...draft, sections }));
    assert.equal(generate().disabled, true);
    assert.ok(document.body.textContent.includes('Overtone.song.incompleteDraft'));
    await act(async () => generate().click());
    assert.equal(observed.creative.musicBusy, false);
    assert.equal(observed.state.project.takes.length, 0);
  }
  await change(({ actions }) => actions.setFullSong(draft));
  assert.equal(generate().disabled, false);
});

const { createVoiceConvertVersions } = await loadSource('../src/overtone/runtime-workflow.ts');
test('voice conversion completion survives a failed project write and retries into one saved pair', async () => {
  const sha = 'sha256:' + 'a'.repeat(64);
  const facts = (relativePath, sampleRateHz, channels, frameCount) => ({ relativePath, mimeType: 'audio/wav', sizeBytes: frameCount * channels * 4 + 44, sha256: sha,
    sampleRateHz, channels, frameCount, durationMs: Math.floor(frameCount * 1000 / sampleRateHz) });
  const imported = (takeId, audio) => ({ takeId, title: takeId, origin: 'imported-recording', originalAsset: audio, audio,
    promptSnapshot: '', favorite: false, discarded: false, createdAt: 1 });
  const vocals = facts('music/results/vocals/result.asset', 44100, 2, 44100 * 60);
  const target = facts('recordings/target.wav', 44100, 1, 44100 * 8);
  const background = facts('music/results/background/result.asset', 44100, 2, 44100 * 60);
  await change(({ actions }) => actions.startProject('Voice conversion'));
  const projectId = observed.state.project.projectId;
  for (const [takeId, audio] of [['take-vocals', vocals], ['take-target', target], ['take-background', background]]) {
    await change(({ actions }) => actions.addTake(projectId, imported(takeId, audio)));
  }
  const operation = { clientSubmissionId: 'voice-author-1', projectId, title: 'Vocals · Voice 4', sourceTakeId: 'take-vocals', sourceArtifactId: 'source-artifact',
    sourceAudio: vocals, sourceRange: { startFrame: 44100 * 30, endFrame: 44100 * 40 },
    targetVoice: { kind: 'reference-audio', artifactId: 'target-artifact', range: { startFrame: 44100 * 2, endFrame: 44100 * 8 } },
    targetTakeId: 'take-target', targetAudio: target, retainedAccompanimentTakeId: 'take-background', retainedAccompanimentArtifactId: 'background-artifact',
    retainedAccompaniment: background, createdAt: 2 };
  await change(({ actions }) => actions.rememberVoiceConvert(operation));
  await change(({ actions }) => actions.captureVoiceConvertJob(projectId, 'voice-author-1', 'voice-job-1'));
  const stored = () => documents.get(`workspace/projects/${projectId}.json`);
  assert.equal(stored().recoverableVoiceConversions[0].jobId, 'voice-job-1');
  const vocal = facts('music/results/vocal/result.asset', 24000, 1, 240008);
  const derived = facts('music/results/derived/result.asset', 44100, 2, 441015);
  const start = 44100 * 30;
  const adopted = { jobId: 'voice-job-1', vocalAudio: vocal, convertedVocalArtifactId: 'vocal-artifact', sourceArtifactId: 'source-artifact',
    sourceInfo: { sampleRateHz: 44100, channels: 2, frameCount: vocals.frameCount, durationMs: vocals.durationMs }, inputRange: operation.sourceRange,
    vocalInfo: { sampleRateHz: 24000, channels: 1, frameCount: vocal.frameCount, durationMs: vocal.durationMs }, lengthRelation: 'MODEL_FRAME_ROUNDING', durationDeltaMs: 0,
    mixDomain: { sampleRateHz: 44100, channels: 2 },
    derived: [{ sourceArtifactId: 'vocal-artifact', artifactId: 'derived-artifact', preparation: { profile: 'canonical-pcm-v1', targetSampleRateHz: 44100, channelMode: 'MONO_TO_STEREO' }, audio: derived }],
    mixAudio: facts('music/results/mix/result.wav', 44100, 2, Math.max(start + derived.frameCount, background.frameCount)),
    mixVocalStartFrame: start, mixVocalFrameCount: derived.frameCount, mixAccompanimentFrameCount: background.frameCount,
    mixOutputFrameCount: Math.max(start + derived.frameCount, background.frameCount), mixPeak: 0.91 };
  const first = createVoiceConvertVersions(operation, adopted, 'Vocals · Mix 4');
  writeFailure = true;
  await change(async ({ actions }) => assert.rejects(actions.completeVoiceConvert(projectId, first.take, first.mixTake), /Isolated storage fault/));
  assert.equal(observed.state.project.takes.length, 3);
  assert.equal(observed.state.project.recoverableVoiceConversions.length, 1);
  assert.equal(stored().takes.length, 3);
  assert.equal(stored().recoverableVoiceConversions.length, 1);
  writeFailure = false;
  // A recovery rerun adopts the same Job again and builds a fresh version pair.
  const retry = createVoiceConvertVersions(operation, adopted, 'Vocals · Mix 4');
  await change(({ actions }) => actions.completeVoiceConvert(projectId, retry.take, retry.mixTake));
  const duplicate = createVoiceConvertVersions(operation, adopted, 'Vocals · Mix 4');
  await change(({ actions }) => actions.completeVoiceConvert(projectId, duplicate.take, duplicate.mixTake));
  assert.equal(stored().takes.length, 5);
  assert.equal(stored().recoverableVoiceConversions.length, 0);
  assert.deepEqual(stored().takes.slice(3).map(item => item.takeId), [retry.take.takeId, retry.mixTake.takeId]);
  await unmount(); await mount();
  const reopened = observed.state.project;
  assert.equal(reopened.takes.length, 5);
  const converted = reopened.takes.find(item => item.capability === 'audio.voice.convert');
  assert.equal(converted.jobId, 'voice-job-1');
  assert.equal(converted.derivation.mix.vocalStartFrame, start);
  assert.deepEqual(converted.derivation.targetVoice.range, { startFrame: 44100 * 2, endFrame: 44100 * 8 });
  assert.equal(converted.derivation.mix.peak, 0.91);
});

// Holds the first project write that contains a completed result of this
// capability, so supported edits can arrive through the public actions while
// it is pending; the held write can then be released or made to fail once.
function holdCompletionWrite(capability, { fail = false } = {}) {
  const originalWrite = storage.writeJson; let release, entered, armed = true;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  storage.writeJson = async (path, value) => {
    if (armed && value?.takes?.some(item => item.capability === capability)) {
      armed = false; entered(); await gate;
      if (fail) throw new Error('Isolated storage fault');
    }
    return originalWrite(path, value);
  };
  return { started, release: () => release(), restore: () => { storage.writeJson = originalWrite; release(); } };
}

async function pendingVoiceConversion() {
  const sha = 'sha256:' + 'a'.repeat(64);
  const facts = (relativePath, sampleRateHz, channels, frameCount) => ({ relativePath, mimeType: 'audio/wav', sizeBytes: frameCount * channels * 4 + 44, sha256: sha,
    sampleRateHz, channels, frameCount, durationMs: Math.floor(frameCount * 1000 / sampleRateHz) });
  const imported = (takeId, audio) => ({ takeId, title: takeId, origin: 'imported-recording', originalAsset: audio, audio,
    promptSnapshot: '', favorite: false, discarded: false, createdAt: 1 });
  const vocals = facts('music/results/vocals/result.asset', 44100, 2, 44100 * 60);
  const target = facts('recordings/target.wav', 44100, 1, 44100 * 8);
  const background = facts('music/results/background/result.asset', 44100, 2, 44100 * 60);
  await change(({ actions }) => actions.startProject('Voice conversion'));
  const projectId = observed.state.project.projectId;
  for (const [takeId, audio] of [['take-vocals', vocals], ['take-target', target], ['take-background', background]]) {
    await change(({ actions }) => actions.addTake(projectId, imported(takeId, audio)));
  }
  const operation = { clientSubmissionId: 'voice-author-1', projectId, title: 'Vocals · Voice 4', sourceTakeId: 'take-vocals', sourceArtifactId: 'source-artifact',
    sourceAudio: vocals, sourceRange: { startFrame: 44100 * 30, endFrame: 44100 * 40 },
    targetVoice: { kind: 'reference-audio', artifactId: 'target-artifact', range: { startFrame: 44100 * 2, endFrame: 44100 * 8 } },
    targetTakeId: 'take-target', targetAudio: target, retainedAccompanimentTakeId: 'take-background', retainedAccompanimentArtifactId: 'background-artifact',
    retainedAccompaniment: background, createdAt: 2 };
  await change(({ actions }) => actions.rememberVoiceConvert(operation));
  await change(({ actions }) => actions.captureVoiceConvertJob(projectId, 'voice-author-1', 'voice-job-1'));
  const vocal = facts('music/results/vocal/result.asset', 24000, 1, 240008);
  const derived = facts('music/results/derived/result.asset', 44100, 2, 441015);
  const start = 44100 * 30;
  const adopted = { jobId: 'voice-job-1', vocalAudio: vocal, convertedVocalArtifactId: 'vocal-artifact', sourceArtifactId: 'source-artifact',
    sourceInfo: { sampleRateHz: 44100, channels: 2, frameCount: vocals.frameCount, durationMs: vocals.durationMs }, inputRange: operation.sourceRange,
    vocalInfo: { sampleRateHz: 24000, channels: 1, frameCount: vocal.frameCount, durationMs: vocal.durationMs }, lengthRelation: 'MODEL_FRAME_ROUNDING', durationDeltaMs: 0,
    mixDomain: { sampleRateHz: 44100, channels: 2 },
    derived: [{ sourceArtifactId: 'vocal-artifact', artifactId: 'derived-artifact', preparation: { profile: 'canonical-pcm-v1', targetSampleRateHz: 44100, channelMode: 'MONO_TO_STEREO' }, audio: derived }],
    mixAudio: facts('music/results/mix/result.wav', 44100, 2, Math.max(start + derived.frameCount, background.frameCount)),
    mixVocalStartFrame: start, mixVocalFrameCount: derived.frameCount, mixAccompanimentFrameCount: background.frameCount,
    mixOutputFrameCount: Math.max(start + derived.frameCount, background.frameCount), mixPeak: 0.91 };
  return { projectId, pair: () => createVoiceConvertVersions(operation, adopted, 'Vocals · Mix 4'), stored: () => documents.get(`workspace/projects/${projectId}.json`) };
}

test('edits made while a voice conversion completion is being written are saved with the result', async () => {
  const { projectId, pair, stored } = await pendingVoiceConversion();
  const result = pair();
  const hold = holdCompletionWrite('audio.voice.convert');
  try {
    await act(async () => {
      const completion = observed.actions.completeVoiceConvert(projectId, result.take, result.mixTake);
      await hold.started;
      observed.actions.favoriteTake('take-vocals');
      observed.actions.renameTake('take-target', 'Target reference');
      hold.release();
      await completion; await observed.persistence.flush();
    });
  } finally { hold.restore(); }
  const expectBoth = project => {
    assert.equal(project.takes.length, 5);
    assert.equal(project.recoverableVoiceConversions?.length ?? 0, 0);
    assert.equal(project.takes.find(item => item.takeId === 'take-vocals').favorite, true);
    assert.equal(project.takes.find(item => item.takeId === 'take-target').title, 'Target reference');
  };
  expectBoth(observed.state.project); expectBoth(stored());
  assert.equal(observed.persistence.status, 'saved');
  await unmount(); await mount();
  expectBoth(observed.state.project);
});

test('a failed completion write keeps concurrent edits and the recovery entry; recovery then saves one pair', async () => {
  const { projectId, pair, stored } = await pendingVoiceConversion();
  const failed = pair();
  const hold = holdCompletionWrite('audio.voice.convert', { fail: true });
  try {
    await act(async () => {
      const completion = observed.actions.completeVoiceConvert(projectId, failed.take, failed.mixTake);
      await hold.started;
      observed.actions.favoriteTake('take-vocals');
      hold.release();
      await assert.rejects(completion, /Isolated storage fault/);
      await observed.persistence.flush();
    });
  } finally { hold.restore(); }
  for (const project of [observed.state.project, stored()]) {
    assert.equal(project.takes.length, 3);
    assert.equal(project.recoverableVoiceConversions.length, 1);
    assert.equal(project.takes.find(item => item.takeId === 'take-vocals').favorite, true);
  }
  const retry = pair();
  await change(({ actions }) => actions.completeVoiceConvert(projectId, retry.take, retry.mixTake));
  await unmount(); await mount();
  const reopened = observed.state.project;
  assert.equal(reopened.takes.length, 5);
  assert.equal(reopened.recoverableVoiceConversions?.length ?? 0, 0);
  assert.equal(reopened.takes.find(item => item.takeId === 'take-vocals').favorite, true);
  assert.deepEqual(reopened.takes.slice(3).map(item => item.takeId), [retry.take.takeId, retry.mixTake.takeId]);
});

test('an edit made while separation stems are being written is saved with the stems', async () => {
  const sha = 'sha256:' + 'b'.repeat(64);
  const facts = (relativePath, sampleRateHz, channels, frameCount) => ({ relativePath, mimeType: 'audio/wav', sizeBytes: frameCount * channels * 4 + 44, sha256: sha,
    sampleRateHz, channels, frameCount, durationMs: Math.floor(frameCount * 1000 / sampleRateHz) });
  const original = facts('recordings/mix.wav', 48000, 2, 48000 * 60);
  await change(({ actions }) => actions.startProject('Separation'));
  const projectId = observed.state.project.projectId;
  await change(({ actions }) => actions.addTake(projectId, { takeId: 'take-mix', title: 'Mix', origin: 'imported-recording', originalAsset: original, audio: original,
    promptSnapshot: '', favorite: false, discarded: false, createdAt: 1 }));
  const sourceRange = { startFrame: 48000 * 10, endFrame: 48000 * 20 };
  const inputPreparation = { profile: 'canonical-pcm-v1', targetSampleRateHz: 44100, channelMode: 'PRESERVE' };
  await change(({ actions }) => actions.rememberSeparation({ separationId: 'separation-1', projectId, title: 'Mix · Separation', sourceTakeId: 'take-mix',
    sourceArtifactId: 'mix-artifact', sourceAudio: original, sourceRange, requestedInstrumentParts: false, inputPreparation, createdAt: 2 }));
  await change(({ actions }) => actions.captureSeparationJob(projectId, 'separation-1', 'separation-job-1'));
  const stem = (takeId, name) => ({ takeId, title: takeId, promptSnapshot: '', favorite: false, discarded: false, createdAt: 3,
    origin: 'runtime-result', capability: 'audio.separate', jobId: 'separation-job-1', audio: facts(`music/results/${takeId}/result.asset`, 44100, 2, 441000),
    separation: { separationId: 'separation-1', sourceTakeId: 'take-mix', sourceArtifactId: 'mix-artifact', sourceAudio: original, sourceRange, stem: name,
      requestedInstrumentParts: false, inputPreparation } });
  const hold = holdCompletionWrite('audio.separate');
  try {
    await act(async () => {
      const completion = observed.actions.completeSeparation(projectId, [stem('take-stem-vocals', 'vocals'), stem('take-stem-background', 'background')]);
      await hold.started;
      observed.actions.favoriteTake('take-mix');
      hold.release();
      await completion; await observed.persistence.flush();
    });
  } finally { hold.restore(); }
  const expectBoth = project => {
    assert.equal(project.takes.length, 3);
    assert.equal(project.recoverableSeparations?.length ?? 0, 0);
    assert.equal(project.takes.find(item => item.takeId === 'take-mix').favorite, true);
  };
  expectBoth(observed.state.project); expectBoth(documents.get(`workspace/projects/${projectId}.json`));
  await unmount(); await mount();
  expectBoth(observed.state.project);
});

test('voice conversion tracks carry the listening position through the song timeline', async () => {
  const media = (name, seconds) => ({ relativePath: `media/${name}.wav`, mimeType: 'audio/wav', sizeBytes: seconds * 8000 * 4 + 44,
    sha256: 'sha256:' + 'c'.repeat(64), sampleRateHz: 8000, channels: 1, frameCount: seconds * 8000, durationMs: seconds * 1000 });
  const source = media('source', 60), target = media('target', 10), background = media('background', 60), vocal = media('vocal', 10), mix = media('mix', 60);
  await change(({ actions }) => actions.startProject('Tracks'));
  const projectId = observed.state.project.projectId;
  await change(async ({ cache, actions }) => {
    for (const audio of [source, target, background, vocal, mix]) {
      mediaSeconds.set(audio.relativePath, audio.durationMs / 1000);
      await cache.load(audio.relativePath, async () => ({ info: audio, peaks: [0, 0.5], mimeType: audio.mimeType, sizeBytes: audio.sizeBytes, sha256: audio.sha256 }), new AbortController().signal);
    }
    for (const [takeId, audio] of [['source', source], ['target', target], ['background', background]]) {
      await actions.addTake(projectId, { takeId, title: takeId, origin: 'imported-recording', originalAsset: audio, audio,
        promptSnapshot: '', favorite: false, discarded: false, createdAt: 1 });
    }
  });
  // Source 30-40 s converted; the mix places the converted vocal at 30 s.
  const operation = { clientSubmissionId: 'voice-tracks', projectId, title: 'Source · Voice', sourceTakeId: 'source', sourceArtifactId: 'source-artifact',
    sourceAudio: source, sourceRange: { startFrame: 30 * 8000, endFrame: 40 * 8000 },
    targetVoice: { kind: 'reference-audio', artifactId: 'target-artifact' }, targetTakeId: 'target', targetAudio: target,
    retainedAccompanimentTakeId: 'background', retainedAccompanimentArtifactId: 'background-artifact', retainedAccompaniment: background, createdAt: 2 };
  await change(({ actions }) => actions.rememberVoiceConvert(operation));
  const versions = createVoiceConvertVersions(operation, { jobId: 'voice-tracks-job', vocalAudio: vocal, convertedVocalArtifactId: 'vocal-artifact',
    sourceArtifactId: 'source-artifact', sourceInfo: { sampleRateHz: 8000, channels: 1, frameCount: source.frameCount, durationMs: source.durationMs },
    inputRange: operation.sourceRange, vocalInfo: { sampleRateHz: 8000, channels: 1, frameCount: vocal.frameCount, durationMs: vocal.durationMs },
    lengthRelation: 'EXACT', durationDeltaMs: 0, mixDomain: { sampleRateHz: 8000, channels: 1 }, derived: [], mixAudio: mix,
    mixVocalStartFrame: 30 * 8000, mixVocalFrameCount: vocal.frameCount, mixAccompanimentFrameCount: background.frameCount,
    mixOutputFrameCount: mix.frameCount, mixPeak: 0.5 }, 'Source · Mix');
  await change(({ actions }) => actions.completeVoiceConvert(projectId, versions.take, versions.mixTake));
  const playTrack = index => document.querySelectorAll('[data-testid="voice-convert-tracks"] button')[index * 2];
  const listenFromVocal = async (seconds, index) => {
    await change(({ actions }) => actions.selectTake(versions.take.takeId));
    await act(async () => { sources.at(-1).currentTime = seconds; sources.at(-1).dispatchEvent(new dom.window.Event('timeupdate')); });
    await act(async () => { playTrack(index).click(); });
    return sources.at(-1).currentTime;
  };
  // 5 s into the converted vocal is 35 s into the kept accompaniment and the mix.
  assert.equal(await listenFromVocal(5, 2), 35);
  assert.equal(observed.state.project.selectedTakeId, versions.mixTake.takeId);
  assert.equal(await listenFromVocal(5, 1), 35);
  assert.equal(observed.state.project.selectedTakeId, 'background');
  // A discarded kept accompaniment stays listed but cannot clear the player.
  await change(({ actions }) => { actions.selectTake(versions.take.takeId); actions.discardTake('background'); });
  assert.equal(playTrack(1).disabled, true);
  assert.match(document.querySelector('[data-testid="voice-convert-tracks"]').textContent, /Overtone\.voiceConvert\.trackDiscarded/);
  assert.equal(playTrack(2).disabled, false);
});
