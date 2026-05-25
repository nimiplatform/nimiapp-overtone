import { useCallback, useState } from 'react';
import { getPlatformClient } from '@nimiplatform/sdk';
import { ScenarioJobStatus } from '@nimiplatform/sdk/runtime';
import { Button, InlineAlert, Surface } from '@nimiplatform/kit/ui';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import {
  arrayBufferToBase64,
  buildMusicIterationExtensions,
  copyArtifactBytesToArrayBuffer,
  scenarioJobProgressLabel,
  scenarioJobStatusLabel,
  scenarioJobStatusToGenerationStatus,
  submitMusicGenerate,
} from '../runtime-workflow.js';
import { makeId, type SongTake, type TakeOrigin } from '../types.js';

type IterationMode = Exclude<TakeOrigin, 'prompt'>;

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceTake = visibleTakes.find((take) => take.takeId === (sourceTakeId ?? selectedTake?.takeId)) ??
    selectedTake ??
    visibleTakes[0] ??
    null;
  const sourceBuffer = sourceTake ? state.audioBuffers[sourceTake.takeId] : undefined;
  const hasActiveJob = Object.keys(state.activeJobs).length > 0;
  const canSubmit = Boolean(
    brief?.description &&
    sourceTake &&
    sourceBuffer &&
    state.readiness.musicConnectorAvailable &&
    state.readiness.selectedMusicConnectorId &&
    state.readiness.selectedMusicModelId &&
    !hasActiveJob,
  );

  const resolvedStyle = styleTags.trim() ||
    sourceTake?.styleSnapshot ||
    [brief?.genre, brief?.mood].filter(Boolean).join(', ');

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !brief || !sourceTake || !sourceBuffer) return;
    setSubmitting(true);
    setError(null);
    const localJobId = makeId('job-iteration');
    setJob({ jobId: localJobId, status: 'pending', progressLabel: `Preparing ${mode}` });
    try {
      if (
        trimStartSec !== null &&
        trimEndSec !== null &&
        Number.isFinite(trimStartSec) &&
        Number.isFinite(trimEndSec) &&
        trimEndSec <= trimStartSec
      ) {
        throw new Error('Trim end must be greater than trim start.');
      }

      const runtime = getPlatformClient().runtime;
      const result = await submitMusicGenerate(runtime, {
        model: state.readiness.selectedMusicModelId!,
        connectorId: state.readiness.selectedMusicConnectorId!,
        prompt: brief.description,
        lyrics: lyrics?.text || sourceTake.lyricsSnapshot || undefined,
        style: resolvedStyle || undefined,
        title: sourceTake.title || brief.title || 'Untitled',
        durationSeconds: sourceTake.durationSeconds,
        instrumental: sourceTake.instrumental,
        extensions: buildMusicIterationExtensions({
          mode,
          sourceTakeId: sourceTake.takeId,
          sourceAudioBase64: arrayBufferToBase64(sourceBuffer),
          sourceMimeType: 'audio/mpeg',
          trimStartSec: finiteSeconds(trimStartSec),
          trimEndSec: finiteSeconds(trimEndSec),
        }),
      }, (job) => {
        removeJob(localJobId);
        setJob({
          jobId: job.jobId,
          status: scenarioJobStatusToGenerationStatus(job.status),
          progressLabel: scenarioJobProgressLabel(job),
          errorMessage: job.reasonDetail || undefined,
        });
      });

      removeJob(localJobId);
      removeJob(result.job.jobId);

      if (result.job.status !== ScenarioJobStatus.COMPLETED) {
        throw new Error(result.job.reasonDetail || scenarioJobStatusLabel(result.job.status));
      }

      const artifact = result.artifacts[0];
      const take: SongTake = {
        takeId: makeId('take'),
        parentTakeId: sourceTake.takeId,
        origin: mode,
        title: `${sourceTake.title || brief.title || 'Untitled'} - ${mode}`,
        jobId: result.job.jobId,
        artifactId: artifact?.artifactId,
        promptSnapshot: brief.description,
        lyricsSnapshot: lyrics?.text || sourceTake.lyricsSnapshot || undefined,
        styleSnapshot: resolvedStyle || undefined,
        durationSeconds: sourceTake.durationSeconds,
        instrumental: sourceTake.instrumental,
        favorite: false,
        discarded: false,
        createdAt: Date.now(),
      };
      const buffer = copyArtifactBytesToArrayBuffer(artifact?.bytes);
      addTake(take, buffer ?? undefined);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      removeJob(localJobId);
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    brief,
    lyrics,
    mode,
    sourceTake,
    sourceBuffer,
    trimStartSec,
    trimEndSec,
    resolvedStyle,
    state.readiness.selectedMusicConnectorId,
    state.readiness.selectedMusicModelId,
    addTake,
    setJob,
    removeJob,
  ]);

  if (visibleTakes.length === 0) return null;

  return (
    <Surface tone="panel" padding="md" className="overtone-section">
      <div className="overtone-section__heading">
        <h2>Iteration</h2>
      </div>

      <div className="overtone-row">
        <div className="overtone-field" style={{ flex: 1 }}>
          <label htmlFor="overtone-iteration-source">Source take</label>
          <select
            id="overtone-iteration-source"
            className="nimi-input"
            value={sourceTake?.takeId ?? ''}
            onChange={(event) => setSourceTakeId(event.target.value)}
          >
            {visibleTakes.map((take) => (
              <option key={take.takeId} value={take.takeId}>{take.title}</option>
            ))}
          </select>
        </div>
        <div className="overtone-field" style={{ flex: 1 }}>
          <label htmlFor="overtone-iteration-mode">Mode</label>
          <select
            id="overtone-iteration-mode"
            className="nimi-input"
            value={mode}
            onChange={(event) => setMode(event.target.value as IterationMode)}
          >
            <option value="extend">Extend</option>
            <option value="remix">Remix</option>
            <option value="reference">Reference</option>
          </select>
        </div>
      </div>

      <div className="overtone-field">
        <label htmlFor="overtone-iteration-style">Style override</label>
        <input
          id="overtone-iteration-style"
          className="nimi-input"
          type="text"
          value={styleTags}
          onChange={(event) => setStyleTags(event.target.value)}
          placeholder={sourceTake?.styleSnapshot || [brief?.genre, brief?.mood].filter(Boolean).join(', ')}
        />
      </div>

      <div className="overtone-row">
        <div className="overtone-field" style={{ flex: 1 }}>
          <label htmlFor="overtone-trim-start">Trim start</label>
          <input
            id="overtone-trim-start"
            className="nimi-input"
            type="number"
            min={0}
            value={trimStartSec ?? ''}
            onChange={(event) => setTrimStartSec(parseOptionalSecond(event.target.value))}
          />
        </div>
        <div className="overtone-field" style={{ flex: 1 }}>
          <label htmlFor="overtone-trim-end">Trim end</label>
          <input
            id="overtone-trim-end"
            className="nimi-input"
            type="number"
            min={0}
            value={trimEndSec ?? ''}
            onChange={(event) => setTrimEndSec(parseOptionalSecond(event.target.value))}
          />
        </div>
      </div>

      {!sourceBuffer ? (
        <InlineAlert tone="warning">
          The selected take has no decoded audio buffer in memory, so it cannot be used for iteration.
        </InlineAlert>
      ) : null}

      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

      <Button
        type="button"
        tone="primary"
        size="md"
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
      >
        {submitting || hasActiveJob ? 'Iterating...' : 'Create Child Take'}
      </Button>
    </Surface>
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
