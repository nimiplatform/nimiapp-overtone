import { useEffect, useRef, useState } from 'react';
import { Button, FieldShell, InlineAlert, NimiText, SelectField, TextField } from '@nimiplatform/kit/ui';
import { ScenarioJobStatus, type ScenarioJob } from '@nimiplatform/sdk/runtime/generated';
import { useTranslation } from 'react-i18next';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { useOvertoneActions, useOvertonePlayback, useOvertoneState } from '../store.js';
import { recoverRecordingTranscription, transcribeRecording } from '../transcription.js';
import { makeId, type GenerationJob, type RecoverableMusicTranscription } from '../types.js';
import { formatAudioTime } from '../exploration.js';

const JOB_STATES: Partial<Record<ScenarioJobStatus, GenerationJob['status']>> = {
  [ScenarioJobStatus.SUBMITTED]: 'pending', [ScenarioJobStatus.QUEUED]: 'pending', [ScenarioJobStatus.RUNNING]: 'running',
  [ScenarioJobStatus.COMPLETED]: 'completed', [ScenarioJobStatus.FAILED]: 'failed', [ScenarioJobStatus.CANCELED]: 'canceled', [ScenarioJobStatus.TIMEOUT]: 'timeout',
};
type Stage = 'preparing' | 'recovering' | 'pending' | 'running' | 'saving';

// @nimi-authority: rule.overtone.transcription.r001
// @nimi-authority: rule.overtone.transcription.r002
export function TranscriptionPanel() {
  const { t } = useTranslation(); const { project, readiness, activeJobs } = useOvertoneState(); const actions = useOvertoneActions();
  const playback = useOvertonePlayback();
  const [stage, setStage] = useState<Stage | null>(null); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [rangeMode, setRangeMode] = useState('full'); const [start, setStart] = useState(''); const [end, setEnd] = useState('');
  const [part, setPart] = useState(''); const [activeTitle, setActiveTitle] = useState(''); const [canceling, setCanceling] = useState(false);
  const request = useRef<AbortController | null>(null); const projectIdRef = useRef(project?.projectId); projectIdRef.current = project?.projectId;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);
  useEffect(() => () => request.current?.abort(), [project?.projectId]);
  const source = project?.takes.find(take => take.takeId === project.selectedTakeId && !take.discarded);
  useEffect(() => { setStart(''); setEnd(''); setRangeMode('full'); }, [source?.takeId]);
  const profiles = readiness.musicTranscriptionInput?.filter(profile => profile.formats.includes('abc')) ?? [];
  const profile = profiles.find(item => item.parts.includes(part as RecoverableMusicTranscription['requestedPart'])) ?? profiles[0];
  const selectedPart = profile?.parts.includes(part as RecoverableMusicTranscription['requestedPart']) ? part as RecoverableMusicTranscription['requestedPart']
    : profile?.parts.includes('lead-sheet') ? 'lead-sheet' : profile?.parts[0];
  const available = readiness.musicTranscriptionAvailable && Boolean(profile);
  const busy = Boolean(stage); const otherBusy = Object.keys(activeJobs).length > 0;
  const estimates = project?.transcriptions?.filter(item => item.sourceTakeId === source?.takeId) ?? [];
  function openScore(scoreId: string) {
    actions.selectScore(scoreId);
    const panel = document.querySelector<HTMLDetailsElement>('#ot-score-panel');
    if (panel) { panel.open = true; panel.scrollIntoView({ block: 'nearest' }); }
  }
  async function run(recovery?: RecoverableMusicTranscription) {
    if (!project || request.current || (!recovery && (!source || !profile || !selectedPart))) return;
    const projectId = recovery?.projectId ?? project.projectId;
    const controller = new AbortController(); request.current = controller;
    setError(''); setNotice(''); setCanceling(false); setActiveTitle(recovery?.title ?? source!.title); setStage(recovery ? 'recovering' : 'preparing');
    let jobId = recovery?.jobId; let savedJob = Promise.resolve();
    const operation = recovery ?? {
      clientSubmissionId: makeId('transcribe'), projectId, sourceTakeId: source!.takeId, sourceAudio: source!.audio,
      sourceRange: {
        startFrame: rangeMode === 'range' && start.trim() ? Math.round(Number(start) * source!.audio.sampleRateHz) : 0,
        endFrame: rangeMode === 'range' && end.trim() ? Math.round(Number(end) * source!.audio.sampleRateHz) : source!.audio.frameCount,
      },
      requestedFormats: ['abc', ...(profile!.formats.includes('timeline') ? ['timeline'] as const : [])] as const,
      requestedPart: selectedPart!, title: source!.title, createdAt: Date.now(),
    };
    const onJobUpdate = (job: ScenarioJob) => {
      if (jobId !== job.jobId) {
        savedJob = actions.captureTranscriptionJob(projectId, operation.clientSubmissionId, job.jobId);
        void savedJob.catch(() => undefined);
      }
      jobId = job.jobId;
      if (controller.signal.aborted) return;
      const status = JOB_STATES[job.status]; if (!status) return;
      actions.setJob({ jobId: job.jobId, capability: 'music.transcribe', status });
      if (mounted.current && (status === 'pending' || status === 'running' || status === 'completed')) setStage(status === 'completed' ? 'saving' : status);
    };
    try {
      const client = getNimiLocalAppClient();
      const result = recovery ? await recoverRecordingTranscription({ client, operation: recovery, signal: controller.signal, onJobUpdate })
        : await transcribeRecording({ client, operation, signal: controller.signal, onPrepared: actions.rememberTranscription, onJobUpdate });
      await savedJob; controller.signal.throwIfAborted();
      if (mounted.current) setStage('saving');
      await actions.completeTranscription(projectId, result);
      if (mounted.current && projectIdRef.current === projectId) {
        setNotice(t('Overtone.transcription.saved'));
        const panel = document.querySelector<HTMLDetailsElement>('#ot-score-panel');
        if (panel) { panel.open = true; panel.scrollIntoView({ block: 'nearest' }); }
      }
    } catch (cause) {
      if (mounted.current && projectIdRef.current === projectId) {
        if (controller.signal.aborted) setNotice(t('Overtone.transcription.stopped'));
        else setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      if (jobId) actions.removeJob(jobId);
      if (request.current === controller) request.current = null;
      if (mounted.current) { setStage(null); setCanceling(false); }
    }
  }
  if (!project) return null;
  return <details id="ot-transcription-panel" className="ot-score-panel">
    <summary>{t('Overtone.transcription.title')}</summary>
    <div className="ot-score-content">
      <p>{t('Overtone.transcription.intro')}</p>
      <NimiText role="body">{source ? t('Overtone.transcription.source', { title: source.title }) : t('Overtone.transcription.selectRecording')}</NimiText>
      {!available ? <InlineAlert tone="info">{t('Overtone.transcription.configure')}
        <Button tone="secondary" size="sm" onClick={() => actions.setAISettingsOpen(true)}>{t('Overtone.transcription.openSettings')}</Button>
      </InlineAlert> : null}
      {available && profile ? <>
        <FieldShell label={t('Overtone.transcription.part')}>
          <SelectField value={selectedPart} disabled={busy || otherBusy} options={[...new Set(profiles.flatMap(item => item.parts))].map(value => ({ value, label: t(`Overtone.transcription.parts.${value}`) }))}
            onChange={event => setPart(event.currentTarget.value)} />
        </FieldShell>
        {profile.supportsRange ? <FieldShell label={t('Overtone.transcription.range')}>
          <SelectField value={rangeMode} disabled={busy || otherBusy} options={[{ value: 'full', label: t('Overtone.transcription.full') }, { value: 'range', label: t('Overtone.transcription.selection') }]}
            onChange={event => setRangeMode(event.currentTarget.value)} />
        </FieldShell> : null}
        {profile.supportsRange && rangeMode === 'range' ? <div className="overtone-row">
          <FieldShell label={t('Overtone.transcription.start')}><TextField type="number" step="0.001" min="0" value={start} disabled={busy || otherBusy} onChange={event => setStart(event.currentTarget.value)} aria-label={t('Overtone.transcription.start')} /></FieldShell>
          <FieldShell label={t('Overtone.transcription.end')}><TextField type="number" step="0.001" min="0" value={end} disabled={busy || otherBusy} onChange={event => setEnd(event.currentTarget.value)} aria-label={t('Overtone.transcription.end')} /></FieldShell>
        </div> : null}
        <Button tone="primary" size="sm" disabled={!source || busy || otherBusy} loading={busy} onClick={() => void run()}>{t('Overtone.transcription.run')}</Button>
      </> : null}
      {stage ? <div role="status" className="overtone-row"><span>{activeTitle} · {t(canceling ? 'Overtone.transcription.canceling' : `Overtone.transcription.stages.${stage}`)}</span>
        <Button tone="ghost" size="sm" disabled={canceling || stage === 'saving'} onClick={() => { setCanceling(true); request.current?.abort(); }}>{t(stage === 'preparing' ? 'Overtone.transcription.abandon' : 'Overtone.transcription.cancel')}</Button>
      </div> : null}
      {notice ? <NimiText role="helper">{notice}</NimiText> : null}
      {error ? <InlineAlert tone="warning">{t('Overtone.transcription.failed')}<details><summary>{t('Overtone.playground.errorDetails')}</summary>{error}</details></InlineAlert> : null}
      {estimates.map(estimate => <section key={estimate.transcriptionId} className="ot-result-recovery">
        <strong>{t('Overtone.transcription.estimate')}</strong>
        <p>{formatAudioTime(estimate.sourceRange.startFrame / estimate.sourceAudio.sampleRateHz)}–{formatAudioTime(estimate.sourceRange.endFrame / estimate.sourceAudio.sampleRateHz)} · {t(`Overtone.transcription.completeness.${estimate.completeness}`)}</p>
        <div className="overtone-row"><Button tone="secondary" size="sm" onClick={() => openScore(estimate.scoreIds[0]!)}>{t('Overtone.transcription.openScore')}</Button>
          <Button tone="ghost" size="sm" onClick={() => playback.requestTake(estimate.sourceTakeId, true)}>{t('Overtone.transcription.listenSource')}</Button></div>
      </section>)}
      {(!busy ? project.recoverableTranscriptions : [])?.map(operation => <section key={operation.clientSubmissionId} className="ot-result-recovery">
        <strong>{operation.title}</strong><p>{t('Overtone.transcription.recovery')}</p>
        <Button tone="secondary" size="sm" disabled={busy || otherBusy} onClick={() => void run(operation)}>{t('Overtone.transcription.restore')}</Button>
        <Button tone="ghost" size="sm" disabled={busy || otherBusy} onClick={() => void actions.forgetTranscription(project.projectId, operation.clientSubmissionId).catch(cause => setError(String(cause)))}>{t('Overtone.recovery.forget')}</Button>
      </section>)}
    </div>
  </details>;
}
