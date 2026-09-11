import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatAudioTime } from '../exploration.js';

const DEFAULT_BAR_COUNT = 160;

interface WaveformProps {
  peaks?: readonly number[];
  currentTime: number;
  duration: number;
  trimStart: number | null;
  trimEnd: number | null;
  onSeek: (time: number) => void;
  variant?: 'full' | 'mini';
}

export function Waveform({ peaks = [], currentTime, duration, trimStart, trimEnd, onSeek, variant = 'full' }: WaveformProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMini = variant === 'mini';
  const barCount = isMini ? 60 : DEFAULT_BAR_COUNT;

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

    const visibleBars = Math.max(1, Math.min(barCount, Math.floor(rect.width / 3)));
    const barWidth = rect.width / visibleBars;
    const playRatio = duration > 0 ? currentTime / duration : 0;
    const trimStartRatio = trimStart !== null && duration > 0 ? trimStart / duration : null;
    const trimEndRatio = trimEnd !== null && duration > 0 ? trimEnd / duration : null;
    const centerY = rect.height / 2;
    const colors = waveformColors(canvas);

    if (!isMini && (trimStartRatio !== null || trimEndRatio !== null)) {
      const startX = (trimStartRatio ?? 0) * rect.width;
      const endX = (trimEndRatio ?? 1) * rect.width;
      ctx.fillStyle = colors.trim;
      ctx.fillRect(startX, 0, endX - startX, rect.height);
    }

    for (let i = 0; i < visibleBars; i += 1) {
      const x = i * barWidth;
      const peak = peaks[Math.floor(i * peaks.length / visibleBars)] ?? 0;
      const halfH = Math.max(isMini ? 1 : 2, peak * rect.height * (isMini ? 0.5 : 0.42));
      const isPlayed = i / visibleBars <= playRatio;
      ctx.fillStyle = isPlayed ? colors.played : colors.resting;
      ctx.fillRect(x + .5, centerY - halfH, Math.max(.75, barWidth - 1), halfH * 2);
    }

    if (!isMini && duration > 0) {
      const playX = playRatio * rect.width;
      ctx.fillStyle = colors.playhead;
      ctx.fillRect(playX - 1, 0, 2, rect.height);
    }
  }, [peaks, barCount, currentTime, duration, trimStart, trimEnd, isMini]);

  useEffect(() => { draw(); }, [draw]);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => drawRef.current());
    observer.observe(canvas);
    const theme = new MutationObserver(() => drawRef.current());
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-nimi-scheme'] });
    return () => { observer.disconnect(); theme.disconnect(); };
  }, []);

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
      role={isMini ? 'img' : 'slider'}
      aria-label={t('Overtone.playground.audition')}
      aria-disabled={!peaks.length || undefined}
      aria-valuemin={isMini ? undefined : 0}
      aria-valuemax={isMini ? undefined : duration}
      aria-valuenow={isMini ? undefined : currentTime}
      aria-valuetext={isMini ? undefined : formatAudioTime(currentTime)}
      tabIndex={!isMini && peaks.length ? 0 : undefined}
      onKeyDown={(event) => {
        if (isMini || !peaks.length) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          event.stopPropagation();
          onSeek(Math.max(0, Math.min(duration, currentTime + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 15 : 5))));
        }
      }}
      data-testid={isMini ? 'overtone-waveform-mini' : 'overtone-waveform'}
    />
  );
}

function waveformColors(element?: Element) {
  if (typeof document === 'undefined') {
    return {
      played: '#8b5cf6',
      resting: 'rgba(148, 163, 184, 0.28)',
      playhead: '#ffffff',
      trim: 'rgba(139, 92, 246, 0.12)',
    };
  }
  const style = getComputedStyle(element ?? document.documentElement);
  return {
    played: readCssVar(style, '--nimi-action-primary-bg', '#8b5cf6'),
    resting: readCssVar(style, '--nimi-text-secondary', '#64748b'),
    playhead: readCssVar(style, '--nimi-text-primary', '#ffffff'),
    trim: readCssVar(style, '--nimi-surface-active', 'rgba(139, 92, 246, 0.12)'),
  };
}

function readCssVar(style: CSSStyleDeclaration, name: string, fallback: string): string {
  return style.getPropertyValue(name).trim() || fallback;
}
