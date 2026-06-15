import { useMemo, useState } from 'react';
import { RuntimeGenerationPanel } from '@nimiplatform/kit/features/generation/ui';
import { useRuntimeGenerationPanel } from '@nimiplatform/kit/features/generation/runtime';
import { InlineAlert, SelectField, TextField } from '@nimiplatform/kit/ui';
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
} from '../runtime-workflow.js';
import { makeId, type SongTake, type TakeOrigin } from '../types.js';

type IterationMode = Exclude<TakeOrigin, 'prompt'>;
type ReferenceAudio = {
  name: string;
  mimeType: string;
  buffer: ArrayBuffer;
};

export function IterationPanel() {
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
  const [referenceError, setReferenceError] = useState<string | null>(null);

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

  const generationInput = useMemo<MusicSubmitOptions>(() => ({
    model: state.readiness.selectedMusicModelId || '',
    connectorId: state.readiness.selectedMusicConnectorId || '',
    prompt: brief?.description || '',
    lyrics: lyrics?.text || sourceTake?.lyricsSnapshot || undefined,
    style: resolvedStyle || undefined,
    title: sourceTake?.title || brief?.title || 'Untitled',
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
  ]);

  const hasSourceAudio = mode === 'reference'
    ? Boolean(referenceAudio?.buffer && referenceAudio.mimeType)
    : Boolean(sourceTake && sourceBuffer);
  const canSubmit = Boolean(
    brief?.description &&
    hasSourceAudio &&
    state.readiness.musicConnectorAvailable &&
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
    getStatusLabel: ({ job }) => scenarioJobProgressLabel(job),
    onJobUpdate: ({ job }) => {
      setJob({
        jobId: job.jobId,
        status: scenarioJobStatusToGenerationStatus(job.status),
        progressLabel: scenarioJobProgressLabel(job),
        errorMessage: job.reasonDetail || undefined,
      });
    },
    onCompleted: (result) => {
      removeJob(result.job.jobId);
      if (!brief) {
        throw new Error('Iteration source is not ready.');
      }
      if (mode !== 'reference' && !sourceTake) {
        throw new Error('Iteration source take is not ready.');
      }
      const artifact = requireCompletedMusicArtifact(result);
      const take: SongTake = {
        takeId: makeId('take'),
        parentTakeId: mode === 'reference' ? undefined : sourceTake?.takeId,
        origin: mode,
        title: `${sourceTake?.title || brief.title || referenceAudio?.name || 'Untitled'} - ${mode}`,
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
    setReferenceError(null);
    setReferenceAudio(null);
    if (!file) return;
    const mimeType = String(file.type || '').trim().toLowerCase();
    if (!mimeType.startsWith('audio/')) {
      setReferenceError('Reference file must be an audio file.');
      return;
    }
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength === 0) {
      setReferenceError('Reference file is empty.');
      return;
    }
    setReferenceAudio({ name: file.name, mimeType, buffer });
  }
  const controls = (
    <>
      <div className="overtone-row">
        <div className="overtone-field" style={{ flex: 1 }}>
          <label htmlFor="overtone-iteration-source">Source take</label>
          <SelectField
            id="overtone-iteration-source"
            value={sourceTake?.takeId ?? ''}
            onValueChange={(value) => setSourceTakeId(value)}
            disabled={mode === 'reference' || visibleTakes.length === 0}
            options={visibleTakes.length > 0
              ? visibleTakes.map((take) => ({ value: take.takeId, label: take.title }))
              : [{ value: '', label: 'No source takes', disabled: true }]}
          />
        </div>
        <div className="overtone-field" style={{ flex: 1 }}>
          <label htmlFor="overtone-iteration-mode">Mode</label>
          <SelectField
            id="overtone-iteration-mode"
            value={mode}
            onValueChange={(value) => setMode(value as IterationMode)}
            options={[
              { value: 'extend', label: 'Extend' },
              { value: 'remix', label: 'Remix' },
              { value: 'reference', label: 'Reference' },
            ]}
          />
        </div>
      </div>

      <div className="overtone-field">
        <label htmlFor="overtone-iteration-style">Style override</label>
        <TextField
          id="overtone-iteration-style"
          value={styleTags}
          onChange={(event) => setStyleTags(event.target.value)}
          placeholder={sourceTake?.styleSnapshot || [brief?.genre, brief?.mood].filter(Boolean).join(', ')}
        />
      </div>

      {mode === 'reference' ? (
        <div className="overtone-field">
          <label htmlFor="overtone-reference-audio">Reference audio</label>
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
          <label htmlFor="overtone-trim-start">Trim start</label>
          <TextField
            id="overtone-trim-start"
            type="number"
            min={0}
            value={trimStartSec ?? ''}
            onChange={(event) => setTrimStartSec(parseOptionalSecond(event.target.value))}
          />
        </div>
        <div className="overtone-field" style={{ flex: 1 }}>
          <label htmlFor="overtone-trim-end">Trim end</label>
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
          The selected take has no decoded audio buffer in memory, so it cannot be used for iteration.
        </InlineAlert>
      ) : null}

      {mode === 'reference' && !referenceAudio ? (
        <InlineAlert tone="warning">
          Reference mode requires an uploaded audio file.
        </InlineAlert>
      ) : null}

      {referenceError ? (
        <InlineAlert tone="danger">{referenceError}</InlineAlert>
      ) : null}

      {trimInvalid ? (
        <InlineAlert tone="danger">
          Trim end must be greater than trim start.
        </InlineAlert>
      ) : null}
    </>
  );

  return (
    <RuntimeGenerationPanel
      runtimeState={runtimeState}
      title="Iteration"
      className="overtone-section overtone-generation-panel"
      runtimeLabel="Music route"
      runtimeValue={state.readiness.selectedMusicConnectorId && state.readiness.selectedMusicModelId
        ? `${state.readiness.selectedMusicConnectorId} / ${state.readiness.selectedMusicModelId}`
        : 'not configured'}
      warning={!state.readiness.musicConnectorAvailable
        ? 'No music connector/model pair is ready. Configure runtime music access before iterating.'
        : null}
      controls={controls}
      submitLabel="Create Child Take"
      submittingLabel="Iterating..."
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
