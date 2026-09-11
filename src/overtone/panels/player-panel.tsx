import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, IconToggleAction, InlineAlert, NimiText, NumberStepper, SegmentedControl, Slider, Surface } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useAudioCache, useAudioSnapshot, useOvertonePlayback, useOvertoneState } from '../store.js';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { loadRuntimeMusicArtifact } from '../runtime-workflow.js';
import { persistOvertoneVolume, resolveInitialOvertoneVolume } from '../volume-preference.js';
import { formatAudioTime } from '../exploration.js';
import { downloadAudio, encodeTrimmedWav } from '../audio-export.js';
import { Waveform } from './waveform.js';
import { OvertoneIcon } from './icons.js';

// @nimi-authority: rule.overtone.ia.r006
// @nimi-authority: rule.overtone.exploration.r003
export function PlayerPanel() {
  const { t } = useTranslation();
  const state = useOvertoneState();
  const cache = useAudioCache();
  const playback = useOvertonePlayback();
  const selectedTake = state.project?.takes.find((take) => take.takeId === state.project?.selectedTakeId && !take.discarded) ?? null;
  const media = useAudioSnapshot(selectedTake?.artifactId ?? '');
  const audioData = media?.audio?.bytes;
  const decoded = media?.audio?.decoded ?? null;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [audioRetry, setAudioRetry] = useState(0);
  const [volume, setVolume] = useState(resolveInitialOvertoneVolume);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  // @nimi-authority: rule.overtone.data-model.r006
  const [trim, setTrim] = useState<{ takeId: string; start: number | null; end: number | null } | null>(null);
  // A newly selected buffer must never render or start with another take's bounds.
  const trimStartSec = trim?.takeId === selectedTake?.takeId ? trim?.start ?? null : null;
  const trimEndSec = trim?.takeId === selectedTake?.takeId ? trim?.end ?? null : null;
  const contextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const frameRef = useRef(0);
  const offsetRef = useRef(0);
  const volumeRef = useRef(volume);
  const speedRef = useRef(speed);
  const loopRef = useRef(loop);
  const clock = useRef({ offset: 0, started: 0 });
  const consumedRequest = useRef(0);
  const duration = decoded?.duration ?? 0;
  const trimStart = Math.max(0, Math.min(trimStartSec ?? 0, duration));
  const trimEnd = Math.max(0, Math.min(trimEndSec ?? duration, duration));
  const trimInvalid = duration > 0 && trimEnd <= trimStart;
  const bounds = useRef({ start: trimStart, end: trimEnd });
  bounds.current = { start: trimStart, end: trimEnd };

  const stopPlayback = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      try { sourceRef.current.stop(); } catch { /* the source may already have ended */ }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const position = useCallback(() => {
    const context = contextRef.current;
    if (!context || !sourceRef.current) return offsetRef.current;
    const elapsed = clock.current.offset + (context.currentTime - clock.current.started) * speedRef.current;
    const { start, end } = bounds.current;
    return loopRef.current && end > start ? start + ((elapsed - start) % (end - start) + end - start) % (end - start) : Math.min(end, elapsed);
  }, []);

  useEffect(() => {
    setTrim(null);
    setAudioError('');
  }, [selectedTake?.takeId]);

  useEffect(() => {
    cache.pin(selectedTake?.artifactId ?? null);
    return () => cache.pin(null);
  }, [cache, selectedTake?.artifactId]);

  useEffect(() => {
    stopPlayback(); setCurrentTime(0); offsetRef.current = 0;
    if (!selectedTake) { setLoadingAudio(false); return; }
    if (audioData) { setLoadingAudio(false); return; }
    const controller = new AbortController(); setLoadingAudio(true); setAudioError('');
    void loadRuntimeMusicArtifact({ client: getNimiLocalAppClient(), cache,
      artifact: { artifactId: selectedTake.artifactId, mimeType: selectedTake.artifactMimeType, sizeBytes: selectedTake.artifactByteLength }, signal: controller.signal,
    }).catch((cause: unknown) => { if (!controller.signal.aborted) setAudioError(cause instanceof Error && cause.name === 'TimeoutError' ? 'OVERTONE_AUDIO_READ_TIMEOUT' : cause instanceof Error ? cause.message : String(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoadingAudio(false); });
    return () => controller.abort();
  }, [selectedTake?.takeId, audioData, audioRetry, cache, stopPlayback]);

  useEffect(() => () => {
    stopPlayback();
    const context = contextRef.current;
    contextRef.current = null;
    gainRef.current = null;
    if (context) void context.close().catch(() => undefined);
  }, [stopPlayback]);

  const startPlayback = useCallback((fromOffset?: number) => {
    if (!decoded || bounds.current.end <= bounds.current.start) return;
    stopPlayback();
    try {
      if (!contextRef.current) {
        const context = new AudioContext();
        contextRef.current = context;
        gainRef.current = context.createGain();
        gainRef.current.gain.value = volumeRef.current / 100;
        gainRef.current.connect(context.destination);
      }
      const context = contextRef.current;
      if (context.state === 'suspended') void context.resume().catch((error) => setAudioError(String(error)));
      const source = context.createBufferSource();
      const { start, end } = bounds.current;
      const offset = fromOffset === undefined && offsetRef.current >= end
        ? start
        : Math.max(start, Math.min(fromOffset ?? offsetRef.current, end - .001));
      source.buffer = decoded;
      source.playbackRate.value = speedRef.current;
      source.loop = loopRef.current;
      source.loopStart = start;
      source.loopEnd = end;
      source.connect(gainRef.current!);
      source.onended = () => { stopPlayback(); setCurrentTime(end); offsetRef.current = start; };
      if (loopRef.current) source.start(0, offset);
      else source.start(0, offset, end - offset);
      sourceRef.current = source;
      offsetRef.current = offset;
      clock.current = { offset, started: context.currentTime };
      setIsPlaying(true);
      const tick = () => {
        setCurrentTime(position());
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    } catch (error) { setAudioError(error instanceof Error ? error.message : String(error)); stopPlayback(); }
  }, [decoded, position, stopPlayback]);

  const handlePlayPause = useCallback(() => {
    if (sourceRef.current) {
      offsetRef.current = position();
      setCurrentTime(offsetRef.current);
      stopPlayback();
    } else startPlayback();
  }, [position, startPlayback, stopPlayback]);

  const handleSeek = useCallback((time: number) => {
    const next = Math.max(trimStart, Math.min(trimEnd, time));
    const wasPlaying = !!sourceRef.current;
    stopPlayback();
    offsetRef.current = next;
    setCurrentTime(next);
    if (wasPlaying) startPlayback(next);
  }, [trimStart, trimEnd, startPlayback, stopPlayback]);

  useEffect(() => {
    playback.registerController({ togglePlayback: handlePlayPause, seekBy: (delta) => handleSeek(position() + delta), getPosition: position });
    return () => playback.registerController(null);
  }, [playback, handlePlayPause, handleSeek, position]);

  useEffect(() => {
    const request = playback.request;
    if (!decoded || !request || request.takeId !== selectedTake?.takeId || request.serial === consumedRequest.current) return;
    consumedRequest.current = request.serial;
    startPlayback(request.offset < bounds.current.end ? Math.max(bounds.current.start, request.offset) : bounds.current.start);
  }, [decoded, playback.request, selectedTake?.takeId, startPlayback]);

  useEffect(() => {
    playback.reportPlaying(isPlaying && sourceRef.current ? selectedTake?.takeId ?? null : null);
  }, [isPlaying, selectedTake?.takeId, playback.reportPlaying]);
  useEffect(() => () => playback.reportPlaying(null), [playback.reportPlaying]);

  function changeSpeed(value: string) {
    const next = Number(value);
    if (![.75, 1, 1.25].includes(next)) return;
    const at = position();
    speedRef.current = next;
    setSpeed(next);
    if (contextRef.current && sourceRef.current) {
      clock.current = { offset: at, started: contextRef.current.currentTime };
      sourceRef.current.playbackRate.setValueAtTime(next, contextRef.current.currentTime);
    }
  }

  function toggleLoop() {
    const at = position();
    const playing = !!sourceRef.current;
    loopRef.current = !loopRef.current;
    setLoop(loopRef.current);
    if (playing) startPlayback(at);
  }

  function trimChange(value: number, edge: 'start' | 'end') {
    if (!selectedTake) return;
    offsetRef.current = position();
    stopPlayback();
    setTrim({ takeId: selectedTake.takeId, start: edge === 'start' ? value : trimStartSec, end: edge === 'end' ? value : trimEndSec });
  }

  function exportAudio(trimmed: boolean) {
    if (!selectedTake || !decoded || !audioData || (trimmed && trimInvalid)) return;
    try {
      downloadAudio(trimmed ? encodeTrimmedWav(decoded, trimStart, trimEnd) : audioData,
        trimmed ? 'audio/wav' : selectedTake.artifactMimeType,
        trimmed ? `${selectedTake.title}-trim` : selectedTake.title,
        trimmed ? 'wav' : selectedTake.artifactFileExtension);
    } catch (error) { setAudioError(error instanceof Error ? error.message : String(error)); }
  }

  return <Surface material="solid" tone="panel" elevation="base" padding="none" className="overtone-transport" data-testid="overtone-transport">
    <div className="overtone-transport__main">
      <div className="overtone-transport__identity"><strong>{selectedTake?.title || t('Overtone.playground.waitingAudio')}</strong>
        <span>{t(!selectedTake ? 'Overtone.studio.emptyPlayer' : isPlaying ? 'Overtone.playground.playing' : 'Overtone.playground.selectedRecording')}</span></div>
      <div className="overtone-transport__controls">
        <IconToggleAction className="ot-main-play" icon={isPlaying ? <PauseIcon /> : <PlayIcon />} active={isPlaying} onClick={handlePlayPause}
          disabled={!decoded || trimInvalid} aria-label={isPlaying ? t('Overtone.player.pause') : t('Overtone.player.play')} />
        <Button tone={loop ? 'primary' : 'ghost'} size="sm" onClick={toggleLoop} disabled={!decoded || trimInvalid} aria-label={t('Overtone.playground.loop')} aria-pressed={loop}><OvertoneIcon name="loop" /></Button>
      </div>
      <Waveform peaks={media?.peaks} currentTime={currentTime} duration={duration} trimStart={trimStartSec} trimEnd={trimEndSec} onSeek={handleSeek} />
      <div className="overtone-transport__meta">
        <NimiText as="span" role="caption" className="overtone-transport__time">{formatAudioTime(currentTime)} / {formatAudioTime(duration)}</NimiText>
        <Slider value={volume} min={0} max={100} className="overtone-volume" aria-label={t('Overtone.player.volumeAria')}
          onChange={(event) => { const next = Number(event.target.value); volumeRef.current = next; setVolume(next); persistOvertoneVolume(next); if (gainRef.current) gainRef.current.gain.value = next / 100; }} />
      </div>
    </div>
    {loadingAudio ? <NimiText role="helper">{t('Overtone.player.loadingAudio')}</NimiText> : null}
    {audioError ? <InlineAlert tone="warning">{t('Overtone.player.audioUnavailable', { message: audioError === 'OVERTONE_AUDIO_READ_TIMEOUT' ? t('Overtone.player.loadTimeout') : audioError })}<Button tone="ghost" size="sm" onClick={() => setAudioRetry((value) => value + 1)}>{t('Overtone.player.retryAudio')}</Button></InlineAlert> : null}
    {selectedTake ? <div className="overtone-transport__extras">
      <div className="overtone-row"><NimiText role="caption">{t('Overtone.playground.speed')}</NimiText>
        <SegmentedControl size="sm" ariaLabel={t('Overtone.playground.speed')} value={String(speed)} onValueChange={changeSpeed}
          items={[{ value: '0.75', label: '0.75×' }, { value: '1', label: '1×' }, { value: '1.25', label: '1.25×' }]} /></div>
      <details><summary>{t('Overtone.playground.trim')}</summary>
        <div className="overtone-trim-controls">
          <div className="ot-trim-field"><NimiText as="span" role="caption">{t('Overtone.player.trimStartAria')}</NimiText>
          <NumberStepper ariaLabel={t('Overtone.player.trimStartAria')} decreaseLabel={t('Overtone.player.trimStartDecreaseAria')} increaseLabel={t('Overtone.player.trimStartIncreaseAria')}
            min={0} max={duration} step={1} value={Math.round(trimStart * 1000) / 1000} onValueChange={(value) => trimChange(value, 'start')} disabled={!decoded} /></div>
          <div className="ot-trim-field"><NimiText as="span" role="caption">{t('Overtone.player.trimEndAria')}</NimiText>
          <NumberStepper ariaLabel={t('Overtone.player.trimEndAria')} decreaseLabel={t('Overtone.player.trimEndDecreaseAria')} increaseLabel={t('Overtone.player.trimEndIncreaseAria')}
            min={0} max={duration} step={1} value={Math.round(trimEnd * 1000) / 1000} onValueChange={(value) => trimChange(value, 'end')} disabled={!decoded} /></div>
          <Button tone="ghost" size="sm" disabled={!decoded} onClick={() => { stopPlayback(); setTrim(null); }}>{t('Overtone.player.clearTrim')}</Button>
          <Button tone="secondary" size="sm" disabled={!decoded || trimInvalid} onClick={() => exportAudio(true)}>{t('Overtone.playground.exportTrim')}</Button>
        </div>
        <NimiText role="caption" className="ot-trim-hint">{t('Overtone.playground.exportHint')}</NimiText>
      </details>
      <Button tone="ghost" size="sm" disabled={!decoded || !audioData} onClick={() => exportAudio(false)}><OvertoneIcon name="download" size={15} />{t('Overtone.playground.exportOriginal')}</Button>
    </div> : null}
    {trimInvalid ? <NimiText role="helper" className="overtone-trim-error">{t('Overtone.player.invalidTrim')}</NimiText> : null}
  </Surface>;
}

function PlayIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>; }
function PauseIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>; }
