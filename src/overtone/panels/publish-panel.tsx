import { useCallback, useEffect, useMemo } from 'react';
import { Button, InlineAlert, OverlayShell, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import type { PublishDraft } from '../types.js';

interface PublishModalProps {
  open: boolean;
  takeId: string | null;
  onClose: () => void;
}

export function PublishModal({ open, takeId, onClose }: PublishModalProps) {
  const { t } = useTranslation();
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
      t('Overtone.publish.proxyRequiredError'),
    );
  }, [canPublish, audioBuffer, draft, take, setPublishStatus, t]);

  if (!take || !draft) return null;

  const isPublishing = state.publishStatus === 'uploading' || state.publishStatus === 'creating';

  return (
    <OverlayShell
      open={open}
      onClose={onClose}
      kind="dialog"
      panelClassName="overtone-publish-modal"
      contentClassName="overtone-section"
      title={<h2>{t('Overtone.publish.title')}</h2>}
      footer={(
        <div className="overtone-row" style={{ justifyContent: 'space-between', width: '100%' }}>
          <Button type="button" tone="secondary" onClick={onClose}>{t('Overtone.publish.cancel')}</Button>
          <Button type="button" tone="primary" onClick={handlePublish} disabled={!canPublish || isPublishing}>
            {isPublishing
              ? state.publishStatus === 'uploading' ? t('Overtone.publish.uploading') : t('Overtone.publish.creatingPost')
              : state.publishStatus === 'done' ? t('Overtone.publish.publishedButton') : t('Overtone.publish.publishNow')}
          </Button>
        </div>
      )}
    >
      <Surface tone="card" padding="md" className="overtone-section">
        <div className="overtone-row" style={{ justifyContent: 'space-between' }}>
          <strong>{take.title}</strong>
          <StatusBadge tone="info">{t(`Overtone.common.takeOrigins.${take.origin}`)}</StatusBadge>
        </div>
      </Surface>

      {!realmPublishProxyAvailable ? (
        <InlineAlert tone="warning">
          {t('Overtone.publish.proxyUnavailable')}
        </InlineAlert>
      ) : null}

      {state.publishStatus === 'error' && state.publishError ? (
        <InlineAlert tone="danger">{state.publishError}</InlineAlert>
      ) : null}

      {state.publishStatus === 'done' && state.publishedPostId ? (
        <InlineAlert tone="success">
          {t('Overtone.publish.publishedPostId')} <code>{state.publishedPostId}</code>
        </InlineAlert>
      ) : null}

      <DraftField id="title" label={t('Overtone.publish.fields.title')} value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} />
      <DraftTextarea id="description" label={t('Overtone.publish.fields.description')} value={draft.description} onChange={(value) => setDraft({ ...draft, description: value })} />
      <DraftField
        id="tags"
        label={t('Overtone.publish.fields.tags')}
        value={draft.tags.join(', ')}
        onChange={(value) => setDraft({ ...draft, tags: parseTags(value) })}
      />

      <Surface tone="card" padding="md" className="overtone-section">
        <p className="overtone-take-card__meta">
          {t('Overtone.publish.sourceMode')} <strong>{t(`Overtone.common.sourceModes.${draft.sourceMode}`)}</strong>
        </p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <input
            type="checkbox"
            checked={draft.provenanceConfirmed}
            onChange={(event) => setProvenance(event.target.checked)}
          />
          <span style={{ fontSize: 13, color: 'var(--nimi-text-secondary)' }}>
            {t('Overtone.publish.provenanceConfirm')}
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

function DraftField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const fieldId = `overtone-publish-${id}`;
  return (
    <div className="overtone-field">
      <label htmlFor={fieldId}>{label}</label>
      <input id={fieldId} className="nimi-input" type="text" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function DraftTextarea({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const fieldId = `overtone-publish-${id}`;
  return (
    <div className="overtone-field">
      <label htmlFor={fieldId}>{label}</label>
      <textarea id={fieldId} className="nimi-input" rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export type { PublishDraft };
