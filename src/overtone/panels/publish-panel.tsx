import { useCallback, useEffect, useMemo } from 'react';
import { Button, Checkbox, FieldShell, InlineAlert, NimiText, nimiToast, OverlayShell, StatusBadge, Surface, TextareaField, TextField } from '@nimiplatform/kit/ui';
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
    if (state.publishStatus === 'done' && state.publishedPostId) {
      nimiToast.success(`${t('Overtone.publish.publishedPostId')} ${state.publishedPostId}`);
    }
  }, [state.publishStatus, state.publishedPostId, t]);

  const canPublish = useMemo(() => {
    if (!realmPublishProxyAvailable) return false;
    if (!audioBuffer) return false;
    if (!draft || !draft.provenanceConfirmed) return false;
    return state.publishStatus === 'idle' || state.publishStatus === 'error';
  }, [realmPublishProxyAvailable, audioBuffer, draft, state.publishStatus]);

  const handlePublish = useCallback(async () => {
    if (!canPublish || !audioBuffer || !draft || !take) return;
    const message = t('Overtone.publish.proxyRequiredError');
    setPublishStatus('error', message);
    nimiToast.danger(message);
  }, [canPublish, audioBuffer, draft, take, setPublishStatus, t]);

  if (!take || !draft) return null;

  const isPublishing = state.publishStatus === 'uploading' || state.publishStatus === 'creating';

  return (
    <OverlayShell
      open={open}
      onClose={onClose}
      kind="dialog"
      size="md"
      contentClassName="overtone-section"
      title={t('Overtone.publish.title')}
      footer={(
        <div className="overtone-row overtone-row--between overtone-publish-footer">
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
        <div className="overtone-row overtone-row--between">
          <NimiText as="p" role="card-title" className="overtone-ellipsis">{take.title}</NimiText>
          <StatusBadge tone="info">{t(`Overtone.common.takeOrigins.${take.origin}`)}</StatusBadge>
        </div>
      </Surface>

      {!realmPublishProxyAvailable ? (
        <InlineAlert tone="warning">
          {t('Overtone.publish.proxyUnavailable')}
        </InlineAlert>
      ) : null}

      <FieldShell label={t('Overtone.publish.fields.title')}>
        <TextField
          id="overtone-publish-title"
          type="text"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
      </FieldShell>
      <FieldShell label={t('Overtone.publish.fields.description')}>
        <TextareaField
          id="overtone-publish-description"
          rows={3}
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        />
      </FieldShell>
      <FieldShell label={t('Overtone.publish.fields.tags')}>
        <TextField
          id="overtone-publish-tags"
          type="text"
          value={draft.tags.join(', ')}
          onChange={(event) => setDraft({ ...draft, tags: parseTags(event.target.value) })}
        />
      </FieldShell>

      <Surface tone="card" padding="md" className="overtone-section">
        <NimiText as="p" role="caption">
          {t('Overtone.publish.sourceMode')} <strong>{t(`Overtone.common.sourceModes.${draft.sourceMode}`)}</strong>
        </NimiText>
        <label className="overtone-checkbox-row">
          <Checkbox
            checked={draft.provenanceConfirmed}
            onChange={(event) => setProvenance(event.target.checked)}
            aria-label={t('Overtone.publish.provenanceConfirm')}
          />
          <NimiText as="span" role="body">{t('Overtone.publish.provenanceConfirm')}</NimiText>
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

export type { PublishDraft };
