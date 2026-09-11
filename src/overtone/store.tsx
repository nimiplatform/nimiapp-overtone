import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { makeId, type FullSongDraft, type GenerationJob, type LyricsDocument, type ReadinessSnapshot, type RecoverableMusicResult, type SongBrief, type SongTake } from './types.js';
import { MusicAudioCache } from './media-cache.js';

export interface SongProject {
  projectId: string; createdAt: number; brief: SongBrief | null; lyrics: LyricsDocument | null;
  takes: SongTake[]; selectedTakeId: string | null; comparedTakeIds: [string | null, string | null];
  fullSong?: FullSongDraft | null; recoverableResults?: RecoverableMusicResult[];
}
export interface OvertoneState {
  project: SongProject | null; readiness: ReadinessSnapshot; activeJobs: Record<string, GenerationJob>;
}
type Action =
  | { type: 'readiness/set'; readiness: ReadinessSnapshot }
  | { type: 'project/start'; idea?: string }
  | { type: 'brief/set'; brief: SongBrief | null }
  | { type: 'lyrics/set'; text: string; source: LyricsDocument['source'] }
  | { type: 'song/set'; draft: FullSongDraft | null }
  | { type: 'result/remember'; result: RecoverableMusicResult; projectId: string }
  | { type: 'take/add'; take: SongTake }
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
};
const LOCAL_DRAFT_STORAGE_KEY = 'nimi.overtone:workspace.v1';
function withProject(state: OvertoneState, update: (project: SongProject) => SongProject): OvertoneState {
  return state.project ? { ...state, project: update(state.project) } : state;
}
// @nimi-authority: rule.overtone.data-model.r007
export function overtoneReducer(state: OvertoneState, action: Action): OvertoneState {
  switch (action.type) {
    case 'readiness/set': return { ...state, readiness: action.readiness };
    case 'project/start': return { ...state, activeJobs: {}, project: {
      projectId: makeId('proj'), createdAt: Date.now(), brief: action.idea ? { title: '', genre: '', mood: '', tempo: '', description: action.idea.slice(0,1500) } : null,
      lyrics: null, takes: [], selectedTakeId: null, comparedTakeIds: [null,null],
    } };
    case 'brief/set': return withProject(state, project => ({ ...project, brief: action.brief }));
    case 'lyrics/set': return withProject(state, project => ({ ...project, lyrics: { text: action.text, source: action.source, updatedAt: Date.now() } }));
    case 'song/set': return withProject(state, project => ({ ...project, fullSong: action.draft }));
    case 'result/remember': return withProject(state, project => {
      if (project.projectId !== action.projectId) return project;
      if (project.takes.some(take => take.jobId === action.result.jobId) || project.recoverableResults?.some(result => result.jobId === action.result.jobId)) return project;
      return { ...project, recoverableResults: [...project.recoverableResults ?? [], action.result] };
    });
    case 'take/add': return withProject(state, project => {
      const existing = project.takes.find(take => take.jobId === action.take.jobId);
      return { ...project, takes: existing ? project.takes : [...project.takes, action.take], selectedTakeId: existing?.takeId ?? action.take.takeId,
        recoverableResults: project.recoverableResults?.filter(result => result.jobId !== action.take.jobId) };
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
function useStoreActions(dispatch: React.Dispatch<Action>, cache: MusicAudioCache, stateRef: React.RefObject<OvertoneState>) {
  return useMemo(() => ({
    setReadiness: (readiness: ReadinessSnapshot) => dispatch({ type: 'readiness/set', readiness }),
    startProject: (idea?: string) => { cache.clear(); dispatch({ type: 'project/start', idea }); },
    setBrief: (brief: SongBrief | null) => dispatch({ type: 'brief/set', brief }),
    setLyrics: (text: string, source: LyricsDocument['source']) => dispatch({ type: 'lyrics/set', text, source }),
    setFullSong: (draft: FullSongDraft | null) => dispatch({ type: 'song/set', draft }),
    rememberResult: (result: RecoverableMusicResult, projectId: string) => dispatch({ type: 'result/remember', result, projectId }),
    addTake: (take: SongTake) => dispatch({ type: 'take/add', take }),
    selectTake: (takeId: string | null) => dispatch({ type: 'take/select', takeId }),
    favoriteTake: (takeId: string) => dispatch({ type: 'take/favorite', takeId }),
    renameTake: (takeId: string, title: string) => dispatch({ type: 'take/rename', takeId, title }),
    discardTake: (takeId: string) => { const take = stateRef.current.project?.takes.find(take => take.takeId === takeId); if (take) cache.remove(take.artifactId); dispatch({ type: 'take/discard', takeId }); },
    setCompareSlot: (slot: 0|1, takeId: string|null) => dispatch({ type: 'compare/set', slot, takeId }),
    clearCompare: () => dispatch({ type: 'compare/clear' }),
    setJob: (job: GenerationJob) => dispatch({ type: 'job/set', job }),
    removeJob: (jobId: string) => dispatch({ type: 'job/remove', jobId }),
  }), [dispatch, cache, stateRef]);
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
// @nimi-authority: rule.overtone.data-model.r008
function useProjectPersistence(project: SongProject | null) {
  const [write, setWrite] = useState<{ project: SongProject | null; status: 'saved' | 'failed' }>({ project: null, status: 'saved' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    try {
      if (project) localStorage.setItem(LOCAL_DRAFT_STORAGE_KEY, JSON.stringify({ project }));
      setWrite({ project, status: 'saved' });
    } catch { setWrite({ project, status: 'failed' }); }
  }, [project, attempt]);
  // A previous successful write does not certify the newly edited draft.
  const status = write.project === project ? write.status : 'saving';
  return useMemo(() => ({ status, retry }), [status, retry]);
}
const PersistenceContext = createContext<ReturnType<typeof useProjectPersistence> | null>(null);
export function OvertoneProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(overtoneReducer, INITIAL_STATE, loadInitialState);
  const [cache] = useState(() => new MusicAudioCache());
  const stateRef = useRef(state); stateRef.current = state;
  const actions = useStoreActions(dispatch, cache, stateRef);
  const playback = usePlaybackBridge(dispatch);
  const persistence = useProjectPersistence(state.project);
  useEffect(() => () => cache.clear(), [cache]);
  return <CacheContext.Provider value={cache}><ActionsContext.Provider value={actions}><PlaybackContext.Provider value={playback}><PersistenceContext.Provider value={persistence}><StateContext.Provider value={state}>{children}</StateContext.Provider></PersistenceContext.Provider></PlaybackContext.Provider></ActionsContext.Provider></CacheContext.Provider>;
}
function loadInitialState(initial: OvertoneState): OvertoneState {
  try { const value = JSON.parse(localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY) ?? 'null')?.project;
    if (value && typeof value.projectId === 'string' && Number.isFinite(value.createdAt) && Array.isArray(value.takes) && Array.isArray(value.comparedTakeIds)
      && (!value.recoverableResults || Array.isArray(value.recoverableResults) && value.recoverableResults.every((r: RecoverableMusicResult) => typeof r.jobId === 'string' && typeof r.title === 'string' && typeof r.promptSnapshot === 'string' && typeof r.lyricsSnapshot === 'string')))
      return { ...initial, project: value };
  } catch { /* invalid local draft does not become Runtime truth */ }
  return initial;
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
