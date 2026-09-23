import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import type { JsonValue } from '@nimiplatform/sdk/types';
import { sameProjectAudio, type AudioInfoFacts, type AudioPreparationRecord, type DerivedAudioRecord, type OwnedAsset, type ProjectAudio, type SongProject, type VoiceConvertDerivation, type VoiceMixRecord } from './types.js';

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
    || Object.keys(p).some(k => !['schemaVersion', 'projectId', 'createdAt', 'brief', 'lyrics', 'takes', 'selectedTakeId', 'comparedTakeIds', 'scores', 'selectedScoreId', 'generationScoreId', 'scoreBudgetSeconds', 'fullSong', 'recoverableResults', 'transcriptions', 'recoverableTranscriptions', 'recoverableVoiceConversions', 'recoverableSeparations'].includes(k))
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
  const takes = new Set<string>(); const jobs = new Map<string, string>(); const outputs = new Set<string>();
  for (const value of p.takes) {
    const take = record(value); const audio = record(take.audio); requireAsset(audio);
    if (!id(take.takeId) || takes.has(take.takeId) || typeof take.title !== 'string' || !Number.isFinite(take.createdAt)
      || typeof take.promptSnapshot !== 'string' || typeof take.favorite !== 'boolean' || typeof take.discarded !== 'boolean'
      || audio.mimeType !== 'audio/wav' || ['sampleRateHz', 'channels', 'frameCount'].some(k => !Number.isSafeInteger(audio[k]) || Number(audio[k]) <= 0)
      || !Number.isSafeInteger(audio.durationMs) || Number(audio.durationMs) < 0
      || (take.scoreId !== undefined && !scores.has(String(take.scoreId)))) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
    if (take.origin === 'runtime-result') {
      if (typeof take.jobId !== 'string' || !take.jobId) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
      const claimed = jobs.get(take.jobId);
      if (claimed !== undefined && claimed !== take.capability) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
      if (take.capability === 'music.generate') {
        if (!id(take.clientSubmissionId) || outputs.has(take.jobId)) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
        if (!['model-end', 'budget-limit', 'unknown'].includes(String(take.termination))) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
        outputs.add(take.jobId);
      } else if (take.capability === 'audio.voice.convert') {
        if (!id(take.clientSubmissionId) || outputs.has(take.jobId)) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
        requireVoiceConvertDerivation(take.derivation);
        outputs.add(take.jobId);
      } else if (take.capability === 'audio.separate') {
        if ('clientSubmissionId' in take || !requireSeparationRecord(take.separation)) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
        const outputKey = take.jobId + ':' + String(record(take.separation).stem);
        if (outputs.has(outputKey)) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
        outputs.add(outputKey);
      } else throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
      jobs.set(take.jobId, take.capability);
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
  validateVoiceConvertTakeLinks(p.takes.map(record));
  validateSeparationTakeLinks(p.takes.map(record));
  const scoreRecords = p.scores.map(record);
  for (const score of scoreRecords) {
    if (score.sourceTakeId !== undefined && !takes.has(String(score.sourceTakeId))) throw new Error('OVERTONE_PROJECT_REFERENCE_INVALID');
    const visited = new Set<unknown>(); let current: Record<string, unknown> | undefined = score;
    while (current) {
      if (visited.has(current.scoreId)) throw new Error('OVERTONE_PROJECT_REFERENCE_INVALID');
      visited.add(current.scoreId);
      if (current.parentScoreId === undefined) break;
      const parent: unknown = current.parentScoreId;
      current = scoreRecords.find(candidate => candidate.scoreId === parent);
      if (!current) throw new Error('OVERTONE_PROJECT_REFERENCE_INVALID');
    }
  }
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
  validateProjectTranscriptions(p as unknown as SongProject, jobs, submissions);
  validateProjectVoiceConversions(p as unknown as SongProject, jobs, submissions);
  validateProjectSeparations(p as unknown as SongProject, jobs);
  return p as unknown as SongProject;
}

function publicJobId(value: unknown): boolean { return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/u.test(value); }

function requireAudioFacts(audio: Record<string, unknown>): void {
  if (audio.mimeType !== 'audio/wav' || !Number.isSafeInteger(audio.sampleRateHz) || Number(audio.sampleRateHz) < 8000 || Number(audio.sampleRateHz) > 96000
    || ![1, 2].includes(Number(audio.channels)) || !Number.isSafeInteger(audio.frameCount) || Number(audio.frameCount) < 1
    || Number(audio.frameCount) > Number(audio.sampleRateHz) * 600 || audio.durationMs !== Math.floor(Number(audio.frameCount) * 1000 / Number(audio.sampleRateHz))) {
    throw new Error('OVERTONE_PROJECT_AUDIO_FACTS_INVALID');
  }
}

function requireAudioInfo(value: unknown): AudioInfoFacts {
  const info = record(value);
  if (!Number.isSafeInteger(info.sampleRateHz) || Number(info.sampleRateHz) < 8000 || Number(info.sampleRateHz) > 96000
    || !Number.isSafeInteger(info.channels) || ![1, 2].includes(Number(info.channels))
    || !Number.isSafeInteger(info.frameCount) || Number(info.frameCount) < 1
    || !Number.isSafeInteger(info.durationMs) || Number(info.durationMs) < 0) throw new Error('OVERTONE_PROJECT_VOICE_CONVERT_INVALID');
  return info as unknown as AudioInfoFacts;
}

function requireRange(value: unknown, frameCount: number): { startFrame: number; endFrame: number } {
  const range = record(value);
  if (!Number.isSafeInteger(range.startFrame) || !Number.isSafeInteger(range.endFrame) || Number(range.startFrame) < 0
    || Number(range.endFrame) > frameCount || Number(range.startFrame) >= Number(range.endFrame)) throw new Error('OVERTONE_PROJECT_VOICE_CONVERT_RANGE');
  return range as unknown as { startFrame: number; endFrame: number };
}

function requirePreparation(value: unknown): AudioPreparationRecord {
  const preparation = record(value);
  if (Object.keys(preparation).some(k => !['profile', 'targetSampleRateHz', 'channelMode'].includes(k)) || preparation.profile !== 'canonical-pcm-v1'
    || !Number.isSafeInteger(preparation.targetSampleRateHz) || Number(preparation.targetSampleRateHz) < 8000 || Number(preparation.targetSampleRateHz) > 96000
    || !['PRESERVE', 'MONO_TO_STEREO', 'STEREO_TO_MONO'].includes(String(preparation.channelMode))) throw new Error('OVERTONE_PROJECT_VOICE_CONVERT_INVALID');
  return preparation as unknown as AudioPreparationRecord;
}

// Overtone records only a project recording as the target voice.
function requireTargetVoice(value: unknown): { kind: 'reference-audio'; range?: unknown } {
  const voice = record(value);
  if (voice.kind !== 'reference-audio' || !publicJobId(voice.artifactId)
    || Object.keys(voice).some(k => !['kind', 'artifactId', 'range'].includes(k))) throw new Error('OVERTONE_PROJECT_VOICE_CONVERT_INVALID');
  if (voice.range !== undefined) requireRange(voice.range, Number.MAX_SAFE_INTEGER);
  return voice as unknown as { kind: 'reference-audio'; range?: unknown };
}

function requireVoiceConvertDerivation(value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
  const d = record(value);
  if (Object.keys(d).some(k => !['sourceTakeId', 'sourceArtifactId', 'sourceRange', 'sourceInfo', 'targetVoice', 'semitoneShift', 'convertedVocalArtifactId', 'inputRange', 'vocalInfo', 'lengthRelation', 'durationDeltaMs', 'retainedAccompanimentTakeId', 'retainedAccompanimentArtifactId', 'retainedAccompaniment', 'mixDomain', 'derived', 'mix'].includes(k))
    || !id(d.sourceTakeId) || !publicJobId(d.sourceArtifactId) || !publicJobId(d.convertedVocalArtifactId)
    || !['EXACT', 'MODEL_FRAME_ROUNDING'].includes(String(d.lengthRelation))
    || !Number.isSafeInteger(d.durationDeltaMs)
    || !id(d.retainedAccompanimentTakeId) || !publicJobId(d.retainedAccompanimentArtifactId)) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
  const sourceInfo = requireAudioInfo(d.sourceInfo); const vocalInfo = requireAudioInfo(d.vocalInfo);
  requireRange(d.sourceRange, sourceInfo.frameCount);
  const inputRange = requireRange(d.inputRange, sourceInfo.frameCount);
  const sourceRange = record(d.sourceRange);
  if (inputRange.startFrame !== Number(sourceRange.startFrame) || inputRange.endFrame !== Number(sourceRange.endFrame)) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
  if (d.semitoneShift !== undefined && (!Number.isInteger(d.semitoneShift) || Number(d.semitoneShift) < -12 || Number(d.semitoneShift) > 12)) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
  requireTargetVoice(d.targetVoice);
  const mixDomain = record(d.mixDomain);
  if (!Number.isSafeInteger(mixDomain.sampleRateHz) || Number(mixDomain.sampleRateHz) < 8000 || Number(mixDomain.sampleRateHz) > 96000
    || ![1, 2].includes(Number(mixDomain.channels))) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
  if (!Array.isArray(d.derived) || d.derived.length > 2) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
  for (const entry of d.derived) {
    const derived = record(entry);
    if (Object.keys(derived).some(k => !['sourceArtifactId', 'artifactId', 'preparation', 'audio'].includes(k))
      || !publicJobId(derived.sourceArtifactId) || !publicJobId(derived.artifactId)) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
    requirePreparation(derived.preparation);
    const audio = record(derived.audio); requireAsset(audio); requireAudioFacts(audio);
  }
  const mix = record(d.mix);
  if (Object.keys(mix).some(k => !['mixTakeId', 'outputFrameCount', 'lengthPolicy', 'vocalStartFrame', 'vocalFrameCount', 'accompanimentFrameCount', 'peak'].includes(k))
    || !id(mix.mixTakeId) || mix.lengthPolicy !== 'longest-track' || typeof mix.peak !== 'number' || !Number.isFinite(mix.peak) || mix.peak < 0
    || ![mix.outputFrameCount, mix.vocalFrameCount, mix.accompanimentFrameCount].every(n => Number.isSafeInteger(n) && Number(n) > 0)
    || !Number.isSafeInteger(Number(mix.vocalStartFrame)) || Number(mix.vocalStartFrame) < 0
    || Number(mix.outputFrameCount) !== Math.max(Number(mix.vocalStartFrame) + Number(mix.vocalFrameCount), Number(mix.accompanimentFrameCount))) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
}

function requireSeparationRecord(value: unknown): boolean {
  const s = record(value);
  if (Object.keys(s).some(k => !['separationId', 'sourceTakeId', 'sourceArtifactId', 'sourceAudio', 'sourceRange', 'stem', 'requestedInstrumentParts', 'inputPreparation'].includes(k))
    || !id(s.separationId) || !id(s.sourceTakeId) || !publicJobId(s.sourceArtifactId)
    || !['vocals', 'background', 'drums', 'bass', 'other'].includes(String(s.stem))
    || typeof s.requestedInstrumentParts !== 'boolean') throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
  const audio = record(s.sourceAudio); requireAsset(audio); requireAudioFacts(audio);
  requireRange(s.sourceRange, Number(audio.frameCount));
  if (s.inputPreparation !== undefined) {
    const preparation = requirePreparation(s.inputPreparation);
    if (preparation.targetSampleRateHz !== 44100 || (preparation.channelMode === 'STEREO_TO_MONO' && Number(audio.channels) !== 2)
      || (preparation.channelMode === 'MONO_TO_STEREO' && Number(audio.channels) !== 1)) throw new Error('OVERTONE_PROJECT_VERSION_INVALID');
  }
  return true;
}

function validateVoiceConvertTakeLinks(takes: readonly Record<string, unknown>[]): void {
  const byId = new Map(takes.map(take => [String(take.takeId), take]));
  for (const take of takes) {
    if (take.origin !== 'runtime-result' || take.capability !== 'audio.voice.convert') continue;
    const d = record(take.derivation);
    const source = byId.get(String(d.sourceTakeId));
    const accompaniment = byId.get(String(d.retainedAccompanimentTakeId));
    const mix = record(d.mix); const mixTake = byId.get(String(mix.mixTakeId));
    if (!source || !accompaniment || !mixTake || String(d.sourceTakeId) === String(d.retainedAccompanimentTakeId)) throw new Error('OVERTONE_PROJECT_REFERENCE_INVALID');
    const vocalInfo = record(d.vocalInfo); const audio = record(take.audio);
    const sourceInfo = record(d.sourceInfo); const sourceAudio = record(source.audio);
    if (sourceAudio.sampleRateHz !== sourceInfo.sampleRateHz || sourceAudio.channels !== sourceInfo.channels
      || sourceAudio.frameCount !== sourceInfo.frameCount || sourceAudio.durationMs !== sourceInfo.durationMs
      || audio.sampleRateHz !== vocalInfo.sampleRateHz || audio.channels !== vocalInfo.channels
      || audio.frameCount !== vocalInfo.frameCount || audio.durationMs !== vocalInfo.durationMs) throw new Error('OVERTONE_PROJECT_VOICE_CONVERT_INVALID');
    const retained = record(d.retainedAccompaniment);
    if (!sameProjectAudio(accompaniment.audio as unknown as ProjectAudio, retained as unknown as ProjectAudio)) throw new Error('OVERTONE_PROJECT_VOICE_CONVERT_INVALID');
    const derivedList = d.derived;
    if (!Array.isArray(derivedList)) throw new Error('OVERTONE_PROJECT_REFERENCE_INVALID');
    for (const entry of derivedList) {
      const derived = record(entry); const preparation = record(derived.preparation); const derivedAudio = record(derived.audio);
      if (!publicJobId(derived.sourceArtifactId) || derived.sourceArtifactId !== d.convertedVocalArtifactId
        || derivedAudio.sampleRateHz !== preparation.targetSampleRateHz
        || (preparation.channelMode === 'PRESERVE' && derivedAudio.channels !== audio.channels)
        || (preparation.channelMode === 'MONO_TO_STEREO' && (audio.channels !== 1 || derivedAudio.channels !== 2))
        || (preparation.channelMode === 'STEREO_TO_MONO' && (audio.channels !== 2 || derivedAudio.channels !== 1))) throw new Error('OVERTONE_PROJECT_VOICE_CONVERT_INVALID');
    }
    const mixDomain = record(d.mixDomain);
    const mixInput = derivedList.length ? record(record(derivedList[derivedList.length - 1]).audio) : audio;
    if (Number(mixDomain.sampleRateHz) !== Number(mixInput.sampleRateHz) || Number(mixDomain.channels) !== Number(mixInput.channels)) throw new Error('OVERTONE_PROJECT_VOICE_CONVERT_INVALID');
    const mixAudio = record(mixTake.audio);
    const recipe = record(mixTake.mixRecipe); const sourceIds = recipe.sourceTakeIds;
    if (mixTake.origin !== 'local-render' || !Array.isArray(sourceIds)
      || !sourceIds.map(String).includes(String(take.takeId))
      || !sourceIds.map(String).includes(String(d.retainedAccompanimentTakeId))
      || mixAudio.sampleRateHz !== mixDomain.sampleRateHz || mixAudio.channels !== mixDomain.channels
      || mixAudio.frameCount !== mix.outputFrameCount) throw new Error('OVERTONE_PROJECT_REFERENCE_INVALID');
    const retainedAudio = record(accompaniment.audio);
    if (Number(mix.vocalFrameCount) !== Number(mixInput.frameCount) || Number(mix.accompanimentFrameCount) !== Number(retainedAudio.frameCount)) throw new Error('OVERTONE_PROJECT_VOICE_CONVERT_INVALID');
    const sourceRange = record(d.sourceRange);
    const expectedStart = Math.round(Number(sourceRange.startFrame) / Number(sourceInfo.sampleRateHz) * Number(mixDomain.sampleRateHz));
    if (Number(mix.vocalStartFrame) !== expectedStart) throw new Error('OVERTONE_PROJECT_VOICE_CONVERT_INVALID');
  }
}

function validateSeparationTakeLinks(takes: readonly Record<string, unknown>[]): void {
  const byId = new Map(takes.map(take => [String(take.takeId), take]));
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const take of takes) {
    if (take.origin !== 'runtime-result' || take.capability !== 'audio.separate') continue;
    const s = record(take.separation);
    const group = groups.get(String(s.separationId)) ?? [];
    group.push(take); groups.set(String(s.separationId), group);
  }
  for (const [separationId, stems] of groups) {
    const first = record(stems[0].separation);
    const source = byId.get(String(first.sourceTakeId));
    const sourceAudio = source ? record(source.audio) : undefined;
    if (!source || String(first.sourceTakeId) === String(stems[0].takeId)) throw new Error('OVERTONE_PROJECT_REFERENCE_INVALID');
    const keys = new Set<string>();
    for (const stemTake of stems) {
      const s = record(stemTake.separation);
      const audio = record(s.sourceAudio);
      if (String(s.separationId) !== separationId || String(s.sourceTakeId) !== String(first.sourceTakeId)
        || String(s.sourceArtifactId) !== String(first.sourceArtifactId)
        || s.requestedInstrumentParts !== first.requestedInstrumentParts
        || JSON.stringify(s.inputPreparation ?? null) !== JSON.stringify(first.inputPreparation ?? null)
        || JSON.stringify(s.sourceRange) !== JSON.stringify(first.sourceRange)
        || String(stemTake.jobId) !== String(stems[0].jobId)
        || !sourceAudio || !sameProjectAudio(sourceAudio as unknown as ProjectAudio, audio as unknown as ProjectAudio)) {
        throw new Error('OVERTONE_PROJECT_SEPARATION_INVALID');
      }
      const stem = String(s.stem);
      if (keys.has(stem)) throw new Error('OVERTONE_PROJECT_SEPARATION_INVALID');
      keys.add(stem);
    }
    if (!keys.has('vocals') || !keys.has('background')) throw new Error('OVERTONE_PROJECT_SEPARATION_INVALID');
    if (!first.requestedInstrumentParts && [...keys].some(key => ['drums', 'bass', 'other'].includes(key))) {
      throw new Error('OVERTONE_PROJECT_SEPARATION_INVALID');
    }
    if (first.requestedInstrumentParts && !['vocals', 'background', 'drums', 'bass', 'other'].every(key => keys.has(key) || !['drums', 'bass', 'other'].includes(key))) {
      throw new Error('OVERTONE_PROJECT_SEPARATION_INVALID');
    }
  }
}

// @nimi-authority: rule.overtone.data-model.r007
function validateProjectSeparations(project: SongProject, jobs: Map<string, string>) {
  const pending = project.recoverableSeparations ?? [];
  if (!Array.isArray(pending)) throw new Error('OVERTONE_PROJECT_SEPARATION_INVALID');
  const ids = new Set<string>();
  const byId = new Map(project.takes.map(take => [take.takeId, take]));
  for (const value of pending) {
    const entry = record(value);
    if (Object.keys(entry).some(k => !['separationId', 'projectId', 'jobId', 'title', 'sourceTakeId', 'sourceArtifactId', 'sourceAudio', 'sourceRange', 'requestedInstrumentParts', 'inputPreparation', 'createdAt'].includes(k))
      || !id(entry.separationId) || ids.has(entry.separationId) || entry.projectId !== project.projectId
      || (entry.jobId !== undefined && (!publicJobId(entry.jobId) || jobs.get(String(entry.jobId)) !== undefined))
      || typeof entry.title !== 'string' || !Number.isFinite(entry.createdAt)
      || !id(entry.sourceTakeId) || !publicJobId(entry.sourceArtifactId) || typeof entry.requestedInstrumentParts !== 'boolean') {
      throw new Error('OVERTONE_PROJECT_SEPARATION_OPERATION');
    }
    if (entry.inputPreparation !== undefined) requirePreparation(entry.inputPreparation);
    const source = byId.get(entry.sourceTakeId);
    const audio = record(entry.sourceAudio); requireAsset(audio); requireAudioFacts(audio);
    requireRange(entry.sourceRange, Number(audio.frameCount));
    if (!source || !sameProjectAudio(source.audio, audio as unknown as ProjectAudio)) throw new Error('OVERTONE_PROJECT_SEPARATION_SOURCE');
    ids.add(entry.separationId);
  }
}

// @nimi-authority: rule.overtone.transcription.r002
function validateProjectTranscriptions(project: SongProject, jobs: Map<string, string>, submissions: Set<string>) {
  const estimates = project.transcriptions ?? []; const pending = project.recoverableTranscriptions ?? [];
  if (!Array.isArray(estimates) || !Array.isArray(pending)) throw new Error('OVERTONE_PROJECT_TRANSCRIPTION_INVALID');
  const publicId = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/u.test(value);
  const source = (value: unknown) => {
    const entry = record(value); const audio = record(entry.sourceAudio); requireAsset(audio); const range = record(entry.sourceRange);
    const take = project.takes.find(item => item.takeId === entry.sourceTakeId);
    if (!take || !sameProjectAudio(take.audio, audio as unknown as ProjectAudio) || audio.mimeType !== 'audio/wav'
      || !Number.isSafeInteger(audio.sampleRateHz) || Number(audio.sampleRateHz) < 8000 || Number(audio.sampleRateHz) > 96000
      || ![1,2].includes(Number(audio.channels)) || !Number.isSafeInteger(audio.frameCount) || Number(audio.frameCount) < 1
      || Number(audio.frameCount) > Number(audio.sampleRateHz) * 600 || audio.durationMs !== Math.floor(Number(audio.frameCount) * 1000 / Number(audio.sampleRateHz))
      || !Number.isSafeInteger(range.startFrame) || !Number.isSafeInteger(range.endFrame) || Number(range.startFrame) < 0
      || Number(range.endFrame) > Number(audio.frameCount) || Number(range.startFrame) >= Number(range.endFrame)) throw new Error('OVERTONE_PROJECT_TRANSCRIPTION_SOURCE');
    return entry;
  };
  const ids = new Set<string>();
  for (const value of estimates) {
    const entry = source(value);
    if (!id(entry.transcriptionId) || ids.has(entry.transcriptionId) || !publicId(entry.jobId) || jobs.has(String(entry.jobId))
      || !id(entry.clientSubmissionId) || submissions.has(entry.clientSubmissionId) || !Number.isFinite(entry.createdAt)
      || !['unknown','complete','truncated'].includes(String(entry.completeness)) || !Array.isArray(entry.scoreIds) || !entry.scoreIds.length
      || new Set(entry.scoreIds).size !== entry.scoreIds.length
      || Object.keys(entry).some(key => !['transcriptionId','jobId','clientSubmissionId','sourceTakeId','sourceAudio','sourceRange','scoreIds','timeline','completeness','createdAt'].includes(key))) throw new Error('OVERTONE_PROJECT_TRANSCRIPTION_INVALID');
    for (const scoreId of entry.scoreIds) {
      const score = project.scores.find(item => item.scoreId === scoreId);
      if (!score || score.origin !== 'transcription-estimate' || score.transcriptionId !== entry.transcriptionId || score.sourceTakeId !== entry.sourceTakeId
        || !['vocal-melody','lead-sheet','full-arrangement'].includes(String(score.transcriptionPart))) throw new Error('OVERTONE_PROJECT_TRANSCRIPTION_REFERENCE');
    }
    if (entry.timeline !== undefined) {
      const timeline = requireAsset(entry.timeline);
      if (timeline.mimeType !== 'application/vnd.nimi.music-timeline+json' || timeline.sizeBytes > 16777216) throw new Error('OVERTONE_PROJECT_TRANSCRIPTION_INVALID');
    }
    ids.add(entry.transcriptionId); jobs.set(String(entry.jobId), 'music.transcribe'); submissions.add(entry.clientSubmissionId);
  }
  for (const score of project.scores) {
    if (score.origin === 'transcription-estimate' && !score.transcriptionId) throw new Error('OVERTONE_PROJECT_TRANSCRIPTION_REFERENCE');
    if (score.transcriptionId && (!ids.has(score.transcriptionId) || !estimates.some(entry => entry.transcriptionId === score.transcriptionId && entry.scoreIds.includes(score.scoreId)))) throw new Error('OVERTONE_PROJECT_TRANSCRIPTION_REFERENCE');
  }
  for (const value of pending) {
    const entry = source(value);
    if (!id(entry.clientSubmissionId) || submissions.has(entry.clientSubmissionId) || entry.projectId !== project.projectId || !publicId(entry.sourceArtifactId)
      || (entry.jobId !== undefined && !publicId(entry.jobId)) || typeof entry.title !== 'string' || !Number.isFinite(entry.createdAt)
      || !['vocal-melody','lead-sheet','full-arrangement'].includes(String(entry.requestedPart)) || !Array.isArray(entry.requestedFormats)
      || !entry.requestedFormats.includes('abc') || entry.requestedFormats.some(format => !['abc','timeline'].includes(String(format)))
      || new Set(entry.requestedFormats).size !== entry.requestedFormats.length
      || Object.keys(entry).some(key => !['clientSubmissionId','projectId','jobId','sourceTakeId','sourceArtifactId','sourceAudio','sourceRange','requestedFormats','requestedPart','title','createdAt'].includes(key))) throw new Error('OVERTONE_PROJECT_TRANSCRIPTION_OPERATION');
    submissions.add(entry.clientSubmissionId);
  }
}

// @nimi-authority: rule.overtone.data-model.r007
function validateProjectVoiceConversions(project: SongProject, jobs: Map<string, string>, submissions: Set<string>) {
  const pending = project.recoverableVoiceConversions ?? [];
  if (!Array.isArray(pending)) throw new Error('OVERTONE_PROJECT_VOICE_CONVERT_INVALID');
  const byId = new Map(project.takes.map(take => [take.takeId, take]));
  for (const value of pending) {
    const entry = record(value);
    if (Object.keys(entry).some(k => !['clientSubmissionId', 'projectId', 'jobId', 'title', 'sourceTakeId', 'sourceArtifactId', 'sourceAudio', 'sourceRange', 'targetVoice', 'targetTakeId', 'targetAudio', 'semitoneShift', 'retainedAccompanimentTakeId', 'retainedAccompanimentArtifactId', 'retainedAccompaniment', 'createdAt'].includes(k))
      || !id(entry.clientSubmissionId) || submissions.has(entry.clientSubmissionId) || entry.projectId !== project.projectId
      || (entry.jobId !== undefined && !publicJobId(entry.jobId)) || (entry.jobId !== undefined && jobs.has(String(entry.jobId)))
      || typeof entry.title !== 'string' || !Number.isFinite(entry.createdAt)
      || !id(entry.sourceTakeId) || !publicJobId(entry.sourceArtifactId)
      || !id(entry.retainedAccompanimentTakeId) || !publicJobId(entry.retainedAccompanimentArtifactId)) throw new Error('OVERTONE_PROJECT_VOICE_CONVERT_OPERATION');
    const source = byId.get(entry.sourceTakeId); const accompaniment = byId.get(entry.retainedAccompanimentTakeId);
    const audio = record(entry.sourceAudio); requireAsset(audio); requireAudioFacts(audio);
    requireRange(entry.sourceRange, Number(audio.frameCount));
    if (!source || entry.sourceTakeId === entry.retainedAccompanimentTakeId
      || !sameProjectAudio(source.audio, audio as unknown as ProjectAudio)) throw new Error('OVERTONE_PROJECT_VOICE_CONVERT_SOURCE');
    const retained = record(entry.retainedAccompaniment);
    if (!accompaniment || !sameProjectAudio(accompaniment.audio, retained as unknown as ProjectAudio)) throw new Error('OVERTONE_PROJECT_VOICE_CONVERT_SOURCE');
    const target = requireTargetVoice(entry.targetVoice);
    const reference = record(entry.targetAudio); requireAsset(reference); requireAudioFacts(reference);
    const targetTake = entry.targetTakeId === undefined ? undefined : byId.get(String(entry.targetTakeId));
    if (!targetTake || !sameProjectAudio(targetTake.audio, reference as unknown as ProjectAudio)) throw new Error('OVERTONE_PROJECT_VOICE_CONVERT_SOURCE');
    if (target.range !== undefined) requireRange(target.range, Number(reference.frameCount));
    if (entry.semitoneShift !== undefined && (!Number.isInteger(entry.semitoneShift) || Number(entry.semitoneShift) < -12 || Number(entry.semitoneShift) > 12)) throw new Error('OVERTONE_PROJECT_VOICE_CONVERT_OPERATION');
    submissions.add(entry.clientSubmissionId);
    if (entry.jobId !== undefined) jobs.set(String(entry.jobId), 'audio.voice.convert');
  }
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
