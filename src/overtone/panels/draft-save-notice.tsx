import { Button, InlineAlert } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertonePersistence } from '../store.js';

// @nimi-authority: rule.overtone.data-model.r008
export function DraftSaveNotice() {
  const { t } = useTranslation();
  const { status, retry, error } = useOvertonePersistence();
  return <div className="ot-draft-save-state">
    {status === 'failed' || status === 'load-failed' ? <InlineAlert tone="warning" className="ot-draft-save-alert">
      <div><strong>{t(status === 'load-failed' ? 'Overtone.storage.loadFailedTitle' : 'Overtone.storage.failedTitle')}</strong><p>{t(status === 'load-failed' ? 'Overtone.storage.loadFailedHint' : 'Overtone.storage.failedHint')}</p></div>
      <Button tone="secondary" size="sm" onClick={retry}>{t(status === 'load-failed' ? 'Overtone.storage.retryLoad' : 'Overtone.storage.retry')}</Button>
      {error ? <details><summary>{t('Overtone.playground.errorDetails')}</summary>{error}</details> : null}
    </InlineAlert> : null}
  </div>;
}
