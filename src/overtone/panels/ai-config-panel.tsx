import { useCallback, useEffect, useState } from 'react';
import type { NimiAIConfigSnapshot } from '@nimiplatform/sdk/ai';
import { ModelConfigAIConfigSurface, type ModelConfigOverwrite } from '@nimiplatform/kit/features/model-config';
import { Button, OverlayShell } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { probeReadiness } from '../readiness.js';
import { useOvertoneActions, useOvertoneState } from '../store.js';

const CONTEXT = { owner: 'app-ai-config' as const, appId: 'nimi.overtone' };

export function AIConfigPanel() {
  const { t, i18n } = useTranslation();
  const { readiness } = useOvertoneState();
  const { setReadiness } = useOvertoneActions();
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<NimiAIConfigSnapshot>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setSnapshot(await getNimiLocalAppClient().aiConfig.get()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (open) void refresh(); }, [open, refresh]);
  const overwrite = useCallback<ModelConfigOverwrite>(async (input) => {
    const result = await getNimiLocalAppClient().aiConfig.overwrite(input);
    await refresh();
    setReadiness(await probeReadiness());
    return result;
  }, [refresh, setReadiness]);

  return <>
    <Button type="button" tone="secondary" size="sm" onClick={() => setOpen(true)} disabled={readiness.runtimeStatus !== 'ready'}>
      {t('Overtone.configuration.title')}
    </Button>
    <OverlayShell open={open} onClose={() => setOpen(false)} kind="dialog"
      panelClassName="overtone-publish-modal" contentClassName="overtone-section"
      title={<h2>{t('Overtone.configuration.title')}</h2>}>
      <ModelConfigAIConfigSurface context={CONTEXT} capabilityContracts={['text.generate', 'music.generate']}
        capabilities={snapshot ? snapshot.config?.capabilities ?? null : undefined}
        revision={snapshot?.revision} effectiveSelections={snapshot?.effectiveSelections}
        listOptions={(query) => getNimiLocalAppClient().aiConfig.listOptions(query)}
        loading={loading} loadError={error} onRetry={() => void refresh()} onOverwrite={overwrite}
        copy={{
          title: t('Overtone.configuration.title'),
          configuredSummary: t('Overtone.configuration.configured'),
          emptySummary: t('Overtone.configuration.empty'),
          capabilityLabel: (contract, fallback) => contract === 'text.generate'
            ? t('Overtone.configuration.text') : contract === 'music.generate' ? t('Overtone.configuration.music') : fallback,
          capabilityDescription: (contract, fallback) => contract === 'text.generate'
            ? t('Overtone.configuration.textHint') : contract === 'music.generate' ? t('Overtone.configuration.musicHint') : fallback,
        }}
        language={i18n.resolvedLanguage || i18n.language} />
    </OverlayShell>
  </>;
}
