import { useEffect, useRef, useState } from 'react';
import { Button, FieldShell, InlineAlert, NimiText, SelectField, TextField } from '@nimiplatform/kit/ui';
import { ScenarioJobStatus, type ScenarioJob } from '@nimiplatform/sdk/runtime/generated';
import { useTranslation } from 'react-i18next';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { useAudioCache, useOvertoneActions, useOvertoneState } from '../store.js';
import { recoverSeparation, runSeparation, type SeparationStages } from '../separation.js';
import { makeId, type GenerationJob, type RecoverableSeparation, type SeparationStem } from '../types.js';

const JOB_STATES: Partial<Record<ScenarioJobStatus, GenerationJob['status']>> = {
  [ScenarioJobStatus.SUBMITTED]: 'pending', [ScenarioJobStatus.QUEUED]: 'pending', [ScenarioJobStatus.RUNNING]: 'running',
  [ScenarioJobStatus.COMPLETED]: 'completed', [ScenarioJobStatus.FAILED]: 'failed', [ScenarioJobStatus.CANCELED]: 'canceled', [ScenarioJobStatus.TIMEOUT]: 'timeout',
};
const STEMS: readonly SeparationStem[] = ['vocals', 'background', 'drums', 'bass', 'other'];

// @nimi-authority: rule.overtone.runtime.r005
export function SeparationPanel() {
  const { t } = useTranslation();
  const { project, readiness, activeJobs } = useOvertoneState();
  const actions = useOvertoneActions();
  const cache = useAudioCache();
  const [stage, setStage] = useState<SeparationStages | null>(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [sourceTakeId, setSourceTakeId] = useState('');
  const [rangeMode, setRangeMode] = useState('full'); const [start, setStart] = useState(''); const [end, setEnd] = useState('');
  const [instrumentParts, setInstrumentParts] = useState(false);
  const [activeTitle, setActiveTitle] = useState(''); const [canceling, setCanceling] = useState(false);
  const request = useRef<AbortController | null>(null);
  const projectIdRef = useRef(project?.projectId); projectIdRef.current = project?.projectId;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);
  useEffect(() => () => request.current?.abort(), [project?.projectId]);

  const takes = project?.takes.filter(take => !take.discarded) ?? [];
  const source = takes.find(take => take.takeId === sourceTakeId);
  const available = Boolean(readiness.audioSeparateAvailable);
  const busy = Boolean(stage); const otherBusy = Object.keys(activeJobs).length > 0;
  const secondsValid = (value: string) => value.trim() === '' || (Number.isFinite(Number(value)) && Number(value) >= 0);
  const rangesValid = secondsValid(start) && secondsValid(end);
  const ready = available && Boolean(source) && rangesValid;

  function titles(): Record<SeparationStem, string> {
    const number = project!.takes.length + (project!.recoverableSeparations?.length ?? 0) + 1;
    return Object.fromEntries(STEMS.map(stem => [stem, t('Overtone.separation.stemTitle', { title: source!.title, stem: t(`Overtone.separation.stems.${stem}`), number }).slice(0, 80)])) as Record<SeparationStem, string>;
  }

  async function run(recovery?: RecoverableSeparation) {
    if (!project || request.current || (!recovery && (!source || !ready))) return;
    const projectId = recovery?.projectId ?? project.projectId;
    const controller = new AbortController(); request.current = controller;
    setError(''); setNotice(''); setCanceling(false);
    setActiveTitle(recovery?.title ?? source!.title);
    setStage(recovery ? 'recovering' : 'preparing');
    let jobId = recovery?.jobId; let savedJob = Promise.resolve();
    const operation = recovery ?? {
      separationId: makeId('separation'), projectId, title: t('Overtone.separation.takeTitle', { title: source!.title }).slice(0, 80),
      sourceTakeId: source!.takeId, sourceAudio: source!.audio,
      sourceRange: {
        startFrame: rangeMode === 'range' && start.trim() ? Math.round(Number(start) * source!.audio.sampleRateHz) : 0,
        endFrame: rangeMode === 'range' && end.trim() ? Math.round(Number(end) * source!.audio.sampleRateHz) : source!.audio.frameCount,
      },
      requestedInstrumentParts: instrumentParts, createdAt: Date.now(),
    };
    const onJobUpdate = (job: ScenarioJob) => {
      if (jobId !== job.jobId) {
        savedJob = actions.captureSeparationJob(projectId, operation.separationId, job.jobId);
        void savedJob.catch(() => undefined);
      }
      jobId = job.jobId;
      if (controller.signal.aborted) return;
      const status = JOB_STATES[job.status]; if (!status) return;
      actions.setJob({ jobId: job.jobId, capability: 'audio.separate', status });
      if (mounted.current && (status === 'pending' || status === 'running' || status === 'completed')) setStage(status === 'completed' ? 'saving' : status);
    };
    try {
      const client = getNimiLocalAppClient();
      const result = recovery ? await recoverSeparation({ client, cache, operation: recovery, titles: recovery ? recoveryTitles(recovery) : titles(), signal: controller.signal,
        onStage: stage => { if (mounted.current) setStage(stage); }, onJobUpdate })
        : await runSeparation({ client, cache, operation, titles: titles(), signal: controller.signal,
          onStage: stage => { if (mounted.current) setStage(stage); }, onPrepared: actions.rememberSeparation, onJobUpdate });
      await savedJob; controller.signal.throwIfAborted();
      if (mounted.current) setStage('saving');
      await actions.completeSeparation(projectId, [...result.takes]);
      if (mounted.current && projectIdRef.current === projectId) {
        setNotice(t('Overtone.separation.saved', { count: String(result.takes.length) }));
        requestAnimationFrame(() => document.querySelector('.overtone-takes-stack')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    } catch (cause) {
      if (mounted.current && projectIdRef.current === projectId) {
        if (controller.signal.aborted) setNotice(t('Overtone.separation.stopped'));
        else if (cause instanceof Error && cause.message === 'OVERTONE_SEPARATION_NO_JOB') setError(t('Overtone.separation.recoveryMissingJob'));
        else setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      if (jobId) actions.removeJob(jobId);
      if (request.current === controller) request.current = null;
      if (mounted.current) { setStage(null); setCanceling(false); }
    }
  }

  function recoveryTitles(recovery: RecoverableSeparation): Record<SeparationStem, string> {
    return Object.fromEntries(STEMS.map(stem => [stem, t('Overtone.separation.stemTitle', { title: recovery.title, stem: t(`Overtone.separation.stems.${stem}`), number: '' }).slice(0, 80)])) as Record<SeparationStem, string>;
  }

  if (!project) return null;
  return <details id="ot-separation-panel" className="ot-score-panel" data-testid="overtone-separation">
    <summary>{t('Overtone.separation.title')}</summary>
    <div className="ot-score-content">
      <p>{t('Overtone.separation.intro')}</p>
      {!available ? <InlineAlert tone="info">{t('Overtone.separation.configure')}
        <Button tone="secondary" size="sm" onClick={() => actions.setAISettingsOpen(true)}>{t('Overtone.separation.openSettings')}</Button>
      </InlineAlert> : null}
      {available ? <>
        <FieldShell label={t('Overtone.separation.source')}>
          <SelectField value={sourceTakeId} disabled={busy || otherBusy} options={[{ value: '', label: t('Overtone.separation.choose') },
            ...takes.map(take => ({ value: take.takeId, label: take.title }))]} onChange={event => setSourceTakeId(event.currentTarget.value)} />
        </FieldShell>
        <FieldShell label={t('Overtone.separation.range')}>
          <SelectField value={rangeMode} disabled={busy || otherBusy} options={[{ value: 'full', label: t('Overtone.separation.full') }, { value: 'range', label: t('Overtone.separation.selection') }]}
            onChange={event => setRangeMode(event.currentTarget.value)} />
        </FieldShell>
        {rangeMode === 'range' ? <div className="overtone-row">
          <FieldShell label={t('Overtone.separation.start')}><TextField type="number" step="0.001" min="0" value={start} disabled={busy || otherBusy} onChange={event => setStart(event.currentTarget.value)} aria-label={t('Overtone.separation.start')} /></FieldShell>
          <FieldShell label={t('Overtone.separation.end')}><TextField type="number" step="0.001" min="0" value={end} disabled={busy || otherBusy} onChange={event => setEnd(event.currentTarget.value)} aria-label={t('Overtone.separation.end')} /></FieldShell>
        </div> : null}
        <FieldShell label={t('Overtone.separation.instrumentParts')} message={t('Overtone.separation.instrumentPartsHint')}>
          <SelectField value={instrumentParts ? 'yes' : 'no'} disabled={busy || otherBusy}
            options={[{ value: 'no', label: t('Overtone.separation.instrumentPartsNo') }, { value: 'yes', label: t('Overtone.separation.instrumentPartsYes') }]}
            onChange={event => setInstrumentParts(event.currentTarget.value === 'yes')} />
        </FieldShell>
        <Button tone="primary" size="sm" data-testid="separation-run" data-next-action="separation"
          disabled={!ready || busy || otherBusy} loading={busy} onClick={() => void run()}>{t('Overtone.separation.run')}</Button>
      </> : null}
      {stage ? <div role="status" className="overtone-row"><span>{activeTitle} · {t(canceling ? 'Overtone.separation.canceling' : `Overtone.separation.stages.${stage}`)}</span>
        <Button tone="ghost" size="sm" disabled={canceling || stage === 'saving'} onClick={() => { setCanceling(true); request.current?.abort(); }}>{t(stage === 'preparing' ? 'Overtone.separation.abandon' : 'Overtone.separation.cancel')}</Button>
      </div> : null}
      {notice ? <NimiText role="helper">{notice}</NimiText> : null}
      {error ? <InlineAlert tone="warning">{t('Overtone.separation.failed')}<details><summary>{t('Overtone.playground.errorDetails')}</summary>{error}</details></InlineAlert> : null}
      {(!busy ? project.recoverableSeparations : [])?.map(entry => <section key={entry.separationId} className="ot-result-recovery" data-testid="separation-recovery">
        <strong>{entry.title}</strong><p>{entry.jobId ? t('Overtone.separation.recovery') : t('Overtone.separation.recoveryMissingJob')}</p>
        {entry.jobId ? <Button tone="secondary" size="sm" disabled={busy || otherBusy} onClick={() => void run(entry)}>{t('Overtone.separation.restore')}</Button> : null}
        <Button tone="ghost" size="sm" disabled={busy || otherBusy} onClick={() => void actions.forgetSeparation(project.projectId, entry.separationId).catch(cause => setError(String(cause)))}>{t('Overtone.recovery.forget')}</Button>
      </section>)}
    </div>
  </details>;
}
