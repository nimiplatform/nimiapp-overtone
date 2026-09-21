import { useEffect, useRef, useState } from 'react';
import { Button, InlineAlert, NimiText } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { useAudioCache, useOvertoneActions, useOvertoneState } from '../store.js';
import { importRecording, type RecordingImportStage } from '../import-recording.js';
import './import-recording.css';

export function ImportRecording() {
  const { t } = useTranslation(); const { project } = useOvertoneState(); const { addTake } = useOvertoneActions(); const cache = useAudioCache();
  const picker = useRef<HTMLInputElement>(null); const operation = useRef<AbortController | null>(null);
  const [stage, setStage] = useState<RecordingImportStage | 'saving' | null>(null); const [abandoning, setAbandoning] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => operation.current?.abort(), []);
  async function run(file: File) {
    if (!project || operation.current) return;
    const projectId = project.projectId; const controller = new AbortController(); operation.current = controller;
    setError(''); setAbandoning(false); setStage('copying');
    try {
      const take = await importRecording({ client: getNimiLocalAppClient(), cache, file, signal: controller.signal, onStage: setStage });
      controller.signal.throwIfAborted(); setStage('saving');
      // A project save failure leaves the valid assets and in-memory version for the existing save retry.
      await addTake(projectId, take);
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { operation.current = null; setStage(null); setAbandoning(false); }
  }
  return <div className="ot-import-recording">
    <input ref={picker} type="file" accept=".mp3,.wav,.flac" hidden aria-label={t('Overtone.recording.import')}
      onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void run(file); }} />
    <Button tone="secondary" size="sm" disabled={!project || !!stage} loading={!!stage} onClick={() => picker.current?.click()}>{t('Overtone.recording.import')}</Button>
    <NimiText role="helper">{t('Overtone.recording.hint')}</NimiText>
    {stage ? <div className="overtone-row" role="status"><NimiText role="helper">{t(abandoning ? 'Overtone.recording.abandoning' : `Overtone.recording.stages.${stage}`)}</NimiText>
      <Button tone="ghost" size="sm" disabled={abandoning || stage === 'saving'} onClick={() => { setAbandoning(true); operation.current?.abort(); }}>{t('Overtone.recording.abandon')}</Button>
    </div> : null}
    {error ? <InlineAlert tone="warning">{t('Overtone.recording.failed')}<details><summary>{t('Overtone.playground.errorDetails')}</summary>{error}</details></InlineAlert> : null}
  </div>;
}
