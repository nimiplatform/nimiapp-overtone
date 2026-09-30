import { Button, InlineAlert } from '@nimiplatform/kit/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOvertonePersistence } from '../store.js';
import { useOvertoneState } from '../store.js';
import { MAX_PROJECT_DOCUMENT_BYTES, projectDocumentSize } from '../project-storage.js';
import { StorageCleanupDialog } from './storage-cleanup-dialog.js';

// @nimi-authority: rule.overtone.data-model.r008
export function DraftSaveNotice() {
  const { t } = useTranslation();
  const { status, retry, error, maintenance, operationCount } = useOvertonePersistence();
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const { project } = useOvertoneState();
  const nearCapacity = project && projectDocumentSize(project) >= MAX_PROJECT_DOCUMENT_BYTES * 0.8;
  return <div className="ot-draft-save-state">
    {status === 'failed' || status === 'load-failed' ? <InlineAlert tone="warning" className="ot-draft-save-alert">
      <div><strong>{t(status === 'load-failed' ? 'Overtone.storage.loadFailedTitle' : 'Overtone.storage.failedTitle')}</strong><p>{t(status === 'load-failed' ? 'Overtone.storage.loadFailedHint' : 'Overtone.storage.failedHint')}</p></div>
      <Button tone="secondary" size="sm" onClick={retry}>{t(status === 'load-failed' ? 'Overtone.storage.retryLoad' : 'Overtone.storage.retry')}</Button>
      {error ? <details><summary>{t('Overtone.playground.errorDetails')}</summary>{error}</details> : null}
    </InlineAlert> : null}
    {nearCapacity ? <InlineAlert tone="warning" className="ot-draft-save-alert">{t('Overtone.storage.nearCapacity')}</InlineAlert> : null}
    {maintenance.warning ? <InlineAlert tone="warning" className="ot-draft-save-alert">
      <div><strong>{t('Overtone.storage.cleanupFailed')}</strong><p>{t('Overtone.storage.cleanupFailedHint')}</p></div>
      <Button tone="secondary" size="sm" disabled={maintenance.busy || operationCount > 0 || status !== 'saved'} onClick={() => setCleanupOpen(true)}>{t('Overtone.storage.retryCleanup')}</Button>
      <details><summary>{t('Overtone.playground.errorDetails')}</summary>{maintenance.warning}</details>
    </InlineAlert> : null}
    <StorageCleanupDialog open={cleanupOpen} onClose={() => setCleanupOpen(false)} />
  </div>;
}
