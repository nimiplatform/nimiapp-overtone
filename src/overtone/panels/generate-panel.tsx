import { useMemo, useState } from 'react';
import { RuntimeGenerationPanel } from '@nimiplatform/kit/features/generation/ui';
import { useRuntimeGenerationPanel } from '@nimiplatform/kit/features/generation/runtime';
import { NumberStepper, TextField, Toggle } from '@nimiplatform/kit/ui';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import { getRuntimeNimiClient } from '../../shell/auth/runtime-platform.js';
import {
  buildMusicGenerateScenarioRequest,
  requireCompletedMusicArtifact,
  scenarioJobProgressLabel,
  scenarioJobStatusToGenerationStatus,
  type MusicSubmitOptions,
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

  const hasActiveJob = Object.keys(state.activeJobs).length > 0;
  const resolvedStyle = styleTags.trim() ||
    [brief?.genre, brief?.mood].filter(Boolean).join(', ');
  const runtime = useMemo(() => getRuntimeNimiClient().runtime, []);

  const generationInput = useMemo<MusicSubmitOptions>(() => ({
    model: readiness.selectedMusicModelId || '',
    connectorId: readiness.selectedMusicConnectorId || '',
    prompt: brief?.description || '',
    lyrics: lyrics?.text || undefined,
    style: resolvedStyle || undefined,
    title: brief?.title || 'Untitled',
    durationSeconds,
    instrumental,
  }), [
    readiness.selectedMusicModelId,
    readiness.selectedMusicConnectorId,
    brief?.description,
    brief?.title,
    lyrics?.text,
    resolvedStyle,
    durationSeconds,
    instrumental,
  ]);

  const canSubmit = Boolean(
    brief?.description &&
    readiness.musicConnectorAvailable &&
    readiness.selectedMusicConnectorId &&
    readiness.selectedMusicModelId &&
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
      if (!brief || !project) {
        throw new Error('Song project is not ready.');
      }
      const artifact = requireCompletedMusicArtifact(result);
      const take: SongTake = {
        takeId: makeId('take'),
        origin: 'prompt',
        title: `${brief.title || 'Untitled'} - Take ${project.takes.length + 1}`,
        jobId: result.job.jobId,
        artifactId: artifact.artifactId,
        artifactMimeType: artifact.mimeType,
        artifactByteLength: artifact.byteLength,
        artifactFileExtension: artifact.fileExtension,
        promptSnapshot: brief.description,
        lyricsSnapshot: lyrics?.text || undefined,
        styleSnapshot: resolvedStyle || undefined,
        durationSeconds: artifact.durationSeconds ?? durationSeconds,
        instrumental,
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

  const controls = (
    <>
      <div className="overtone-field">
        <label htmlFor="overtone-style-tags">Style tags</label>
        <TextField
          id="overtone-style-tags"
          value={styleTags}
          onChange={(event) => setStyleTags(event.target.value)}
          placeholder={brief ? [brief.genre, brief.mood].filter(Boolean).join(', ') : 'indie, dreamy, acoustic'}
        />
      </div>

      <div className="overtone-row">
        <div className="overtone-field" style={{ flex: 1 }}>
          <label htmlFor="overtone-duration">Duration</label>
          <NumberStepper
            min={10}
            max={600}
            value={durationSeconds}
            onValueChange={setDurationSeconds}
            ariaLabel="Duration seconds"
          />
        </div>
        <div className="overtone-row overtone-toggle-row">
          <Toggle checked={instrumental} onChange={setInstrumental} />
          <span>Instrumental</span>
        </div>
      </div>
    </>
  );

  return (
    <RuntimeGenerationPanel
      runtimeState={runtimeState}
      title="Generation"
      className="overtone-section overtone-generation-panel"
      runtimeLabel="Music route"
      runtimeValue={readiness.selectedMusicConnectorId && readiness.selectedMusicModelId
        ? `${readiness.selectedMusicConnectorId} / ${readiness.selectedMusicModelId}`
        : 'not configured'}
      warning={!readiness.musicConnectorAvailable
        ? 'No music connector/model pair is ready. Configure runtime music access before generating.'
        : null}
      controls={controls}
      submitLabel="Generate Song"
      submittingLabel="Generating..."
    />
  );
}
