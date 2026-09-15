import { useCallback, useEffect, useRef, useState } from 'react';
import type { NimiAIConfigSnapshot } from '@nimiplatform/sdk/ai';
import {
  ModelConfigAIConfigSurface,
  type ModelConfigFormattedError,
  type ModelConfigOverwrite,
} from '@nimiplatform/kit/features/model-config';
import { Button, OverlayShell } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { probeReadiness } from '../readiness.js';
import { useOvertoneActions, useOvertoneState } from '../store.js';

const CONTEXT = { owner: 'app-ai-config' as const, appId: 'nimi.overtone' };

const RUNTIME_UNAVAILABLE_REASON_CODES = new Set([
  'runtime-service-unavailable',
  'protected-carrier-required',
  'local-app-operation-unavailable',
  'renderer-standard-shell-host-unavailable',
]);

function reasonCodeOf(cause: unknown): string {
  if (cause && typeof cause === 'object' && 'reasonCode' in cause) {
    const code = (cause as { reasonCode?: unknown }).reasonCode;
    if (typeof code === 'string' && code.length > 0) return code;
  }
  return cause instanceof Error ? cause.message : String(cause);
}

export function AIConfigPanel() {
  const { t, i18n } = useTranslation();
  const { readiness, aiSettingsOpen } = useOvertoneState();
  const { setReadiness, setAISettingsOpen } = useOvertoneActions();
  const open = aiSettingsOpen;
  const setOpen = setAISettingsOpen;
  const [snapshot, setSnapshot] = useState<NimiAIConfigSnapshot>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const describeError = useCallback((cause: unknown, fallbackKey: string): string => {
    const code = reasonCodeOf(cause);
    if (RUNTIME_UNAVAILABLE_REASON_CODES.has(code)) {
      return t('Overtone.configuration.runtimeUnavailable');
    }
    console.warn('[overtone] AI settings request failed:', code);
    return t(fallbackKey);
  }, [t]);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setSnapshot(await getNimiLocalAppClient().aiConfig.get()); }
    catch (cause) { setError(describeError(cause, 'Overtone.configuration.loadFailed')); }
    finally { setLoading(false); }
  }, [describeError]);
  useEffect(() => { if (open) void refresh(); }, [open, refresh]);
  const overwrite = useCallback<ModelConfigOverwrite>(async (input) => {
    const result = await getNimiLocalAppClient().aiConfig.overwrite(input);
    await refresh();
    setReadiness(await probeReadiness());
    return result;
  }, [refresh, setReadiness]);
  const formatError = useCallback((cause: unknown): ModelConfigFormattedError => ({
    message: describeError(cause, 'Overtone.configuration.saveFailed'),
    technicalDetail: reasonCodeOf(cause),
  }), [describeError]);
  const setupNeeded = readiness.runtimeStatus === 'ready'
    && (!readiness.textCapabilityAvailable || !readiness.musicCapabilityAvailable);
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || !setupNeeded) return;
    autoOpened.current = true;
    setOpen(true);
  }, [setupNeeded]);

  return <>
    <Button type="button" className="ot-ai-settings" tone="secondary" size="sm" onClick={() => setOpen(true)} disabled={readiness.runtimeStatus !== 'ready'}>
      {t('Overtone.configuration.title')}{setupNeeded ? <span className="ot-ai-settings-dot" aria-hidden="true" /> : null}
    </Button>
    <OverlayShell open={open} onClose={() => setOpen(false)} kind="dialog" size="md"
      contentClassName="overtone-section ot-ai-config-content"
      title={t('Overtone.configuration.dialogTitle')}>
      <ModelConfigAIConfigSurface className="ot-ai-config" context={CONTEXT} capabilityContracts={['text.generate', 'music.generate']}
        capabilities={snapshot ? snapshot.config?.capabilities ?? null : undefined}
        revision={snapshot?.revision} effectiveSelections={snapshot?.effectiveSelections}
        listOptions={(query) => getNimiLocalAppClient().aiConfig.listOptions(query)}
        loading={loading} loadError={error} onRetry={() => void refresh()} onOverwrite={overwrite}
        formatError={formatError}
        copy={{
          title: t('Overtone.configuration.capabilities'),
          configuredSummary: t('Overtone.configuration.configured'),
          emptySummary: t('Overtone.configuration.empty'),
          backLabel: t('Overtone.configuration.back'),
          detailTitle: (label) => t('Overtone.configuration.detailTitle', { label }),
          retryLabel: t('Overtone.configuration.retry'),
          loadFailed: t('Overtone.configuration.loadFailed'),
          saveFailed: t('Overtone.configuration.saveFailed'),
          technicalDetailsLabel: t('Overtone.configuration.technicalDetails'),
          notConfiguredLabel: t('Overtone.configuration.empty'),
          configuredLabel: t('Overtone.configuration.configured'),
          selectionRequiredLabel: t('Overtone.configuration.selectionRequired'),
          blockedLabel: t('Overtone.configuration.blocked'),
          unavailableLabel: t('Overtone.configuration.unavailable'),
          mismatchLabel: t('Overtone.configuration.mismatch'),
          routeLabel: t('Overtone.configuration.route'),
          localLabel: t('Overtone.configuration.local'),
          cloudLabel: t('Overtone.configuration.cloud'),
          localChoiceDescription: t('Overtone.configuration.localChoice'),
          localSelectedLabel: t('Overtone.configuration.localSelected'),
          localMissingLabel: t('Overtone.configuration.localMissing'),
          localBrokenLabel: t('Overtone.configuration.localBroken'),
          localUnavailableLabel: t('Overtone.configuration.localUnavailable'),
          localMismatchLabel: (features) => t('Overtone.configuration.localMismatch', { features }),
          openMachineLabel: t('Overtone.configuration.openMachine'),
          saveLocalLabel: t('Overtone.configuration.save'),
          saveCloudLabel: t('Overtone.configuration.save'),
          savingLabel: t('Overtone.configuration.saving'),
          clearLabel: t('Overtone.configuration.clear'),
          clearingLabel: t('Overtone.configuration.clearing'),
          conflictLabel: t('Overtone.configuration.conflict'),
          conflictDescription: t('Overtone.configuration.conflictDescription'),
          conflictCurrentLabel: (revision, summary) => t('Overtone.configuration.conflictCurrent', { revision, summary }),
          advancedLabel: t('Overtone.configuration.advanced'),
          advancedHint: t('Overtone.configuration.advancedHint'),
          requiredFeaturesLabel: t('Overtone.configuration.requiredFeatures'),
          requiredFeaturesPlaceholder: t('Overtone.configuration.requiredFeaturesPlaceholder'),
          defaultsLabel: t('Overtone.configuration.defaults'),
          defaultsPlaceholder: t('Overtone.configuration.defaultsPlaceholder'),
          defaultsUnsetLabel: t('Overtone.configuration.defaultsUnset'),
          defaultsTrueLabel: t('Overtone.configuration.defaultsTrue'),
          defaultsFalseLabel: t('Overtone.configuration.defaultsFalse'),
          defaultsListPlaceholder: t('Overtone.configuration.defaultsListPlaceholder'),
          defaultsLocalEffectivePlaceholder: (value) => t('Overtone.configuration.defaultsLocalEffective', { value }),
          defaultsCloudEffectivePlaceholder: t('Overtone.configuration.defaultsCloudEffective'),
          defaultsRandomValue: t('Overtone.configuration.defaultsRandom'),
          modelPickerTitle: t('Overtone.configuration.pickerTitle'),
          modelPickerSearchPlaceholder: t('Overtone.configuration.pickerSearch'),
          modelPickerLoadingLabel: t('Overtone.configuration.pickerLoading'),
          modelPickerEmptyLabel: t('Overtone.configuration.pickerEmpty'),
          activeModelLabel: t('Overtone.configuration.activeModel'),
          activeModelHint: t('Overtone.configuration.activeModelHint'),
          activeModelConfiguredLabel: t('Overtone.configuration.activeModelConfigured'),
          activeModelSetupPendingLabel: t('Overtone.configuration.activeModelSetupPending'),
          cloudConnectorPickerLabel: t('Overtone.configuration.cloudConnectorPicker'),
          cloudConnectorPickerPlaceholder: t('Overtone.configuration.cloudConnectorPickerPlaceholder'),
          cloudConnectorSelectionRequired: t('Overtone.configuration.cloudConnectorRequired'),
          cloudNoConnectorsLabel: t('Overtone.configuration.cloudNoConnectors'),
          openCloudConnectorsLabel: t('Overtone.configuration.openCloudConnectors'),
          cloudImplementationLabel: t('Overtone.configuration.cloudImplementation'),
          cloudImplementationPlaceholder: t('Overtone.configuration.cloudImplementationPlaceholder'),
          cloudTargetLabel: t('Overtone.configuration.cloudTarget'),
          cloudTargetPlaceholder: t('Overtone.configuration.cloudTargetPlaceholder'),
          cloudTargetDialogTitle: t('Overtone.configuration.cloudTargetDialogTitle'),
          cloudTargetDialogDescription: t('Overtone.configuration.cloudTargetDialogDescription'),
          cloudNoticeLabel: t('Overtone.configuration.cloudNotice'),
          cloudNoticeDescription: t('Overtone.configuration.cloudNoticeDescription'),
          cloudConnectorLabel: t('Overtone.configuration.cloudConnector'),
          cloudConnectorPlaceholder: t('Overtone.configuration.cloudConnectorPlaceholder'),
          cloudLoadFailed: t('Overtone.configuration.cloudLoadFailed'),
          cancelLabel: t('Overtone.configuration.cancel'),
          confirmSelectionLabel: t('Overtone.configuration.confirmSelection'),
          unsupportedCapabilityLabel: t('Overtone.configuration.unsupported'),
          capabilityLabel: (contract, fallback) => contract === 'text.generate'
            ? t('Overtone.configuration.text') : contract === 'music.generate' ? t('Overtone.configuration.music') : fallback,
          capabilityDescription: (contract, fallback) => contract === 'text.generate'
            ? t('Overtone.configuration.textHint') : contract === 'music.generate' ? t('Overtone.configuration.musicHint') : fallback,
        }}
        language={i18n.resolvedLanguage || i18n.language} />
    </OverlayShell>
  </>;
}
