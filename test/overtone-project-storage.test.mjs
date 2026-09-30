import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';
import { createProjectStorage, storedHead } from './project-storage-fixture.mjs';
const { parseSongProject, readCurrentProject, writeProject, selectCurrentProject } = await loadSource('../src/overtone/project-storage.ts');
const project = () => ({ schemaVersion: 3, projectId: 'project-one', createdAt: 1, brief: null, lyrics: null,
  takes: [], scores: [], selectedScoreId: null, selectedTakeId: null, comparedTakeIds: [null, null] });
const operation = () => ({ projectId: 'project-one', clientSubmissionId: 'author-one', title: 'Draft', promptSnapshot: 'Folk',
  lyricsSnapshot: 'A line', targetDurationSeconds: 20, creationMode: 'sketch', createdAt: 1 });
const memoryStorage = createProjectStorage;

test('project storage reopens durable author intent without persisting active Runtime status', async () => {
  const storage = memoryStorage();
  assert.equal(await readCurrentProject(storage), null);
  const draft = { ...project(), recoverableResults: [operation()] };
  await writeProject(storage, draft);
  await selectCurrentProject(storage, draft.projectId);
  assert.deepEqual(await readCurrentProject(storage), draft);
  assert.throws(() => parseSongProject({ ...draft, recoverableResults: [{ ...operation(), status: 'running' }] }), /OPERATION_INVALID/);
  assert.throws(() => parseSongProject({ ...draft, activeJobs: {} }), /PROJECT_INVALID/);
});

test('schema hard cut and damaged pointers fail instead of silently creating an empty project', async () => {
  assert.throws(() => parseSongProject({ ...project(), schemaVersion: 1 }), /PROJECT_INVALID/);
  assert.throws(() => parseSongProject({ ...project(), schemaVersion: 2 }), /PROJECT_INVALID/);
  const storage = memoryStorage();
  storage.documents.set('workspace/current.json', { projectId: 'missing-project' });
  await assert.rejects(readCurrentProject(storage), /absent/);
  storage.documents.set('workspace/projects.json', project());
  await assert.rejects(readCurrentProject(storage), /PROJECT_CATALOG_INVALID/);
});

test('owned versions reject fake jobs, external file paths and unresolved score references', () => {
  const asset = { relativePath: 'music/result.wav', mimeType: 'audio/wav', sizeBytes: 1978, sha256: 'sha256:' + 'a'.repeat(64),
    sampleRateHz: 48000, channels: 1, frameCount: 480, durationMs: 10 };
  const take = { takeId: 'take-one', title: 'Song', origin: 'runtime-result', capability: 'music.generate', jobId: 'job-one', clientSubmissionId: 'author-one',
    termination: 'budget-limit', audio: asset, promptSnapshot: 'Folk', favorite: false, discarded: false, createdAt: 1 };
  assert.equal(parseSongProject({ ...project(), takes: [take] }).takes.length, 1);
  assert.throws(() => parseSongProject({ ...project(), takes: [{ ...take, scoreId: 'missing-score' }] }), /VERSION_INVALID/);
  assert.throws(() => parseSongProject({ ...project(), takes: [{ ...take, audio: { ...asset, relativePath: 'D:/private/file.wav' } }] }), /ASSET_INVALID/);
  assert.throws(() => parseSongProject({ ...project(), takes: [{ ...take, origin: 'imported-recording', originalAsset: asset }] }), /VERSION_INVALID/);
});

test('an oversized author document does not reach the protected write operation', async () => {
  let writes = 0;
  const storage = { async writeJson() { writes += 1; }, async readJson() { throw Error('unneeded'); } };
  await assert.rejects(writeProject(storage, { ...project(), lyrics: { text: 'x'.repeat(16 * 1024 * 1024), source: 'manual', updatedAt: 1 } }), /PROJECT_TOO_LARGE/);
  assert.equal(writes, 0);
});

test('large projects reopen beyond the JSON entry budget while their protected head stays small', async () => {
  const storage = memoryStorage();
  const draft = { ...project(), lyrics: { text: '创作歌词'.repeat(50000), source: 'manual', updatedAt: 1 } };
  await writeProject(storage, draft); await selectCurrentProject(storage, draft.projectId);
  assert.ok(JSON.stringify(storage.documents.get('workspace/projects.json')).length < 1024);
  assert.deepEqual(await readCurrentProject(storage), draft);
});

test('failed head writes preserve the prior project and reclaim only the uncommitted document', async () => {
  const storage = memoryStorage(); await writeProject(storage, project()); await selectCurrentProject(storage, 'project-one');
  const head = structuredClone(storedHead(storage.documents, 'project-one'));
  const original = storage.writeJson;
  storage.writeJson = async () => { throw Error('head write failed'); };
  await assert.rejects(writeProject(storage, { ...project(), lyrics: { text: 'new', source: 'manual', updatedAt: 2 } }), /head write failed/);
  assert.deepEqual(storedHead(storage.documents, 'project-one'), head);
  assert.equal(storage.assetBodies.size, 1);
  storage.writeJson = original;
  assert.deepEqual(await readCurrentProject(storage), project());
});

test('a lost head-write response never deletes an actually committed project document', async () => {
  const storage = memoryStorage(); await writeProject(storage, project()); await selectCurrentProject(storage, 'project-one');
  const original = storage.writeJson;
  storage.writeJson = async (path, value) => { await original(path, value); throw Error('response lost'); };
  const next = { ...project(), lyrics: { text: 'completed', source: 'manual', updatedAt: 2 } };
  await assert.rejects(writeProject(storage, next), /response lost/);
  assert.deepEqual(await readCurrentProject(storage), next);
});

test('a changed project document body fails digest validation', async () => {
  const storage = memoryStorage(); await writeProject(storage, project()); await selectCurrentProject(storage, 'project-one');
  const head = storedHead(storage.documents, 'project-one');
  storage.assetBodies.get(head.document.relativePath)[0] = 0;
  await assert.rejects(readCurrentProject(storage), /DOCUMENT_CHANGED/);
});

test('a missing catalog is not rebuilt from surviving documents or an existing current pointer', async () => {
  const storage = memoryStorage(); await writeProject(storage, project()); await selectCurrentProject(storage, 'project-one');
  storage.documents.delete('workspace/projects.json');
  const paths = [...storage.assetBodies.keys()];
  await assert.rejects(writeProject(storage, { ...project(), projectId: 'new' }), /CATALOG_MISSING/);
  assert.deepEqual([...storage.assetBodies.keys()], paths);
  storage.documents.delete('workspace/current.json');
  await assert.rejects(writeProject(storage, { ...project(), projectId: 'new' }), /CATALOG_MISSING/);
  assert.equal(storage.documents.has('workspace/projects.json'), false);
});
