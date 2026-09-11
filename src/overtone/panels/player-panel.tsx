import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, IconToggleAction, InlineAlert, LoadingSkeleton, NimiText, NumberStepper, Slider, Surface } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertoneActions, useOvertonePlayback, useOvertoneState } from '../store.js';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { readRuntimeMusicArtifact } from '../runtime-workflow.js';
import { persistOvertoneVolume, resolveInitialOvertoneVolume } from '../volume-preference.js';
import { Waveform } from './waveform.js';

const TRIM_STEP_SEC = 1;

// @nimi-authority: rule.overtone.ia.r006
export function PlayerPanel() {
  const { t } = useTranslation();
  const state = useOvertoneState();
  const { setAudioBuffer } = useOvertoneActions();
  const playback = useOvertonePlayback();
  const project = state.project;
  const selectedTake = project?.takes.find((take) => take.takeId === project.selectedTakeId && !take.discarded) ?? null;
  const audioData = selectedTake ? state.audioBuffers[selectedTake.takeId] : undefined;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [audioRetry, setAudioRetry] = useState(0);
  const [volume, setVolume] = useState(resolveInitialOvertoneVolume);
  // @nimi-authority: rule.overtone.data-model.r006
  // Audition bounds are transient; the take's source trim metadata is immutable.
  const [trimStartSec, setTrimStartSec] = useState<number | null>(null);
  const [trimEndSec, setTrimEndSec] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const volumeRef = useRef(volume);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const decodedBufferRef = useRef<AudioBuffer | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      const gain = audioContextRef.current.createGain();
      gain.gain.value = volumeRef.current / 100;
      gain.connect(audioContextRef.current.destination);
      gainNodeRef.current = gain;
    }
    return audioContextRef.current;
  }, []);

  const releaseAudioContext = useCallback(() => {
    const context = audioContextRef.current;
    audioContextRef.current = null;
    gainNodeRef.current = null;
    if (context) void context.close().catch(() => undefined);
  }, []);

  const handleVolumeChange = useCallback((next: number) => {
    if (!Number.isFinite(next)) return;
    const clamped = Math.max(0, Math.min(100, Math.round(next)));
    volumeRef.current = clamped;
    setVolume(clamped);
    persistOvertoneVolume(clamped);
    const gain = gainNodeRef.current;
    if (gain) gain.gain.value = clamped / 100;
  }, []);

  const stopPlayback = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      try { sourceRef.current.stop(); } catch { /* already stopped */ }
      sourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    setTrimStartSec(null);
    setTrimEndSec(null);
  }, [selectedTake?.takeId]);

  useEffect(() => {
    setAudioError('');
    if (!selectedTake || audioData) { setLoadingAudio(false); return; }
    const controller = new AbortController();
    setLoadingAudio(true);
    void Promise.resolve().then(() => readRuntimeMusicArtifact({
      client: getNimiLocalAppClient(),
      artifact: { artifactId: selectedTake.artifactId, mimeType: selectedTake.artifactMimeType, sizeBytes: selectedTake.artifactByteLength },
      signal: controller.signal,
    })).then(({ buffer }) => {
      if (!controller.signal.aborted) setAudioBuffer(selectedTake.takeId, buffer);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setAudioError(error instanceof Error ? error.message : String(error));
    }).finally(() => { if (!controller.signal.aborted) setLoadingAudio(false); });
    return () => controller.abort();
  }, [selectedTake, audioData, audioRetry, setAudioBuffer]);

  useEffect(() => {
    stopPlayback();
    setCurrentTime(0);
    setDuration(0);
    decodedBufferRef.current = null;
    offsetRef.current = 0;
    if (!audioData) {
      releaseAudioContext();
      return;
    }
    const context = getAudioContext();
    let active = true;
    context.decodeAudioData(audioData.slice(0)).then((decoded) => {
      if (!active) return;
      decodedBufferRef.current = decoded;
      setDuration(decoded.duration);
    }).catch((error: unknown) => {
      if (!active) return;
      decodedBufferRef.current = null;
      setAudioError(error instanceof Error ? error.message : String(error));
    });
    return () => { active = false; };
  }, [audioData, audioRetry, getAudioContext, releaseAudioContext, stopPlayback]);

  useEffect(() => () => {
    stopPlayback();
    releaseAudioContext();
  }, [stopPlayback, releaseAudioContext]);

  const trimStart = normalizeTrimStart(trimStartSec, duration);
  const trimEnd = normalizeTrimEnd(trimEndSec, duration);
  const trimInvalid = duration > 0 && trimEnd <= trimStart;

  const startPlayback = useCallback((fromOffset?: number) => {
    const decoded = decodedBufferRef.current;
    if (!decoded || trimInvalid) return;
    const context = getAudioContext();
    if (context.state === 'suspended') void context.resume();
    const source = context.createBufferSource();
    source.buffer = decoded;
    source.connect(gainNodeRef.current ?? context.destination);
    const rawOffset = fromOffset !== undefined ? fromOffset : offsetRef.current;
    const offset = clampSeconds(rawOffset, trimStart, Math.max(trimStart, trimEnd - 0.01));
    source.onended = () => { stopPlayback(); setCurrentTime(trimEnd); offsetRef.current = trimStart; };
    source.start(0, offset, trimEnd - offset);
    sourceRef.current = source;
    startTimeRef.current = context.currentTime - offset;
    setIsPlaying(true);
    const tick = () => {
      const elapsed = context.currentTime - startTimeRef.current;
      const nextTime = Math.min(elapsed, trimEnd);
      setCurrentTime(nextTime);
      if (nextTime >= trimEnd) {
        offsetRef.current = trimStart;
        stopPlayback();
        return;
      }
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
  }, [getAudioContext, stopPlayback, trimEnd, trimInvalid, trimStart]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      const context = getAudioContext();
      offsetRef.current = context.currentTime - startTimeRef.current;
      stopPlayback();
      return;
    }
    startPlayback();
  }, [isPlaying, getAudioContext, stopPlayback, startPlayback]);

  const handleSeek = useCallback((time: number) => {
    if (isPlaying) {
      stopPlayback();
      offsetRef.current = time;
      setCurrentTime(time);
      startPlayback(time);
      return;
    }
    const next = clampSeconds(time, 0, duration);
    offsetRef.current = next;
    setCurrentTime(next);
  }, [duration, isPlaying, stopPlayback, startPlayback]);

  useEffect(() => {
    playback.registerController({
      togglePlayback: handlePlayPause,
      seekBy(deltaSec) {
        const next = Math.max(0, Math.min(duration, currentTime + deltaSec));
        handleSeek(next);
      },
    });
    return () => playback.registerController(null);
  }, [playback, handlePlayPause, handleSeek, currentTime, duration]);

  const trimControlsDisabled = !selectedTake || duration <= 0;

  const stopForTrimChange = useCallback(() => {
    if (isPlaying) offsetRef.current = getAudioContext().currentTime - startTimeRef.current;
    stopPlayback();
  }, [getAudioContext, isPlaying, stopPlayback]);

  const handleTrimStartChange = useCallback((value: number) => {
    stopForTrimChange();
    setTrimStartSec(value);
  }, [stopForTrimChange]);

  const handleTrimEndChange = useCallback((value: number) => {
    stopForTrimChange();
    setTrimEndSec(value);
  }, [stopForTrimChange]);

  return (
    <Surface material="glass-chrome" tone="panel" elevation="base" padding="none" className="overtone-transport" data-testid="overtone-transport">
      <div className="overtone-transport__controls">
        <IconToggleAction
          icon={isPlaying ? <PauseIcon /> : <PlayIcon />}
          active={isPlaying}
          onClick={handlePlayPause}
          disabled={!decodedBufferRef.current || trimInvalid}
          aria-label={loadingAudio ? t('Overtone.player.loadingAudio') : isPlaying ? t('Overtone.player.pause') : t('Overtone.player.play')}
        />
        <Slider
          value={volume}
          min={0}
          max={100}
          showValue
          onChange={(event) => handleVolumeChange(Number(event.target.value))}
          aria-label={t('Overtone.player.volumeAria')}
          className="overtone-volume"
        />
      </div>
      {audioError ? <InlineAlert tone="warning">{t('Overtone.player.audioUnavailable', { message: audioError })}<Button type="button" tone="ghost" onClick={() => setAudioRetry((value) => value + 1)}>{t('Overtone.player.retryAudio')}</Button></InlineAlert> : null}
      {loadingAudio && !audioData && !audioError ? (
        <LoadingSkeleton lines={2} label={t('Overtone.player.loadingAudio')} className="overtone-transport__loading" />
      ) : (
        <Waveform
          buffer={decodedBufferRef.current}
          currentTime={currentTime}
          duration={duration}
          trimStart={trimStartSec}
          trimEnd={trimEndSec}
          onSeek={handleSeek}
        />
      )}
      <div className="overtone-transport__meta">
        <NimiText as="span" role="caption" className="overtone-transport__time">{formatTime(currentTime)} / {formatTime(duration)}</NimiText>
        <div className="overtone-trim-controls">
          <NimiText as="span" role="caption">{t('Overtone.player.trimStartAria')}</NimiText>
          <NumberStepper
            ariaLabel={t('Overtone.player.trimStartAria')}
            decreaseLabel={t('Overtone.player.trimStartDecreaseAria')}
            increaseLabel={t('Overtone.player.trimStartIncreaseAria')}
            min={0}
            max={duration > 0 ? Math.max(trimStart, trimEnd) : undefined}
            step={TRIM_STEP_SEC}
            value={trimStart}
            onValueChange={handleTrimStartChange}
            disabled={trimControlsDisabled}
          />
          <NimiText as="span" role="caption">{t('Overtone.player.trimEndAria')}</NimiText>
          <NumberStepper
            ariaLabel={t('Overtone.player.trimEndAria')}
            decreaseLabel={t('Overtone.player.trimEndDecreaseAria')}
            increaseLabel={t('Overtone.player.trimEndIncreaseAria')}
            min={0}
            max={duration > 0 ? duration : undefined}
            step={TRIM_STEP_SEC}
            value={trimEnd}
            onValueChange={handleTrimEndChange}
            disabled={trimControlsDisabled}
          />
          <Button type="button" tone="ghost" size="sm"
            disabled={trimControlsDisabled || (trimStartSec === null && trimEndSec === null)}
            onClick={() => { stopForTrimChange(); setTrimStartSec(null); setTrimEndSec(null); }}>
            {t('Overtone.player.clearTrim')}
          </Button>
        </div>
        {trimInvalid ? <NimiText as="span" role="helper" className="overtone-trim-error">{t('Overtone.player.invalidTrim')}</NimiText> : null}
      </div>
    </Surface>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function normalizeTrimStart(value: number | null, duration: number): number {
  return clampSeconds(value ?? 0, 0, Math.max(0, duration));
}

function normalizeTrimEnd(value: number | null, duration: number): number {
  return clampSeconds(value ?? duration, 0, Math.max(0, duration));
}

function clampSeconds(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
