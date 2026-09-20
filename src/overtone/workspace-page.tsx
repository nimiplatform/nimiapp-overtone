import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  NimiText,
  NimiToaster,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedControl,
  Surface,
  useNimiTheme,
  type NimiThemeScheme,
} from '@nimiplatform/kit/ui';
import { OvertoneProvider, useOvertoneActions, useOvertonePlayback, useOvertoneState } from './store.js';
import { BriefPanel, SoundNotes } from './panels/brief-panel.js';
import { LyricsPanel } from './panels/lyrics-panel.js';
import { GeneratePanel } from './panels/generate-panel.js';
import { AIConfigPanel } from './panels/ai-config-panel.js';
import { IterationPanel } from './panels/iteration-panel.js';
import { TakesPanel } from './panels/takes-panel.js';
import { PlayerPanel } from './panels/player-panel.js';
import { DraftSaveNotice } from './panels/draft-save-notice.js';
import { probeReadiness } from './readiness.js';
import { usePlaybackShortcuts } from './use-playback-shortcuts.js';
import { persistOvertoneScheme } from './theme-scheme.js';
import { ExplorationProvider, useExploration } from './exploration-context.js';
import { DirectionsPanel } from './panels/directions-panel.js';
import { SongComposer } from './panels/song-composer.js';
import { OvertoneIcon } from './panels/icons.js';
import {
  OVERTONE_LOCALES,
  applyOvertoneDocumentLocale,
  normalizeOvertoneLocale,
  persistOvertoneLocale,
  resolveInitialOvertoneLocale,
  type OvertoneLocale,
} from './i18n.js';
import './overtone.css';

export function WorkspacePage() {
  return (
    <OvertoneProvider>
      <CreativeWorkspace />
      <NimiToaster />
    </OvertoneProvider>
  );
}

function CreativeWorkspace() {
  const { project } = useOvertoneState();
  return <ExplorationProvider key={project?.projectId ?? 'entry'}><WorkspaceInner /></ExplorationProvider>;
}

function WorkspaceInner() {
  const { t } = useTranslation();
  const state = useOvertoneState();
  const { setReadiness, startProject, clearCompare } = useOvertoneActions();
  const creative = useExploration();
  const started = useRef(false);
  const playback = useOvertonePlayback();
  const [reloadKey, setReloadKey] = useState(0);
  const [projectAction, setProjectAction] = useState<'discard' | 'restart' | null>(null);
  const hasCompare = Boolean(state.project?.comparedTakeIds[0] || state.project?.comparedTakeIds[1]);

  // @nimi-authority: rule.overtone.ia.r002
  useEffect(() => {
    if (!state.project && !started.current && state.readiness.runtimeStatus === 'ready') {
      started.current = true;
      startProject();
    }
  }, [state.project, state.readiness.runtimeStatus, startProject]);

  useEffect(() => {
    if (creative.notesOpen) document.getElementById('ot-notebook')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [creative.notesOpen]);

  useEffect(() => {
    let cancelled = false;
    probeReadiness()
      .then((snapshot) => { if (!cancelled) setReadiness(snapshot); })
      .catch((error) => {
        if (!cancelled) {
          setReadiness({
            runtimeStatus: 'unavailable',
            runtimeErrorMessage: error instanceof Error ? error.message : String(error),
            textCapabilityAvailable: false,
            musicCapabilityAvailable: false,
          });
        }
      });
    return () => { cancelled = true; };
  }, [reloadKey, setReadiness]);

  usePlaybackShortcuts({
    enabled: projectAction === null && !!state.project,
    onTogglePlayback: playback.togglePlayback,
    onSeekDelta: playback.seekBy,
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (projectAction !== null || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isInput) return;

      if (event.key === 'Escape' && hasCompare) {
        event.preventDefault();
        clearCompare();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
        event.preventDefault();
        if (state.project) setProjectAction('restart');
        else startProject();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearCompare, hasCompare, projectAction, startProject, state.project]);

  if (state.readiness.runtimeStatus === 'unavailable') {
    return (
      <OvertoneScreen>
        <div className="overtone-empty">
          <EmptyState
            data-testid="overtone-runtime-unavailable"
            title={<NimiText as="span" role="section-title">{t('Overtone.workspace.runtimeUnavailableTitle')}</NimiText>}
            description={state.readiness.runtimeErrorMessage || t('Overtone.workspace.runtimeUnavailableFallback')}
            action={(
              <Button type="button" tone="primary" onClick={() => setReloadKey((value) => value + 1)}>
                {t('Overtone.workspace.retryRuntimeCheck')}
              </Button>
            )}
          />
        </div>
      </OvertoneScreen>
    );
  }

  const hasTakes = state.project?.takes.some((take) => !take.discarded);

  return (
    <OvertoneScreen onCloseProject={() => setProjectAction('discard')}>
      <main className="overtone-workspace" data-testid="overtone-workspace">
        <div className="ot-workspace-content">
        <section className="ot-creation" aria-label={t('Overtone.workspace.composeAria')}>
          <div className="ot-creation-scroll">
            {state.project?.fullSong ? <div className="ot-stage-switch"><SegmentedControl value={creative.stage}
              ariaLabel={t('Overtone.song.stageLabel')} items={[{ value: 'explore', label: t('Overtone.song.exploreStage'), disabled: creative.arranging || creative.musicBusy || Object.keys(state.activeJobs).length > 0 }, { value: 'song', label: t('Overtone.song.songStage'), disabled: creative.arranging || creative.musicBusy || Object.keys(state.activeJobs).length > 0 }]}
              onValueChange={value => { if (!creative.arranging && !creative.musicBusy && !Object.keys(state.activeJobs).length) creative.setStage(value as 'explore' | 'song'); }}/></div> : null}
            {creative.stage === 'song' && state.project?.fullSong ? <SongComposer /> : <><BriefPanel />
            <DirectionsPanel />
            <div id="ot-notebook" className="ot-notebook" hidden={!creative.notesOpen}>
              <SoundNotes /><LyricsPanel />
            </div></>}
          </div>
          <GeneratePanel />
        </section>
        <aside className="ot-recordings" aria-label={t('Overtone.workspace.takesAria')}>
          <TakesPanel />
          {hasTakes ? <IterationPanel /> : null}
        </aside>
        </div>
        <PlayerPanel />
        <ConfirmDialog open={creative.pendingSong !== null} title={t('Overtone.song.replaceTitle')} message={t('Overtone.song.replaceHint')}
          confirmLabel={t('Overtone.song.replace')} cancelLabel={t('Overtone.song.keepPlan')} onClose={() => creative.setPendingSong(null)}
          onConfirm={() => { if (creative.pendingSong) creative.openSong(creative.pendingSong); }}/>
        <ConfirmDialog
          open={projectAction !== null}
          title={t(projectAction === 'restart' ? 'Overtone.workspace.restartTitle' : 'Overtone.workspace.discardTitle')}
          message={t('Overtone.workspace.discardMessage')}
          confirmLabel={t(projectAction === 'restart' ? 'Overtone.workspace.discardAndRestart' : 'Overtone.workspace.discardProject')}
          cancelLabel={t('Overtone.workspace.keepProject')}
          onClose={() => setProjectAction(null)}
          onConfirm={() => {
            if (projectAction === 'restart') startProject();
            else if (projectAction === 'discard') startProject();
            setProjectAction(null);
          }}
        />
      </main>
    </OvertoneScreen>
  );
}

function OvertoneScreen({ children, onCloseProject }: { children: ReactNode; onCloseProject?: () => void }) {
  const { t, i18n } = useTranslation();
  const { readiness } = useOvertoneState();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const documentLocale = normalizeOvertoneLocale(i18n.resolvedLanguage || i18n.language);
  useEffect(() => applyOvertoneDocumentLocale(documentLocale), [documentLocale]);
  return (
    <div className="overtone-screen">
      <header className="overtone-masthead">
        <div className="overtone-brand"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><path d="M3 15c0-7 7-12 12-12s12 5 12 12-7 12-12 12S3 22 3 15Z" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M9 15c0-5 3-9 6-9s6 4 6 9-3 9-6 9-6-4-6-9Z" fill="none" stroke="currentColor" strokeWidth="2"/></svg><strong>{t('Overtone.playground.wordmark')}</strong></div>
        <span className="ot-header-purpose">{t('Overtone.studio.headerPurpose')}</span>
        <div className="overtone-language-bar">
          <span className="ot-connection" data-ready={readiness.runtimeStatus === 'ready'}><i />{t(readiness.runtimeStatus === 'ready' ? 'Overtone.studio.connected' : readiness.runtimeStatus === 'checking' ? 'Overtone.common.status.checking' : 'Overtone.common.status.unavailable')}</span>
          {onCloseProject ? <Button className="ot-tool-button ot-new-session" tone="ghost" size="sm" leadingIcon={<OvertoneIcon name="plus" size={16} />} onClick={onCloseProject}>{t('Overtone.studio.newSession')}</Button> : null}
          <AIConfigPanel />
          <Popover open={preferencesOpen} onOpenChange={setPreferencesOpen}>
            <PopoverTrigger asChild><Button className="ot-settings-button" tone="ghost" size="sm" aria-label={t('Overtone.studio.preferences')}><OvertoneIcon name="settings" size={19} /></Button></PopoverTrigger>
            <PopoverContent align="end" className="ot-preferences">
              <div className="ot-preferences__row">
                <span className="ot-preferences__label"><OvertoneIcon name="sun" size={14} />{t('Overtone.scheme.ariaLabel')}</span>
                <SchemeToggle />
              </div>
              <div className="ot-preferences__row">
                <span className="ot-preferences__label"><OvertoneIcon name="chat" size={14} />{t('Overtone.language.ariaLabel')}</span>
                <LanguageSwitcher />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>
      <DraftSaveNotice />
      {children}
    </div>
  );
}

function SchemeToggle() {
  const { t } = useTranslation();
  const { scheme, setScheme } = useNimiTheme();
  const schemeItems = useMemo(() => ([
    { value: 'light', label: t('Overtone.scheme.light') },
    { value: 'dark', label: t('Overtone.scheme.dark') },
  ]), [t]);

  const handleSchemeChange = useCallback((value: string) => {
    const nextScheme: NimiThemeScheme = value === 'dark' ? 'dark' : 'light';
    setScheme(nextScheme);
    persistOvertoneScheme(nextScheme);
  }, [setScheme]);

  return (
    <SegmentedControl
      items={schemeItems}
      value={scheme}
      onValueChange={handleSchemeChange}
      ariaLabel={t('Overtone.scheme.ariaLabel')}
      size="sm"
    />
  );
}

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const locale = normalizeOvertoneLocale(i18n.resolvedLanguage || i18n.language);
  const languageItems = useMemo(() => OVERTONE_LOCALES.map((itemLocale) => ({
    value: itemLocale,
    label: t(itemLocale === 'zh' ? 'Overtone.language.chinese' : 'Overtone.language.english'),
  })), [locale, t]);

  useEffect(() => {
    const initialLocale = resolveInitialOvertoneLocale();
    applyOvertoneDocumentLocale(initialLocale);
    if (normalizeOvertoneLocale(i18n.resolvedLanguage || i18n.language) !== initialLocale) {
      void i18n.changeLanguage(initialLocale);
    }
  }, [i18n]);

  useEffect(() => {
    applyOvertoneDocumentLocale(locale);
  }, [locale]);

  const handleLocaleChange = useCallback((value: string) => {
    const nextLocale: OvertoneLocale = normalizeOvertoneLocale(value);
    persistOvertoneLocale(nextLocale);
    applyOvertoneDocumentLocale(nextLocale);
    void i18n.changeLanguage(nextLocale);
  }, [i18n]);

  return (
    <SegmentedControl
      items={languageItems}
      value={locale}
      onValueChange={handleLocaleChange}
      ariaLabel={t('Overtone.language.ariaLabel')}
      size="sm"
    />
  );
}
