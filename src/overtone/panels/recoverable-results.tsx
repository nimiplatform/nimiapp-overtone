import { useEffect, useRef, useState } from 'react';
import { Button, InlineAlert } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { useAudioCache, useOvertoneActions, useOvertoneState } from '../store.js';
import { createMusicVersion, recoverRuntimeMusic } from '../runtime-workflow.js';
import type { RecoverableMusicResult } from '../types.js';

// @nimi-authority: rule.overtone.data-model.r007
export function RecoverableResults() {
  const { project, activeJobs } = useOvertoneState();
  return <>{project?.recoverableResults?.filter(result => !result.jobId || !activeJobs[result.jobId]).map(result => <RecoverableResult key={result.clientSubmissionId} result={result}/>)}</>;
}
function RecoverableResult({ result }: { result: RecoverableMusicResult }) {
  const { t } = useTranslation();
  const cache = useAudioCache();
  const { addTake, forgetResult } = useOvertoneActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function restore() {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    try {
      const audio = await recoverRuntimeMusic({ client: getNimiLocalAppClient(), cache, operation: result, signal: controller.signal });
      controller.signal.throwIfAborted();
      const version = createMusicVersion(result, audio);
      await addTake(result.projectId, version.take, version.score);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally { if (!controller.signal.aborted) { request.current = null; setBusy(false); } }
  }
  return <section className="ot-result-recovery" aria-label={t('Overtone.recovery.title')}>
    <strong>{result.title}</strong><p>{t('Overtone.recovery.hint')}</p>
    <Button tone="primary" size="sm" loading={busy} disabled={busy} onClick={() => void restore()}>{t(busy ? 'Overtone.recovery.loading' : 'Overtone.recovery.restore')}</Button>
    <Button tone="ghost" size="sm" disabled={busy} onClick={() => void forgetResult(result.clientSubmissionId).catch(cause => setError(String(cause)))}>{t('Overtone.recovery.forget')}</Button>
    {error ? <InlineAlert tone="warning">{t('Overtone.recovery.failed')}<details><summary>{t('Overtone.playground.errorDetails')}</summary>{error}</details></InlineAlert> : null}
  </section>;
}
