import { Button } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertoneActions, useOvertoneState } from '../store.js';

export function OvertoneEmptyState() {
  const { t } = useTranslation();
  const { startProject } = useOvertoneActions();
  const { readiness } = useOvertoneState();

  const dots: Array<{ label: string; state: 'ready' | 'pending' | 'error' }> = [
    {
      label: t('Overtone.common.readiness.runtime'),
      state:
        readiness.runtimeStatus === 'ready' || readiness.runtimeStatus === 'degraded'
          ? 'ready'
          : readiness.runtimeStatus === 'checking'
            ? 'pending'
            : 'error',
    },
    { label: t('Overtone.common.readiness.realm'), state: readiness.realmConfigured ? 'ready' : 'pending' },
    { label: t('Overtone.common.readiness.music'), state: readiness.musicConnectorAvailable ? 'ready' : 'pending' },
    { label: t('Overtone.common.readiness.text'), state: readiness.textConnectorAvailable ? 'ready' : 'pending' },
  ];

  return (
    <div className="overtone-empty" data-testid="overtone-empty-state">
      <div>
        <h2>OVERTONE</h2>
        <p>{t('Overtone.empty.tagline')}</p>
        <Button type="button" tone="primary" size="md" onClick={startProject}>
          {t('Overtone.empty.startSession')}
        </Button>
        <div className="overtone-readiness">
          {dots.map((dot) => (
            <span key={dot.label}>
              <span className="overtone-readiness__dot" data-state={dot.state} />
              {dot.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
