import { useEffect, useRef, useState } from 'react';
import { ScenarioJobStatus } from '@nimiplatform/sdk/runtime/generated';
import { Button, InlineAlert, Surface, TextField } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { generateRuntimeMusic } from '../runtime-workflow.js';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import { makeId, type GenerationJob } from '../types.js';

const JOB_STATUS: Partial<Record<ScenarioJobStatus, GenerationJob['status']>> = {
  [ScenarioJobStatus.SUBMITTED]: 'pending', [ScenarioJobStatus.QUEUED]: 'pending',
  [ScenarioJobStatus.RUNNING]: 'running', [ScenarioJobStatus.COMPLETED]: 'completed',
  [ScenarioJobStatus.FAILED]: 'failed', [ScenarioJobStatus.CANCELED]: 'canceled',
  [ScenarioJobStatus.TIMEOUT]: 'timeout',
};

// @nimi-authority: rule.overtone.workflow.r004
export function GeneratePanel() {
  const { t } = useTranslation();
  const { project, readiness } = useOvertoneState();
  const { addTake, setJob, removeJob } = useOvertoneActions();
  const [styleTags, setStyleTags] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  const brief = project?.brief;
  const lyrics = project?.lyrics?.text.trim() || '';
  const canGenerate = Boolean(brief?.description.trim() && lyrics && readiness.musicCapabilityAvailable);

  useEffect(() => () => active.current?.abort(), []);

  async function generate() {
    if (!project || !brief || !canGenerate || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setGenerating(true);
    setError('');
    let jobId = '';
    const prompt = [
      brief.description.trim(),
      [brief.genre, brief.mood, brief.tempo, styleTags].map((value) => value.trim()).filter(Boolean).join(', '),
    ].filter(Boolean).join('\n');
    try {
      const result = await generateRuntimeMusic({
        client: getNimiLocalAppClient(), prompt, lyrics, signal: controller.signal,
        onJobUpdate(job) {
          if (controller.signal.aborted) return;
          const status = JOB_STATUS[job.status];
          if (!status) throw new Error('Runtime returned an invalid music job status.');
          jobId = job.jobId;
          setJob({ jobId, status });
        },
      });
      controller.signal.throwIfAborted();
      addTake({
        takeId: makeId('take'), origin: 'prompt',
        title: t('Overtone.generate.takeTitle', {
          title: brief.title || t('Overtone.generate.untitled'), number: project.takes.length + 1,
        }).slice(0, 80),
        jobId: result.jobId, artifactId: result.artifactId,
        artifactMimeType: result.mimeType, artifactByteLength: result.buffer.byteLength,
        artifactFileExtension: result.extension, durationSeconds: result.durationSeconds,
        promptSnapshot: prompt, lyricsSnapshot: lyrics, styleSnapshot: styleTags,
        favorite: false, discarded: false, createdAt: Date.now(),
      }, result.buffer);
    } catch (cause) {
      const reason = (cause as { reasonCode?: string })?.reasonCode;
      const message = cause instanceof Error ? cause.message : String(cause);
      setError([
        controller.signal.aborted ? t('Overtone.generate.cancelRequested') : '',
        reason, message,
      ].filter(Boolean).join(': '));
    } finally {
      if (jobId) removeJob(jobId);
      active.current = null;
      setGenerating(false);
    }
  }

  return (
    <Surface tone="panel" padding="md" className="overtone-section" data-testid="overtone-music-generation">
      <div className="overtone-section__heading"><h2>{t('Overtone.generate.title')}</h2></div>
      {!canGenerate && !generating ? <InlineAlert tone="warning">{t('Overtone.generate.requiredInput')}</InlineAlert> : null}
      {error ? <InlineAlert tone="warning">{error}</InlineAlert> : null}
      <div className="overtone-field">
        <label htmlFor="overtone-style-tags">{t('Overtone.generate.styleTags')}</label>
        <TextField id="overtone-style-tags" value={styleTags} disabled={generating}
          onChange={(event) => setStyleTags(event.target.value)}
          placeholder={t('Overtone.generate.stylePlaceholder')} />
      </div>
      <div className="overtone-row">
        <Button type="button" tone="primary" onClick={() => void generate()} disabled={!canGenerate || generating}>
          {generating ? t('Overtone.generate.submitting') : t('Overtone.generate.submit')}
        </Button>
        {generating ? <Button type="button" tone="secondary" onClick={() => active.current?.abort()}>
          {t('Overtone.generate.cancel')}
        </Button> : null}
      </div>
    </Surface>
  );
}
