import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, IconToggleAction, InlineAlert, NimiText, NumberStepper, SegmentedControl, Slider, Surface } from '@nimiplatform/kit/ui';
import { openNimiLocalAppAssetMediaUrl } from '@nimiplatform/kit/shell/renderer/bridge';
import { useTranslation } from 'react-i18next';
import { useAudioCache, useAudioSnapshot, useOvertonePlayback, useOvertoneState } from '../store.js';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { loadProjectAudio } from '../runtime-workflow.js';
import { renderProjectMix } from '../pcm-media.js';
import { makeId, type ProjectAudio } from '../types.js';
import { persistOvertoneVolume, resolveInitialOvertoneVolume } from '../volume-preference.js';
import { formatAudioTime } from '../exploration.js';
import { Waveform } from './waveform.js';
import { OvertoneIcon } from './icons.js';

// @nimi-authority: rule.overtone.ia.r006
// @nimi-authority: rule.overtone.data-model.r005
export function PlayerPanel({ openMedia = openNimiLocalAppAssetMediaUrl }: { openMedia?: typeof openNimiLocalAppAssetMediaUrl } = {}) {
  const { t } = useTranslation();
  const state = useOvertoneState(); const cache = useAudioCache(); const playback = useOvertonePlayback();
  const selectedTake = state.project?.takes.find(take => take.takeId === state.project?.selectedTakeId && !take.discarded) ?? null;
  const media = useAudioSnapshot(selectedTake?.audio.relativePath ?? '');
  const [isPlaying, setIsPlaying] = useState(false); const [ready, setReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadingAudio, setLoadingAudio] = useState(false); const [audioError, setAudioError] = useState('');
  const [audioRetry, setAudioRetry] = useState(0); const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<{ sourceTakeId: string; audio: ProjectAudio } | null>(null);
  const [volume, setVolume] = useState(resolveInitialOvertoneVolume); const [speed, setSpeed] = useState(1); const [loop, setLoop] = useState(false);
  const [trim, setTrim] = useState<{ takeId: string; start: number | null; end: number | null } | null>(null);
  const trimStartSec = trim?.takeId === selectedTake?.takeId ? trim?.start ?? null : null;
  const trimEndSec = trim?.takeId === selectedTake?.takeId ? trim?.end ?? null : null;
  const duration = selectedTake ? selectedTake.audio.frameCount / selectedTake.audio.sampleRateHz : 0;
  const trimStart = Math.max(0, Math.min(trimStartSec ?? 0, duration));
  const trimEnd = Math.max(0, Math.min(trimEndSec ?? duration, duration));
  const trimInvalid = duration > 0 && trimEnd <= trimStart;
  const bounds = useRef({ start: trimStart, end: trimEnd }); bounds.current = { start: trimStart, end: trimEnd };
  const elementRef = useRef<HTMLAudioElement | null>(null);
  const volumeRef = useRef(volume); const speedRef = useRef(speed); const loopRef = useRef(loop);
  const consumedRequest = useRef(0); const frameRef = useRef(0);
  const exportController = useRef<AbortController | null>(null);

  const stopPlayback = useCallback(() => {
    cancelAnimationFrame(frameRef.current); elementRef.current?.pause(); setIsPlaying(false);
  }, []);
  const position = useCallback(() => Math.min(bounds.current.end, Math.max(bounds.current.start, elementRef.current?.currentTime ?? 0)), []);
  useEffect(() => { setTrim(null); setAudioError(''); }, [selectedTake?.takeId]);
  useEffect(() => { cache.pin(selectedTake?.audio.relativePath ?? null); return () => cache.pin(null); }, [cache, selectedTake?.audio.relativePath]);

  useEffect(() => {
    stopPlayback(); setReady(false); setCurrentTime(0); setAudioError('');
    if (!selectedTake) { setLoadingAudio(false); return; }
    const controller = new AbortController(); const element = new Audio(); elementRef.current = element;
    element.preload = 'metadata'; element.volume = volumeRef.current / 100; element.playbackRate = speedRef.current;
    setLoadingAudio(true);
    let handle: Awaited<ReturnType<typeof openMedia>> | undefined;
    let refresh: ReturnType<typeof setTimeout> | undefined;
    let loadDeadline: ReturnType<typeof setTimeout> | undefined;
    let restoreTime = 0; let restorePlaying = false;
    const fail = (error: unknown) => {
      if (controller.signal.aborted) return;
      element.pause(); setReady(false); setLoadingAudio(false); setAudioError(String(error));
    };
    const sync = () => {
      const { start, end } = bounds.current;
      if (element.currentTime >= end && end > start) {
        if (loopRef.current) { element.currentTime = start; void element.play().catch(fail); }
        else element.pause();
      }
      setCurrentTime(Math.min(end, element.currentTime)); setIsPlaying(!element.paused);
      if (!element.paused) frameRef.current = requestAnimationFrame(sync);
    };
    element.addEventListener('timeupdate', () => { cancelAnimationFrame(frameRef.current); sync(); });
    element.addEventListener('play', () => { setIsPlaying(true); cancelAnimationFrame(frameRef.current); frameRef.current = requestAnimationFrame(sync); });
    element.addEventListener('pause', () => { setIsPlaying(false); cancelAnimationFrame(frameRef.current); });
    element.addEventListener('ended', sync);
    element.addEventListener('error', () => fail(new Error('OVERTONE_MEDIA_PLAYBACK_FAILED')));
    element.addEventListener('loadedmetadata', () => {
      clearTimeout(loadDeadline);
      if (controller.signal.aborted) return;
      if (!Number.isFinite(element.duration) || Math.abs(element.duration - duration) > 0.002) { fail(new Error('OVERTONE_AUDIO_FACTS_CHANGED')); return; }
      element.currentTime = Math.max(bounds.current.start, Math.min(restoreTime, bounds.current.end));
      setReady(true); setLoadingAudio(false);
      if (restorePlaying) void element.play().catch(fail);
    });
    const open = async (renew = false) => {
      const cached = await loadProjectAudio({ client: getNimiLocalAppClient(), cache, audio: selectedTake.audio, signal: controller.signal });
      if (cached.sha256 !== selectedTake.audio.sha256) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
      const fresh = await openMedia(selectedTake.audio.relativePath);
      if (controller.signal.aborted) { await fresh.revoke(); return; }
      restoreTime = renew ? element.currentTime : 0; restorePlaying = renew && !element.paused;
      setReady(false); element.pause(); const previous = handle; handle = fresh;
      element.src = fresh.url; element.load();
      if (previous) await previous.revoke();
      loadDeadline = setTimeout(() => fail(new Error('OVERTONE_AUDIO_READ_TIMEOUT')), 30_000);
      // Renew the technical handle before its ten-minute expiry; never replay AI work.
      refresh = setTimeout(() => { void open(true).catch(fail); }, 9 * 60_000);
    };
    void open().catch(fail);
    return () => {
      controller.abort(); clearTimeout(refresh); clearTimeout(loadDeadline); cancelAnimationFrame(frameRef.current);
      element.pause(); element.removeAttribute('src'); element.load(); if (elementRef.current === element) elementRef.current = null;
      if (handle) void handle.revoke().catch(() => undefined);
    };
  }, [selectedTake?.takeId, audioRetry, cache, openMedia, duration, position, stopPlayback]);

  useEffect(() => () => {
    exportController.current?.abort();
  }, []);
  const startPlayback = useCallback((offset?: number) => {
    const element = elementRef.current; if (!ready || !element || element.readyState < 1 || bounds.current.end <= bounds.current.start) return false;
    const { start, end } = bounds.current;
    element.currentTime = Math.max(start, Math.min(offset ?? (element.currentTime >= end ? start : element.currentTime), end));
    void element.play().catch(error => setAudioError(String(error))); return true;
  }, [ready]);
  const handlePlayPause = useCallback(() => {
    const element = elementRef.current; if (element && !element.paused) stopPlayback(); else startPlayback();
  }, [startPlayback, stopPlayback]);
  const handleSeek = useCallback((time: number) => {
    const element = elementRef.current; if (!ready || !element) return;
    element.currentTime = Math.max(bounds.current.start, Math.min(bounds.current.end, time)); setCurrentTime(element.currentTime);
  }, [ready]);
  useEffect(() => {
    playback.registerController({ togglePlayback: handlePlayPause, seekBy: delta => handleSeek(position() + delta), getPosition: position });
    return () => playback.registerController(null);
  }, [playback, handlePlayPause, handleSeek, position]);
  useEffect(() => {
    const request = playback.request;
    if (request && request.takeId === selectedTake?.takeId && request.serial !== consumedRequest.current
      && startPlayback(request.offset < bounds.current.end ? Math.max(bounds.current.start, request.offset) : bounds.current.start)) consumedRequest.current = request.serial;
  }, [ready, playback.request, selectedTake?.takeId, startPlayback]);
  useEffect(() => { playback.reportPlaying(isPlaying ? selectedTake?.takeId ?? null : null); }, [isPlaying, selectedTake?.takeId, playback.reportPlaying]);
  useEffect(() => () => playback.reportPlaying(null), [playback.reportPlaying]);
  function changeSpeed(value: string) {
    const next = Number(value); if (![.75, 1, 1.25].includes(next)) return;
    speedRef.current = next; setSpeed(next); if (elementRef.current) elementRef.current.playbackRate = next;
  }
  function toggleLoop() { loopRef.current = !loopRef.current; setLoop(loopRef.current); }
  function trimChange(value: number, edge: 'start' | 'end') {
    if (!selectedTake) return; stopPlayback();
    const aligned = Math.floor(value * selectedTake.audio.sampleRateHz) / selectedTake.audio.sampleRateHz;
    setTrim({ takeId: selectedTake.takeId, start: edge === 'start' ? aligned : trimStartSec, end: edge === 'end' ? aligned : trimEndSec });
  }
  async function exportAudio(trimmed: boolean) {
    if (!selectedTake || !ready || exporting || (trimmed && trimInvalid)) return;
    const controller = new AbortController(); exportController.current = controller; setExporting(true); setAudioError('');
    try {
      let audio = selectedTake.audio;
      if (trimmed) {
        const sourceStartFrame = Math.floor(trimStart * audio.sampleRateHz), sourceEndFrame = Math.min(audio.frameCount, Math.floor(trimEnd * audio.sampleRateHz));
        const result = await renderProjectMix({ client: getNimiLocalAppClient(), tracks: [{ audio, gain: 1, startFrame: 0, sourceStartFrame, sourceEndFrame }],
          output: { sampleRateHz: audio.sampleRateHz, channels: audio.channels as 1 | 2, frameCount: sourceEndFrame - sourceStartFrame },
          relativePath: 'music/exports/' + makeId('trim') + '.wav', signal: controller.signal });
        audio = result.audio;
      }
      controller.signal.throwIfAborted();
      if (trimmed) setLastExport({ sourceTakeId: selectedTake.takeId, audio });
      else await getNimiLocalAppClient().storage.assets.reveal(audio.relativePath);
    } catch (error) { if (!controller.signal.aborted) setAudioError(String(error)); }
    finally { if (exportController.current === controller) { exportController.current = null; setExporting(false); } }
  }
  async function exportTrack(audio: ProjectAudio) {
    if (!selectedTake || exporting) return;
    const controller = new AbortController(); exportController.current = controller; setExporting(true); setAudioError('');
    try {
      const result = await renderProjectMix({ client: getNimiLocalAppClient(), tracks: [{ audio, gain: 1, startFrame: 0, sourceStartFrame: 0, sourceEndFrame: audio.frameCount }],
        output: { sampleRateHz: audio.sampleRateHz, channels: audio.channels as 1 | 2, frameCount: audio.frameCount },
        relativePath: 'music/exports/' + makeId('export') + '.wav', signal: controller.signal });
      controller.signal.throwIfAborted();
      setLastExport({ sourceTakeId: selectedTake.takeId, audio: result.audio });
      await getNimiLocalAppClient().storage.assets.reveal(result.audio.relativePath);
    } catch (error) { if (!controller.signal.aborted) setAudioError(String(error)); }
    finally { if (exportController.current === controller) { exportController.current = null; setExporting(false); } }
  }
  const derivation = selectedTake && selectedTake.origin === 'runtime-result' && selectedTake.capability === 'audio.voice.convert' ? selectedTake.derivation : null;
  // The accompaniment and mix run on the song timeline; the converted vocal
  // starts at its recorded placement. A discarded or missing track stays
  // listed but cannot be selected for playback.
  const voiceTracks = derivation && selectedTake ? [
    { key: 'trackVocal', takeId: selectedTake.takeId, audio: selectedTake.audio, startSeconds: derivation.mix.vocalStartFrame / derivation.mixDomain.sampleRateHz },
    { key: 'trackAccompaniment', takeId: derivation.retainedAccompanimentTakeId, audio: derivation.retainedAccompaniment, startSeconds: 0 },
    ...((() => { const mix = state.project?.takes.find(take => take.takeId === derivation.mix.mixTakeId); return mix ? [{ key: 'trackMix', takeId: derivation.mix.mixTakeId, audio: mix.audio, startSeconds: 0 }] : []; })()),
  ].map(track => ({ ...track, playable: state.project?.takes.some(take => take.takeId === track.takeId && !take.discarded) ?? false })) : null;
  const currentTrack = voiceTracks?.find(track => track.takeId === selectedTake?.takeId);
  // Carry the listening position across tracks through the song timeline; a
  // position outside the target track starts it from its beginning.
  const trackPosition = (target: { startSeconds: number; audio: { durationMs: number } }) => (seconds: number) => {
    const local = seconds + (currentTrack?.startSeconds ?? 0) - target.startSeconds;
    return local >= 0 && local < target.audio.durationMs / 1000 ? local : 0;
  };

  return <Surface material="solid" tone="panel" elevation="base" padding="none" className="overtone-transport" data-testid="overtone-transport">
    <div className="overtone-transport__main">
      <div className="overtone-transport__identity"><strong>{selectedTake?.title || t('Overtone.playground.waitingAudio')}</strong>
        <span>{t(!selectedTake ? 'Overtone.studio.emptyPlayer' : isPlaying ? 'Overtone.playground.playing' : 'Overtone.playground.selectedRecording')}</span></div>
      <div className="overtone-transport__controls">
        <IconToggleAction className="ot-main-play" icon={isPlaying ? <PauseIcon /> : <PlayIcon />} active={isPlaying} onClick={handlePlayPause}
          disabled={!ready || trimInvalid} aria-label={isPlaying ? t('Overtone.player.pause') : t('Overtone.player.play')} />
        <Button tone={loop ? 'primary' : 'ghost'} size="sm" onClick={toggleLoop} disabled={!ready || trimInvalid} aria-label={t('Overtone.playground.loop')} aria-pressed={loop}><OvertoneIcon name="loop" /></Button>
      </div>
      <Waveform peaks={media?.peaks} currentTime={currentTime} duration={duration} trimStart={trimStartSec} trimEnd={trimEndSec} onSeek={handleSeek} />
      <div className="overtone-transport__meta">
        <NimiText as="span" role="caption" className="overtone-transport__time">{formatAudioTime(currentTime)} / {formatAudioTime(duration)}</NimiText>
        <Slider value={volume} min={0} max={100} className="overtone-volume" aria-label={t('Overtone.player.volumeAria')}
          onChange={(event) => { const next = Number(event.target.value); volumeRef.current = next; setVolume(next); persistOvertoneVolume(next); if (elementRef.current) elementRef.current.volume = next / 100; }} />
      </div>
    </div>
    {loadingAudio ? <NimiText role="helper">{t('Overtone.player.loadingAudio')}</NimiText> : null}
    {audioError ? <InlineAlert tone="warning">{t('Overtone.player.audioUnavailable', { message: audioError === 'OVERTONE_AUDIO_READ_TIMEOUT' ? t('Overtone.player.loadTimeout') : audioError })}<Button tone="ghost" size="sm" onClick={() => setAudioRetry((value) => value + 1)}>{t('Overtone.player.retryAudio')}</Button></InlineAlert> : null}
    {selectedTake ? <div className="overtone-transport__extras">
      {voiceTracks ? <div className="overtone-row" role="group" aria-label={t('Overtone.voiceConvert.tracks')} data-testid="voice-convert-tracks">
        {voiceTracks.map(track => <span key={track.takeId} className="overtone-row">
          <Button tone={track.takeId === selectedTake.takeId ? 'primary' : 'ghost'} size="sm" disabled={!track.playable}
            aria-label={t('Overtone.playground.playTake', { title: t(`Overtone.voiceConvert.${track.key}`) })}
            onClick={() => playback.requestTake(track.takeId, trackPosition(track))}><OvertoneIcon name="play" size={14} />{t(`Overtone.voiceConvert.${track.key}`)}</Button>
          {track.playable ? null : <NimiText as="span" role="caption">{t('Overtone.voiceConvert.trackDiscarded')}</NimiText>}
          <Button tone="ghost" size="sm" loading={exporting} disabled={exporting} onClick={() => void exportTrack(track.audio)}>{t('Overtone.voiceConvert.exportTrack')}</Button>
        </span>)}
      </div> : null}
      <div className="overtone-row"><NimiText role="caption">{t('Overtone.playground.speed')}</NimiText>
        <SegmentedControl size="sm" ariaLabel={t('Overtone.playground.speed')} value={String(speed)} onValueChange={changeSpeed}
          items={[{ value: '0.75', label: '0.75×' }, { value: '1', label: '1×' }, { value: '1.25', label: '1.25×' }]} /></div>
      <details><summary>{t('Overtone.playground.trim')}</summary>
        <div className="overtone-trim-controls">
          <div className="ot-trim-field"><NimiText as="span" role="caption">{t('Overtone.player.trimStartAria')}</NimiText>
          <NumberStepper ariaLabel={t('Overtone.player.trimStartAria')} decreaseLabel={t('Overtone.player.trimStartDecreaseAria')} increaseLabel={t('Overtone.player.trimStartIncreaseAria')}
            min={0} max={duration} step={1} value={Math.round(trimStart * 1000) / 1000} onValueChange={(value) => trimChange(value, 'start')} disabled={!ready} /></div>
          <div className="ot-trim-field"><NimiText as="span" role="caption">{t('Overtone.player.trimEndAria')}</NimiText>
          <NumberStepper ariaLabel={t('Overtone.player.trimEndAria')} decreaseLabel={t('Overtone.player.trimEndDecreaseAria')} increaseLabel={t('Overtone.player.trimEndIncreaseAria')}
            min={0} max={duration} step={1} value={Math.round(trimEnd * 1000) / 1000} onValueChange={(value) => trimChange(value, 'end')} disabled={!ready} /></div>
          <Button tone="ghost" size="sm" disabled={!ready} onClick={() => { stopPlayback(); setTrim(null); }}>{t('Overtone.player.clearTrim')}</Button>
          <Button tone="secondary" size="sm" loading={exporting} disabled={!ready || trimInvalid || exporting} onClick={() => void exportAudio(true)}>{t('Overtone.playground.exportTrim')}</Button>
          {exporting ? <Button tone="ghost" size="sm" onClick={() => exportController.current?.abort()}>{t('Overtone.takes.cancel')}</Button> : null}
          {lastExport?.sourceTakeId === selectedTake.takeId ? <Button tone="secondary" size="sm" onClick={() => void getNimiLocalAppClient().storage.assets.reveal(lastExport.audio.relativePath).catch(error => setAudioError(String(error)))}>{t('Overtone.playground.openExport')}</Button> : null}
        </div>
        <NimiText role="caption" className="ot-trim-hint">{t('Overtone.playground.exportHint')}</NimiText>
      </details>
      <Button tone="ghost" size="sm" disabled={!ready || exporting} onClick={() => void exportAudio(false)}><OvertoneIcon name="download" size={15} />{t('Overtone.playground.exportOriginal')}</Button>
    </div> : null}
    {trimInvalid ? <NimiText role="helper" className="overtone-trim-error">{t('Overtone.player.invalidTrim')}</NimiText> : null}
  </Surface>;
}

function PlayIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>; }
function PauseIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>; }
