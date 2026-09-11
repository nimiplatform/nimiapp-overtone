import { useEffect, useRef, useState } from 'react';
import { ScenarioJobStatus, ScenarioType } from '@nimiplatform/sdk/runtime/generated';
import { Button, FieldShell, InlineAlert, NimiText, TextField } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { generateRuntimeMusic, SKETCH_DURATION_SECONDS } from '../runtime-workflow.js';
import { useOvertoneActions, useOvertoneState, useAudioCache } from '../store.js';
import { makeId, type GenerationJob, type RecoverableMusicResult } from '../types.js';
import { buildMusicPrompt, musicInputValid } from '../exploration.js';
import { useExploration, useMusicIntent } from '../exploration-context.js';
import { OvertoneIcon } from './icons.js';
import { fullSongDraftValid, fullSongInput, songFallsShort } from '../full-song.js';

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
  const { addTake, selectTake, setJob, removeJob, rememberResult } = useOvertoneActions();
  const creative = useExploration();
  const intent = useMusicIntent();
  const cache = useAudioCache();
  const [styleTags, setStyleTags] = useState('');
  const { musicBusy: generating, setMusicBusy: setGenerating } = creative;
  const [submittedTitle, setSubmittedTitle] = useState('');
  const [error, setError] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [failedResultId, setFailedResultId] = useState('');
  const [notice, setNotice] = useState('');
  const active = useRef<AbortController | null>(null);
  const brief = project?.brief;
  const song = creative.stage === 'song' ? project?.fullSong : null;
  const songValid = !!song && fullSongDraftValid(song);
  const songInput = song ? fullSongInput(song) : null;
  const lyrics = songInput?.lyrics ?? (project?.lyrics?.text.trim() || '');
  const prompt = songInput?.prompt ?? (brief ? buildMusicPrompt(brief, styleTags, intent.energy, intent.surprise) : '');
  const hasRecoverable = project?.recoverableResults?.some(result => result.promptSnapshot === prompt && result.lyricsSnapshot === lyrics) ?? false;
  const canGenerate = Boolean(musicInputValid(prompt, lyrics) && readiness.musicCapabilityAvailable
    && (song ? songValid && !creative.songCandidate && !creative.arranging : !creative.ideaDirty));
  const nextExplore = !generating && creative.ideaDirty && !creative.proposalsCurrent;
  const nextApply = !generating && creative.proposalsCurrent && creative.chosen !== creative.focusedDirection;
  const focusedTitle = creative.directions[creative.focusedDirection]?.brief.title;
  const errorMessage = failedResultId
    ? project?.recoverableResults?.some(result => result.jobId === failedResultId) ? t('Overtone.recovery.failedAfterGeneration') : ''
    : error;

  useEffect(() => () => active.current?.abort(), []);

  async function generate() {
    if (!project || !canGenerate || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setGenerating(true);
    const title = song?.title || brief?.title || t('Overtone.playground.ownDirection');
    const durationSeconds = song?.durationSeconds ?? SKETCH_DURATION_SECONDS;
    setSubmittedTitle(title);
    setError('');
    setFailedResultId('');
    setErrorDetail('');
    setNotice('');
    let jobId = '';
    let completed = false;
    const submission: Omit<RecoverableMusicResult, 'jobId'> = {
      title: t(song ? 'Overtone.song.takeTitle' : 'Overtone.generate.takeTitle', { title, number: project.takes.length + (project.recoverableResults?.length ?? 0) + 1 }).slice(0,80),
      parentTakeId: song?.sourceTakeId ?? creative.parentTakeId, promptSnapshot: prompt, lyricsSnapshot: lyrics, styleSnapshot: song ? undefined : styleTags,
      targetDurationSeconds: durationSeconds, creationMode: song ? 'song' : 'sketch', createdAt: Date.now(),
    };
    try {
      const result = await generateRuntimeMusic({
        client: getNimiLocalAppClient(), cache, prompt, lyrics, durationSeconds, signal: controller.signal,
        onJobUpdate(job) {
          const status = JOB_STATUS[job.status];
          jobId = job.jobId;
          if (status === 'completed' && job.scenarioType === ScenarioType.MUSIC_GENERATE) {
            completed = true;
            rememberResult({ ...submission, jobId }, project.projectId);
          }
          if (controller.signal.aborted) return;
          if (!status || job.scenarioType !== ScenarioType.MUSIC_GENERATE) { setError(t('Overtone.generate.invalidStatus')); controller.abort(); return; }
          setJob({ jobId, status });
        },
      });
      controller.signal.throwIfAborted();
      const takeId = makeId('take');
      addTake({ ...submission, takeId, origin: 'prompt', jobId: result.jobId, artifactId: result.artifactId,
        artifactMimeType: result.mimeType, artifactByteLength: result.buffer.byteLength, artifactFileExtension: result.extension, durationSeconds: result.durationSeconds,
        favorite: false, discarded: false });
      selectTake(takeId);
      if (song) setNotice(t(songFallsShort(result.durationSeconds, durationSeconds) ? 'Overtone.song.shortResultNotice' : 'Overtone.song.readyNotice', {
        actual: Math.round(result.durationSeconds), target: durationSeconds,
      }));
      requestAnimationFrame(() => document.querySelector('.overtone-takes-stack')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (cause) {
      const reason = (cause as { reasonCode?: string })?.reasonCode;
      const message = cause instanceof Error ? cause.message : String(cause);
      const actionHint = (cause as { actionHint?: string })?.actionHint;
      if (!controller.signal.aborted) setErrorDetail([reason, actionHint, message !== reason ? message : ''].filter(Boolean).join(' · '));
      if (completed) setFailedResultId(jobId);
      if (!controller.signal.aborted) setError([
        controller.signal.aborted ? t('Overtone.generate.cancelRequested') : '',
        completed ? t('Overtone.recovery.failedAfterGeneration') : reason === 'ai-media-option-unsupported' ? t('Overtone.playground.musicRejected') : message,
      ].filter(Boolean).join(': '));
    } finally {
      if (jobId) removeJob(jobId);
      active.current = null;
      setGenerating(false);
    }
  }

  if (song) return <section className="overtone-generate ot-song-generate" data-testid="overtone-music-generation">
    <div className="ot-generation-draft"><p className="overtone-generate__target">{generating ? t('Overtone.song.renderingTarget', { title: submittedTitle }) : t('Overtone.song.generationTarget', { title: song.title })}</p>
      <NimiText role="helper">{t(generating ? 'Overtone.song.renderingHint' : !song.sections.length && !readiness.textCapabilityAvailable ? 'Overtone.song.textSetup' : song.sections.length && !songValid ? 'Overtone.song.incompleteDraft' : !readiness.musicCapabilityAvailable ? 'Overtone.playground.musicSetup' : 'Overtone.song.durationHint')}</NimiText>
      {notice ? <p className="ot-song-result-notice" role="status">{notice}</p> : null}
      {errorMessage ? <InlineAlert tone="warning">{errorMessage}{errorDetail ? <details><summary>{t('Overtone.playground.errorDetails')}</summary>{errorDetail}</details> : null}</InlineAlert> : null}
    </div>
    <div className="overtone-row"><Button tone={hasRecoverable ? 'secondary' : 'primary'} className="ot-generate-button" data-next-action={!song.sections.length ? 'arrange-song' : 'generate-song'}
      loading={generating || creative.arranging} disabled={generating || creative.arranging || (!song.sections.length ? !readiness.textCapabilityAvailable : !canGenerate)}
      onClick={() => { if (!song.sections.length) void creative.arrangeSong(); else void generate(); }} leadingIcon={<OvertoneIcon name="music"/>}>
      {t(generating ? 'Overtone.song.rendering' : creative.arranging ? 'Overtone.song.arranging' : !song.sections.length ? 'Overtone.song.arrange' : 'Overtone.song.generate')}
    </Button>{creative.arranging ? <Button tone="secondary" onClick={creative.cancelSongArrangement}>{t('Overtone.text.cancel')}</Button> : null}{generating ? <Button tone="secondary" onClick={() => { active.current?.abort(); setError(t('Overtone.generate.cancelRequested')); }}>{t('Overtone.generate.cancel')}</Button> : null}</div>
  </section>;

  return (
    <section className="overtone-generate" id="overtone-generate-panel" data-testid="overtone-music-generation">
      <div className="ot-generation-draft">
      {nextApply ? <p className="overtone-generate__target">{t('Overtone.studio.applyTarget', { title: focusedTitle })}</p>
        : brief ? <p className="overtone-generate__target">{t('Overtone.playground.generationTarget', { title: generating ? submittedTitle : brief.title || t('Overtone.playground.ownDirection') })}</p> : null}
      {nextExplore ? <div className="ot-generation-note"><NimiText role="helper">{t('Overtone.studio.unappliedShort')}</NimiText>
        <Button tone="ghost" size="sm" onClick={creative.restoreAppliedIdea}>{t('Overtone.playground.keepDirection')}</Button></div>
        : !nextApply && !canGenerate && !generating ? <NimiText role="helper">{t(!readiness.musicCapabilityAvailable ? 'Overtone.playground.musicSetup' : !brief?.description.trim() ? 'Overtone.playground.needDirection' : !lyrics ? 'Overtone.playground.needLyrics' : 'Overtone.playground.invalidInput')}</NimiText> : null}
      {errorMessage ? <InlineAlert tone="warning">{errorMessage}{errorDetail ? <details><summary>{t('Overtone.playground.errorDetails')}</summary>{errorDetail}</details> : null}</InlineAlert> : null}
      <div className="ot-generation-tools"><Button className="ot-tool-button" tone="ghost" size="sm" aria-expanded={creative.notesOpen} aria-controls="ot-notebook" leadingIcon={<OvertoneIcon name="notes" size={15} />} onClick={() => creative.setNotesOpen(!creative.notesOpen)}>{t('Overtone.studio.editDraft')}</Button>
      <details className="overtone-style-details"><summary>{t('Overtone.generate.styleTags')}</summary><FieldShell label={t('Overtone.generate.styleTags')}>
        <TextField id="overtone-style-tags" value={styleTags} disabled={generating}
          onChange={(event) => setStyleTags(event.target.value)}
          maxLength={400} placeholder={t('Overtone.generate.stylePlaceholder')} />
      </FieldShell></details>
      </div></div>
      <div className="overtone-row">
        <Button type="button" tone={hasRecoverable && !nextExplore && !nextApply ? 'secondary' : 'primary'} className="ot-generate-button" data-next-action={nextExplore ? 'explore' : nextApply ? 'apply' : 'generate'} loading={generating || (nextExplore && creative.exploring)}
          onClick={() => { if (nextExplore) void creative.explore(); else if (nextApply) creative.chooseDirection(creative.focusedDirection); else void generate(); }}
          disabled={generating || (nextExplore ? creative.exploring || !creative.idea.trim() || !readiness.textCapabilityAvailable : nextApply ? creative.exploring : !canGenerate)}>
          <OvertoneIcon name={nextExplore ? 'spark' : nextApply ? 'arrow' : 'music'} />
          {t(generating ? 'Overtone.generate.submitting' : nextExplore ? 'Overtone.playground.explore' : nextApply ? 'Overtone.studio.applyNext' : 'Overtone.generate.submit')}
        </Button>
        {generating ? <Button type="button" tone="secondary" onClick={() => { active.current?.abort(); setError(t('Overtone.generate.cancelRequested')); }}>
          {t('Overtone.generate.cancel')}
        </Button> : null}
      </div>
    </section>
  );
}
