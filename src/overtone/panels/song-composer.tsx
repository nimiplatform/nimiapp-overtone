import { useState } from 'react';
import { Button, FieldShell, InlineAlert, SegmentedControl, TextareaField, TextField } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertoneActions, useOvertonePlayback, useOvertoneState } from '../store.js';
import { useExploration } from '../exploration-context.js';
import { OvertoneIcon } from './icons.js';
import type { FullSongDraft, SongSection } from '../types.js';

// @nimi-authority: rule.overtone.workflow.r012
export function SongComposer() {
  const { t } = useTranslation();
  const { project, readiness } = useOvertoneState();
  const { setFullSong, setAISettingsOpen } = useOvertoneActions();
  const playback = useOvertonePlayback();
  const creative = useExploration();
  const [selectedSection, setSelectedSection] = useState(0);
  const draft = project?.fullSong;
  if (!draft) return null;
  const sections = creative.songCandidate?.sections ?? draft.sections;
  const index = Math.min(selectedSection, Math.max(0, sections.length - 1));
  const section = sections[index];
  const sectionName = (sectionIndex: number) => {
    const entry = sections[sectionIndex]!;
    const occurrence = sections.slice(0, sectionIndex + 1).filter(section => section.kind === entry.kind).length;
    const repeated = sections.filter(section => section.kind === entry.kind).length > 1;
    return `${t(`Overtone.song.sectionKinds.${entry.kind}`)}${repeated ? ` ${occurrence}` : ''}`;
  };
  const readOnly = creative.arranging || creative.musicBusy || !!creative.songCandidate;
  function editSection(change: Partial<SongSection>) {
    if (!draft || readOnly) return;
    setFullSong({ ...draft, sections: draft.sections.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...change } : entry) });
  }
  return <section className="ot-song-composer" aria-label={t('Overtone.song.title')}>
    <div className="ot-song-heading"><h1>{t('Overtone.song.title')}</h1><span>{t('Overtone.song.directionLocked')}</span></div>
    <div className="ot-song-source"><div><span>{t('Overtone.song.fromSketch')}</span><strong>{draft.sourceTitle}</strong></div>
      <Button tone="secondary" size="sm" leadingIcon={<OvertoneIcon name="play" size={14}/>} onClick={() => playback.requestTake(draft.sourceTakeId)}>{t('Overtone.song.listenSource')}</Button>
    </div>
    <p className="ot-song-hint">{t('Overtone.song.hint')}</p>
    <div className="ot-song-controls">
      <FieldShell label={t('Overtone.song.name')}><TextField value={draft.title} maxLength={80} disabled={readOnly} onChange={event => setFullSong({ ...draft, title: event.target.value })}/></FieldShell>
      <FieldShell label={t('Overtone.song.duration')}><SegmentedControl value={String(draft.durationSeconds)} ariaLabel={t('Overtone.song.duration')}
        items={[90,120,180].map(seconds => ({ value: String(seconds), label: t(`Overtone.song.duration${seconds}`), disabled: readOnly }))}
        onValueChange={value => { if (!readOnly) setFullSong({ ...draft, durationSeconds: Number(value) as FullSongDraft['durationSeconds'] }); }}/></FieldShell>
    </div>
    {sections.length ? <>
      <div className="ot-song-score-heading"><h2>{t(creative.songCandidate ? 'Overtone.song.candidate' : 'Overtone.song.structure')}</h2>
        <Button tone="ghost" size="sm" disabled={readOnly} onClick={() => { if (!readiness.textCapabilityAvailable) { setAISettingsOpen(true); return; } void creative.arrangeSong(); }}>{t('Overtone.song.rearrange')}</Button></div>
      <div className="ot-song-score" role="group" aria-label={t('Overtone.song.sections')}>
        {sections.map((entry, entryIndex) => <Button key={entryIndex} tone="ghost" className="ot-song-section" aria-pressed={index === entryIndex}
          data-selected={index === entryIndex} onClick={() => setSelectedSection(entryIndex)}><span>{String(entryIndex + 1).padStart(2, '0')}</span><strong>{sectionName(entryIndex)}</strong></Button>)}
      </div>
      {section ? <div className="ot-song-section-editor">
        <div className="ot-song-section-label"><span>{String(index + 1).padStart(2, '0')}</span><h3>{sectionName(index)}</h3><span>{t('Overtone.song.intentLabel')}</span></div>
        <FieldShell label={t('Overtone.song.arrangement')}><TextareaField rows={2} value={section.arrangement} maxLength={200} disabled={readOnly} onChange={event => editSection({ arrangement: event.target.value })}/></FieldShell>
        <FieldShell label={t('Overtone.song.sectionLyrics')}><TextareaField className="ot-song-lyrics" rows={5} value={section.lyrics} maxLength={900} disabled={readOnly} placeholder={t('Overtone.song.instrumentalSection')} onChange={event => editSection({ lyrics: event.target.value })}/></FieldShell>
      </div> : null}
      {creative.songCandidate ? <div className="overtone-row"><Button tone="primary" onClick={creative.applySongCandidate}>{t('Overtone.song.applyPlan')}</Button><Button tone="ghost" onClick={() => creative.setSongCandidate(null)}>{t('Overtone.song.keepPlan')}</Button></div> : null}
    </> : <div className="ot-song-empty"><OvertoneIcon name="music" size={38}/><h2>{t('Overtone.song.emptyTitle')}</h2><p>{t('Overtone.song.emptyHint')}</p>
      <div className="ot-song-empty-sequence">{['verse','chorus','bridge','ending'].map(key => <span key={key}>{t(`Overtone.song.${key}`)}</span>)}</div>
    </div>}
    {creative.songError ? <InlineAlert tone="warning">{creative.songError}</InlineAlert> : null}
    <details className="ot-song-reference"><summary>{t('Overtone.song.lockedNotes')}</summary><p>{draft.sourcePrompt}</p><p className="overtone-lyric-sketch">{draft.sourceLyrics}</p></details>
  </section>;
}
