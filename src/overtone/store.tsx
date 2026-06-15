// Renderer-local store. Pure React context + useReducer; no external state library.
// Authority: .nimi/spec/overtone/kernel/data-model-contract.md (OVT-DATA-*).

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import {
  ORIGIN_TO_SOURCE_MODE,
  makeId,
  type GenerationJob,
  type LyricsDocument,
  type PublishDraft,
  type PublishStatus,
  type ReadinessSnapshot,
  type SongBrief,
  type SongTake,
} from './types.js';

export interface SongProject {
  projectId: string;
  createdAt: number;
  brief: SongBrief | null;
  lyrics: LyricsDocument | null;
  takes: SongTake[];
  selectedTakeId: string | null;
  comparedTakeIds: [string | null, string | null];
  draftPost: PublishDraft | null;
}

export interface OvertoneState {
  project: SongProject | null;
  readiness: ReadinessSnapshot;
  activeJobs: Record<string, GenerationJob>;
  audioBuffers: Record<string, ArrayBuffer>;
  publishStatus: PublishStatus;
  publishError: string | null;
  publishedPostId: string | null;
}

type Action =
  | { type: 'readiness/set'; readiness: ReadinessSnapshot }
  | { type: 'project/start' }
  | { type: 'project/reset' }
  | { type: 'brief/set'; brief: SongBrief | null }
  | { type: 'lyrics/set'; text: string; source: 'assistant' | 'manual' | 'mixed' }
  | { type: 'take/add'; take: SongTake }
  | { type: 'take/select'; takeId: string | null }
  | { type: 'take/favorite'; takeId: string }
  | { type: 'take/rename'; takeId: string; title: string }
  | { type: 'take/discard'; takeId: string }
  | { type: 'compare/set'; slot: 0 | 1; takeId: string | null }
  | { type: 'compare/clear' }
  | { type: 'job/set'; job: GenerationJob }
  | { type: 'job/remove'; jobId: string }
  | { type: 'audio/set'; takeId: string; buffer: ArrayBuffer }
  | { type: 'audio/clear'; takeId: string }
  | { type: 'draft/set'; draft: PublishDraft | null }
  | { type: 'draft/provenance'; confirmed: boolean }
  | { type: 'publish/status'; status: PublishStatus; error?: string | null }
  | { type: 'publish/post-id'; postId: string | null };

const INITIAL_READINESS: ReadinessSnapshot = {
  runtimeStatus: 'checking',
  textConnectorAvailable: false,
  musicConnectorAvailable: false,
  realmConfigured: false,
  realmAuthenticated: false,
};

const INITIAL_STATE: OvertoneState = {
  project: null,
  readiness: INITIAL_READINESS,
  activeJobs: {},
  audioBuffers: {},
  publishStatus: 'idle',
  publishError: null,
  publishedPostId: null,
};

const LOCAL_DRAFT_STORAGE_KEY = 'nimi.overtone:workspace.v1';

function ensureProject(state: OvertoneState): SongProject | null {
  return state.project;
}

function withProject(state: OvertoneState, update: (project: SongProject) => SongProject): OvertoneState {
  const project = ensureProject(state);
  if (!project) return state;
  return { ...state, project: update(project) };
}

function reducer(state: OvertoneState, action: Action): OvertoneState {
  switch (action.type) {
    case 'readiness/set':
      return { ...state, readiness: action.readiness };

    case 'project/start': {
      const project: SongProject = {
        projectId: makeId('proj'),
        createdAt: Date.now(),
        brief: null,
        lyrics: null,
        takes: [],
        selectedTakeId: null,
        comparedTakeIds: [null, null],
        draftPost: null,
      };
      return { ...state, project, activeJobs: {}, audioBuffers: {}, publishStatus: 'idle', publishError: null, publishedPostId: null };
    }

    case 'project/reset':
      return { ...state, project: null, activeJobs: {}, audioBuffers: {}, publishStatus: 'idle', publishError: null, publishedPostId: null };

    case 'brief/set':
      return withProject(state, (project) => ({ ...project, brief: action.brief }));

    case 'lyrics/set':
      return withProject(state, (project) => ({
        ...project,
        lyrics: { text: action.text, source: action.source, updatedAt: Date.now() },
      }));

    case 'take/add':
      return withProject(state, (project) => ({
        ...project,
        takes: [...project.takes, action.take],
        selectedTakeId: project.selectedTakeId ?? action.take.takeId,
      }));

    case 'take/select':
      return withProject(state, (project) => ({ ...project, selectedTakeId: action.takeId }));

    case 'take/favorite':
      return withProject(state, (project) => ({
        ...project,
        takes: project.takes.map((take) =>
          take.takeId === action.takeId ? { ...take, favorite: !take.favorite } : take,
        ),
      }));

    case 'take/rename':
      return withProject(state, (project) => ({
        ...project,
        takes: project.takes.map((take) =>
          take.takeId === action.takeId ? { ...take, title: action.title } : take,
        ),
      }));

    case 'take/discard': {
      const project = ensureProject(state);
      if (!project) return state;
      const { [action.takeId]: _removed, ...audioBuffers } = state.audioBuffers;
      return {
        ...state,
        audioBuffers,
        project: {
          ...project,
          takes: project.takes.map((take) =>
            take.takeId === action.takeId ? { ...take, discarded: true } : take,
          ),
          selectedTakeId: project.selectedTakeId === action.takeId ? null : project.selectedTakeId,
          comparedTakeIds: project.comparedTakeIds.map((takeId) =>
            takeId === action.takeId ? null : takeId,
          ) as [string | null, string | null],
        },
      };
    }

    case 'compare/set':
      return withProject(state, (project) => {
        const next: [string | null, string | null] = [...project.comparedTakeIds];
        next[action.slot] = action.takeId;
        return { ...project, comparedTakeIds: next };
      });

    case 'compare/clear':
      return withProject(state, (project) => ({ ...project, comparedTakeIds: [null, null] }));

    case 'job/set':
      return { ...state, activeJobs: { ...state.activeJobs, [action.job.jobId]: action.job } };

    case 'job/remove': {
      const { [action.jobId]: _removed, ...rest } = state.activeJobs;
      return { ...state, activeJobs: rest };
    }

    case 'audio/set':
      return { ...state, audioBuffers: { ...state.audioBuffers, [action.takeId]: action.buffer } };

    case 'audio/clear': {
      const { [action.takeId]: _removed, ...rest } = state.audioBuffers;
      return { ...state, audioBuffers: rest };
    }

    case 'draft/set':
      return withProject(state, (project) => ({ ...project, draftPost: action.draft }));

    case 'draft/provenance':
      return withProject(state, (project) => {
        if (!project.draftPost) return project;
        return { ...project, draftPost: { ...project.draftPost, provenanceConfirmed: action.confirmed } };
      });

    case 'publish/status':
      return { ...state, publishStatus: action.status, publishError: action.error ?? null };

    case 'publish/post-id':
      return { ...state, publishedPostId: action.postId };

    default:
      return state;
  }
}

interface OvertoneContextValue {
  state: OvertoneState;
  dispatch: Dispatch<Action>;
  actions: {
    setReadiness: (readiness: ReadinessSnapshot) => void;
    startProject: () => void;
    resetProject: () => void;
    setBrief: (brief: SongBrief | null) => void;
    setLyrics: (text: string, source: 'assistant' | 'manual' | 'mixed') => void;
    addTake: (take: SongTake, buffer?: ArrayBuffer) => void;
    selectTake: (takeId: string | null) => void;
    favoriteTake: (takeId: string) => void;
    renameTake: (takeId: string, title: string) => void;
    discardTake: (takeId: string) => void;
    setCompareSlot: (slot: 0 | 1, takeId: string | null) => void;
    clearCompare: () => void;
    setJob: (job: GenerationJob) => void;
    removeJob: (jobId: string) => void;
    setAudioBuffer: (takeId: string, buffer: ArrayBuffer) => void;
    setDraft: (draft: PublishDraft | null) => void;
    setProvenance: (confirmed: boolean) => void;
    setPublishStatus: (status: PublishStatus, error?: string | null) => void;
    setPublishedPostId: (postId: string | null) => void;
    publishDraftFromTake: (takeId: string) => PublishDraft | null;
  };
}

const OvertoneContext = createContext<OvertoneContextValue | null>(null);

export function OvertoneProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE, loadInitialState);

  useEffect(() => {
    persistLocalDraft(state.project);
  }, [state.project]);

  const setReadiness = useCallback((readiness: ReadinessSnapshot) => dispatch({ type: 'readiness/set', readiness }), []);
  const startProject = useCallback(() => dispatch({ type: 'project/start' }), []);
  const resetProject = useCallback(() => dispatch({ type: 'project/reset' }), []);
  const setBrief = useCallback((brief: SongBrief | null) => dispatch({ type: 'brief/set', brief }), []);
  const setLyrics = useCallback((text: string, source: 'assistant' | 'manual' | 'mixed') => dispatch({ type: 'lyrics/set', text, source }), []);

  const setAudioBuffer = useCallback((takeId: string, buffer: ArrayBuffer) => {
    dispatch({ type: 'audio/set', takeId, buffer });
  }, []);

  const addTake = useCallback((take: SongTake, buffer?: ArrayBuffer) => {
    if (buffer) {
      dispatch({ type: 'audio/set', takeId: take.takeId, buffer });
    }
    dispatch({ type: 'take/add', take });
  }, []);

  const selectTake = useCallback((takeId: string | null) => dispatch({ type: 'take/select', takeId }), []);
  const favoriteTake = useCallback((takeId: string) => dispatch({ type: 'take/favorite', takeId }), []);
  const renameTake = useCallback((takeId: string, title: string) => dispatch({ type: 'take/rename', takeId, title }), []);
  const discardTake = useCallback((takeId: string) => dispatch({ type: 'take/discard', takeId }), []);
  const setCompareSlot = useCallback((slot: 0 | 1, takeId: string | null) => dispatch({ type: 'compare/set', slot, takeId }), []);
  const clearCompare = useCallback(() => dispatch({ type: 'compare/clear' }), []);
  const setJob = useCallback((job: GenerationJob) => dispatch({ type: 'job/set', job }), []);
  const removeJob = useCallback((jobId: string) => dispatch({ type: 'job/remove', jobId }), []);
  const setDraft = useCallback((draft: PublishDraft | null) => dispatch({ type: 'draft/set', draft }), []);
  const setProvenance = useCallback((confirmed: boolean) => dispatch({ type: 'draft/provenance', confirmed }), []);
  const setPublishStatus = useCallback((status: PublishStatus, error?: string | null) => dispatch({ type: 'publish/status', status, error: error ?? null }), []);
  const setPublishedPostId = useCallback((postId: string | null) => dispatch({ type: 'publish/post-id', postId }), []);

  const publishDraftFromTake = useCallback((takeId: string): PublishDraft | null => {
    const project = state.project;
    if (!project) return null;
    const take = project.takes.find((entry) => entry.takeId === takeId);
    if (!take || take.discarded) return null;
    const draft: PublishDraft = {
      takeId: take.takeId,
      title: take.title || project.brief?.title || '',
      description: project.brief?.description || '',
      tags: [project.brief?.genre, project.brief?.mood].filter((value): value is string => Boolean(value)),
      sourceMode: ORIGIN_TO_SOURCE_MODE[take.origin],
      provenanceConfirmed: false,
    };
    dispatch({ type: 'draft/set', draft });
    dispatch({ type: 'publish/status', status: 'idle', error: null });
    dispatch({ type: 'publish/post-id', postId: null });
    return draft;
  }, [state.project]);

  const value = useMemo<OvertoneContextValue>(() => ({
    state,
    dispatch,
    actions: {
      setReadiness,
      startProject,
      resetProject,
      setBrief,
      setLyrics,
      addTake,
      selectTake,
      favoriteTake,
      renameTake,
      discardTake,
      setCompareSlot,
      clearCompare,
      setJob,
      removeJob,
      setAudioBuffer,
      setDraft,
      setProvenance,
      setPublishStatus,
      setPublishedPostId,
      publishDraftFromTake,
    },
  }), [
    state,
    setReadiness,
    startProject,
    resetProject,
    setBrief,
    setLyrics,
    addTake,
    selectTake,
    favoriteTake,
    renameTake,
    discardTake,
    setCompareSlot,
    clearCompare,
    setJob,
    removeJob,
    setAudioBuffer,
    setDraft,
    setProvenance,
    setPublishStatus,
    setPublishedPostId,
    publishDraftFromTake,
  ]);

  return <OvertoneContext.Provider value={value}>{children}</OvertoneContext.Provider>;
}

function loadInitialState(initialState: OvertoneState): OvertoneState {
  if (typeof window === 'undefined') return initialState;
  try {
    const raw = window.localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as { project?: SongProject | null };
    if (!isPersistedProject(parsed.project)) return initialState;
    return {
      ...initialState,
      project: parsed.project,
    };
  } catch {
    return initialState;
  }
}

function persistLocalDraft(project: SongProject | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!project) {
      window.localStorage.removeItem(LOCAL_DRAFT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(LOCAL_DRAFT_STORAGE_KEY, JSON.stringify({ project }));
  } catch {
    // Local draft persistence is best-effort and must not block creation.
  }
}

function isPersistedProject(value: unknown): value is SongProject {
  if (!value || typeof value !== 'object') return false;
  const project = value as Partial<SongProject>;
  return typeof project.projectId === 'string' &&
    typeof project.createdAt === 'number' &&
    Array.isArray(project.takes) &&
    (project.selectedTakeId === null || typeof project.selectedTakeId === 'string') &&
    Array.isArray(project.comparedTakeIds);
}

export function useOvertone(): OvertoneContextValue {
  const ctx = useContext(OvertoneContext);
  if (!ctx) throw new Error('useOvertone must be used inside <OvertoneProvider>');
  return ctx;
}

export function useOvertoneState(): OvertoneState {
  return useOvertone().state;
}

export function useOvertoneActions(): OvertoneContextValue['actions'] {
  return useOvertone().actions;
}
