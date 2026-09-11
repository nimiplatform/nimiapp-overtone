import { useMemo, useRef, type PointerEvent, type KeyboardEvent } from 'react';
import { Button, Slider } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useExploration, useMusicIntent } from '../exploration-context.js';

// @nimi-authority: definition.overtone.exploration.music-playground
// A graphic score of the author's intent. This is deliberately separate from decoded audio waveforms.
export function IntentField({ variant = 0 }: { variant?: number }) {
  const { t } = useTranslation();
  const { exploring } = useExploration();
  const creative = useMusicIntent();
  const pad = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const x = 5 + creative.energy * .9;
  const y = 10 + (100 - creative.surprise) * .8;
  const lines = useMemo(() => Array.from({ length: 27 }, (_, line) => {
    const depth = line / 26;
    return Array.from({ length: 100 }, (_, point) => {
      const px = point / 99 * 860 - 30;
      const envelope = Math.exp(-Math.pow((px - 80 - creative.energy * 6.1) / 220, 2));
      const wave = Math.sin(px / (65 - variant * 9) + depth * (2.5 + creative.surprise / 17));
      const py = 150 + (depth - .5) * 150 + wave * envelope * (35 + creative.surprise * .9);
      return `${point ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(' ');
  }), [creative.energy, creative.surprise, variant]);

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!dragging.current || exploring || !pad.current) return;
    const box = pad.current.getBoundingClientRect();
    creative.setEnergy(Math.round(Math.max(0, Math.min(100, ((event.clientX - box.left) / box.width - .05) / .9 * 100))));
    creative.setSurprise(Math.round(Math.max(0, Math.min(100, (1 - ((event.clientY - box.top) / box.height - .1) / .8) * 100))));
  }
  function onKey(event: KeyboardEvent) {
    const step = event.shiftKey ? 10 : 2;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Home') { creative.setEnergy(50); creative.setSurprise(50); return; }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') creative.setEnergy(Math.max(0, Math.min(100, creative.energy + (event.key === 'ArrowRight' ? step : -step))));
    else creative.setSurprise(Math.max(0, Math.min(100, creative.surprise + (event.key === 'ArrowUp' ? step : -step))));
  }

  return <div className="ot-intent-field">
    <div className="ot-field-heading"><span>{t('Overtone.studio.intentTitle')}</span><span>{t('Overtone.studio.dragHint')}</span></div>
    <div ref={pad} className="ot-xy-pad" role="group" aria-label={t('Overtone.studio.intentAria')}
      onPointerDown={(event) => { if (exploring) return; dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); move(event); }}
      onPointerMove={move} onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}>
      <svg className="ot-graphic-score" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden="true">
        <g className="ot-score-rules" strokeWidth=".6"><path d="M40 150H760M400 30V270" /><path d="M40 30v8m180-8v8m180-8v8m180-8v8m180-8v8M40 270v-8m180 8v-8m180 8v-8m180 8v-8m180 8v-8" /></g>
        <g fill="none" stroke="currentColor" strokeWidth="1.35">{lines.map((d, index) => <path key={index} d={d} opacity={.22 + index / lines.length * .58} />)}</g>
        <g className="ot-score-crosshair" strokeWidth=".8" strokeDasharray="3 6"><path d={`M${x * 8} 30V270M40 ${y * 3}H760`} /></g>
      </svg>
      <span className="ot-axis-y">{t('Overtone.playground.surpriseHigh')}</span>
      <Button className="ot-intent-point" disabled={exploring} style={{ left: `${x}%`, top: `${y}%` }} onKeyDown={onKey}
        aria-label={t('Overtone.studio.pointAria', { energy: creative.energy, surprise: creative.surprise })} aria-describedby="ot-intent-instructions">
        <span className="ot-intent-point__cross" aria-hidden="true" />
      </Button>
      <div className="ot-score-coordinate" style={{ left: `${x > 72 ? x - 25 : x + 5}%`, top: `${Math.max(15, Math.min(80, y))}%` }} aria-hidden="true">{String(creative.energy).padStart(2, '0')} / {String(creative.surprise).padStart(2, '0')}</div>
      <div className="ot-axis-x"><span>{t('Overtone.playground.energyLow')}</span><span>{t('Overtone.playground.energyHigh')}</span></div>
    </div>
    <div className="ot-axis-controls" id="ot-intent-instructions">
      {(['energy', 'surprise'] as const).map((axis) => <label key={axis} className="ot-axis-control">
        <span>{t(`Overtone.playground.${axis}`)}<strong>{t(`Overtone.playground.${axis}${creative[axis] < 34 ? 'Low' : creative[axis] > 66 ? 'High' : 'Mid'}`)}</strong></span>
        <Slider min={0} max={100} value={creative[axis]} disabled={exploring} aria-label={t(`Overtone.playground.${axis}`)}
          onChange={(event) => (axis === 'energy' ? creative.setEnergy : creative.setSurprise)(Number(event.target.value))} />
      </label>)}
    </div>
  </div>;
}
