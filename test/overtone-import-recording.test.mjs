import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { loadSource } from './load-source.mjs';
const { importRecording } = await loadSource('../src/overtone/import-recording.ts');

// Orchestration fault tests only. Actual codec/long-file acceptance uses the
// supervised Overtone file input and protected Runtime, recorded separately.
function setup() {
  const assets = new Map(); const calls = [];
  const info = { sampleRateHz: 48000, channels: 2, frameCount: 48000, durationMs: 1000 };
  const prepared = { artifactId: 'owned-canonical-reference', mimeType: 'audio/wav', sizeBytes: 384058, audioInfo: info };
  const digest = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
  const client = { storage: { assets: {
    async write(input) {
      const parts = []; for await (const part of input.body) parts.push(part);
      const bytes = Buffer.concat(parts);
      const asset = { relativePath: input.relativePath, mediaType: input.mediaType, sizeBytes: bytes.length, sha256: digest(bytes) };
      assets.set(asset.relativePath, { asset, bytes }); return asset;
    },
    async adoptArtifact(input) {
      calls.push(['adopt', input]); const asset = { relativePath: input.relativePath, mediaType: 'audio/wav', sizeBytes: prepared.sizeBytes, sha256: 'sha256:' + 'b'.repeat(64) };
      assets.set(asset.relativePath, { asset }); return asset;
    },
    async remove(path) { calls.push(['remove', path]); assets.delete(path); return { removed: true }; },
  } }, ai: { artifacts: { async upload(input) { calls.push(['upload', input]); return prepared; } } } };
  const cache = { load: async () => ({}), remove: path => calls.push(['uncache', path]) };
  return { client, cache, calls, assets, prepared };
}
test('import orchestration preserves the original and sends an owned asset reference without inventing a Job', async () => {
  const setupValue = setup(); const file = new File([Uint8Array.of(1, 2, 3)], 'Recording.mp3');
  const take = await importRecording({ ...setupValue, file, signal: new AbortController().signal });
  assert.equal(take.origin, 'imported-recording'); assert.equal('jobId' in take, false); assert.equal(take.promptSnapshot, '');
  assert.equal(take.audio.frameCount, 48000); assert.equal(take.originalAsset.mimeType, 'audio/mpeg');
  assert.deepEqual([...setupValue.assets.get(take.originalAsset.relativePath).bytes], [1, 2, 3]);
  const upload = setupValue.calls.find(([kind]) => kind === 'upload')[1];
  assert.deepEqual(upload, { source: { kind: 'app-asset', relativePath: take.originalAsset.relativePath }, mimeType: 'audio/mpeg', audioPreparation: { profile: 'canonical-pcm-v1' } });
});
test('abandoning unary preparation waits for it to settle, then cleans the import without adopting', async () => {
  const value = setup(); const controller = new AbortController(); let finish;
  let markStarted; const started = new Promise(resolve => { markStarted = resolve; });
  value.client.ai.artifacts.upload = () => { markStarted(); return new Promise(resolve => { finish = resolve; }); };
  const pending = importRecording({ ...value, file: new File(['source'], 'song.mp3'), signal: controller.signal });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await started; controller.abort(); assert.equal(value.assets.size, 1);
  finish(value.prepared); await rejected;
  assert.equal(value.assets.size, 0); assert.equal(value.calls.some(([kind]) => kind === 'adopt'), false);
});
test('failed waveform validation cleans only new copies and retains unrelated assets', async () => {
  const value = setup(); value.assets.set('kept/original.wav', { marker: 'keep' });
  value.cache.load = async () => { throw new Error('non-finite waveform'); };
  await assert.rejects(importRecording({ ...value, file: new File(['source'], 'song.flac'), signal: new AbortController().signal }), /non-finite waveform/);
  assert.deepEqual([...value.assets.keys()], ['kept/original.wav']);
});
