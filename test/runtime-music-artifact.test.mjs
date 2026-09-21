import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';
const { readOwnedAsset } = await loadSource('../src/overtone/runtime-workflow.ts');
const asset = { relativePath: 'music/saved/result.wav', sizeBytes: 4, mimeType: 'audio/wav', sha256: 'sha256:' + 'a'.repeat(64) };
const clientFor = (metadata = asset, chunks = [Uint8Array.of(1, 2), Uint8Array.of(3, 4)]) => ({ storage: { assets: {
  async read({ relativePath }) {
    assert.equal(relativePath, asset.relativePath);
    return { asset: { ...metadata, mediaType: metadata.mimeType }, body: { async *[Symbol.asyncIterator]() { yield* chunks; } } };
  },
} } });

test('saved music streams owned App assets without reading or regenerating an expiring Runtime artifact', async () => {
  assert.deepEqual(await readOwnedAsset(clientFor(), asset, new AbortController().signal, 1024), Uint8Array.of(1, 2, 3, 4));
});

test('saved music rejects changed metadata, incomplete bodies and canceled reads', async () => {
  for (const field of [{ sizeBytes: 5 }, { mimeType: 'audio/mpeg' }, { sha256: 'sha256:' + 'b'.repeat(64) }]) {
    await assert.rejects(readOwnedAsset(clientFor({ ...asset, ...field }), asset, new AbortController().signal, 1024), /METADATA_CHANGED/);
  }
  await assert.rejects(readOwnedAsset(clientFor(asset, [Uint8Array.of(1)]), asset, new AbortController().signal, 1024), /METADATA_CHANGED/);
  const canceled = new AbortController(); canceled.abort();
  await assert.rejects(readOwnedAsset(clientFor(), asset, canceled.signal, 1024), { name: 'AbortError' });
  await assert.rejects(readOwnedAsset({ storage: { assets: { read() { throw Error('must not allocate'); } } } }, asset, new AbortController().signal, 2), /TOO_LARGE/);
});
