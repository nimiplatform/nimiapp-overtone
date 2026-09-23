import { useEffect, useRef, useState } from 'react';
import { Button, FieldShell, InlineAlert, NimiText, SelectField, TextField } from '@nimiplatform/kit/ui';
import { ScenarioJobStatus, type ScenarioJob } from '@nimiplatform/sdk/runtime/generated';
import { useTranslation } from 'react-i18next';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { recoverVoiceConvert, runVoiceConvert, type VoiceConvertStages } from '../voice-convert.js';
import { buildVoiceConvertTargetChoice, selectionFrames } from '../voice-convert-target.js';
import { useAudioCache, useOvertoneActions, useOvertoneState } from '../store.js';
import { makeId, type GenerationJob, type RecoverableVoiceConvert, type VoiceConvertTargetChoice } from '../types.js';

const JOB_STATES: Partial<Record<ScenarioJobStatus, GenerationJob['status']>> = {
  [ScenarioJobStatus.SUBMITTED]: 'pending', [ScenarioJobStatus.QUEUED]: 'pending', [ScenarioJobStatus.RUNNING]: 'running',
  [ScenarioJobStatus.COMPLETED]: 'completed', [ScenarioJobStatus.FAILED]: 'failed', [ScenarioJobStatus.CANCELED]: 'canceled', [ScenarioJobStatus.TIMEOUT]: 'timeout',
};

// @nimi-authority: rule.overtone.runtime.r005
export function VoiceConvertPanel() {
  const { t } = useTranslation();
  const { project, readiness, activeJobs } = useOvertoneState();
  const actions = useOvertoneActions();
  const cache = useAudioCache();
  const [stage, setStage] = useState<VoiceConvertStages | null>(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [sourceTakeId, setSourceTakeId] = useState('');
  const [targetTakeId, setTargetTakeId] = useState('');
  const [targetRangeMode, setTargetRangeMode] = useState('full');
  const [targetStart, setTargetStart] = useState(''); const [targetEnd, setTargetEnd] = useState('');
  const [accompanimentTakeId, setAccompanimentTakeId] = useState('');
  const [rangeMode, setRangeMode] = useState('full');
  const [start, setStart] = useState(''); const [end, setEnd] = useState('');
  const [semitone, setSemitone] = useState('');
  const [activeTitle, setActiveTitle] = useState(''); const [canceling, setCanceling] = useState(false);
  const request = useRef<AbortController | null>(null);
  const projectIdRef = useRef(project?.projectId); projectIdRef.current = project?.projectId;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);
  useEffect(() => () => request.current?.abort(), [project?.projectId]);

  const takes = project?.takes.filter(take => !take.discarded) ?? [];
  const source = takes.find(take => take.takeId === sourceTakeId);
  const targetReference = takes.find(take => take.takeId === targetTakeId);
  const accompaniment = takes.find(take => take.takeId === accompanimentTakeId);
  // Overtone's target voice is always another project recording; a profile
  // without the reference-audio carrier leaves this action unavailable.
  const profile = readiness.voiceConvertInput?.find(item => item.sourceKinds.includes('singing') && item.targetKinds.includes('reference-audio'));
  const available = Boolean(readiness.voiceConvertAvailable && profile);
  const busy = Boolean(stage); const otherBusy = Object.keys(activeJobs).length > 0;

  const semitoneText = semitone.trim();
  const semitoneValid = semitoneText === '' || (Number.isInteger(Number(semitoneText))
    && Number(semitoneText) >= (profile?.supportsSemitoneShift ? profile.minSemitoneShift : -12)
    && Number(semitoneText) <= (profile?.supportsSemitoneShift ? profile.maxSemitoneShift : 12)
    && (profile?.supportsSemitoneShift ?? true));
  const secondsValid = (value: string) => value.trim() === '' || (Number.isFinite(Number(value)) && Number(value) >= 0);
  const sourceRange = source && secondsValid(start) && secondsValid(end) ? selectionFrames(source.audio, rangeMode, start, end) : null;
  const targetChoice: VoiceConvertTargetChoice | null = targetReference && secondsValid(targetStart) && secondsValid(targetEnd)
    ? buildVoiceConvertTargetChoice({ reference: targetReference.audio, rangeMode: targetRangeMode, startSeconds: targetStart, endSeconds: targetEnd }) : null;
  const sourceRangeInvalid = Boolean(source) && !sourceRange;
  const targetRangeInvalid = Boolean(targetReference) && !targetChoice;
  const targetReady = Boolean(targetReference) && targetReference!.takeId !== sourceTakeId && Boolean(targetChoice);
  const ready = available && Boolean(source) && Boolean(accompaniment) && source!.takeId !== accompaniment!.takeId
    && Boolean(sourceRange) && targetReady && semitoneValid;

  async function run(recovery?: RecoverableVoiceConvert) {
    if (!project || request.current || (!recovery && (!source || !accompaniment || !ready))) return;
    const projectId = recovery?.projectId ?? project.projectId;
    const controller = new AbortController(); request.current = controller;
    setError(''); setNotice(''); setCanceling(false);
    setActiveTitle(recovery?.title ?? source!.title);
    setStage(recovery ? 'recovering' : 'preparing');
    let jobId = recovery?.jobId; let savedJob = Promise.resolve();
    const submissionId = recovery?.clientSubmissionId ?? makeId('voice');
    const number = project.takes.length + (project.recoverableVoiceConversions?.length ?? 0) + 1;
    const title = recovery?.title ?? t('Overtone.voiceConvert.takeTitle', { title: source!.title, number }).slice(0, 80);
    const mixTitle = t('Overtone.voiceConvert.mixTakeTitle', { title: recovery?.title ?? source!.title, number });
    const onJobUpdate = (job: ScenarioJob) => {
      if (jobId !== job.jobId) {
        savedJob = actions.captureVoiceConvertJob(projectId, submissionId, job.jobId);
        void savedJob.catch(() => undefined);
      }
      jobId = job.jobId;
      if (controller.signal.aborted) return;
      const status = JOB_STATES[job.status]; if (!status) return;
      actions.setJob({ jobId: job.jobId, capability: 'audio.voice.convert', status });
      if (mounted.current && (status === 'pending' || status === 'running' || status === 'completed')) setStage(status === 'completed' ? 'saving' : status);
    };
    try {
      const client = getNimiLocalAppClient();
      const result = recovery ? await recoverVoiceConvert({ client, cache, operation: recovery, mixTitle, signal: controller.signal,
        onStage: stage => { if (mounted.current) setStage(stage); }, onJobUpdate })
        : await runVoiceConvert({ client, cache, mixTitle, signal: controller.signal,
          onStage: stage => { if (mounted.current) setStage(stage); }, onPrepared: actions.rememberVoiceConvert, onJobUpdate,
          operation: {
            clientSubmissionId: submissionId, projectId, title,
            sourceTakeId: source!.takeId, sourceAudio: source!.audio, sourceRange: sourceRange!,
            targetChoice: targetChoice!, targetTakeId: targetReference!.takeId, targetAudio: targetReference!.audio,
            ...(semitoneText !== '' && Number(semitoneText) !== 0 ? { semitoneShift: Number(semitoneText) } : {}),
            retainedAccompanimentTakeId: accompaniment!.takeId, retainedAccompaniment: accompaniment!.audio,
            createdAt: Date.now(),
          },
        });
      await savedJob; controller.signal.throwIfAborted();
      if (mounted.current) setStage('saving');
      await actions.completeVoiceConvert(projectId, result.take, result.mixTake);
      if (mounted.current && projectIdRef.current === projectId) {
        const converted = result.take;
        if (converted.origin === 'runtime-result' && converted.capability === 'audio.voice.convert') {
          const mix = converted.derivation.mix;
          setNotice(`${t('Overtone.voiceConvert.saved', {
            relation: t(`Overtone.voiceConvert.lengthRelation.${converted.derivation.lengthRelation}`),
            deltaMs: `${converted.derivation.durationDeltaMs > 0 ? '+' : ''}${converted.derivation.durationDeltaMs}`,
          })} ${t(mix.peak > 1 ? 'Overtone.voiceConvert.mixPeakOver' : 'Overtone.voiceConvert.mixPeak', { peak: mix.peak.toFixed(3) })}`);
        }
        requestAnimationFrame(() => document.querySelector('.overtone-takes-stack')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    } catch (cause) {
      if (mounted.current && projectIdRef.current === projectId) {
        if (controller.signal.aborted) setNotice(t('Overtone.voiceConvert.stopped'));
        else setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      if (jobId) actions.removeJob(jobId);
      if (request.current === controller) request.current = null;
      if (mounted.current) { setStage(null); setCanceling(false); }
    }
  }

  if (!project) return null;
  return <details id="ot-voice-convert-panel" className="ot-score-panel" data-testid="overtone-voice-convert">
    <summary>{t('Overtone.voiceConvert.title')}</summary>
    <div className="ot-score-content">
      <p>{t('Overtone.voiceConvert.intro')}</p>
      {!available ? <InlineAlert tone="info">{t('Overtone.voiceConvert.configure')}
        <Button tone="secondary" size="sm" onClick={() => actions.setAISettingsOpen(true)}>{t('Overtone.voiceConvert.openSettings')}</Button>
      </InlineAlert> : null}
      {available ? <>
        <FieldShell label={t('Overtone.voiceConvert.source')}>
          <SelectField value={sourceTakeId} disabled={busy || otherBusy} options={[{ value: '', label: t('Overtone.voiceConvert.choose') },
            ...takes.map(take => ({ value: take.takeId, label: take.title }))]} onChange={event => setSourceTakeId(event.currentTarget.value)} />
        </FieldShell>
        {profile?.supportsRange ? <FieldShell label={t('Overtone.voiceConvert.range')}>
          <SelectField value={rangeMode} disabled={busy || otherBusy} options={[{ value: 'full', label: t('Overtone.voiceConvert.full') }, { value: 'range', label: t('Overtone.voiceConvert.selection') }]}
            onChange={event => setRangeMode(event.currentTarget.value)} />
        </FieldShell> : null}
        {profile?.supportsRange && rangeMode === 'range' ? <div className="overtone-row">
          <FieldShell label={t('Overtone.voiceConvert.start')}><TextField type="number" step="0.001" min="0" value={start} disabled={busy || otherBusy} onChange={event => setStart(event.currentTarget.value)} aria-label={t('Overtone.voiceConvert.start')} /></FieldShell>
          <FieldShell label={t('Overtone.voiceConvert.end')}><TextField type="number" step="0.001" min="0" value={end} disabled={busy || otherBusy} onChange={event => setEnd(event.currentTarget.value)} aria-label={t('Overtone.voiceConvert.end')} /></FieldShell>
        </div> : null}
        {sourceRangeInvalid ? <InlineAlert tone="warning">{t('Overtone.voiceConvert.rangeInvalid')}</InlineAlert> : null}
        <>
          <FieldShell label={t('Overtone.voiceConvert.reference')} message={t('Overtone.voiceConvert.referenceHint')}>
            <SelectField value={targetTakeId} disabled={busy || otherBusy} options={[{ value: '', label: t('Overtone.voiceConvert.choose') },
              ...takes.filter(take => take.takeId !== sourceTakeId).map(take => ({ value: take.takeId, label: take.title }))]} onChange={event => setTargetTakeId(event.currentTarget.value)} />
          </FieldShell>
          {profile?.supportsRange ? <FieldShell label={t('Overtone.voiceConvert.targetRange')}>
            <SelectField value={targetRangeMode} disabled={busy || otherBusy} options={[{ value: 'full', label: t('Overtone.voiceConvert.full') }, { value: 'range', label: t('Overtone.voiceConvert.selection') }]}
              onChange={event => setTargetRangeMode(event.currentTarget.value)} />
          </FieldShell> : null}
          {profile?.supportsRange && targetRangeMode === 'range' ? <div className="overtone-row">
            <FieldShell label={t('Overtone.voiceConvert.targetStart')}><TextField type="number" step="0.001" min="0" value={targetStart} disabled={busy || otherBusy} onChange={event => setTargetStart(event.currentTarget.value)} aria-label={t('Overtone.voiceConvert.targetStart')} /></FieldShell>
            <FieldShell label={t('Overtone.voiceConvert.targetEnd')}><TextField type="number" step="0.001" min="0" value={targetEnd} disabled={busy || otherBusy} onChange={event => setTargetEnd(event.currentTarget.value)} aria-label={t('Overtone.voiceConvert.targetEnd')} /></FieldShell>
          </div> : null}
          {targetRangeInvalid ? <InlineAlert tone="warning">{t('Overtone.voiceConvert.targetRangeInvalid')}</InlineAlert> : null}
        </>
        <FieldShell label={t('Overtone.voiceConvert.accompaniment')} message={t('Overtone.voiceConvert.accompanimentHint')}>
          <SelectField value={accompanimentTakeId} disabled={busy || otherBusy} options={[{ value: '', label: t('Overtone.voiceConvert.choose') },
            ...takes.filter(take => take.takeId !== sourceTakeId).map(take => ({ value: take.takeId, label: take.title }))]} onChange={event => setAccompanimentTakeId(event.currentTarget.value)} />
        </FieldShell>
        {profile?.supportsSemitoneShift || semitoneText ? <FieldShell label={t('Overtone.voiceConvert.semitone')} message={semitoneValid ? t('Overtone.voiceConvert.semitoneHint') : t('Overtone.voiceConvert.semitoneInvalid')} messageTone={semitoneValid ? undefined : 'warning'}>
          <TextField type="number" step={1} min={profile?.supportsSemitoneShift ? profile.minSemitoneShift : -12} max={profile?.supportsSemitoneShift ? profile.maxSemitoneShift : 12}
            value={semitone} disabled={busy || otherBusy} onChange={event => setSemitone(event.currentTarget.value)} aria-label={t('Overtone.voiceConvert.semitone')} />
        </FieldShell> : null}
        <Button tone="primary" size="sm" data-testid="voice-convert-run" data-next-action="voice-convert"
          disabled={!ready || busy || otherBusy} loading={busy} onClick={() => void run()}>{t('Overtone.voiceConvert.run')}</Button>
      </> : null}
      {stage ? <div role="status" className="overtone-row"><span>{activeTitle} · {t(canceling ? 'Overtone.voiceConvert.canceling' : `Overtone.voiceConvert.stages.${stage}`)}</span>
        <Button tone="ghost" size="sm" disabled={canceling || stage === 'saving'} onClick={() => { setCanceling(true); request.current?.abort(); }}>{t(stage === 'preparing' ? 'Overtone.voiceConvert.abandon' : 'Overtone.voiceConvert.cancel')}</Button>
      </div> : null}
      {notice ? <NimiText role="helper">{notice}</NimiText> : null}
      {error ? <InlineAlert tone="warning">{t('Overtone.voiceConvert.failed')}<details><summary>{t('Overtone.playground.errorDetails')}</summary>{error}</details></InlineAlert> : null}
      {(!busy ? project.recoverableVoiceConversions : [])?.map(entry => <section key={entry.clientSubmissionId} className="ot-result-recovery" data-testid="voice-convert-recovery">
        <strong>{entry.title}</strong><p>{t('Overtone.voiceConvert.recovery')}</p>
        <Button tone="secondary" size="sm" disabled={busy || otherBusy} onClick={() => void run(entry)}>{t('Overtone.voiceConvert.restore')}</Button>
        <Button tone="ghost" size="sm" disabled={busy || otherBusy} onClick={() => void actions.forgetVoiceConvert(project.projectId, entry.clientSubmissionId).catch(cause => setError(String(cause)))}>{t('Overtone.recovery.forget')}</Button>
      </section>)}
    </div>
  </details>;
}
