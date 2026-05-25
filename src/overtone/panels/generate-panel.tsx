import { useCallback, useState } from 'react';
import { getPlatformClient } from '@nimiplatform/sdk';
import { ScenarioJobStatus } from '@nimiplatform/sdk/runtime';
import { Button, InlineAlert, Surface, Toggle } from '@nimiplatform/kit/ui';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import {
  copyArtifactBytesToArrayBuffer,
  scenarioJobProgressLabel,
  scenarioJobStatusLabel,
  scenarioJobStatusToGenerationStatus,
  submitMusicGenerate,
} from '../runtime-workflow.js';
import { makeId, type SongTake } from '../types.js';

export function GeneratePanel() {
  const state = useOvertoneState();
  const { addTake, setJob, removeJob } = useOvertoneActions();
  const project = state.project;
  const brief = project?.brief ?? null;
  const lyrics = project?.lyrics ?? null;
  const { readiness } = state;

  const [durationSeconds, setDurationSeconds] = useState(120);
  const [instrumental, setInstrumental] = useState(false);
  const [styleTags, setStyleTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasActiveJob = Object.keys(state.activeJobs).length > 0;
  const canSubmit = Boolean(
    brief?.description &&
    readiness.musicConnectorAvailable &&
    readiness.selectedMusicConnectorId &&
    readiness.selectedMusicModelId &&
    !hasActiveJob,
  );

  const resolvedStyle = styleTags.trim() ||
    [brief?.genre, brief?.mood].filter(Boolean).join(', ');

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !brief) return;
    setSubmitting(true);
    setError(null);
    const localJobId = makeId('job-pending');
    setJob({ jobId: localJobId, status: 'pending', progressLabel: 'Submitting...' });
    try {
      const runtime = getPlatformClient().runtime;
      const result = await submitMusicGenerate(runtime, {
        model: readiness.selectedMusicModelId!,
        connectorId: readiness.selectedMusicConnectorId!,
        prompt: brief.description,
        lyrics: lyrics?.text || undefined,
        style: resolvedStyle || undefined,
        title: brief.title || 'Untitled',
        durationSeconds,
        instrumental,
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
        origin: 'prompt',
        title: `${brief.title || 'Untitled'} · Take ${project!.takes.length + 1}`,
        jobId: result.job.jobId,
        artifactId: artifact?.artifactId,
        promptSnapshot: brief.description,
        lyricsSnapshot: lyrics?.text || undefined,
        styleSnapshot: resolvedStyle || undefined,
        durationSeconds,
        instrumental,
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
    durationSeconds,
    instrumental,
    resolvedStyle,
    readiness.selectedMusicConnectorId,
    readiness.selectedMusicModelId,
    addTake,
    setJob,
    removeJob,
    project,
  ]);

  return (
    <Surface tone="panel" padding="md" className="overtone-section">
      <div className="overtone-section__heading">
        <h2>Generation</h2>
      </div>

      <div className="overtone-field">
        <label htmlFor="overtone-style-tags">Style tags</label>
        <input
          id="overtone-style-tags"
          className="nimi-input"
          type="text"
          value={styleTags}
          onChange={(event) => setStyleTags(event.target.value)}
          placeholder={brief ? [brief.genre, brief.mood].filter(Boolean).join(', ') : 'e.g. indie, dreamy, acoustic'}
        />
      </div>

      <div className="overtone-row">
        <div className="overtone-field" style={{ flex: 1 }}>
          <label htmlFor="overtone-duration">Duration (sec)</label>
          <input
            id="overtone-duration"
            className="nimi-input"
            type="number"
            min={10}
            max={600}
            value={durationSeconds}
            onChange={(event) => setDurationSeconds(Number(event.target.value) || 0)}
          />
        </div>
        <div className="overtone-row" style={{ alignItems: 'center', gap: 8 }}>
          <Toggle checked={instrumental} onChange={setInstrumental} />
          <span style={{ fontSize: 13, color: 'var(--nimi-text-secondary)' }}>Instrumental</span>
        </div>
      </div>

      {!readiness.musicConnectorAvailable ? (
        <InlineAlert tone="warning">
          No music connector/model pair is ready. Configure runtime music access before generating.
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
        {submitting || hasActiveJob ? 'Generating...' : 'Generate Song'}
      </Button>
    </Surface>
  );
}
