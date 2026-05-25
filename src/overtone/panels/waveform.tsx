import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_BAR_COUNT = 160;

interface WaveformProps {
  buffer: AudioBuffer | null;
  currentTime: number;
  duration: number;
  trimStart: number | null;
  trimEnd: number | null;
  onSeek: (time: number) => void;
  variant?: 'full' | 'mini';
}

export function Waveform({ buffer, currentTime, duration, trimStart, trimEnd, onSeek, variant = 'full' }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMini = variant === 'mini';

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const barCount = isMini ? 60 : DEFAULT_BAR_COUNT;
    const peaks = computePeaks(buffer, barCount);
    const barWidth = rect.width / barCount;
    const playRatio = duration > 0 ? currentTime / duration : 0;
    const trimStartRatio = trimStart !== null && duration > 0 ? trimStart / duration : null;
    const trimEndRatio = trimEnd !== null && duration > 0 ? trimEnd / duration : null;
    const centerY = rect.height / 2;

    if (!isMini && (trimStartRatio !== null || trimEndRatio !== null)) {
      const startX = (trimStartRatio ?? 0) * rect.width;
      const endX = (trimEndRatio ?? 1) * rect.width;
      ctx.fillStyle = 'rgba(167, 133, 255, 0.10)';
      ctx.fillRect(startX, 0, endX - startX, rect.height);
    }

    for (let i = 0; i < barCount; i += 1) {
      const x = i * barWidth;
      const peak = peaks[i] ?? 0;
      const halfH = Math.max(isMini ? 1 : 2, peak * rect.height * (isMini ? 0.5 : 0.42));
      const isPlayed = i / barCount <= playRatio;
      ctx.fillStyle = isPlayed ? '#a785ff' : 'rgba(232, 234, 240, 0.18)';
      ctx.fillRect(x + 1, centerY - halfH, Math.max(0, barWidth - 2), halfH * 2);
    }

    if (!isMini && duration > 0) {
      const playX = playRatio * rect.width;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(playX - 1, 0, 2, rect.height);
    }
  }, [buffer, currentTime, duration, trimStart, trimEnd, isMini]);

  useEffect(() => { draw(); }, [draw]);

  const handleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isMini || duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  }, [duration, isMini, onSeek]);

  return (
    <canvas
      ref={canvasRef}
      className={isMini ? 'overtone-waveform overtone-waveform--mini' : 'overtone-waveform'}
      onClick={handleClick}
      data-testid={isMini ? 'overtone-waveform-mini' : 'overtone-waveform'}
    />
  );
}

function computePeaks(buffer: AudioBuffer | null, barCount: number): number[] {
  if (!buffer) return new Array(barCount).fill(0);
  const data = buffer.getChannelData(0);
  const samplesPerBar = Math.max(1, Math.floor(data.length / barCount));
  const peaks: number[] = [];
  let maxPeak = 0;
  for (let i = 0; i < barCount; i += 1) {
    const start = i * samplesPerBar;
    const end = Math.min(start + samplesPerBar, data.length);
    let peak = 0;
    for (let j = start; j < end; j += 1) {
      const abs = Math.abs(data[j]!);
      if (abs > peak) peak = abs;
    }
    peaks.push(peak);
    if (peak > maxPeak) maxPeak = peak;
  }
  if (maxPeak > 0) {
    for (let i = 0; i < peaks.length; i += 1) peaks[i] = peaks[i]! / maxPeak;
  }
  return peaks;
}
