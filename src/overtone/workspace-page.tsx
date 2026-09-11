import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  NimiText,
  NimiToaster,
  SegmentedControl,
  Surface,
  useNimiTheme,
  type NimiThemeScheme,
} from '@nimiplatform/kit/ui';
import { OvertoneProvider, useOvertoneActions, useOvertonePlayback, useOvertoneState } from './store.js';
import { OvertoneEmptyState } from './panels/empty-state.js';
import { BriefPanel } from './panels/brief-panel.js';
import { LyricsPanel } from './panels/lyrics-panel.js';
import { GeneratePanel } from './panels/generate-panel.js';
import { AIConfigPanel } from './panels/ai-config-panel.js';
import { IterationPanel } from './panels/iteration-panel.js';
import { TakesPanel } from './panels/takes-panel.js';
import { PlayerPanel } from './panels/player-panel.js';
import { PublishModal } from './panels/publish-panel.js';
import { probeReadiness } from './readiness.js';
import { usePlaybackShortcuts } from './use-playback-shortcuts.js';
import { persistOvertoneScheme } from './theme-scheme.js';
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
      <WorkspaceInner />
      <NimiToaster />
    </OvertoneProvider>
  );
}

function WorkspaceInner() {
  const { t } = useTranslation();
  const state = useOvertoneState();
  const { setReadiness, startProject, resetProject, publishDraftFromTake, clearCompare } = useOvertoneActions();
  const playback = useOvertonePlayback();
  const [reloadKey, setReloadKey] = useState(0);
  const [publishTakeId, setPublishTakeId] = useState<string | null>(null);
  const [projectAction, setProjectAction] = useState<'discard' | 'restart' | null>(null);
  const hasCompare = Boolean(state.project?.comparedTakeIds[0] || state.project?.comparedTakeIds[1]);

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
            realmConfigured: false,
            realmAuthenticated: false,
          });
        }
      });
    return () => { cancelled = true; };
  }, [reloadKey, setReadiness]);

  const handlePublish = useCallback((takeId: string) => {
    const draft = publishDraftFromTake(takeId);
    if (draft) setPublishTakeId(takeId);
  }, [publishDraftFromTake]);

  const closePublish = useCallback(() => {
    setPublishTakeId(null);
  }, []);

  usePlaybackShortcuts({
    enabled: projectAction === null && publishTakeId === null && !!state.project,
    onTogglePlayback: playback.togglePlayback,
    onSeekDelta: playback.seekBy,
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (projectAction !== null) return;
      const target = event.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isInput) return;

      if (event.key === 'Escape' && publishTakeId === null && hasCompare) {
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
  }, [clearCompare, hasCompare, projectAction, publishTakeId, startProject, state.project]);

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

  if (!state.project) {
    return (
      <OvertoneScreen>
        <OvertoneEmptyState />
      </OvertoneScreen>
    );
  }

  const hasTakes = state.project.takes.some((take) => !take.discarded);

  return (
    <OvertoneScreen>
      <div className="overtone-workspace" data-testid="overtone-workspace">
        <Surface
          as="section"
          material="glass-regular"
          tone="panel"
          elevation="base"
          padding="none"
          className="overtone-compose"
          aria-label={t('Overtone.workspace.composeAria')}
        >
          <div className="overtone-row overtone-row--between">
            <NimiText role="overline">{t('Overtone.workspace.songProject')}</NimiText>
            <Button type="button" tone="secondary" size="sm" onClick={() => setProjectAction('discard')}>
              {t('Overtone.workspace.discardProject')}
            </Button>
          </div>
          <ReadinessBanner />
          <BriefPanel />
          <LyricsPanel />
          <GeneratePanel />
          {hasTakes ? <IterationPanel /> : null}
        </Surface>
        <section className="overtone-output" aria-label={t('Overtone.workspace.takesAria')}>
          <Surface
            material="glass-regular"
            tone="panel"
            elevation="base"
            padding="none"
            className="overtone-takes"
          >
            {hasTakes || Object.keys(state.activeJobs).length > 0 ? <TakesPanel onPublish={handlePublish} /> : (
              <div className="overtone-empty">
                <EmptyState
                  title={<NimiText as="span" role="helper">{t('Overtone.workspace.noTakesCompose')}</NimiText>}
                />
              </div>
            )}
          </Surface>
          <PlayerPanel />
        </section>
        <PublishModal open={publishTakeId !== null} takeId={publishTakeId} onClose={closePublish} />
        <ConfirmDialog
          open={projectAction !== null}
          title={t(projectAction === 'restart' ? 'Overtone.workspace.restartTitle' : 'Overtone.workspace.discardTitle')}
          message={t('Overtone.workspace.discardMessage')}
          confirmLabel={t(projectAction === 'restart' ? 'Overtone.workspace.discardAndRestart' : 'Overtone.workspace.discardProject')}
          cancelLabel={t('Overtone.workspace.keepProject')}
          onClose={() => setProjectAction(null)}
          onConfirm={() => {
            if (projectAction === 'restart') startProject();
            else if (projectAction === 'discard') resetProject();
            setProjectAction(null);
          }}
        />
      </div>
    </OvertoneScreen>
  );
}

function OvertoneScreen({ children }: { children: ReactNode }) {
  return (
    <div className="overtone-screen">
      <div className="overtone-language-bar">
        <AIConfigPanel />
        <SchemeToggle />
        <LanguageSwitcher />
      </div>
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

function ReadinessBanner() {
  const { t } = useTranslation();
  const { readiness } = useOvertoneState();
  if (readiness.runtimeStatus === 'ready' && readiness.musicCapabilityAvailable && readiness.textCapabilityAvailable) return null;
  const messages: string[] = [];
  if (readiness.runtimeStatus === 'degraded') {
    messages.push(readiness.runtimeErrorMessage || t('Overtone.workspace.readiness.degraded'));
  }
  if (!readiness.musicCapabilityAvailable) {
    messages.push(t('Overtone.workspace.readiness.musicUnavailable'));
  }
  if (!readiness.textCapabilityAvailable) {
    messages.push(t('Overtone.workspace.readiness.textUnavailable'));
  }
  if (messages.length === 0) return null;
  return (
    <InlineAlert tone="warning">
      <ul className="overtone-readiness-list">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </InlineAlert>
  );
}
