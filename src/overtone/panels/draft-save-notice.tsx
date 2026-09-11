import { Button, InlineAlert } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertonePersistence } from '../store.js';

// @nimi-authority: rule.overtone.data-model.r008
export function DraftSaveNotice() {
  const { t } = useTranslation();
  const { status, retry } = useOvertonePersistence();
  return <div className="ot-draft-save-state">
    {status === 'failed' ? <InlineAlert tone="warning" className="ot-draft-save-alert">
      <div><strong>{t('Overtone.storage.failedTitle')}</strong><p>{t('Overtone.storage.failedHint')}</p></div>
      <Button tone="secondary" size="sm" onClick={retry}>{t('Overtone.storage.retry')}</Button>
    </InlineAlert> : null}
  </div>;
}
