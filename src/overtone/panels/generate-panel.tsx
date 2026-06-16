import { useMemo, useState } from 'react';
import { RuntimeGenerationPanel } from '@nimiplatform/kit/features/generation/ui';
import { useRuntimeGenerationPanel } from '@nimiplatform/kit/features/generation/runtime';
import { NumberStepper, TextField, Toggle } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import { getRuntimeNimiClient } from '../../shell/auth/runtime-platform.js';
import {
  buildMusicGenerateScenarioRequest,
  requireCompletedMusicArtifact,
  scenarioJobProgressLabel,
  scenarioJobStatusToGenerationStatus,
  type ScenarioJobStatusLabels,
  type MusicSubmitOptions,
} from '../runtime-workflow.js';
import { makeId, type SongTake } from '../types.js';

export function GeneratePanel() {
  const { t } = useTranslation();
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
  const scenarioStatusLabels = useMemo<ScenarioJobStatusLabels>(() => ({
    submitted: t('Overtone.runtime.status.submitted'),
    queued: t('Overtone.runtime.status.queued'),
    running: t('Overtone.runtime.status.running'),
    completed: t('Overtone.runtime.status.completed'),
    timeout: t('Overtone.runtime.status.timeout'),
    canceled: t('Overtone.runtime.status.canceled'),
    failed: t('Overtone.runtime.status.failed'),
  }), [t]);

  const generationInput = useMemo<MusicSubmitOptions>(() => ({
    model: readiness.selectedMusicModelId || '',
    connectorId: readiness.selectedMusicConnectorId || '',
    prompt: brief?.description || '',
    lyrics: lyrics?.text || undefined,
    style: resolvedStyle || undefined,
    title: brief?.title || t('Overtone.generate.untitled'),
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
    t,
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
      if (!brief || !project) {
        throw new Error(t('Overtone.generate.errors.projectNotReady'));
      }
      const artifact = requireCompletedMusicArtifact(result);
      const fallbackTitle = brief.title || t('Overtone.generate.untitled');
      const take: SongTake = {
        takeId: makeId('take'),
        origin: 'prompt',
        title: t('Overtone.generate.takeTitle', { title: fallbackTitle, number: project.takes.length + 1 }),
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
        <label htmlFor="overtone-style-tags">{t('Overtone.generate.styleTags')}</label>
        <TextField
          id="overtone-style-tags"
          value={styleTags}
          onChange={(event) => setStyleTags(event.target.value)}
          placeholder={brief ? [brief.genre, brief.mood].filter(Boolean).join(', ') : t('Overtone.generate.stylePlaceholder')}
        />
      </div>

      <div className="overtone-row">
        <div className="overtone-field" style={{ flex: 1 }}>
          <label htmlFor="overtone-duration">{t('Overtone.generate.duration')}</label>
          <NumberStepper
            min={10}
            max={600}
            value={durationSeconds}
            onValueChange={setDurationSeconds}
            ariaLabel={t('Overtone.generate.durationSecondsAria')}
          />
        </div>
        <div className="overtone-row overtone-toggle-row">
          <Toggle checked={instrumental} onChange={setInstrumental} />
          <span>{t('Overtone.generate.instrumental')}</span>
        </div>
      </div>
    </>
  );

  return (
    <RuntimeGenerationPanel
      runtimeState={runtimeState}
      title={t('Overtone.generate.title')}
      className="overtone-section overtone-generation-panel"
      runtimeLabel={t('Overtone.generate.runtimeLabel')}
      runtimeValue={readiness.selectedMusicConnectorId && readiness.selectedMusicModelId
        ? `${readiness.selectedMusicConnectorId} / ${readiness.selectedMusicModelId}`
        : t('Overtone.generate.runtimeNotConfigured')}
      warning={!readiness.musicConnectorAvailable
        ? t('Overtone.generate.warningNoMusicRoute')
        : null}
      controls={controls}
      submitLabel={t('Overtone.generate.submit')}
      submittingLabel={t('Overtone.generate.submitting')}
    />
  );
}
