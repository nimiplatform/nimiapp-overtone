import { RecoverableResults } from './recoverable-results.js';
import { useState } from 'react';
import { ActionMenu, Button, IconButton, NimiText, Popover, PopoverContent, PopoverTrigger, TextField, type NimiMenuItem } from '@nimiplatform/kit/ui';
import { GenerationStatusList, type GenerationStatusListProps } from '@nimiplatform/kit/features/generation/ui';
import { useTranslation } from 'react-i18next';
import { useOvertoneActions, useOvertonePlayback, useOvertoneState, useAudioSnapshot } from '../store.js';
import type { SongTake } from '../types.js';
import { Waveform } from './waveform.js';
import { OvertoneIcon } from './icons.js';
import { formatAudioTime } from '../exploration.js';
import { useExploration } from '../exploration-context.js';
import { belongsToSongDraft, songFallsShort } from '../full-song.js';
import { ImportRecording } from './import-recording.js';

// @nimi-authority: rule.overtone.ia.r004
export function TakesPanel() {
  const { t } = useTranslation();
  const state = useOvertoneState();
  const { clearCompare } = useOvertoneActions();
  const playback = useOvertonePlayback();
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const project = state.project;
  const takes = [...project?.takes ?? []].filter(take=>!take.discarded).sort((a,b)=>b.createdAt-a.createdAt);
  const shown = favoritesOnly ? takes.filter(take=>take.favorite) : takes;
  const compared = project?.comparedTakeIds.map(id=>takes.find(take=>take.takeId===id) ?? null) ?? [null,null];
  const jobItems: GenerationStatusListProps['items'] = Object.values(state.activeJobs).map(job=>({runId:job.jobId,status:job.status,label:t('Overtone.takes.generating')}));
  return <div className="overtone-takes-stack">
    <div className="ot-shelf-heading"><div><h2>{t('Overtone.studio.recordings')}</h2><span>{t('Overtone.studio.recordingCount',{count:takes.length})}</span></div>
      <IconButton className="ot-tool-button" size="sm" tone="ghost" active={favoritesOnly} aria-label={t('Overtone.studio.favoritesOnly')} aria-pressed={favoritesOnly}
        icon={<OvertoneIcon name="heart" size={18} />} onClick={()=>setFavoritesOnly(!favoritesOnly)} /></div>
    {compared.some(Boolean) ? <section className="ot-compare-dock" aria-label={t('Overtone.takes.compareTitle')}>
      <div className="ot-compare-heading"><strong>{t('Overtone.takes.compareTitle')}</strong><Button tone="ghost" size="sm" className="ot-tool-button" onClick={clearCompare}>{t('Overtone.takes.exitCompare')}</Button></div>
      <div className="overtone-compare__grid">{compared.map((take,index)=><Button key={index} tone="ghost" className="ot-compare-switch" disabled={!take}
        active={take?.takeId===playback.playingTakeId} title={take ? `${take.title} · ${t('Overtone.studio.compareHint')}` : t('Overtone.studio.chooseCompare')} onClick={()=>{if(take)playback.requestTake(take.takeId,true);}}>
        <span className="ot-compare-switch__content"><strong>{index===0?'A':'B'}</strong><span className="ot-compare-identity">
          <span className="ot-compare-title">{take?.title||t('Overtone.studio.chooseCompare')}</span>
          {take ? <span className="ot-compare-number">{t('Overtone.studio.recordingNumber', { number: String(takes.length-takes.indexOf(take)).padStart(2,'0') })}</span> : null}
        </span><OvertoneIcon name="play" size={14}/></span>
      </Button>)}</div>
    </section> : <p className="ot-shelf-hint">{t('Overtone.studio.compareIntro')}</p>}
    {jobItems.length ? <div className="ot-generation-status"><GenerationStatusList items={jobItems} getStatusLabel={status=>t(`Overtone.runtime.status.${status==='pending'?'queued':status}`)} /></div> : null}
    <ImportRecording /><RecoverableResults /><div className="ot-take-list">
      {shown.map((take,index)=><TakeRow key={take.takeId} take={take} ordinal={takes.length-takes.indexOf(take)} isSelected={take.takeId===project?.selectedTakeId} />)}
      {!shown.length ? <div className="ot-shelf-empty"><OvertoneIcon name="music" size={35}/><h3>{t(favoritesOnly?'Overtone.studio.noFavorites':'Overtone.studio.firstSound')}</h3><p>{t(favoritesOnly?'Overtone.studio.noFavoritesHint':'Overtone.studio.firstSoundHint')}</p>{favoritesOnly?<Button tone="secondary" size="sm" onClick={()=>setFavoritesOnly(false)}>{t('Overtone.studio.showAll')}</Button>:null}</div> : null}
    </div>
  </div>;
}

function TakeRow({take,ordinal,isSelected}:{take:SongTake;ordinal:number;isSelected:boolean}) {
  const {t}=useTranslation();
  const state=useOvertoneState();
  const playback=useOvertonePlayback();
  const creative=useExploration();
  const {selectTake,selectScore,favoriteTake,renameTake,discardTake,setCompareSlot}=useOvertoneActions();
  const [menuOpen,setMenuOpen]=useState(false);
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState(take.title);
  const slots=state.project?.comparedTakeIds ?? [null,null];
  const parent=state.project?.takes.find(entry=>entry.takeId===take.parentTakeId);
  const playing=playback.playingTakeId===take.takeId;
  function compare(slot:0|1) {
    const other=slot===0?1:0;
    if(slots[other]===take.takeId)setCompareSlot(other,null);
    setCompareSlot(slot,slots[slot]===take.takeId?null:take.takeId);
  }
  const menu:NimiMenuItem[]=[
    {id:'rename',label:t('Overtone.takes.rename'),onSelect:()=>{setDraft(take.title);setEditing(true);}},
    {id:'discard',label:t('Overtone.takes.discard'),tone:'danger',onSelect:()=>discardTake(take.takeId)},
  ];
  return <article className="ot-take-row" data-selected={isSelected} data-playing={playing}>
    <div className="ot-take-row__head">
      <Button className="ot-take-play" tone={playing?'primary':'ghost'} aria-label={t(playing?'Overtone.player.pause':'Overtone.playground.playTake',{title:take.title})}
        onClick={()=>playing?playback.togglePlayback():playback.requestTake(take.takeId)}><OvertoneIcon name={playing?'pause':'play'} size={19}/></Button>
      <div className="ot-take-info"><Button tone="ghost" className="ot-take-title" aria-pressed={isSelected} onClick={()=>selectTake(take.takeId)}>{take.title}</Button>
        <span>{String(ordinal).padStart(2,'0')}<span> / </span>{formatAudioTime(take.durationSeconds??0)}<span> · </span>{t(take.origin === 'imported-recording' ? 'Overtone.recording.imported' : take.origin === 'local-render' ? 'Overtone.recording.localRender' : take.creationMode === 'song'
          ? songFallsShort(take.durationSeconds ?? 0, take.targetDurationSeconds ?? 120) ? 'Overtone.song.shortResult' : 'Overtone.song.longResult'
          : 'Overtone.song.sketch')}</span></div>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}><PopoverTrigger asChild><IconButton className="ot-more-button" size="sm" tone="ghost" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="13" cy="8" r="1.3"/></svg>} aria-label={t('Overtone.takes.moreActions')}/></PopoverTrigger>
        <PopoverContent align="end" className="ot-take-menu"><ActionMenu ariaLabel={t('Overtone.takes.moreActions')} items={menu.map(item=>({...item,onSelect:()=>{setMenuOpen(false);item.onSelect?.();}}))}/></PopoverContent></Popover>
    </div>
    {editing?<form className="ot-rename-form" onSubmit={event=>{event.preventDefault();renameTake(take.takeId,draft.trim()||take.title);setEditing(false);}}>
      <TextField autoFocus aria-label={t('Overtone.takes.rename')} value={draft} maxLength={80} onChange={event=>setDraft(event.target.value)}/>
      <Button type="submit" tone="primary" size="sm">{t('Overtone.takes.save')}</Button><Button type="button" tone="ghost" size="sm" onClick={()=>setEditing(false)}>{t('Overtone.takes.cancel')}</Button>
    </form>:null}
    <div className="ot-take-row__sound"><TakeWaveformPreview artifactId={take.audio.relativePath}/>
      <div className="ot-take-shortcuts"><Button size="sm" tone="ghost" className="ot-compare-slot" active={slots[0]===take.takeId} aria-pressed={slots[0]===take.takeId} aria-label={t('Overtone.takes.setCompareA')} onClick={()=>compare(0)}>A</Button>
        <Button size="sm" tone="ghost" className="ot-compare-slot" active={slots[1]===take.takeId} aria-pressed={slots[1]===take.takeId} aria-label={t('Overtone.takes.setCompareB')} onClick={()=>compare(1)}>B</Button>
        <IconButton size="sm" tone="ghost" className="ot-favorite" active={take.favorite} aria-label={t(take.favorite?'Overtone.takes.favoriteActive':'Overtone.takes.favoriteInactive')} aria-pressed={take.favorite} onClick={()=>favoriteTake(take.takeId)} icon={<OvertoneIcon name="heart" size={15}/>}/></div>
    </div>
    {parent?<p className="ot-take-parent"><OvertoneIcon name="branch" size={12}/>{t('Overtone.takes.fromParent',{title:parent.title})}</p>:null}
    {take.origin === 'runtime-result' && take.termination === 'budget-limit' ? <p className="ot-take-parent">{t('Overtone.score.budgetLimit')}</p> : null}
    {take.scoreId || take.inputScoreId ? <Button tone="ghost" size="sm" onClick={() => {
      selectScore((take.scoreId || take.inputScoreId)!); const panel = document.querySelector<HTMLDetailsElement>('#ot-score-panel');
      if (panel) { panel.open = true; panel.scrollIntoView({ block: 'nearest' }); }
    }}>{t(take.scoreId ? 'Overtone.score.openGenerated' : 'Overtone.score.openInput')}</Button> : null}
    {isSelected && take.promptSnapshot.trim() ? <Button className="ot-finish-song" tone="secondary" size="sm" disabled={creative.arranging || creative.musicBusy || Object.keys(state.activeJobs).length > 0}
      trailingIcon={<OvertoneIcon name="arrow" size={14}/>} onClick={() => creative.startSong(take)}>
      {t(belongsToSongDraft(take, state.project?.fullSong) ? 'Overtone.song.resume' : state.project?.fullSong ? 'Overtone.song.startAnother' : 'Overtone.song.start')}</Button> : null}
  </article>;
}

function TakeWaveformPreview({artifactId}:{artifactId:string}) {
  const {t}=useTranslation();
  const media = useAudioSnapshot(artifactId);
  if (!media) return <span className="ot-waveform-status">{t('Overtone.playground.waveformOnListen')}</span>;
  return <Waveform peaks={media.peaks} currentTime={0} duration={0} trimStart={null} trimEnd={null} onSeek={()=>{}} variant="mini"/>;
}
