import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import type { JsonValue } from '@nimiplatform/sdk/types';
import type { OwnedAsset, SongProject } from './types.js';

type Storage = Pick<NimiLocalAppClient['storage'], 'readJson' | 'writeJson'>;
const CURRENT = 'workspace/current.json';
export function isStorageMissing(error: unknown): boolean {
  const e = error as { reasonCode?: string; code?: string };
  return ['not_found', 'app_storage_entry_not_found'].includes(String(e?.reasonCode ?? e?.code ?? '').toLowerCase().replaceAll('-', '_'));
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('OVERTONE_PROJECT_INVALID');
  return value as Record<string, unknown>;
}
function id(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/u.test(value); }
function requireAsset(value: unknown): OwnedAsset {
  const a = record(value);
  if (typeof a.relativePath !== 'string' || !a.relativePath || a.relativePath.startsWith('/') || /[\\:]/u.test(a.relativePath)
    || a.relativePath.split('/').some(p => !p || p === '.' || p === '..') || typeof a.mimeType !== 'string'
    || !Number.isSafeInteger(a.sizeBytes) || Number(a.sizeBytes) <= 0 || typeof a.sha256 !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(a.sha256)) throw new Error('OVERTONE_PROJECT_ASSET_INVALID');
  return a as unknown as OwnedAsset;
}

// @nimi-authority: rule.overtone.data-model.r008
export function parseSongProject(value: unknown): SongProject {
  const p = record(value);
  if (p.schemaVersion !== 2 || !id(p.projectId) || !Number.isFinite(p.createdAt) || !Array.isArray(p.takes)
    || !Array.isArray(p.scores) || !Array.isArray(p.comparedTakeIds) || p.comparedTakeIds.length !== 2
    || (p.selectedTakeId !== null && !id(p.selectedTakeId)) || (p.selectedScoreId !== null && !id(p.selectedScoreId))
    || Object.keys(p).some(k => !['schemaVersion', 'projectId', 'createdAt', 'brief', 'lyrics', 'takes', 'selectedTakeId', 'comparedTakeIds', 'scores', 'selectedScoreId', 'generationScoreId', 'scoreBudgetSeconds', 'fullSong', 'recoverableResults'].includes(k))
    || (p.scoreBudgetSeconds !== undefined && ![20, 60, 120, 180].includes(Number(p.scoreBudgetSeconds)))) throw new Error('OVERTONE_PROJECT_INVALID');
  if (p.brief !== null) {
    const brief = record(p.brief);
    if (['title', 'genre', 'mood', 'tempo', 'description'].some(k => typeof brief[k] !== 'string') || String(brief.title).length > 80 || String(brief.description).length > 1500) throw new Error('OVERTONE_PROJECT_INVALID');
  }
  if (p.lyrics !== null) {
    const lyrics = record(p.lyrics);
    if (typeof lyrics.text !== 'string' || !['assistant', 'manual', 'mixed'].includes(String(lyrics.source)) || !Number.isFinite(lyrics.updatedAt)) throw new Error('OVERTONE_PROJECT_INVALID');
  }
  if (p.fullSong !== undefined && p.fullSong !== null) {
    const song = record(p.fullSong);
    if (['sourceTakeId', 'sourceTitle', 'sourcePrompt', 'sourceLyrics', 'title'].some(k => typeof song[k] !== 'string')
      || ![90, 120, 180].includes(Number(song.durationSeconds)) || !Array.isArray(song.sections)
      || song.sections.some(value => { const section = record(value); return !['intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'outro'].includes(String(section.kind))
        || ['name', 'arrangement', 'lyrics'].some(k => typeof section[k] !== 'string'); })) throw new Error('OVERTONE_PROJECT_INVALID');
  }
  const scores = new Set<string>();
  for (const value of p.scores) {
    const score = record(value); const asset = requireAsset(score.asset);
    if (!id(score.scoreId) || scores.has(score.scoreId) || !['abc', 'midi'].includes(String(score.format))
      || !['generated-plan', 'transcription-estimate', 'imported', 'author-edit', 'explicit-conversion'].includes(String(score.origin))
      || typeof score.title !== 'string' || !Number.isFinite(score.createdAt)
      || (score.format === 'abc' && asset.mimeType !== 'text/vnd.abc')) throw new Error('OVERTONE_PROJECT_SCORE_INVALID');
    scores.add(score.scoreId);
  }
  const takes = new Set<string>(); const jobs = new Set<string>();
  for (const value of p.takes) {
    const take = record(value); const audio = record(take.audio); requireAsset(audio);
    if (!id(take.takeId) || takes.has(take.takeId) || typeof take.title !== 'string' || !Number.isFinite(take.createdAt)
      || typeof take.promptSnapshot !== 'string' || typeof take.favorite !== 'boolean' || typeof take.discarded !== 'boolean'
      || audio.mimeType !== 'audio/wav' || ['sampleRateHz', 'channels', 'frameCount'].some(k => !Number.isSafeInteger(audio[k]) || Number(audio[k]) <= 0)
      || !Number.isSafeInteger(audio.durationMs) || Number(audio.durationMs) < 0
      || (take.scoreId !== undefined && !scores.has(String(take.scoreId)))) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
    if (take.origin === 'runtime-result') {
      if (typeof take.jobId !== 'string' || !take.jobId || !id(take.clientSubmissionId) || jobs.has(take.jobId) || take.capability !== 'music.generate'
        || !['model-end', 'budget-limit', 'unknown'].includes(String(take.termination))) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
      jobs.add(take.jobId);
    } else if (take.origin === 'imported-recording') { requireAsset(take.originalAsset); if ('jobId' in take) throw new Error('OVERTONE_PROJECT_VERSION_INVALID'); }
    else if (take.origin === 'local-render') {
      const recipe = record(take.mixRecipe);
      if ('jobId' in take || !Array.isArray(recipe.sourceTakeIds) || !recipe.sourceTakeIds.length || !recipe.sourceTakeIds.every(id)) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
    } else throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
    takes.add(take.takeId);
  }
  if ((p.selectedTakeId && !takes.has(String(p.selectedTakeId))) || p.comparedTakeIds.some(v => v !== null && !takes.has(v))
    || (p.selectedScoreId && !scores.has(String(p.selectedScoreId)))
    || (p.generationScoreId && !scores.has(String(p.generationScoreId)))) throw new Error('OVERTONE_PROJECT_REFERENCE_INVALID');
  const operations = p.recoverableResults ?? [];
  if (!Array.isArray(operations)) throw new Error('OVERTONE_PROJECT_INVALID');
  const submissions = new Set<string>();
  for (const value of operations) {
    const op = record(value);
    if (!id(op.clientSubmissionId) || submissions.has(op.clientSubmissionId) || op.projectId !== p.projectId
      || Object.keys(op).some(k => !['clientSubmissionId', 'projectId', 'jobId', 'title', 'parentTakeId', 'promptSnapshot', 'lyricsSnapshot', 'styleSnapshot', 'targetDurationSeconds', 'creationMode', 'createdAt', 'inputScoreId', 'scoreConditioning', 'seed', 'instrumental', 'returnGeneratedScore'].includes(k))
      || (op.jobId !== undefined && (typeof op.jobId !== 'string' || !op.jobId)) || typeof op.title !== 'string'
      || typeof op.promptSnapshot !== 'string' || typeof op.lyricsSnapshot !== 'string' || !Number.isFinite(op.createdAt)
      || !Number.isInteger(op.targetDurationSeconds) || Number(op.targetDurationSeconds) < 1 || Number(op.targetDurationSeconds) > 600
      || !['sketch', 'song'].includes(String(op.creationMode))
      || (op.inputScoreId !== undefined && !scores.has(String(op.inputScoreId)))) throw new Error('OVERTONE_PROJECT_OPERATION_INVALID');
    submissions.add(op.clientSubmissionId);
  }
  return p as unknown as SongProject;
}

export async function readProject(storage: Storage, projectId: string): Promise<SongProject> {
  if (!id(projectId)) throw new Error('OVERTONE_PROJECT_INVALID');
  const project = parseSongProject((await storage.readJson(`workspace/projects/${projectId}.json`)).value);
  if (project.projectId !== projectId) throw new Error('OVERTONE_PROJECT_INVALID');
  return project;
}
export async function readCurrentProject(storage: Storage): Promise<SongProject | null> {
  let value: unknown;
  try { value = (await storage.readJson(CURRENT)).value; }
  catch (error) { if (isStorageMissing(error)) return null; throw error; }
  const pointer = record(value);
  if (!id(pointer.projectId)) throw new Error('OVERTONE_PROJECT_INVALID');
  return readProject(storage, pointer.projectId);
}
export async function writeProject(storage: Storage, project: SongProject): Promise<void> {
  const value = JSON.parse(JSON.stringify(project)) as JsonValue;
  parseSongProject(value);
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 240 * 1024) throw new Error('OVERTONE_PROJECT_TOO_LARGE');
  await storage.writeJson(`workspace/projects/${project.projectId}.json`, value);
}
export async function selectCurrentProject(storage: Storage, projectId: string): Promise<void> {
  if (!id(projectId)) throw new Error('OVERTONE_PROJECT_INVALID');
  await storage.writeJson(CURRENT, { projectId });
}
