import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { canonicalWavHeader, readPcmFrames } from '@nimiplatform/kit/core/audio';
import { loadSource } from './load-source.mjs';
const { openProjectPcm } = await loadSource('../src/overtone/pcm-media.ts');

function source() {
  const info = { sampleRateHz: 48000, channels: 2, frameCount: 4 };
  const bytes = new Uint8Array(58 + 32); bytes.set(canonicalWavHeader(info));
  const fields = new DataView(bytes.buffer);
  for (let n = 0; n < 8; n++) fields.setFloat32(58 + n * 4, (n - 4) / 10, true);
  const audio = { ...info, relativePath: 'owned/source.wav', sizeBytes: bytes.length, mimeType: 'audio/wav',
    sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}`, durationMs: 0 };
  const requests = [];
  const read = async range => {
    requests.push(range);
    return { asset: { ...audio, mediaType: audio.mimeType }, range: { offset: range.offset, length: range.length, totalSize: bytes.length },
      body: (async function* () { yield bytes.slice(range.offset, range.offset + range.length); })() };
  };
  return { audio, requests, read };
}
test('project PCM reads pin owned asset facts and use explicit byte ranges', async () => {
  const value = source(); const client = { storage: { assets: { read: value.read } } };
  const wav = await openProjectPcm(client, value.audio, new AbortController().signal);
  const samples = await readPcmFrames(wav, 1, 2);
  assert.equal(samples.length, 4); assert.ok(Math.abs(samples[0] + 0.2) < 1e-7);
  assert.deepEqual(value.requests, [{ relativePath: value.audio.relativePath, offset: 0, length: 90 }]);
  assert.ok(value.requests.every(request => request.length > 0 && request.length <= 1024 * 1024));
});
test('a changed asset digest or canonical frame count is rejected instead of redefining the editing source', async () => {
  const value = source(); const signal = new AbortController().signal;
  const changed = { storage: { assets: { read: async request => { const result = await value.read(request); return { ...result, asset: { ...result.asset, sha256: 'sha256:' + '0'.repeat(64) } }; } } } };
  await assert.rejects(openProjectPcm(changed, value.audio, signal), /OVERTONE_ARTIFACT_METADATA_CHANGED/);
  const client = { storage: { assets: { read: value.read } } };
  await assert.rejects(openProjectPcm(client, { ...value.audio, frameCount: 5 }, signal), /OVERTONE_AUDIO_FACTS_CHANGED/);
});

test('sequential PCM windows retain bounded stream chunks and dispose the held read when stopped early', async () => {
  const info = { sampleRateHz: 8000, channels: 2, frameCount: 524288 };
  const bytes = new Uint8Array(58 + info.frameCount * 8); bytes.set(canonicalWavHeader(info));
  const audio = { ...info, relativePath: 'owned/long.wav', sizeBytes: bytes.length, mimeType: 'audio/wav', sha256: 'sha256:' + 'a'.repeat(64), durationMs: 65536 };
  let opened = 0, closed = 0, delivered = 0;
  const client = { storage: { assets: { read: async ({ offset, length }) => {
    opened++;
    return { asset: { ...audio, mediaType: 'audio/wav' }, range: { offset, length, totalSize: bytes.length },
      body: (async function* () { try {
        for (let at = offset; at < offset + length; at += 65536) {
          const chunk = bytes.slice(at, Math.min(at + 65536, offset + length)); delivered += chunk.length; yield chunk;
        }
      } finally { closed++; } })() };
  } } } };
  const wav = await openProjectPcm(client, audio, new AbortController().signal);
  for (let frame = 0; frame < 16384 * 12; frame += 16384) await readPcmFrames(wav, frame, 16384);
  await wav.dispose();
  assert.equal(opened, 2); assert.equal(closed, 2);
  assert.ok(delivered <= 2 * 1024 * 1024, 'partial inspection does not fetch the whole four-MiB source');
});
