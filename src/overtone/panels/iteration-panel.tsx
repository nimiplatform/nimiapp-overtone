import { useMemo, useState } from 'react';
import { RuntimeGenerationPanel } from '@nimiplatform/kit/features/generation/ui';
import { useRuntimeGenerationPanel } from '@nimiplatform/kit/features/generation/runtime';
import { InlineAlert, SelectField, TextField } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import { getRuntimeNimiClient } from '../../shell/auth/runtime-platform.js';
import {
  arrayBufferToBase64,
  buildMusicGenerateScenarioRequest,
  buildMusicIterationExtensions,
  requireCompletedMusicArtifact,
  scenarioJobProgressLabel,
  scenarioJobStatusToGenerationStatus,
  type MusicSubmitOptions,
  type ScenarioJobStatusLabels,
} from '../runtime-workflow.js';
import { makeId, type SongTake, type TakeOrigin } from '../types.js';

type IterationMode = Exclude<TakeOrigin, 'prompt'>;
type ReferenceErrorKey = 'referenceMustBeAudio' | 'referenceEmpty';
type ReferenceAudio = {
  name: string;
  mimeType: string;
  buffer: ArrayBuffer;
};

export function IterationPanel() {
  const { t } = useTranslation();
  const state = useOvertoneState();
  const { addTake, setJob, removeJob } = useOvertoneActions();
  const project = state.project;
  const brief = project?.brief ?? null;
  const lyrics = project?.lyrics ?? null;
  const visibleTakes = project?.takes.filter((take) => !take.discarded) ?? [];
  const selectedTake = visibleTakes.find((take) => take.takeId === project?.selectedTakeId) ?? null;

  const [mode, setMode] = useState<IterationMode>('extend');
  const [sourceTakeId, setSourceTakeId] = useState<string | null>(null);
  const [styleTags, setStyleTags] = useState('');
  const [trimStartSec, setTrimStartSec] = useState<number | null>(null);
  const [trimEndSec, setTrimEndSec] = useState<number | null>(null);
  const [referenceAudio, setReferenceAudio] = useState<ReferenceAudio | null>(null);
  const [referenceErrorKey, setReferenceErrorKey] = useState<ReferenceErrorKey | null>(null);

  const sourceTake = visibleTakes.find((take) => take.takeId === (sourceTakeId ?? selectedTake?.takeId)) ??
    selectedTake ??
    visibleTakes[0] ??
    null;
  const sourceBuffer = sourceTake ? state.audioBuffers[sourceTake.takeId] : undefined;
  const sourceAudioBuffer = mode === 'reference' ? referenceAudio?.buffer : sourceBuffer;
  const sourceAudioMimeType = mode === 'reference' ? referenceAudio?.mimeType : sourceTake?.artifactMimeType;
  const hasActiveJob = Object.keys(state.activeJobs).length > 0;
  const trimInvalid = trimStartSec !== null &&
    trimEndSec !== null &&
    Number.isFinite(trimStartSec) &&
    Number.isFinite(trimEndSec) &&
    trimEndSec <= trimStartSec;
  const resolvedStyle = styleTags.trim() ||
    sourceTake?.styleSnapshot ||
    [brief?.genre, brief?.mood].filter(Boolean).join(', ');
  const runtime = useMemo(() => getRuntimeNimiClient().runtime, []);
  const scenarioStatusLabels = useMemo<ScenarioJobStatusLabels>(() => ({
    submitted: t('Overtone.runtime.status.submitted'),
    queued: t('Overtone.runtime.status.queued'),
    running: t('Overtone.runtime.status.running'),
    completed: t('Overtone.runtime.status.completed'),
    timeout: t('Overtone.runtime.status.timeout'),
    canceled: t('Overtone.runtime.status.canceled'),
    failed: t('Overtone.runtime.status.failed'),
  }), [t]);
  const modeOptions = useMemo(() => [
    { value: 'extend', label: t('Overtone.common.takeOrigins.extend') },
    { value: 'remix', label: t('Overtone.common.takeOrigins.remix') },
    { value: 'reference', label: t('Overtone.common.takeOrigins.reference') },
  ], [t]);

  const generationInput = useMemo<MusicSubmitOptions>(() => ({
    model: state.readiness.selectedMusicModelId || '',
    connectorId: state.readiness.selectedMusicConnectorId || '',
    targetRef: state.readiness.selectedMusicTargetRef!,
    prompt: brief?.description || '',
    lyrics: lyrics?.text || sourceTake?.lyricsSnapshot || undefined,
    style: resolvedStyle || undefined,
    title: sourceTake?.title || brief?.title || t('Overtone.generate.untitled'),
    durationSeconds: sourceTake?.durationSeconds,
    instrumental: sourceTake?.instrumental,
    extensions: sourceAudioBuffer && sourceAudioMimeType
      ? buildMusicIterationExtensions({
          mode,
          sourceTakeId: mode === 'reference' ? undefined : sourceTake?.takeId,
          sourceAudioBase64: arrayBufferToBase64(sourceAudioBuffer),
          sourceMimeType: sourceAudioMimeType,
          trimStartSec: finiteSeconds(trimStartSec),
          trimEndSec: finiteSeconds(trimEndSec),
        })
      : [],
  }), [
    state.readiness.selectedMusicModelId,
    state.readiness.selectedMusicConnectorId,
    state.readiness.selectedMusicTargetRef,
    brief?.description,
    brief?.title,
    lyrics?.text,
    mode,
    sourceTake,
    sourceAudioBuffer,
    sourceAudioMimeType,
    trimStartSec,
    trimEndSec,
    resolvedStyle,
    t,
  ]);

  const hasSourceAudio = mode === 'reference'
    ? Boolean(referenceAudio?.buffer && referenceAudio.mimeType)
    : Boolean(sourceTake && sourceBuffer);
  const canSubmit = Boolean(
    brief?.description &&
    hasSourceAudio &&
    state.readiness.musicConnectorAvailable &&
    state.readiness.selectedMusicTargetRef &&
    state.readiness.selectedMusicConnectorId &&
    state.readiness.selectedMusicModelId &&
    !trimInvalid &&
    !hasActiveJob,
  );

  const runtimeState = useRuntimeGenerationPanel<MusicSubmitOptions>({
    runtime,
    input: generationInput,
    resolveRequest: ({ input }) => buildMusicGenerateScenarioRequest(input),
    disabled: !canSubmit,
    getStatusLabel: ({ job }) => scenarioJobProgressLabel(job, scenarioStatusLabels),
    onJobUpdate: ({ job }) => {
      setJob({
        jobId: job.jobId,
        status: scenarioJobStatusToGenerationStatus(job.status),
        progressLabel: scenarioJobProgressLabel(job, scenarioStatusLabels),
        errorMessage: job.reasonDetail || undefined,
      });
    },
    onCompleted: (result) => {
      removeJob(result.job.jobId);
      if (!brief) {
        throw new Error(t('Overtone.iteration.errors.sourceNotReady'));
      }
      if (mode !== 'reference' && !sourceTake) {
        throw new Error(t('Overtone.iteration.errors.sourceTakeNotReady'));
      }
      const artifact = requireCompletedMusicArtifact(result);
      const fallbackTitle = sourceTake?.title || brief.title || referenceAudio?.name || t('Overtone.generate.untitled');
      const take: SongTake = {
        takeId: makeId('take'),
        parentTakeId: mode === 'reference' ? undefined : sourceTake?.takeId,
        origin: mode,
        title: t('Overtone.iteration.childTitle', {
          title: fallbackTitle,
          mode: t(`Overtone.common.takeOrigins.${mode}`),
        }),
        jobId: result.job.jobId,
        artifactId: artifact.artifactId,
        artifactMimeType: artifact.mimeType,
        artifactByteLength: artifact.byteLength,
        artifactFileExtension: artifact.fileExtension,
        sourceMimeType: sourceAudioMimeType,
        trimStartSec: finiteSeconds(trimStartSec),
        trimEndSec: finiteSeconds(trimEndSec),
        promptSnapshot: brief.description,
        lyricsSnapshot: lyrics?.text || sourceTake?.lyricsSnapshot || undefined,
        styleSnapshot: resolvedStyle || undefined,
        durationSeconds: artifact.durationSeconds ?? sourceTake?.durationSeconds,
        instrumental: sourceTake?.instrumental,
        favorite: false,
        discarded: false,
        createdAt: Date.now(),
      };
      addTake(take, artifact.buffer);
    },
    onError: (_error, context) => {
      if (context.job?.jobId) {
        removeJob(context.job.jobId);
      }
    },
  });

  async function handleReferenceFile(file: File | undefined) {
    setReferenceErrorKey(null);
    setReferenceAudio(null);
    if (!file) return;
    const mimeType = String(file.type || '').trim().toLowerCase();
    if (!mimeType.startsWith('audio/')) {
      setReferenceErrorKey('referenceMustBeAudio');
      return;
    }
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength === 0) {
      setReferenceErrorKey('referenceEmpty');
      return;
    }
    setReferenceAudio({ name: file.name, mimeType, buffer });
  }
  const controls = (
    <>
      <div className="overtone-row">
        <div className="overtone-field" style={{ flex: 1 }}>
          <label htmlFor="overtone-iteration-source">{t('Overtone.iteration.sourceTake')}</label>
          <SelectField
            id="overtone-iteration-source"
            value={sourceTake?.takeId ?? ''}
            onValueChange={(value) => setSourceTakeId(value)}
            disabled={mode === 'reference' || visibleTakes.length === 0}
            options={visibleTakes.length > 0
              ? visibleTakes.map((take) => ({ value: take.takeId, label: take.title }))
              : [{ value: '', label: t('Overtone.iteration.noSourceTakes'), disabled: true }]}
          />
        </div>
        <div className="overtone-field" style={{ flex: 1 }}>
          <label htmlFor="overtone-iteration-mode">{t('Overtone.iteration.mode')}</label>
          <SelectField
            id="overtone-iteration-mode"
            value={mode}
            onValueChange={(value) => setMode(value as IterationMode)}
            options={modeOptions}
          />
        </div>
      </div>

      <div className="overtone-field">
        <label htmlFor="overtone-iteration-style">{t('Overtone.iteration.styleOverride')}</label>
        <TextField
          id="overtone-iteration-style"
          value={styleTags}
          onChange={(event) => setStyleTags(event.target.value)}
          placeholder={sourceTake?.styleSnapshot || [brief?.genre, brief?.mood].filter(Boolean).join(', ')}
        />
      </div>

      {mode === 'reference' ? (
        <div className="overtone-field">
          <label htmlFor="overtone-reference-audio">{t('Overtone.iteration.referenceAudio')}</label>
          <TextField
            id="overtone-reference-audio"
            type="file"
            accept="audio/*"
            onChange={(event) => {
              void handleReferenceFile(event.target.files?.[0]);
            }}
          />
          {referenceAudio ? (
            <p className="overtone-field__hint">{referenceAudio.name} · {referenceAudio.mimeType}</p>
          ) : null}
        </div>
      ) : null}

      <div className="overtone-row">
        <div className="overtone-field" style={{ flex: 1 }}>
          <label htmlFor="overtone-trim-start">{t('Overtone.iteration.trimStart')}</label>
          <TextField
            id="overtone-trim-start"
            type="number"
            min={0}
            value={trimStartSec ?? ''}
            onChange={(event) => setTrimStartSec(parseOptionalSecond(event.target.value))}
          />
        </div>
        <div className="overtone-field" style={{ flex: 1 }}>
          <label htmlFor="overtone-trim-end">{t('Overtone.iteration.trimEnd')}</label>
          <TextField
            id="overtone-trim-end"
            type="number"
            min={0}
            value={trimEndSec ?? ''}
            onChange={(event) => setTrimEndSec(parseOptionalSecond(event.target.value))}
          />
        </div>
      </div>

      {mode !== 'reference' && !sourceBuffer ? (
        <InlineAlert tone="warning">
          {t('Overtone.iteration.sourceBufferMissing')}
        </InlineAlert>
      ) : null}

      {mode === 'reference' && !referenceAudio ? (
        <InlineAlert tone="warning">
          {t('Overtone.iteration.referenceRequired')}
        </InlineAlert>
      ) : null}

      {referenceErrorKey ? (
        <InlineAlert tone="danger">{t(`Overtone.iteration.errors.${referenceErrorKey}`)}</InlineAlert>
      ) : null}

      {trimInvalid ? (
        <InlineAlert tone="danger">
          {t('Overtone.iteration.trimInvalid')}
        </InlineAlert>
      ) : null}
    </>
  );

  return (
    <RuntimeGenerationPanel
      runtimeState={runtimeState}
      title={t('Overtone.iteration.title')}
      className="overtone-section overtone-generation-panel"
      runtimeLabel={t('Overtone.generate.runtimeLabel')}
      runtimeValue={state.readiness.selectedMusicConnectorId && state.readiness.selectedMusicModelId
        ? `${state.readiness.selectedMusicConnectorId} / ${state.readiness.selectedMusicModelId}`
        : t('Overtone.generate.runtimeNotConfigured')}
      warning={!state.readiness.musicConnectorAvailable
        ? t('Overtone.iteration.warningNoMusicRoute')
        : null}
      controls={controls}
      submitLabel={t('Overtone.iteration.submit')}
      submittingLabel={t('Overtone.iteration.submitting')}
    />
  );
}

function parseOptionalSecond(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function finiteSeconds(value: number | null): number | undefined {
  return value !== null && Number.isFinite(value) ? value : undefined;
}
