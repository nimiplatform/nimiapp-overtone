import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';
import { createProjectStorage, storedHead } from './project-storage-fixture.mjs';
const { writeProject, readProject } = await loadSource('../src/overtone/project-storage.ts');
const { cleanupProjectStorage } = await loadSource('../src/overtone/project-cleanup.ts');
const project = id => ({ schemaVersion: 3, projectId: id, createdAt: 1, brief: null, lyrics: null,
  takes: [], scores: [], selectedScoreId: null, selectedTakeId: null, comparedTakeIds: [null, null] });
async function media(storage, relativePath) {
  const asset = await storage.assets.write({ relativePath, mediaType: 'audio/wav', body: new Uint8Array([1, 2, 3]), overwrite: false });
  return { relativePath, mimeType: 'audio/wav', sizeBytes: asset.sizeBytes, sha256: asset.sha256, sampleRateHz: 8000, channels: 1, frameCount: 8, durationMs: 1 };
}
const take = (id, audio) => ({ takeId: id, title: id, origin: 'imported-recording', originalAsset: audio, audio,
  promptSnapshot: '', favorite: false, discarded: false, createdAt: 1 });

test('cleanup removes replaced projects and orphan media while keeping current shared assets and explicit exports', async () => {
  const storage = createProjectStorage();
  const shared = await media(storage, 'music/imports/shared/canonical.wav');
  const obsolete = await media(storage, 'music/imports/obsolete/canonical.wav');
  const orphan = await media(storage, 'music/results/orphan/result.asset');
  const exported = await media(storage, 'music/exports/author.wav');
  await writeProject(storage, { ...project('old'), takes: [take('old-shared', shared), take('obsolete', obsolete)] });
  await writeProject(storage, { ...project('current'), takes: [take('shared', shared)] });
  const result = await cleanupProjectStorage(storage, 'current', new Set());
  assert.deepEqual(result.removedProjects, ['old']);
  assert.ok(storage.assetBodies.has(shared.relativePath));
  assert.ok(storage.assetBodies.has(exported.relativePath));
  assert.equal(storage.assetBodies.has(obsolete.relativePath), false);
  assert.equal(storage.assetBodies.has(orphan.relativePath), false);
  assert.equal((await readProject(storage, 'current')).takes.length, 1);
});

test('pending recovery retains its original project and adopted outputs not yet committed', async () => {
  const storage = createProjectStorage();
  const adopted = await media(storage, 'music/results/pending/result.asset');
  await writeProject(storage, { ...project('pending'), recoverableResults: [{ projectId: 'pending', clientSubmissionId: 'author',
    title: 'Draft', promptSnapshot: 'Folk', lyricsSnapshot: 'Words', targetDurationSeconds: 20, creationMode: 'sketch', createdAt: 1 }] });
  await writeProject(storage, project('current'));
  await cleanupProjectStorage(storage, 'current', new Set());
  assert.ok(storage.assetBodies.has(adopted.relativePath));
  assert.equal((await readProject(storage, 'pending')).recoverableResults.length, 1);
});

test('an unreadable project stops cleanup before removing any referenced asset', async () => {
  const storage = createProjectStorage();
  const audio = await media(storage, 'music/imports/broken/canonical.wav');
  await writeProject(storage, { ...project('broken'), takes: [take('recording', audio)] });
  await writeProject(storage, project('current'));
  const head = storedHead(storage.documents, 'broken');
  storage.assetBodies.get(head.document.relativePath)[0] = 0;
  await assert.rejects(cleanupProjectStorage(storage, 'current', new Set()), /DOCUMENT_CHANGED/);
  assert.ok(storage.assetBodies.has(audio.relativePath));
  assert.ok(storedHead(storage.documents, 'broken'));
});

test('cleanup retries a failed head removal without losing the document needed to finish', async () => {
  const storage = createProjectStorage(); await writeProject(storage, project('old')); await writeProject(storage, project('current'));
  const original = storage.writeJson; storage.writeJson = async () => { throw Error('remove failed'); };
  await assert.rejects(cleanupProjectStorage(storage, 'current', new Set()), /remove failed/);
  assert.equal((await readProject(storage, 'old')).projectId, 'old');
  storage.writeJson = original;
  assert.deepEqual((await cleanupProjectStorage(storage, 'current', new Set())).removedProjects, ['old']);
});

test('in-flight project protection retains the exact old project across cleanup', async () => {
  const storage = createProjectStorage(); await writeProject(storage, project('old')); await writeProject(storage, project('current'));
  const result = await cleanupProjectStorage(storage, 'current', new Set(['old']));
  assert.equal(result.removedProjects.length, 0);
  assert.equal((await readProject(storage, 'old')).projectId, 'old');
});

test('a missing pending project document stops cleanup before deleting its output or any old project', async () => {
  const storage = createProjectStorage();
  const adopted = await media(storage, 'music/results/pending/result.asset');
  await writeProject(storage, project('old'));
  await writeProject(storage, { ...project('pending'), recoverableResults: [{ projectId: 'pending', clientSubmissionId: 'author',
    title: 'Draft', promptSnapshot: 'Folk', lyricsSnapshot: 'Words', targetDurationSeconds: 20, creationMode: 'sketch', createdAt: 1 }] });
  await writeProject(storage, project('current'));
  await storage.assets.remove(storedHead(storage.documents, 'pending').document.relativePath);
  const before = [...storage.assetBodies.keys()];
  await assert.rejects(cleanupProjectStorage(storage, 'current', new Set()), /absent asset/);
  assert.deepEqual([...storage.assetBodies.keys()], before);
  assert.ok(storage.assetBodies.has(adopted.relativePath));
  assert.ok(storedHead(storage.documents, 'pending'));
  assert.ok(storedHead(storage.documents, 'old'));
});

test('a missing or malformed catalog refuses cleanup without treating surviving assets as an inventory', async () => {
  const storage = createProjectStorage(); await writeProject(storage, project('current'));
  await media(storage, 'music/results/uncertain/result.asset');
  const before = [...storage.assetBodies.keys()];
  for (const value of [undefined, { schemaVersion: 3, heads: null }]) {
    if (value) storage.documents.set('workspace/projects.json', value); else storage.documents.delete('workspace/projects.json');
    await assert.rejects(cleanupProjectStorage(storage, 'current', new Set()));
    assert.deepEqual([...storage.assetBodies.keys()], before);
  }
});

test('cleanup retries after a lost catalog removal response without deleting retained documents', async () => {
  const storage = createProjectStorage(); await writeProject(storage, project('old')); await writeProject(storage, project('current'));
  const oldDocument = storedHead(storage.documents, 'old').document.relativePath;
  const original = storage.writeJson;
  storage.writeJson = async (path, value) => { await original(path, value); throw Error('response lost'); };
  await assert.rejects(cleanupProjectStorage(storage, 'current', new Set()), /response lost/);
  assert.equal(storedHead(storage.documents, 'old'), undefined);
  assert.ok(storage.assetBodies.has(oldDocument));
  storage.writeJson = original;
  await cleanupProjectStorage(storage, 'current', new Set());
  assert.equal(storage.assetBodies.has(oldDocument), false);
  assert.equal((await readProject(storage, 'current')).projectId, 'current');
});
