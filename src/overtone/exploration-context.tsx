import { createCreativeIntent } from './creative-intent.js';
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getNimiLocalAppClient } from '../shell/auth/local-app-client.js';
import { useOvertoneActions, useOvertoneState } from './store.js';
import { generateRuntimeText, textFailureMessage } from './runtime-workflow.js';
import { DIRECTION_SYSTEM, parseMusicDirections, type MusicDirection } from './exploration.js';
import type { SongTake } from './types.js';
import { belongsToSongDraft, FULL_SONG_SYSTEM, parseFullSong } from './full-song.js';

function useCreativeSession() {
  const { t, i18n } = useTranslation();
  const { project, readiness } = useOvertoneState();
  const { setBrief, setLyrics, setFullSong } = useOvertoneActions();
  const [stage, setStage] = useState<'explore' | 'song'>(project?.fullSong ? 'song' : 'explore');
  const [arranging, setArranging] = useState(false);
  const [musicBusy, setMusicBusy] = useState(false);
  const [songError, setSongError] = useState('');
  const [songCandidate, setSongCandidate] = useState<ReturnType<typeof parseFullSong> | null>(null);
  const [pendingSong, setPendingSong] = useState<SongTake | null>(null);
  const songInvocation = useRef(0);
  const songRevision = useRef(project?.fullSong);
  songRevision.current = project?.fullSong;
  useEffect(() => () => { songInvocation.current += 1; }, []);
  const [idea, setIdea] = useState(project?.brief?.description ?? '');
  const [appliedIdea, setAppliedIdea] = useState(project?.brief?.description ?? '');
  const [proposalIdea, setProposalIdea] = useState('');
  const [intent] = useState(createCreativeIntent);
  const textRequest = useRef<AbortController | null>(null);
  const songRequest = useRef<AbortController | null>(null);
  const [directions, setDirections] = useState<MusicDirection[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [focusedDirection, setFocusedDirection] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [exploring, setExploring] = useState(false);
  const [error, setError] = useState('');
  const [parentTakeId, setParentTakeId] = useState<string | undefined>();
  const [proposalParentId, setProposalParentId] = useState<string | undefined>();
  const [pendingDirection, setPendingDirection] = useState<number | null>(null);
  const invocation = useRef(0);
  useEffect(() => () => { invocation.current += 1; textRequest.current?.abort(); songRequest.current?.abort(); }, []);

  async function explore(source?: SongTake, twist?: string) {
    if (exploring || arranging || musicBusy || !readiness.textCapabilityAvailable || (!source && !idea.trim())) return;
    const request = ++invocation.current;
    const controller = new AbortController(); textRequest.current = controller;
    const { energy, surprise } = intent.getSnapshot();
    setExploring(true);
    setStage('explore');
    setError('');
    requestAnimationFrame(() => {
      const progress = document.querySelector<HTMLElement>('.ot-waiting');
      progress?.scrollIntoView({ block: 'nearest' });
      progress?.focus({ preventScroll: true });
    });
    const seed = source ? `${source.promptSnapshot}\n${twist ?? ''}` : idea.trim();
    const visibleIdea = source ? `${t('Overtone.playground.whatIfSource', { title: source.title })}\n${twist ?? ''}` : idea.trim();
    if (source) setIdea(visibleIdea);
    try {
      const response = await generateRuntimeText({
        client: getNimiLocalAppClient(), signal: controller.signal, system: `${DIRECTION_SYSTEM}\n${i18n.language.startsWith('zh') ? '重要：title、description、twist 和 lyrics 全部用简体中文创作，不要使用英文。歌词每个方向只要四句。' : 'Write all titles, descriptions, twists and lyrics in English.'}`,
        input: JSON.stringify({ idea: seed.slice(0, 4000), energy, surprise,
          language: i18n.language.startsWith('zh') ? '简体中文' : 'English',
          sourceLyrics: source?.lyricsSnapshot?.slice(0, 4000) }),
        temperature: 0.95, maxTokens: 3000,
      });
      if (request !== invocation.current) return;
      const next = parseMusicDirections(response);
      setDirections(next);
      setChosen(null);
      setFocusedDirection(0);
      setProposalParentId(source?.takeId);
      setProposalIdea(visibleIdea);
      requestAnimationFrame(() => document.querySelector('.ot-direction-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    } catch (cause) {
      if (request !== invocation.current) return;
      const message = cause instanceof Error ? cause.message : String(cause);
      const reason = (cause as { reasonCode?: string })?.reasonCode;
      setError(message.includes('OVERTONE_DIRECTIONS_INVALID') || cause instanceof SyntaxError
        ? t('Overtone.playground.invalidDirections') : textFailureMessage(cause, t));
    } finally {
      if (request === invocation.current) setExploring(false);
    }
  }

  function applyDirection(index: number) {
    const direction = directions[index];
    if (!direction) return;
    setError('');
    setBrief(direction.brief);
    setIdea(proposalIdea);
    setAppliedIdea(proposalIdea);
    setLyrics(direction.lyrics, 'assistant');
    setChosen(index);
    setParentTakeId(proposalParentId);
    setPendingDirection(null);
    setNotesOpen(false);
  }

  function chooseDirection(index: number) {
    if (project?.lyrics?.text.trim()) setPendingDirection(index);
    else applyDirection(index);
  }

  function cancelExploration() {
    textRequest.current?.abort();
    invocation.current += 1;
    setExploring(false);
    setError(t('Overtone.playground.stopped'));
  }

  function applyOwnIdea() {
    const text = idea.trim();
    if (!text) return;
    setBrief({ title: '', genre: '', mood: '', tempo: '', description: text });
    setAppliedIdea(text);
    setParentTakeId(undefined);
    setChosen(null);
  }

  function openSong(source: SongTake) {
    songInvocation.current += 1;
    setArranging(false);
    setSongError('');
    setSongCandidate(null);
    if (!belongsToSongDraft(source, project?.fullSong)) setFullSong({
      sourceTakeId: source.takeId, sourceTitle: source.title, sourcePrompt: source.promptSnapshot,
      sourceLyrics: source.lyricsSnapshot ?? '', title: source.title, durationSeconds: 120, sections: [],
    });
    setPendingSong(null);
    setStage('song');
    requestAnimationFrame(() => document.querySelector('.ot-song-composer')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }

  function startSong(source: SongTake) {
    if (musicBusy) return;
    if (project?.fullSong && !belongsToSongDraft(source, project.fullSong)) setPendingSong(source);
    else openSong(source);
  }

  // @nimi-authority: rule.overtone.workflow.r012
  async function arrangeSong() {
    const draft = project?.fullSong;
    if (!draft || arranging || musicBusy || !readiness.textCapabilityAvailable) return;
    const id = ++songInvocation.current;
    const controller = new AbortController(); songRequest.current = controller;
    setArranging(true);
    setSongError('');
    setSongCandidate(null);
    try {
      const text = await generateRuntimeText({ client: getNimiLocalAppClient(), signal: controller.signal, system: FULL_SONG_SYSTEM,
        input: JSON.stringify({ sourcePrompt: draft.sourcePrompt, sourceLyrics: draft.sourceLyrics,
          targetDurationSeconds: draft.durationSeconds, language: i18n.language.startsWith('zh') ? '简体中文。歌词、标题、段落名称和编排全部用简体中文。' : 'English' }),
        temperature: .8, maxTokens: 3600 });
      if (id !== songInvocation.current) return;
      const result = parseFullSong(text);
      if (draft.sections.length || songRevision.current !== draft) setSongCandidate(result);
      else setFullSong({ ...draft, ...result });
    } catch (cause) {
      if (id === songInvocation.current) setSongError(cause instanceof SyntaxError || (cause instanceof Error && cause.message === 'OVERTONE_SONG_INVALID')
        ? t('Overtone.song.invalidPlan') : textFailureMessage(cause, t));
    } finally { if (id === songInvocation.current) setArranging(false); }
  }

  function cancelSongArrangement() { songRequest.current?.abort(); songInvocation.current += 1; setArranging(false); setSongError(t('Overtone.text.canceled')); }

  return { intent, cancelSongArrangement, stage, setStage, startSong, openSong, pendingSong, setPendingSong, arranging, arrangeSong, songError, musicBusy, setMusicBusy,
    songCandidate, setSongCandidate, applySongCandidate: () => {
      if (project?.fullSong && songCandidate) setFullSong({ ...project.fullSong, ...songCandidate });
      setSongCandidate(null);
    }, idea, setIdea, directions, chosen,
    focusedDirection, setFocusedDirection, notesOpen, setNotesOpen,
    exploring, error, explore, chooseDirection, applyDirection, pendingDirection, setPendingDirection,
    cancelExploration, parentTakeId, applyOwnIdea, ideaDirty: idea.trim() !== appliedIdea.trim(),
    proposalsCurrent: directions.length > 0 && idea.trim() === proposalIdea.trim(),
    restoreAppliedIdea: () => setIdea(appliedIdea) };
}

const ExplorationContext = createContext<ReturnType<typeof useCreativeSession> | null>(null);

export function ExplorationProvider({ children }: { children: ReactNode }) {
  const value = useCreativeSession();
  return <ExplorationContext.Provider value={value}>{children}</ExplorationContext.Provider>;
}

export function useExploration() {
  const context = useContext(ExplorationContext);
  if (!context) throw new Error('ExplorationProvider is required.');
  return context;
}

export function useMusicIntent() {
  const { intent } = useExploration();
  const value = useSyncExternalStore(intent.subscribe, intent.getSnapshot, intent.getSnapshot);
  return { ...value, setEnergy: (energy: number) => intent.set({ energy }), setSurprise: (surprise: number) => intent.set({ surprise }), setIntent: intent.set };
}
