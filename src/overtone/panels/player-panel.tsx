import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, InlineAlert, TextField } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { readRuntimeMusicArtifact } from '../runtime-workflow.js';
import { Waveform } from './waveform.js';

export function PlayerPanel() {
  const { t } = useTranslation();
  const state = useOvertoneState();
  const { setAudioBuffer } = useOvertoneActions();
  const project = state.project;
  const selectedTake = project?.takes.find((take) => take.takeId === project.selectedTakeId && !take.discarded) ?? null;
  const audioData = selectedTake ? state.audioBuffers[selectedTake.takeId] : undefined;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [audioRetry, setAudioRetry] = useState(0);
  const [trimStartSec, setTrimStartSec] = useState<number | null>(null);
  const [trimEndSec, setTrimEndSec] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const decodedBufferRef = useRef<AudioBuffer | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
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
    setTrimStartSec(selectedTake?.trimStartSec ?? null);
    setTrimEndSec(selectedTake?.trimEndSec ?? null);
  }, [selectedTake?.takeId, selectedTake?.trimStartSec, selectedTake?.trimEndSec]);

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
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (context) void context.close().catch(() => undefined);
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
  }, [audioData, audioRetry, getAudioContext, stopPlayback]);

  useEffect(() => () => {
    stopPlayback();
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context) void context.close().catch(() => undefined);
  }, [stopPlayback]);

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
    source.connect(context.destination);
    const rawOffset = fromOffset !== undefined ? fromOffset : offsetRef.current;
    const offset = clampSeconds(rawOffset, trimStart, Math.max(trimStart, trimEnd - 0.01));
    source.onended = () => { stopPlayback(); setCurrentTime(trimEnd); offsetRef.current = trimStart; };
    source.start(0, offset);
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
    function onToggle() { handlePlayPause(); }
    function onSeekDelta(event: Event) {
      const delta = (event as CustomEvent<number>).detail;
      const next = Math.max(0, Math.min(duration, currentTime + delta));
      handleSeek(next);
    }
    window.addEventListener('overtone-toggle-playback', onToggle);
    window.addEventListener('overtone-seek-delta', onSeekDelta);
    return () => {
      window.removeEventListener('overtone-toggle-playback', onToggle);
      window.removeEventListener('overtone-seek-delta', onSeekDelta);
    };
  }, [handlePlayPause, handleSeek, currentTime, duration]);

  return (
    <div className="overtone-transport" data-testid="overtone-transport">
      <Button type="button" tone="primary" size="md" onClick={handlePlayPause} disabled={!decodedBufferRef.current}>
        {loadingAudio ? t('Overtone.player.loadingAudio') : isPlaying ? t('Overtone.player.pause') : t('Overtone.player.play')}
      </Button>
      {audioError ? <InlineAlert tone="warning">{t('Overtone.player.audioUnavailable', { message: audioError })}<Button type="button" tone="ghost" onClick={() => setAudioRetry((value) => value + 1)}>{t('Overtone.player.retryAudio')}</Button></InlineAlert> : null}
      <Waveform
        buffer={decodedBufferRef.current}
        currentTime={currentTime}
        duration={duration}
        trimStart={trimStartSec}
        trimEnd={trimEndSec}
        onSeek={handleSeek}
      />
      <div className="overtone-transport__meta">
        <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
        <div className="overtone-trim-controls">
          <TextField
            aria-label={t('Overtone.player.trimStartAria')}
            type="number"
            min={0}
            value={trimStartSec ?? ''}
            onChange={(event) => setTrimStartSec(parseOptionalSecond(event.target.value))}
          />
          <TextField
            aria-label={t('Overtone.player.trimEndAria')}
            type="number"
            min={0}
            value={trimEndSec ?? ''}
            onChange={(event) => setTrimEndSec(parseOptionalSecond(event.target.value))}
          />
        </div>
        {trimInvalid ? <span className="overtone-trim-error">{t('Overtone.player.invalidTrim')}</span> : null}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function parseOptionalSecond(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
