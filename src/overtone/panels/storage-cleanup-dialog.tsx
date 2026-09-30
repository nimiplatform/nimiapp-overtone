import { ConfirmDialog } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertonePersistence } from '../store.js';

// @nimi-authority: rule.overtone.data-model.r011-storage-lifecycle
export function StorageCleanupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const persistence = useOvertonePersistence();
  return <ConfirmDialog open={open} title={t('Overtone.storage.cleanupTitle')} message={t('Overtone.storage.cleanupHint')}
    confirmLabel={t('Overtone.storage.cleanup')} cancelLabel={t('Overtone.workspace.keepProject')} confirmTone="danger"
    onClose={onClose} onConfirm={() => {
      if (persistence.status !== 'saved' || persistence.operationCount > 0 || persistence.maintenance.busy) return;
      onClose();
      void persistence.cleanup().catch(() => undefined);
    }} />;
}
