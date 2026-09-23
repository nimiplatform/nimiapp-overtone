import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { makeId, sameProjectAudio, type FullSongDraft, type GenerationJob, type LyricsDocument, type ReadinessSnapshot, type RecoverableMusicResult, type RecoverableMusicTranscription, type RecoverableVoiceConvert, type RecoverableSeparation, type MusicTranscriptionDocument, type SongBrief, type SongTake, type SeparationSongTake, type ScoreDocument, type SongProject } from './types.js';
import { MusicAudioCache } from './media-cache.js';
import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import { readCurrentProject, readProject, writeProject, selectCurrentProject } from './project-storage.js';

export interface OvertoneState {
  project: SongProject | null; readiness: ReadinessSnapshot; activeJobs: Record<string, GenerationJob>;
  aiSettingsOpen: boolean;
}
type Action =
  | { type: 'readiness/set'; readiness: ReadinessSnapshot }
  | { type: 'aiSettings/setOpen'; open: boolean }
  | { type: 'project/start'; idea?: string }
  | { type: 'brief/set'; brief: SongBrief | null }
  | { type: 'lyrics/set'; text: string; source: LyricsDocument['source'] }
  | { type: 'song/set'; draft: FullSongDraft | null }
  | { type: 'result/remember'; result: RecoverableMusicResult; projectId: string }
  | { type: 'result/job'; clientSubmissionId: string; jobId: string }
  | { type: 'result/forget'; clientSubmissionId: string }
  | { type: 'transcription/remember'; operation: RecoverableMusicTranscription }
  | { type: 'transcription/job'; clientSubmissionId: string; jobId: string }
  | { type: 'transcription/forget'; clientSubmissionId: string }
  | { type: 'transcription/complete'; document: MusicTranscriptionDocument; scores: ScoreDocument[] }
  | { type: 'voiceConvert/remember'; operation: RecoverableVoiceConvert }
  | { type: 'voiceConvert/job'; clientSubmissionId: string; jobId: string }
  | { type: 'voiceConvert/forget'; clientSubmissionId: string }
  | { type: 'voiceConvert/complete'; take: SongTake; mixTake: SongTake }
  | { type: 'separation/remember'; operation: RecoverableSeparation }
  | { type: 'separation/job'; separationId: string; jobId: string }
  | { type: 'separation/forget'; separationId: string }
  | { type: 'separation/complete'; takes: SongTake[] }
  | { type: 'score/add'; score: ScoreDocument }
  | { type: 'score/select'; scoreId: string | null }
  | { type: 'score/use'; scoreId: string | null }
  | { type: 'score/budget'; seconds: number }
  | { type: 'take/add'; take: SongTake; score?: ScoreDocument }
  | { type: 'take/select'; takeId: string | null }
  | { type: 'take/favorite'; takeId: string }
  | { type: 'take/rename'; takeId: string; title: string }
  | { type: 'take/discard'; takeId: string }
  | { type: 'compare/set'; slot: 0 | 1; takeId: string | null }
  | { type: 'compare/clear' }
  | { type: 'job/set'; job: GenerationJob }
  | { type: 'job/remove'; jobId: string };
const INITIAL_STATE: OvertoneState = {
  project: null, readiness: { runtimeStatus: 'checking', textCapabilityAvailable: false, musicCapabilityAvailable: false }, activeJobs: {},
  aiSettingsOpen: false,
};
function withProject(state: OvertoneState, update: (project: SongProject) => SongProject): OvertoneState {
  return state.project ? { ...state, project: update(state.project) } : state;
}
// @nimi-authority: rule.overtone.data-model.r007
export function overtoneReducer(state: OvertoneState, action: Action): OvertoneState {
  switch (action.type) {
    case 'readiness/set': return { ...state, readiness: action.readiness };
    case 'aiSettings/setOpen': return { ...state, aiSettingsOpen: action.open };
    case 'project/start': return { ...state, activeJobs: {}, project: {
      schemaVersion: 2, scores: [], selectedScoreId: null, projectId: makeId('proj'), createdAt: Date.now(), brief: action.idea ? { title: '', genre: '', mood: '', tempo: '', description: action.idea.slice(0,1500) } : null,
      lyrics: null, takes: [], selectedTakeId: null, comparedTakeIds: [null,null],
    } };
    case 'brief/set': return withProject(state, project => ({ ...project, brief: action.brief }));
    case 'lyrics/set': return withProject(state, project => ({ ...project, lyrics: { text: action.text, source: action.source, updatedAt: Date.now() } }));
    case 'song/set': return withProject(state, project => ({ ...project, fullSong: action.draft }));
    case 'result/remember': return withProject(state, project => {
      if (project.projectId !== action.projectId) return project;
      if (project.recoverableResults?.some(result => result.clientSubmissionId === action.result.clientSubmissionId)) return project;
      return { ...project, recoverableResults: [...project.recoverableResults ?? [], action.result] };
    });
    case 'result/job': return withProject(state, project => ({ ...project,
      recoverableResults: project.recoverableResults?.map(result => result.clientSubmissionId === action.clientSubmissionId ? { ...result, jobId: action.jobId } : result) }));
    case 'result/forget': return withProject(state, project => ({ ...project,
      recoverableResults: project.recoverableResults?.filter(result => result.clientSubmissionId !== action.clientSubmissionId) }));
    case 'transcription/remember': return withProject(state, project => {
      const operation = action.operation;
      const source = project.takes.find(take => take.takeId === operation.sourceTakeId);
      if (project.projectId !== operation.projectId || !source || !sameProjectAudio(source.audio, operation.sourceAudio)) throw new Error('OVERTONE_TRANSCRIPTION_IDENTITY');
      if (project.recoverableTranscriptions?.some(item => item.clientSubmissionId === operation.clientSubmissionId)
        || project.transcriptions?.some(item => item.clientSubmissionId === operation.clientSubmissionId)) return project;
      return { ...project, recoverableTranscriptions: [...project.recoverableTranscriptions ?? [], operation] };
    });
    case 'transcription/job': return withProject(state, project => ({ ...project,
      recoverableTranscriptions: project.recoverableTranscriptions?.map(item => item.clientSubmissionId === action.clientSubmissionId ? { ...item, jobId: action.jobId } : item) }));
    case 'transcription/forget': return withProject(state, project => ({ ...project,
      recoverableTranscriptions: project.recoverableTranscriptions?.filter(item => item.clientSubmissionId !== action.clientSubmissionId) }));
    case 'transcription/complete': return withProject(state, project => {
      const document = action.document;
      const source = project.takes.find(take => take.takeId === document.sourceTakeId);
      if (!source || !sameProjectAudio(source.audio, document.sourceAudio)) throw new Error('OVERTONE_TRANSCRIPTION_IDENTITY');
      const existing = project.transcriptions?.find(item => item.jobId === document.jobId || item.clientSubmissionId === document.clientSubmissionId);
      if (!existing && (!project.recoverableTranscriptions?.some(item => item.clientSubmissionId === document.clientSubmissionId)
        || action.scores.length !== document.scoreIds.length || action.scores.some(score => score.transcriptionId !== document.transcriptionId || !document.scoreIds.includes(score.scoreId)))) throw new Error('OVERTONE_TRANSCRIPTION_INCOMPLETE');
      return { ...project, transcriptions: existing ? project.transcriptions : [...project.transcriptions ?? [], document],
        scores: existing ? project.scores : [...project.scores, ...action.scores],
        selectedScoreId: existing?.scoreIds[0] ?? document.scoreIds[0] ?? project.selectedScoreId,
        recoverableTranscriptions: project.recoverableTranscriptions?.filter(item => item.clientSubmissionId !== document.clientSubmissionId && item.jobId !== document.jobId) };
    });
    case 'voiceConvert/remember': return withProject(state, project => {
      const operation = action.operation;
      const source = project.takes.find(take => take.takeId === operation.sourceTakeId);
      const accompaniment = project.takes.find(take => take.takeId === operation.retainedAccompanimentTakeId);
      if (project.projectId !== operation.projectId || !source || !sameProjectAudio(source.audio, operation.sourceAudio)
        || !accompaniment || !sameProjectAudio(accompaniment.audio, operation.retainedAccompaniment)
        || operation.sourceTakeId === operation.retainedAccompanimentTakeId) throw new Error('OVERTONE_VOICE_CONVERT_IDENTITY');
      if (project.recoverableVoiceConversions?.some(item => item.clientSubmissionId === operation.clientSubmissionId)) return project;
      return { ...project, recoverableVoiceConversions: [...project.recoverableVoiceConversions ?? [], operation] };
    });
    case 'voiceConvert/job': return withProject(state, project => ({ ...project,
      recoverableVoiceConversions: project.recoverableVoiceConversions?.map(item => item.clientSubmissionId === action.clientSubmissionId ? { ...item, jobId: action.jobId } : item) }));
    case 'voiceConvert/forget': return withProject(state, project => ({ ...project,
      recoverableVoiceConversions: project.recoverableVoiceConversions?.filter(item => item.clientSubmissionId !== action.clientSubmissionId) }));
    case 'voiceConvert/complete': return withProject(state, project => {
      const { take, mixTake } = action;
      if (take.origin !== 'runtime-result' || take.capability !== 'audio.voice.convert'
        || take.derivation.mix.mixTakeId !== mixTake.takeId || mixTake.origin !== 'local-render') throw new Error('OVERTONE_VOICE_CONVERT_INCOMPLETE');
      const clear = (items: RecoverableVoiceConvert[] | undefined) => items?.filter(item => item.clientSubmissionId !== take.clientSubmissionId
        && (item.jobId === undefined || item.jobId !== take.jobId));
      const existing = project.takes.find(item => item.takeId === take.takeId
        || (item.origin === 'runtime-result' && item.capability === 'audio.voice.convert' && item.jobId === take.jobId));
      if (existing) return { ...project, selectedTakeId: existing.takeId, recoverableVoiceConversions: clear(project.recoverableVoiceConversions) };
      if (project.takes.some(item => item.takeId === mixTake.takeId)) throw new Error('OVERTONE_VOICE_CONVERT_INCOMPLETE');
      return { ...project, takes: [...project.takes, take, mixTake], selectedTakeId: take.takeId,
        recoverableVoiceConversions: clear(project.recoverableVoiceConversions) };
    });
    case 'separation/remember': return withProject(state, project => {
      const operation = action.operation;
      const source = project.takes.find(take => take.takeId === operation.sourceTakeId);
      if (project.projectId !== operation.projectId || !source || !sameProjectAudio(source.audio, operation.sourceAudio)) {
        throw new Error('OVERTONE_SEPARATION_IDENTITY');
      }
      if (project.recoverableSeparations?.some(item => item.separationId === operation.separationId)) return project;
      return { ...project, recoverableSeparations: [...project.recoverableSeparations ?? [], operation] };
    });
    case 'separation/job': return withProject(state, project => ({ ...project,
      recoverableSeparations: project.recoverableSeparations?.map(item => item.separationId === action.separationId ? { ...item, jobId: action.jobId } : item) }));
    case 'separation/forget': return withProject(state, project => ({ ...project,
      recoverableSeparations: project.recoverableSeparations?.filter(item => item.separationId !== action.separationId) }));
    case 'separation/complete': return withProject(state, project => {
      const stems = action.takes.filter((take): take is SeparationSongTake =>
        take.origin === 'runtime-result' && take.capability === 'audio.separate');
      if (!action.takes.length || stems.length !== action.takes.length
        || new Set(stems.map(take => take.separation.stem)).size !== stems.length
        || new Set(stems.map(take => take.separation.separationId)).size !== 1) throw new Error('OVERTONE_SEPARATION_INCOMPLETE');
      const identity = stems[0].separation;
      const missing = stems.filter(take => !project.takes.some(item => item.takeId === take.takeId
        || (item.origin === 'runtime-result' && item.capability === 'audio.separate' && item.jobId === take.jobId && item.separation.stem === take.separation.stem)));
      const first = project.takes.find(item => stems.some(take => item.takeId === take.takeId
        || (item.origin === 'runtime-result' && item.capability === 'audio.separate' && item.jobId === stems[0].jobId && item.separation.stem === take.separation.stem)));
      return { ...project, takes: [...project.takes, ...missing], selectedTakeId: first?.takeId ?? stems[0].takeId,
        recoverableSeparations: project.recoverableSeparations?.filter(item => item.separationId !== identity.separationId
          && (item.jobId === undefined || item.jobId !== stems[0].jobId)) };
    });
    case 'score/add': return withProject(state, project => ({ ...project,
      scores: project.scores.some(score => score.scoreId === action.score.scoreId) ? project.scores : [...project.scores, action.score], selectedScoreId: action.score.scoreId }));
    case 'score/select': return withProject(state, project => ({ ...project, selectedScoreId: action.scoreId }));
    case 'score/use': return withProject(state, project => ({ ...project, generationScoreId: action.scoreId }));
    case 'score/budget': return withProject(state, project => ({ ...project, scoreBudgetSeconds: action.seconds }));
    case 'take/add': return withProject(state, project => {
      if (action.take.origin === 'runtime-result' && (action.take.capability === 'audio.voice.convert' || action.take.capability === 'audio.separate')) {
        throw new Error('OVERTONE_TAKE_COMPLETE_REQUIRED');
      }
      if (action.take.origin === 'local-render'
        && action.take.mixRecipe.sourceTakeIds.some(sourceTakeId => !project.takes.some(item => item.takeId === sourceTakeId))) {
        throw new Error('OVERTONE_TAKE_COMPLETE_REQUIRED');
      }
      const existing = project.takes.find(take => take.takeId === action.take.takeId
        || (take.origin === 'runtime-result' && action.take.origin === 'runtime-result' && take.capability === action.take.capability
          && action.take.capability !== 'audio.separate' && take.jobId === action.take.jobId));
      const score = existing ? undefined : action.score;
      return { ...project, takes: existing ? project.takes : [...project.takes, action.take], selectedTakeId: existing?.takeId ?? action.take.takeId,
        scores: score && !project.scores.some(s => s.scoreId === score.scoreId) ? [...project.scores, score] : project.scores,
        selectedScoreId: project.selectedScoreId ?? score?.scoreId ?? null,
        recoverableResults: project.recoverableResults?.filter(result => action.take.origin !== 'runtime-result'
          || (result.jobId !== action.take.jobId && (!(action.take.capability === 'audio.separate') && result.clientSubmissionId !== action.take.clientSubmissionId))),
        recoverableVoiceConversions: project.recoverableVoiceConversions?.filter(result => action.take.origin !== 'runtime-result'
          || (result.jobId !== action.take.jobId && (!(action.take.capability === 'audio.separate') && result.clientSubmissionId !== action.take.clientSubmissionId))) };
    });
    case 'take/select': return withProject(state, project => ({ ...project, selectedTakeId: action.takeId }));
    case 'take/favorite': return withProject(state, project => ({ ...project, takes: project.takes.map(take => take.takeId === action.takeId ? { ...take, favorite: !take.favorite } : take) }));
    case 'take/rename': return withProject(state, project => ({ ...project, takes: project.takes.map(take => take.takeId === action.takeId ? { ...take, title: action.title } : take) }));
    case 'take/discard': return withProject(state, project => ({ ...project, takes: project.takes.map(take => take.takeId === action.takeId ? { ...take, discarded: true } : take),
      selectedTakeId: project.selectedTakeId === action.takeId ? null : project.selectedTakeId,
      comparedTakeIds: project.comparedTakeIds.map(id => id === action.takeId ? null : id) as [string|null,string|null] }));
    case 'compare/set': return withProject(state, project => { const next: [string|null,string|null] = [...project.comparedTakeIds]; next[action.slot] = action.takeId; return { ...project, comparedTakeIds: next }; });
    case 'compare/clear': return withProject(state, project => ({ ...project, comparedTakeIds: [null,null] }));
    case 'job/set': return { ...state, activeJobs: { ...state.activeJobs, [action.job.jobId]: action.job } };
    case 'job/remove': { const { [action.jobId]: removed, ...activeJobs } = state.activeJobs; return { ...state, activeJobs }; }
  }
}
export interface OvertonePlaybackController { togglePlayback: () => void; seekBy: (delta: number) => void; getPosition: () => number }
const StateContext = createContext<OvertoneState | null>(null);
const CacheContext = createContext<MusicAudioCache | null>(null);
function useStoreActions(dispatch: React.Dispatch<Action>, cache: MusicAudioCache, stateRef: React.RefObject<OvertoneState>, flush: () => Promise<void>, complete: (projectId: string, take: SongTake, score?: ScoreDocument) => Promise<void>, saveScore: (projectId: string, score: ScoreDocument) => Promise<void>, mutateProject: (projectId: string, action: Action) => Promise<void>, completeMutation: (projectId: string, action: Action) => Promise<void>) {
  return useMemo(() => ({
    setReadiness: (readiness: ReadinessSnapshot) => dispatch({ type: 'readiness/set', readiness }),
    setAISettingsOpen: (open: boolean) => dispatch({ type: 'aiSettings/setOpen', open }),
    startProject: (idea?: string) => { cache.clear(); dispatch({ type: 'project/start', idea }); },
    setBrief: (brief: SongBrief | null) => dispatch({ type: 'brief/set', brief }),
    setLyrics: (text: string, source: LyricsDocument['source']) => dispatch({ type: 'lyrics/set', text, source }),
    setFullSong: (draft: FullSongDraft | null) => dispatch({ type: 'song/set', draft }),
    rememberResult: async (result: RecoverableMusicResult, projectId: string) => { dispatch({ type: 'result/remember', result, projectId }); await flush(); },
    captureJob: (clientSubmissionId: string, jobId: string) => dispatch({ type: 'result/job', clientSubmissionId, jobId }),
    forgetResult: async (clientSubmissionId: string) => { dispatch({ type: 'result/forget', clientSubmissionId }); await flush(); },
    rememberTranscription: (operation: RecoverableMusicTranscription) => mutateProject(operation.projectId, { type: 'transcription/remember', operation }),
    captureTranscriptionJob: (projectId: string, clientSubmissionId: string, jobId: string) => mutateProject(projectId, { type: 'transcription/job', clientSubmissionId, jobId }),
    forgetTranscription: (projectId: string, clientSubmissionId: string) => mutateProject(projectId, { type: 'transcription/forget', clientSubmissionId }),
    completeTranscription: (projectId: string, result: { document: MusicTranscriptionDocument; scores: ScoreDocument[] }) => mutateProject(projectId, { type: 'transcription/complete', ...result }),
    rememberVoiceConvert: (operation: RecoverableVoiceConvert) => mutateProject(operation.projectId, { type: 'voiceConvert/remember', operation }),
    captureVoiceConvertJob: (projectId: string, clientSubmissionId: string, jobId: string) => mutateProject(projectId, { type: 'voiceConvert/job', clientSubmissionId, jobId }),
    forgetVoiceConvert: (projectId: string, clientSubmissionId: string) => mutateProject(projectId, { type: 'voiceConvert/forget', clientSubmissionId }),
    completeVoiceConvert: (projectId: string, take: SongTake, mixTake: SongTake) => completeMutation(projectId, { type: 'voiceConvert/complete', take, mixTake }),
    rememberSeparation: (operation: RecoverableSeparation) => mutateProject(operation.projectId, { type: 'separation/remember', operation }),
    captureSeparationJob: (projectId: string, separationId: string, jobId: string) => mutateProject(projectId, { type: 'separation/job', separationId, jobId }),
    forgetSeparation: (projectId: string, separationId: string) => mutateProject(projectId, { type: 'separation/forget', separationId }),
    completeSeparation: (projectId: string, takes: SongTake[]) => completeMutation(projectId, { type: 'separation/complete', takes }),
    addTake: complete,
    addScore: saveScore,
    selectScore: (scoreId: string | null) => dispatch({ type: 'score/select', scoreId }),
    useScoreForGeneration: (scoreId: string | null) => dispatch({ type: 'score/use', scoreId }),
    setScoreBudget: (seconds: number) => dispatch({ type: 'score/budget', seconds }),
    selectTake: (takeId: string | null) => dispatch({ type: 'take/select', takeId }),
    favoriteTake: (takeId: string) => dispatch({ type: 'take/favorite', takeId }),
    renameTake: (takeId: string, title: string) => dispatch({ type: 'take/rename', takeId, title }),
    discardTake: (takeId: string) => { const take = stateRef.current.project?.takes.find(take => take.takeId === takeId); if (take) cache.remove(take.audio.relativePath); dispatch({ type: 'take/discard', takeId }); },
    setCompareSlot: (slot: 0|1, takeId: string|null) => dispatch({ type: 'compare/set', slot, takeId }),
    clearCompare: () => dispatch({ type: 'compare/clear' }),
    setJob: (job: GenerationJob) => dispatch({ type: 'job/set', job }),
    removeJob: (jobId: string) => dispatch({ type: 'job/remove', jobId }),
  }), [dispatch, cache, stateRef, flush, complete, saveScore, mutateProject, completeMutation]);
}
const ActionsContext = createContext<ReturnType<typeof useStoreActions> | null>(null);
function usePlaybackBridge(dispatch: React.Dispatch<Action>) {
  const controller = useRef<OvertonePlaybackController | null>(null);
  const serial = useRef(0);
  const [request, setRequest] = useState<{ takeId: string; serial: number; offset: number } | null>(null);
  const [playingTakeId, reportPlaying] = useState<string | null>(null);
  const registerController = useCallback((value: OvertonePlaybackController | null) => { controller.current = value; }, []);
  const togglePlayback = useCallback(() => controller.current?.togglePlayback(), []);
  const seekBy = useCallback((delta: number) => controller.current?.seekBy(delta), []);
  const requestTake = useCallback((takeId: string, preservePosition = false) => {
    const offset = preservePosition ? controller.current?.getPosition() ?? 0 : 0;
    dispatch({ type: 'take/select', takeId }); setRequest({ takeId, serial: ++serial.current, offset });
  }, [dispatch]);
  return useMemo(() => ({ registerController, togglePlayback, seekBy, requestTake, request, playingTakeId, reportPlaying }), [registerController,togglePlayback,seekBy,requestTake,request,playingTakeId]);
}
const PlaybackContext = createContext<ReturnType<typeof usePlaybackBridge> | null>(null);
type PersistenceState = { status: 'loading' | 'load-failed' | 'saved' | 'saving' | 'failed'; error?: string };
const PersistenceContext = createContext<(PersistenceState & { retry: () => void; flush: () => Promise<void> }) | null>(null);

// @nimi-authority: rule.overtone.data-model.r008
export function OvertoneProvider({ children, storage }: { children: ReactNode; storage: Pick<NimiLocalAppClient['storage'], 'readJson' | 'writeJson'> }) {
  const [state, setState] = useState<OvertoneState>(INITIAL_STATE);
  const [cache] = useState(() => new MusicAudioCache());
  const stateRef = useRef(state);
  const documents = useRef(new Map<string, SongProject>());
  const savedPointer = useRef('');
  const hydrated = useRef(false);
  const tail = useRef<Promise<void>>(Promise.resolve());
  const latestSave = useRef(new Map<string, Promise<void>>());
  const alive = useRef(true);
  const [persistence, setPersistence] = useState<PersistenceState>({ status: 'loading' });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const publish = useCallback((next: OvertoneState) => { stateRef.current = next; setState(next); }, []);
  const save = useCallback((project: SongProject) => {
    if (stateRef.current.project?.projectId === project.projectId) setPersistence({ status: 'saving' });
    const operation = tail.current.catch(() => undefined).then(async () => {
      if (!alive.current) throw new DOMException('Project window closed', 'AbortError');
      await writeProject(storage, project);
      if (!alive.current) throw new DOMException('Project window closed', 'AbortError');
      if (stateRef.current.project?.projectId === project.projectId && savedPointer.current !== project.projectId) {
        await selectCurrentProject(storage, project.projectId); savedPointer.current = project.projectId;
      }
    });
    tail.current = operation;
    latestSave.current.set(project.projectId, operation);
    void operation.then(() => {
      if (alive.current && stateRef.current.project?.projectId === project.projectId && latestSave.current.get(project.projectId) === operation) setPersistence({ status: 'saved' });
    }, cause => {
      if (alive.current && stateRef.current.project?.projectId === project.projectId && latestSave.current.get(project.projectId) === operation) setPersistence({ status: 'failed', error: String(cause) });
    });
    return operation;
  }, [storage]);
  const dispatch = useCallback((action: Action) => {
    if (!hydrated.current && action.type !== 'readiness/set' && action.type !== 'aiSettings/setOpen') throw new Error('OVERTONE_STORAGE_NOT_READY');
    const before = stateRef.current;
    const next = overtoneReducer(before, action);
    publish(next);
    if (next.project && next.project !== before.project) {
      documents.current.set(next.project.projectId, next.project);
      void save(next.project);
    }
  }, [publish, save]);
  const flush = useCallback(() => tail.current, []);
  const mutateProject = useCallback(async (projectId: string, action: Action) => {
    if (!alive.current) throw new DOMException('Project window closed', 'AbortError');
    let project = documents.current.get(projectId) ?? await readProject(storage, projectId);
    if (!alive.current) throw new DOMException('Project window closed', 'AbortError');
    project = documents.current.get(projectId) ?? project;
    const next = overtoneReducer({ ...stateRef.current, project }, action).project!;
    documents.current.set(projectId, next);
    if (stateRef.current.project?.projectId === projectId) publish({ ...stateRef.current, project: next });
    await save(next);
  }, [storage, publish, save]);
  const complete = useCallback((projectId: string, take: SongTake, score?: ScoreDocument) => mutateProject(projectId, { type: 'take/add', take, score }), [mutateProject]);
  const saveScore = useCallback((projectId: string, score: ScoreDocument) => mutateProject(projectId, { type: 'score/add', score }), [mutateProject]);
  // Completion writes one valid project first and publishes only after that
  // write settles, so a failed persistence keeps the in-memory project and its
  // recoverable operation intact for retry.
  const completeMutation = useCallback(async (projectId: string, action: Action) => {
    if (!alive.current) throw new DOMException('Project window closed', 'AbortError');
    let project = documents.current.get(projectId) ?? await readProject(storage, projectId);
    if (!alive.current) throw new DOMException('Project window closed', 'AbortError');
    project = documents.current.get(projectId) ?? project;
    const next = overtoneReducer({ ...stateRef.current, project }, action).project!;
    await save(next);
    documents.current.set(projectId, next);
    if (stateRef.current.project?.projectId === projectId) publish({ ...stateRef.current, project: next });
  }, [storage, publish, save, stateRef]);
  useEffect(() => {
    let active = true;
    setPersistence({ status: 'loading' });
    void readCurrentProject(storage).then(project => {
      if (!active) return;
      hydrated.current = true;
      if (project) { documents.current.set(project.projectId, project); savedPointer.current = project.projectId; }
      publish({ ...stateRef.current, project }); setPersistence({ status: 'saved' });
    }, cause => { if (active) setPersistence({ status: 'load-failed', error: String(cause) }); });
    return () => { active = false; };
  }, [storage, loadAttempt, publish]);
  const retry = useCallback(() => {
    if (!hydrated.current) setLoadAttempt(value => value + 1);
    else if (stateRef.current.project) void save(stateRef.current.project);
  }, [save]);
  const actions = useStoreActions(dispatch, cache, stateRef, flush, complete, saveScore, mutateProject, completeMutation);
  const playback = usePlaybackBridge(dispatch);
  useEffect(() => { alive.current = true; return () => { alive.current = false; cache.clear(); }; }, [cache]);
  return <CacheContext.Provider value={cache}><ActionsContext.Provider value={actions}><PlaybackContext.Provider value={playback}><PersistenceContext.Provider value={{ ...persistence, retry, flush }}><StateContext.Provider value={state}>{children}</StateContext.Provider></PersistenceContext.Provider></PlaybackContext.Provider></ActionsContext.Provider></CacheContext.Provider>;
}
export function useOvertoneState() { const value = useContext(StateContext); if (!value) throw Error('OvertoneProvider required'); return value; }
export function useOvertoneActions() { const value = useContext(ActionsContext); if (!value) throw Error('OvertoneProvider required'); return value; }
export function useOvertonePlayback() { const value = useContext(PlaybackContext); if (!value) throw Error('OvertoneProvider required'); return value; }
export function useOvertonePersistence() { const value = useContext(PersistenceContext); if (!value) throw Error('OvertoneProvider required'); return value; }
export function useAudioCache() { const value = useContext(CacheContext); if (!value) throw Error('OvertoneProvider required'); return value; }
export function useAudioSnapshot(id: string) {
  const cache = useAudioCache();
  const subscribe = useCallback((listener: () => void) => cache.subscribe(id, listener), [cache,id]);
  const snapshot = useCallback(() => cache.getSnapshot(id), [cache,id]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
