import type { OfflineTier } from '@nimiplatform/kit/core/offline-coordinator';
import { Button, InlineAlert, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import { appTitle, type RuntimePlatformUnavailableProjection } from './runtime-platform.js';
import { useTranslation } from 'react-i18next';

type RuntimeUnavailablePageProps = {
  projection?: RuntimePlatformUnavailableProjection;
  message?: string;
  offlineTier?: OfflineTier;
  onRetry: () => void;
};

export function RuntimeUnavailablePage({ projection, message, offlineTier, onRetry }: RuntimeUnavailablePageProps) {
  const { t } = useTranslation();
  const body = message || (projection ? t(`Overtone.host.reasons.${projection.reasonCode}`, { defaultValue: t('Overtone.host.fallback') }) : t('Overtone.host.fallback'));
  return (
    <main className="runtime-unavailable-screen">
      <Surface className="runtime-unavailable-panel" material="glass-thick" tone="panel" elevation="floating">
        <div className="runtime-unavailable-heading">
          <StatusBadge tone="warning" shape="dot">{t('Overtone.host.actionRequired')}</StatusBadge>
          <h1>{appTitle}</h1>
        </div>
        <InlineAlert tone="warning">
          <div className="runtime-alert-copy">
            <strong>{t('Overtone.host.unavailable')}</strong>
            <span>{body}</span>
          </div>
        </InlineAlert>
        <details className="runtime-action-hint"><summary>{t('Overtone.playground.errorDetails')}</summary>
          {offlineTier ? <p>{t('Overtone.host.offlineTier', { tier: offlineTier })}</p> : null}
          {projection ? <p>{projection.reasonCode} · {projection.actionHint}</p> : null}
        </details>
        <Button type="button" tone="primary" onClick={onRetry}>{t('Overtone.host.retry')}</Button>
      </Surface>
    </main>
  );
}
