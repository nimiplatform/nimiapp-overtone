import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';
const { parseSongProject, readCurrentProject, writeProject, selectCurrentProject } = await loadSource('../src/overtone/project-storage.ts');
const project = () => ({ schemaVersion: 2, projectId: 'project-one', createdAt: 1, brief: null, lyrics: null,
  takes: [], scores: [], selectedScoreId: null, selectedTakeId: null, comparedTakeIds: [null, null] });
const operation = () => ({ projectId: 'project-one', clientSubmissionId: 'author-one', title: 'Draft', promptSnapshot: 'Folk',
  lyricsSnapshot: 'A line', targetDurationSeconds: 20, creationMode: 'sketch', createdAt: 1 });
const memoryStorage = () => {
  const documents = new Map();
  return { documents,
    async readJson(path) { if (!documents.has(path)) throw Object.assign(Error('absent'), { reasonCode: 'APP_STORAGE_ENTRY_NOT_FOUND' }); return { value: structuredClone(documents.get(path)) }; },
    async writeJson(path, value) { documents.set(path, structuredClone(value)); return { value }; },
  };
};

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
  const storage = memoryStorage();
  storage.documents.set('workspace/current.json', { projectId: 'missing-project' });
  await assert.rejects(readCurrentProject(storage), /absent/);
  storage.documents.set('workspace/projects/missing-project.json', project());
  await assert.rejects(readCurrentProject(storage), /PROJECT_INVALID/);
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
  await assert.rejects(writeProject(storage, { ...project(), lyrics: { text: 'x'.repeat(250 * 1024), source: 'manual', updatedAt: 1 } }), /PROJECT_TOO_LARGE/);
  assert.equal(writes, 0);
});
