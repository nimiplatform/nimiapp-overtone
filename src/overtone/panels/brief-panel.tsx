import { useState } from 'react';
import { Button, FieldShell, InlineAlert, Popover, PopoverContent, PopoverTrigger, TextareaField, TextField } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import { useExploration } from '../exploration-context.js';
import { OvertoneIcon } from './icons.js';

// @nimi-authority: rule.overtone.exploration.r001
export function BriefPanel() {
  const { t } = useTranslation();
  const { readiness } = useOvertoneState();
  const { setAISettingsOpen } = useOvertoneActions();
  const creative = useExploration();
  const [sparksOpen, setSparksOpen] = useState(false);
  function surpriseMe() {
    const pick = (group: string) => t(`Overtone.playground.${group}.${Math.floor(Math.random() * 6)}`);
    creative.setIdea(t('Overtone.playground.collision', { scene: pick('scenes'), genre: pick('genres'), twist: pick('twists') }));
    document.getElementById('overtone-idea')?.focus();
  }
  return <section className="ot-composer">
    <div className="ot-composer__heading"><h1>{t('Overtone.studio.title')}</h1><span>{t('Overtone.studio.subtitle')}</span></div>
    <div className="ot-prompt-box">
      <TextareaField id="overtone-idea" className="ot-prompt-field" textareaClassName="ot-prompt-text" rows={2} maxLength={1500}
        aria-label={t('Overtone.brief.ideaLabel')} value={creative.idea} disabled={creative.exploring}
        placeholder={t('Overtone.studio.promptPlaceholder')} onChange={(event) => creative.setIdea(event.target.value)} />
      <div className="ot-prompt-toolbar">
        <div className="ot-prompt-tools">
          <Popover open={sparksOpen} onOpenChange={setSparksOpen}>
            <PopoverTrigger asChild><Button className="ot-tool-button" tone="ghost" size="sm" disabled={creative.exploring} leadingIcon={<OvertoneIcon name="spark" size={15} />}>{t('Overtone.studio.sparks')}</Button></PopoverTrigger>
            <PopoverContent align="start" className="ot-spark-menu"><h2>{t('Overtone.studio.sparkMenuTitle')}</h2>
              {['moon', 'rain', 'arcade'].map((key) => <Button className="ot-spark-choice" tone="ghost" key={key} trailingIcon={<OvertoneIcon name="arrow" size={16} />}
                onClick={() => { creative.setIdea(t(`Overtone.playground.sparks.${key}.prompt`)); setSparksOpen(false); }}>
                <span><strong>{t(`Overtone.playground.sparks.${key}.name`)}</strong><span>{t(`Overtone.playground.sparks.${key}.detail`)}</span></span>
              </Button>)}
            </PopoverContent>
          </Popover>
          <Button className="ot-tool-button" tone="ghost" size="sm" onClick={surpriseMe} disabled={creative.exploring} leadingIcon={<OvertoneIcon name="shuffle" size={15} />}>{t('Overtone.studio.shuffle')}</Button>
        </div>
        <Button className="ot-explore-button" tone="primary" loading={creative.exploring}
          disabled={!creative.idea.trim() || creative.exploring}
          trailingIcon={<OvertoneIcon name="arrow" size={17} />} onClick={() => { if (!readiness.textCapabilityAvailable) { setAISettingsOpen(true); return; } void creative.explore(); }}>
          {t(creative.exploring ? 'Overtone.playground.exploring' : 'Overtone.playground.explore')}
        </Button>
      </div>
    </div>
    {creative.error ? <InlineAlert tone="warning">{creative.error}</InlineAlert> : null}
    {creative.exploring ? <div className="ot-waiting" role="status" tabIndex={-1}><span className="ot-pulse" /><span>{t('Overtone.studio.exploringHint')}</span><Button tone="ghost" size="sm" onClick={creative.cancelExploration}>{t('Overtone.playground.stopExploring')}</Button></div> : null}
  </section>;
}

export function SoundNotes() {
  const { t } = useTranslation();
  const { project } = useOvertoneState();
  const { setBrief } = useOvertoneActions();
  const creative = useExploration();
  const brief = project?.brief;
  return <section className="ot-sound-notes">
    <div className="overtone-section__heading"><h3>{t('Overtone.playground.soundNotes')}</h3>
      <Button tone="ghost" size="sm" disabled={!creative.idea.trim() || creative.exploring} onClick={creative.applyOwnIdea}>{t('Overtone.playground.useOwnIdea')}</Button></div>
    {brief ? <div className="ot-notes-fields">
      {(['title', 'genre', 'mood', 'tempo'] as const).map((key) => <FieldShell key={key} label={t(`Overtone.brief.fields.${key}`)}>
        <TextField id={`overtone-brief-${key}`} value={brief[key]} maxLength={key === 'title' ? 80 : 160}
          onChange={(event) => setBrief({ ...brief, [key]: event.target.value })} />
      </FieldShell>)}
      <FieldShell className="ot-notes-description" label={t('Overtone.brief.fields.description')}>
        <TextareaField id="overtone-brief-description" rows={4} maxLength={1500} value={brief.description} onChange={(event) => setBrief({ ...brief, description: event.target.value })} />
      </FieldShell>
    </div> : <p className="ot-muted">{t('Overtone.studio.manualNotesHint')}</p>}
  </section>;
}
