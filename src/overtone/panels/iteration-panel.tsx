import { Button, NimiText } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import { useExploration } from '../exploration-context.js';
import { OvertoneIcon } from './icons.js';

// @nimi-authority: rule.overtone.exploration.r002
export function IterationPanel() {
  const { t } = useTranslation();
  const { project, readiness } = useOvertoneState();
  const { setAISettingsOpen } = useOvertoneActions();
  const creative = useExploration();
  const selected = project?.takes.find((take) => take.takeId === project.selectedTakeId && !take.discarded);
  if (!selected) return null;
  return <section className="overtone-whatif">
    <div className="overtone-section__heading"><h2><OvertoneIcon name="branch" />{t('Overtone.playground.whatIf')}</h2></div>
    <NimiText role="helper">{t('Overtone.playground.whatIfSource', { title: selected.title })}</NimiText>
    <div className="overtone-row">{['dream', 'dance', 'stripped'].map((key) => <Button key={key} tone="secondary" size="sm"
      disabled={creative.exploring || creative.arranging || creative.musicBusy}
      onClick={() => { if (!readiness.textCapabilityAvailable) { setAISettingsOpen(true); return; } void creative.explore(selected, t(`Overtone.playground.reinterpret.${key}.prompt`)); }}>{t(`Overtone.playground.reinterpret.${key}.name`)}</Button>)}</div>
    <NimiText role="caption">{t('Overtone.playground.reinterpretHint')}</NimiText>
  </section>;
}
