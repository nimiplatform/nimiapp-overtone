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
globalThis.OfflineAudioContext = class {
  async decodeAudioData() { return { duration: 20, length: 160, sampleRate: 8, numberOfChannels: 1, getChannelData: () => new Float32Array(160) }; }
};
const sources = [];
globalThis.AudioContext = class {
  currentTime = 0; state = 'running'; destination = {};
  createGain() { return { gain: { value: 1 }, connect() {} }; }
  createBufferSource() {
    const source = { playbackRate: { value: 1, setValueAtTime() {} }, connect() {}, disconnect() {}, stop() {}, start(...args) { this.startArgs = args; } };
    sources.push(source); return source;
  }
  async close() {}
};
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
  await act(async () => root.render(React.createElement(ComponentHarness, { storage, observe: value => { observed = value; } })));
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
      await cache.load(`media/${id}.wav`, async () => new ArrayBuffer(8), new AbortController().signal, { mimeType: 'audio/wav', sizeBytes: 8 });
      await actions.addTake(state.project.projectId, { takeId: id, title: id, jobId: id, clientSubmissionId: id, origin: 'runtime-result', capability: 'music.generate', termination: 'unknown',
        audio: { relativePath: `media/${id}.wav`, mimeType: 'audio/wav', sizeBytes: 8, sha256: 'sha256:'+ 'a'.repeat(64), sampleRateHz: 8, channels: 1, frameCount: 160, durationMs: 20000 },
        durationSeconds: 20, promptSnapshot: 'Test input', lyricsSnapshot: 'Test input', favorite: false, discarded: false, createdAt: 0 });
    }
    actions.selectTake('a');
  });
  await click('Overtone.player.trimStartIncreaseAria', 3);
  await click('Overtone.player.trimEndDecreaseAria', 12);
  await click('Overtone.playground.loop');
  await change(({ playback }) => playback.requestTake('a'));
  assert.deepEqual(sources.at(-1).startArgs, [0, 3]);
  await change(({ playback }) => playback.requestTake('b'));
  assert.deepEqual(sources.at(-1).startArgs, [0, 0]);
  assert.equal(sources.at(-1).loopStart, 0); assert.equal(sources.at(-1).loopEnd, 20);
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
