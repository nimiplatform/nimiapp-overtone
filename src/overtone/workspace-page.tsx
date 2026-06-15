import { useCallback, useEffect, useState } from 'react';
import { Button, InlineAlert } from '@nimiplatform/kit/ui';
import { OvertoneProvider, useOvertoneActions, useOvertoneState } from './store.js';
import { OvertoneEmptyState } from './panels/empty-state.js';
import { BriefPanel } from './panels/brief-panel.js';
import { LyricsPanel } from './panels/lyrics-panel.js';
import { GeneratePanel } from './panels/generate-panel.js';
import { IterationPanel } from './panels/iteration-panel.js';
import { TakesPanel } from './panels/takes-panel.js';
import { PlayerPanel } from './panels/player-panel.js';
import { PublishModal } from './panels/publish-panel.js';
import { probeReadiness } from './readiness.js';
import './overtone.css';

export function WorkspacePage() {
  return (
    <OvertoneProvider>
      <WorkspaceInner />
    </OvertoneProvider>
  );
}

function WorkspaceInner() {
  const state = useOvertoneState();
  const { setReadiness, resetProject, publishDraftFromTake, clearCompare } = useOvertoneActions();
  const [reloadKey, setReloadKey] = useState(0);
  const [publishTakeId, setPublishTakeId] = useState<string | null>(null);
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
            textConnectorAvailable: false,
            musicConnectorAvailable: false,
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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isInput) return;

      if (event.key === 'Escape' && publishTakeId === null && hasCompare) {
        event.preventDefault();
        clearCompare();
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('overtone-toggle-playback'));
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const delta = event.shiftKey ? 15 : 5;
        const sign = event.key === 'ArrowLeft' ? -1 : 1;
        window.dispatchEvent(new CustomEvent('overtone-seek-delta', { detail: delta * sign }));
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
        event.preventDefault();
        resetProject();
        // start fresh project on the next macrotask so the reducer settles
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('overtone-restart-project'));
        }, 0);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearCompare, hasCompare, publishTakeId, resetProject]);

  // Wire restart event to startProject via a tiny inner subscriber.
  const { startProject } = useOvertoneActions();
  useEffect(() => {
    function onRestart() { startProject(); }
    window.addEventListener('overtone-restart-project', onRestart);
    return () => window.removeEventListener('overtone-restart-project', onRestart);
  }, [startProject]);

  if (state.readiness.runtimeStatus === 'unavailable') {
    return (
      <div className="overtone-empty" data-testid="overtone-runtime-unavailable">
        <div>
          <h2>Runtime Unavailable</h2>
          <p>{state.readiness.runtimeErrorMessage || 'Could not reach the nimi runtime daemon.'}</p>
          <Button type="button" tone="primary" onClick={() => setReloadKey((value) => value + 1)}>
            Retry Runtime Check
          </Button>
        </div>
      </div>
    );
  }

  if (!state.project) {
    return <OvertoneEmptyState />;
  }

  const hasTakes = state.project.takes.some((take) => !take.discarded);

  return (
    <div className="overtone-workspace" data-testid="overtone-workspace">
      <section className="overtone-compose" aria-label="Compose">
        <div className="overtone-row" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--nimi-text-muted)' }}>Song Project</span>
          <Button type="button" tone="secondary" size="sm" onClick={resetProject}>Close Project</Button>
        </div>
        <ReadinessBanner />
        <BriefPanel />
        <LyricsPanel />
        <GeneratePanel />
        <IterationPanel />
      </section>
      <section className="overtone-output" aria-label="Takes">
        <div className="overtone-takes">
          {hasTakes ? <TakesPanel onPublish={handlePublish} /> : (
            <div className="overtone-empty">
              <div>
                <p>No takes yet. Generate your first take from the Compose column.</p>
              </div>
            </div>
          )}
        </div>
        <PlayerPanel />
      </section>
      <PublishModal open={publishTakeId !== null} takeId={publishTakeId} onClose={closePublish} />
    </div>
  );
}

function ReadinessBanner() {
  const { readiness } = useOvertoneState();
  if (readiness.runtimeStatus === 'ready' && readiness.musicConnectorAvailable && readiness.textConnectorAvailable) return null;
  const messages: string[] = [];
  if (readiness.runtimeStatus === 'degraded') {
    messages.push(readiness.runtimeErrorMessage || 'Runtime is degraded; some connectors may be unavailable.');
  }
  if (!readiness.musicConnectorAvailable) {
    messages.push('No music connector/model pair is ready.');
  }
  if (!readiness.textConnectorAvailable) {
    messages.push('No text connector/model pair is ready.');
  }
  if (messages.length === 0) return null;
  return (
    <InlineAlert tone="warning">
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </InlineAlert>
  );
}
