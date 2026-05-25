import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@nimiplatform/kit/ui';
import { useOvertoneState } from '../store.js';
import { Waveform } from './waveform.js';

export function PlayerPanel() {
  const state = useOvertoneState();
  const project = state.project;
  const selectedTake = project?.takes.find((take) => take.takeId === project.selectedTakeId && !take.discarded) ?? null;
  const audioData = selectedTake ? state.audioBuffers[selectedTake.takeId] : undefined;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
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
      try { sourceRef.current.stop(); } catch { /* already stopped */ }
      sourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

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
    context.decodeAudioData(audioData.slice(0)).then((decoded) => {
      decodedBufferRef.current = decoded;
      setDuration(decoded.duration);
    }).catch(() => {
      decodedBufferRef.current = null;
    });
  }, [audioData, getAudioContext, stopPlayback]);

  useEffect(() => () => {
    stopPlayback();
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context) void context.close().catch(() => undefined);
  }, [stopPlayback]);

  const startPlayback = useCallback((fromOffset?: number) => {
    const decoded = decodedBufferRef.current;
    if (!decoded) return;
    const context = getAudioContext();
    if (context.state === 'suspended') void context.resume();
    const source = context.createBufferSource();
    source.buffer = decoded;
    source.connect(context.destination);
    const offset = fromOffset !== undefined ? fromOffset : offsetRef.current;
    source.onended = () => { stopPlayback(); setCurrentTime(decoded.duration); offsetRef.current = 0; };
    source.start(0, offset);
    sourceRef.current = source;
    startTimeRef.current = context.currentTime - offset;
    setIsPlaying(true);
    const tick = () => {
      const elapsed = context.currentTime - startTimeRef.current;
      setCurrentTime(Math.min(elapsed, decoded.duration));
      if (elapsed < decoded.duration) animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
  }, [getAudioContext, stopPlayback]);

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
    offsetRef.current = time;
    setCurrentTime(time);
  }, [isPlaying, stopPlayback, startPlayback]);

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
        {isPlaying ? 'Pause' : 'Play'}
      </Button>
      <Waveform
        buffer={decodedBufferRef.current}
        currentTime={currentTime}
        duration={duration}
        trimStart={null}
        trimEnd={null}
        onSeek={handleSeek}
      />
      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--nimi-text-secondary)', minWidth: 90, textAlign: 'right' }}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}
