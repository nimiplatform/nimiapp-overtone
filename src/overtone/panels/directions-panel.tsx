import { Button, ConfirmDialog, NimiText } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useExploration } from '../exploration-context.js';
import { IntentField } from './intent-field.js';
import { OvertoneIcon } from './icons.js';

// @nimi-authority: rule.overtone.ia.r003
export function DirectionsPanel() {
  const { t } = useTranslation();
  const creative = useExploration();
  const focused = creative.directions[creative.focusedDirection];
  return <section id="overtone-directions" className="ot-score-stage" data-has-directions={!!focused} aria-label={t('Overtone.playground.directions')} aria-busy={creative.exploring}>
    <div className="ot-score-layout">
      <IntentField variant={creative.focusedDirection} />
      <div className="ot-interpretations">
        <div className="ot-interpretations__heading"><h2>{t(focused ? 'Overtone.studio.possibilities' : 'Overtone.studio.beforeDirections')}</h2>
          {focused ? <span>{t('Overtone.playground.ideasOnly')}</span> : null}</div>
        {creative.directions.length ? <div className="ot-direction-index" role="group" aria-label={t('Overtone.playground.directions')}>
          {creative.directions.map((direction, index) => <Button key={direction.brief.title} className="ot-direction-choice" tone="ghost"
            aria-pressed={creative.focusedDirection === index} disabled={creative.exploring} onClick={() => creative.setFocusedDirection(index)}>
            <span className="ot-direction-choice__content"><span className="ot-direction-letter">{String.fromCharCode(65 + index)}</span>
              <span className="ot-direction-name"><strong>{direction.brief.title}</strong><span>{direction.brief.genre}</span></span>
              <OvertoneIcon name={creative.chosen === index ? 'music' : 'chevron'} size={16} />
            </span>
          </Button>)}
        </div> : <div className="ot-empty-score">
          <svg viewBox="0 0 200 100" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeLinecap="round">
              <g strokeWidth="1" opacity=".32"><path d="M42 45C84 40 98 8 136 8H170" /><path d="M42 55C84 60 98 92 136 92H170" /></g>
              <g strokeWidth="1.5">
                <path d="M4 50H24" />
                <path d="M43 50C82 50 92 20 132 20H170" />
                <path d="M43 50C74 47 96 53 128 50H170" />
                <path d="M43 50C82 50 92 80 132 80H170" />
              </g>
            </g>
            <circle cx="34" cy="50" r="10.5" fill="var(--ot-lime)" stroke="#f6ffce" strokeWidth="2.5" />
            <path d="M29.5 50h9M34 45.5v9" stroke="#283020" strokeWidth="1.4" strokeLinecap="round" />
            <g fill="var(--ot-surface)" stroke="currentColor" strokeWidth="1.1"><circle cx="181" cy="20" r="9.5" /><circle cx="181" cy="50" r="9.5" /><circle cx="181" cy="80" r="9.5" /></g>
            <g fill="currentColor" fontSize="9.5" fontWeight="600" textAnchor="middle" dominantBaseline="central"><text x="181" y="20">A</text><text x="181" y="50">B</text><text x="181" y="80">C</text></g>
          </svg>
          <p>{t('Overtone.studio.beforeDirectionsHint')}</p>
          <span>{t('Overtone.studio.noTheory')}</span>
        </div>}
      </div>
    </div>
    {focused ? <div className="ot-direction-detail" key={focused.brief.title}>
      <div className="ot-direction-story"><h3>{focused.brief.title}</h3><p>{focused.twist}</p>
        <div className="ot-direction-tags"><span>{focused.brief.mood}</span><span>{focused.brief.tempo}</span></div>
      </div>
      <div className="ot-direction-lyrics"><span>{t('Overtone.studio.lyricSketch')}</span>
        <p>{focused.lyrics.split('\n').filter(line=>line.trim() && !/^(Verse|Chorus|Bridge|Intro|Outro|主歌|副歌)/i.test(line.trim())).slice(0,2).join('\n')}</p>
      </div>
      <details className="ot-arrangement-detail"><summary>{t('Overtone.playground.lookInside')}</summary>
        <div><p>{focused.brief.description}</p><p className="overtone-lyric-sketch">{focused.lyrics}</p></div>
      </details>
    </div> : null}
    {creative.chosen !== null && creative.chosen === creative.focusedDirection ? <NimiText role="helper" className="ot-applied-note">{t('Overtone.studio.appliedHint')}</NimiText> : null}
    <ConfirmDialog open={creative.pendingDirection !== null} title={t('Overtone.playground.replaceTitle')} message={t('Overtone.playground.replaceMessage')}
      confirmLabel={t('Overtone.playground.replaceConfirm')} cancelLabel={t('Overtone.takes.cancel')} onClose={() => creative.setPendingDirection(null)}
      onConfirm={() => { if (creative.pendingDirection !== null) creative.applyDirection(creative.pendingDirection); }} />
  </section>;
}
