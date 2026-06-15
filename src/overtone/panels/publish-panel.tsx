import { useCallback, useEffect, useMemo } from 'react';
import { Button, InlineAlert, OverlayShell, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import type { PublishDraft } from '../types.js';

interface PublishModalProps {
  open: boolean;
  takeId: string | null;
  onClose: () => void;
}

export function PublishModal({ open, takeId, onClose }: PublishModalProps) {
  const state = useOvertoneState();
  const { setDraft, setProvenance, setPublishStatus } = useOvertoneActions();
  const project = state.project;
  const take = project && takeId ? project.takes.find((entry) => entry.takeId === takeId) : null;
  const draft = project?.draftPost ?? null;
  const audioBuffer = take ? state.audioBuffers[take.takeId] : undefined;
  const realmPublishProxyAvailable = false;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const canPublish = useMemo(() => {
    if (!realmPublishProxyAvailable) return false;
    if (!audioBuffer) return false;
    if (!draft || !draft.provenanceConfirmed) return false;
    return state.publishStatus === 'idle' || state.publishStatus === 'error';
  }, [realmPublishProxyAvailable, audioBuffer, draft, state.publishStatus]);

  const handlePublish = useCallback(async () => {
    if (!canPublish || !audioBuffer || !draft || !take) return;
    setPublishStatus(
      'error',
      'Realm publishing for developer-registered local apps requires a Runtime/Realm publish proxy. Overtone cannot publish through raw Realm access tokens.',
    );
  }, [canPublish, audioBuffer, draft, take, setPublishStatus]);

  if (!take || !draft) return null;

  const isPublishing = state.publishStatus === 'uploading' || state.publishStatus === 'creating';

  return (
    <OverlayShell
      open={open}
      onClose={onClose}
      kind="dialog"
      panelClassName="overtone-publish-modal"
      contentClassName="overtone-section"
      title={<h2>Publish to Realm</h2>}
      footer={(
        <div className="overtone-row" style={{ justifyContent: 'space-between', width: '100%' }}>
          <Button type="button" tone="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" tone="primary" onClick={handlePublish} disabled={!canPublish || isPublishing}>
            {isPublishing
              ? state.publishStatus === 'uploading' ? 'Uploading...' : 'Creating post...'
              : state.publishStatus === 'done' ? 'Published' : 'Publish Now'}
          </Button>
        </div>
      )}
    >
      <Surface tone="card" padding="md" className="overtone-section">
        <div className="overtone-row" style={{ justifyContent: 'space-between' }}>
          <strong>{take.title}</strong>
          <StatusBadge tone="info">{take.origin}</StatusBadge>
        </div>
      </Surface>

      {!realmPublishProxyAvailable ? (
        <InlineAlert tone="warning">
          Realm publishing is unavailable for developer-registered local apps until a platform publish proxy is admitted.
        </InlineAlert>
      ) : null}

      {state.publishStatus === 'error' && state.publishError ? (
        <InlineAlert tone="danger">{state.publishError}</InlineAlert>
      ) : null}

      {state.publishStatus === 'done' && state.publishedPostId ? (
        <InlineAlert tone="success">
          Published. Post id: <code>{state.publishedPostId}</code>
        </InlineAlert>
      ) : null}

      <DraftField label="Title" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} />
      <DraftTextarea label="Description" value={draft.description} onChange={(value) => setDraft({ ...draft, description: value })} />
      <DraftField
        label="Tags (comma separated)"
        value={draft.tags.join(', ')}
        onChange={(value) => setDraft({ ...draft, tags: parseTags(value) })}
      />

      <Surface tone="card" padding="md" className="overtone-section">
        <p className="overtone-take-card__meta">
          Source mode: <strong>{draft.sourceMode}</strong>
        </p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <input
            type="checkbox"
            checked={draft.provenanceConfirmed}
            onChange={(event) => setProvenance(event.target.checked)}
          />
          <span style={{ fontSize: 13, color: 'var(--nimi-text-secondary)' }}>
            I confirm the source material is original or I have the right to publish it.
          </span>
        </label>
      </Surface>
    </OverlayShell>
  );
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function DraftField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = `overtone-publish-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="overtone-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="nimi-input" type="text" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function DraftTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = `overtone-publish-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="overtone-field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} className="nimi-input" rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export type { PublishDraft };
