import { useEffect, useRef, useState } from 'react';
import abcjs from 'abcjs';
import { Midi } from '@tonejs/midi';
import { Button, FieldShell, InlineAlert, SelectField, TextareaField } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import { readOwnedAsset } from '../runtime-workflow.js';
import { makeId, type ScoreDocument } from '../types.js';
import { listABCVoices, parseABCLeadSheet, serializeABCLeadSheet } from './abc.js';
import { draftFromMidi, listMidiTracks } from './midi.js';
import type { ScoreDraft } from './model.js';
import { ScoreEditor } from './editor.js';
import { prepareMidiConversion } from './export-midi.js';
import './score.css';

function parseABC(source: string) {
  listABCVoices(source);
  const tunes = abcjs.parseOnly(source);
  if (tunes.length !== 1 || tunes[0]?.warnings?.length) throw new Error('OVERTONE_ABC_INVALID');
  return source;
}

// @nimi-authority: rule.overtone.score.r001
// @nimi-authority: rule.overtone.score.r004
export function ScorePanel() {
  const { t } = useTranslation();
  const { project, activeJobs, readiness } = useOvertoneState();
  const { addScore, selectScore, useScoreForGeneration, setScoreBudget } = useOvertoneActions();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [source, setSource] = useState(''); const [midi, setMidi] = useState<Midi | null>(null);
  const [voice, setVoice] = useState(''); const [sourceEdit, setSourceEdit] = useState('');
  const [draft, setDraft] = useState<ScoreDraft | null>(null);
  const [conversion, setConversion] = useState<(ReturnType<typeof prepareMidiConversion> & { parent: ScoreDocument }) | null>(null);
  const picker = useRef<HTMLInputElement>(null); const notation = useRef<HTMLDivElement>(null);
  const selected = project?.scores.find(score => score.scoreId === project.selectedScoreId);
  const generationBusy = Object.keys(activeJobs).length > 0;
  const profile = readiness.musicInput?.generation.find(item => item.scoreMode === 'required');
  useEffect(() => {
    const controller = new AbortController();
    setSource(''); setMidi(null); setDraft(null); setConversion(null); setError('');
    if (!open || !selected) return () => controller.abort();
    setLoading(true);
    void readOwnedAsset(getNimiLocalAppClient(), selected.asset, controller.signal, 1024 * 1024).then(bytes => {
      if (controller.signal.aborted) return;
      if (selected.format === 'abc') {
        const abc = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        setSource(abc); setSourceEdit(abc); setVoice(listABCVoices(abc)[0]!.id);
      } else {
        const value = new Midi(bytes); setMidi(value); setVoice(String(listMidiTracks(value)[0]?.index ?? ''));
      }
    }).catch(cause => { if (!controller.signal.aborted) setError(String(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, selected]);
  useEffect(() => {
    if (!notation.current || !source || !open) return;
    try { abcjs.renderAbc(notation.current, source, { responsive: 'resize', staffwidth: 700, ariaLabel: t('Overtone.score.originalNotation') }); }
    catch (cause) { setError(String(cause)); }
  }, [source, open, t]);
  async function saveBytes(bytes: Uint8Array, format: ScoreDocument['format'], title: string, parent?: ScoreDocument, losses: readonly string[] = []) {
    if (!project) return;
    const projectId = project.projectId;
    if (!bytes.length || bytes.length > 1024 * 1024) throw new Error('OVERTONE_SCORE_TOO_LARGE');
    const scoreId = makeId('score');
    const mediaType = format === 'abc' ? 'text/vnd.abc' : 'audio/midi';
    const asset = await getNimiLocalAppClient().storage.assets.write({ relativePath: `scores/${scoreId}.${format === 'abc' ? 'abc' : 'mid'}`,
      body: bytes, mediaType, overwrite: false });
    if (asset.mediaType !== mediaType || asset.sizeBytes !== bytes.length) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
    await addScore(projectId, { scoreId, title: title.slice(0, 80), format, createdAt: Date.now(),
      origin: parent ? parent.format === format ? 'author-edit' : 'explicit-conversion' : 'imported',
      ...(parent ? { parentScoreId: parent.scoreId } : {}), ...(losses.length ? { losses } : {}),
      asset: { relativePath: asset.relativePath, mimeType: asset.mediaType!, sizeBytes: asset.sizeBytes, sha256: asset.sha256 } });
  }
  async function importFile(file: File) {
    setBusy(true); setError('');
    try {
      if (file.size > 1024 * 1024) throw new Error('OVERTONE_SCORE_TOO_LARGE');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const format = /\.abc$/iu.test(file.name) ? 'abc' : /\.midi?$/iu.test(file.name) ? 'midi' : null;
      if (!format) throw new Error('OVERTONE_SCORE_FORMAT_UNSUPPORTED');
      if (format === 'abc') parseABC(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      else if (!listMidiTracks(new Midi(bytes)).length) throw new Error('OVERTONE_MIDI_EMPTY');
      await saveBytes(bytes, format, file.name);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }
  async function saveEdited(value: string, losses: readonly string[] = []) {
    if (!selected) return;
    setBusy(true); setError('');
    try { parseABC(value); await saveBytes(new TextEncoder().encode(value), 'abc', selected.title, selected, losses); }
    finally { setBusy(false); }
  }
  const voices = source ? listABCVoices(source).map(v => ({ value: v.id, label: v.label || t('Overtone.score.melodyVoice') }))
    : midi ? listMidiTracks(midi).map(v => ({ value: String(v.index), label: v.name || t('Overtone.score.track', { number: v.index + 1 }) })) : [];
  return <details id="ot-score-panel" className="ot-score-panel" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{t('Overtone.score.title')}</summary>
    <div className="ot-score-content">
      <p>{t('Overtone.score.intro')}</p>
      <input ref={picker} type="file" accept=".abc,.mid,.midi" hidden onChange={event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void importFile(file);
      }} />
      <div className="overtone-row"><Button tone="secondary" disabled={busy || !project} onClick={() => picker.current?.click()}>{t('Overtone.score.import')}</Button>
        {project?.scores.length ? <SelectField value={project.selectedScoreId ?? ''} options={project.scores.map((score, i) => ({ value: score.scoreId,
          label: `${i + 1}. ${score.title || t('Overtone.score.untitled')} · ${t(`Overtone.score.origins.${score.origin}`)}` }))}
          onChange={event => selectScore(event.currentTarget.value)} aria-label={t('Overtone.score.chooseScore')} disabled={busy} /> : null}
      </div>
      {loading ? <p role="status">{t('Overtone.score.loading')}</p> : null}
      {selected?.truncated ? <InlineAlert tone="warning">{t('Overtone.score.truncated')}</InlineAlert> : null}
      {selected && !loading ? <>
        <div className="overtone-row"><Button tone="primary" active={project?.generationScoreId === selected.scoreId} aria-pressed={project?.generationScoreId === selected.scoreId}
          disabled={busy || generationBusy || !profile?.scoreFormats.includes(selected.format)} onClick={() => useScoreForGeneration(selected.scoreId)}>{t(project?.generationScoreId === selected.scoreId ? 'Overtone.score.usingScore' : 'Overtone.score.useScore')}</Button>
          {project?.generationScoreId ? <Button tone="ghost" onClick={() => useScoreForGeneration(null)}>{t('Overtone.score.clearCondition')}</Button> : null}
          <Button tone="ghost" onClick={() => void getNimiLocalAppClient().storage.assets.reveal(selected.asset.relativePath).catch(cause => setError(String(cause)))}>{t('Overtone.score.reveal')}</Button>
        </div>
        {!profile?.scoreFormats.includes(selected.format) ? <p>{t('Overtone.score.configurationNeeded')}</p> : <FieldShell label={t('Overtone.score.budget')}>
          <SelectField value={String(project?.scoreBudgetSeconds ?? 20)} disabled={generationBusy}
            options={[20, 60, 120, 180].filter(seconds => seconds <= profile.maxDurationSeconds).map(seconds => ({ value: String(seconds), label: t('Overtone.score.seconds', { count: seconds }) }))}
            onChange={event => setScoreBudget(Number(event.currentTarget.value))} />
        </FieldShell>}
        <p className="ot-score-help">{t('Overtone.score.regenerationHint')}</p>
        {selected.losses?.length ? <ul className="ot-score-losses">{selected.losses.map(loss => <li key={loss}>{t(`Overtone.score.losses.${loss}`)}</li>)}</ul> : null}
        {selected.parentScoreId ? <Button tone="ghost" size="sm" onClick={() => selectScore(selected.parentScoreId!)}>{t('Overtone.score.viewParent')}</Button> : null}
        {source ? <details className="ot-score-original" open={!draft}><summary>{t('Overtone.score.originalNotation')}</summary><div ref={notation} className="ot-score-notation" /></details> : null}
        <FieldShell label={t('Overtone.score.voice')}><SelectField value={voice} options={voices} disabled={busy}
          onChange={event => setVoice(event.currentTarget.value)} /></FieldShell>
        <p className="ot-score-help">{t('Overtone.score.deriveHint')}</p>
        <Button tone="secondary" disabled={!voice || busy} onClick={() => {
          try { setDraft(source ? parseABCLeadSheet(source, voice) : draftFromMidi(midi!, Number(voice))); setError(''); }
          catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
        }}>{t('Overtone.score.derive')}</Button>
        {draft ? <>
          {draft.losses.length ? <ul className="ot-score-losses">{draft.losses.map(loss => <li key={loss}>{t(`Overtone.score.losses.${loss}`)}</li>)}</ul> : null}
          <ScoreEditor initial={draft} busy={busy} onSave={value => saveEdited(serializeABCLeadSheet(value), value.losses)} />
        </> : null}
        {source ? <details className="ot-score-source"><summary>{t('Overtone.score.source')}</summary>
          <TextareaField value={sourceEdit} textareaClassName="ot-score-code" aria-label={t('Overtone.score.source')} onChange={event => setSourceEdit(event.currentTarget.value)} />
          <Button tone="secondary" disabled={busy || sourceEdit === source} onClick={() => void saveEdited(sourceEdit).catch(cause => setError(String(cause)))}>{t('Overtone.score.saveSource')}</Button>
        </details> : null}
        {source ? <Button tone="ghost" disabled={busy} onClick={() => {
          try { setConversion({ ...prepareMidiConversion(source), parent: selected }); setError(''); }
          catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
        }}>{t('Overtone.score.convertMidi')}</Button> : null}
        {conversion ? <section className="ot-score-conversion" aria-label={t('Overtone.score.conversionReview')}>
          <p>{t('Overtone.score.midiConversionHint')}</p>
          {conversion.losses.length ? <ul className="ot-score-losses">{conversion.losses.map(loss => <li key={loss}>{t(`Overtone.score.losses.${loss}`)}</li>)}</ul> : null}
          <div className="overtone-row"><Button tone="secondary" disabled={busy} onClick={() => {
            setBusy(true); void saveBytes(conversion.bytes, 'midi', conversion.parent.title, conversion.parent, conversion.losses)
              .catch(cause => setError(String(cause))).finally(() => setBusy(false));
          }}>{t('Overtone.score.acceptMidi')}</Button><Button tone="ghost" disabled={busy} onClick={() => setConversion(null)}>{t('Overtone.score.cancelConversion')}</Button></div>
        </section> : null}
      </> : null}
      {error ? <InlineAlert tone="warning">{t(`Overtone.score.errors.${error.split(':')[0]}`, { defaultValue: t('Overtone.score.unavailable') })}
        <details><summary>{t('Overtone.playground.errorDetails')}</summary>{error}</details></InlineAlert> : null}
    </div>
  </details>;
}
