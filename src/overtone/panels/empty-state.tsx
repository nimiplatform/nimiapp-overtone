import { Button, EmptyState, NimiText, StatusBadge, Steps, Tooltip, type StatusTone, type StepItem } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertoneActions, useOvertoneState } from '../store.js';

export function OvertoneEmptyState() {
  const { t } = useTranslation();
  const { startProject } = useOvertoneActions();
  const { readiness } = useOvertoneState();

  const runtimeReady = readiness.runtimeStatus === 'ready' || readiness.runtimeStatus === 'degraded';
  const configReady = readiness.musicCapabilityAvailable && readiness.textCapabilityAvailable;
  const flowSteps: StepItem[] = [
    {
      id: 'configure',
      title: t('Overtone.empty.steps.configure'),
      status: configReady ? 'complete' : readiness.runtimeStatus === 'unavailable' ? 'error' : 'current',
    },
    {
      id: 'brief',
      title: t('Overtone.empty.steps.brief'),
      status: configReady ? 'current' : 'pending',
    },
    {
      id: 'lyrics',
      title: t('Overtone.empty.steps.lyrics'),
      status: 'pending',
    },
    {
      id: 'generate',
      title: t('Overtone.empty.steps.generate'),
      status: 'pending',
    },
  ];
  const rows: Array<{ key: string; label: string; tone: StatusTone; status: string; hint: string | null }> = [
    {
      key: 'runtime',
      label: t('Overtone.common.readiness.runtime'),
      tone: runtimeReady ? 'success' : readiness.runtimeStatus === 'checking' ? 'neutral' : 'danger',
      status: runtimeReady
        ? t('Overtone.common.status.ready')
        : readiness.runtimeStatus === 'checking'
          ? t('Overtone.common.status.checking')
          : t('Overtone.common.status.unavailable'),
      hint: null,
    },
    {
      key: 'realm',
      label: t('Overtone.common.readiness.realm'),
      tone: readiness.realmConfigured ? 'success' : 'neutral',
      status: readiness.realmConfigured ? t('Overtone.common.status.ready') : t('Overtone.common.status.notConnected'),
      hint: readiness.realmConfigured ? null : t('Overtone.common.readiness.realmNotConnectedHint'),
    },
    {
      key: 'music',
      label: t('Overtone.common.readiness.music'),
      tone: readiness.musicCapabilityAvailable ? 'success' : 'neutral',
      status: readiness.musicCapabilityAvailable ? t('Overtone.common.status.ready') : t('Overtone.common.status.notConfigured'),
      hint: null,
    },
    {
      key: 'text',
      label: t('Overtone.common.readiness.text'),
      tone: readiness.textCapabilityAvailable ? 'success' : 'neutral',
      status: readiness.textCapabilityAvailable ? t('Overtone.common.status.ready') : t('Overtone.common.status.notConfigured'),
      hint: null,
    },
  ];

  return (
    <div className="overtone-empty">
      <EmptyState
        data-testid="overtone-empty-state"
        className="overtone-empty-state"
        title={<NimiText as="span" role="page-title" className="overtone-wordmark">OVERTONE</NimiText>}
        description={t('Overtone.empty.tagline')}
        action={(
          <div className="overtone-empty__action">
            <Button type="button" tone="primary" size="md" onClick={startProject}>
              {t('Overtone.empty.startSession')}
            </Button>
            <div className="overtone-readiness">
              {rows.map((row) => {
                const item = (
                  <span className="overtone-readiness__item" key={row.key}>
                    <NimiText as="span" role="caption">{row.label}</NimiText>
                    <StatusBadge tone={row.tone} shape={row.tone === 'neutral' ? 'outline' : 'soft'}>{row.status}</StatusBadge>
                  </span>
                );
                return row.hint ? (
                  <Tooltip key={row.key} content={row.hint}>{item}</Tooltip>
                ) : item;
              })}
            </div>
            <Steps
              items={flowSteps}
              ariaLabel={t('Overtone.empty.steps.ariaLabel')}
              className="overtone-empty-steps"
            />
          </div>
        )}
      />
    </div>
  );
}
