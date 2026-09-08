import assert from 'node:assert/strict';
import test from 'node:test';
import { readRuntimeMusicArtifact } from '../src/overtone/runtime-workflow.ts';

test('restored takes read their existing Runtime artifact without generating a new job', async () => {
  const calls = [];
  const bytes = Uint8Array.of(1, 2, 3, 4);
  const client = { ai: { artifacts: { async read(id) { calls.push(id); return { bytes, sizeBytes: 4, mimeType: 'audio/wav' }; } } } };
  const result = await readRuntimeMusicArtifact({ client, artifact: { artifactId: 'retained-artifact', sizeBytes: 4, mimeType: 'audio/wav' }, signal: new AbortController().signal });
  assert.deepEqual(calls, ['retained-artifact']);
  assert.deepEqual(new Uint8Array(result.buffer), bytes);
  assert.equal(result.artifactId, 'retained-artifact');
  assert.equal(result.extension, 'wav');
});

test('restored audio rejects metadata changes and ignores a cancelled read', async () => {
  const artifact = { artifactId: 'retained-artifact', sizeBytes: 4, mimeType: 'audio/wav' };
  const client = { ai: { artifacts: { async read() { return { bytes: Uint8Array.of(1), sizeBytes: 1, mimeType: 'audio/wav' }; } } } };
  await assert.rejects(readRuntimeMusicArtifact({ client, artifact, signal: new AbortController().signal }), /metadata does not match/);
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(readRuntimeMusicArtifact({ client, artifact, signal: cancelled.signal }), { name: 'AbortError' });
});
