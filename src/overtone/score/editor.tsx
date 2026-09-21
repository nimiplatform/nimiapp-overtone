import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, FieldShell, InlineAlert, TextField } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { add, asNumber, auditionWindow, beat, compare, editNote, endOf, includeTiedNotes, scoreEnd, subtract, transposeNotes, validateDraft, type Beat, type ScoreDraft } from './model.js';
import { transposeScoreKey } from './abc.js';
import { auditionScore } from './audition.js';

const PITCHES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pitchName = (pitch: number) => `${PITCHES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
function readBeat(value: string): Beat {
  const match = value.trim().match(/^(\d+)(?:\/(\d+)|\.(\d{1,6}))?$/u);
  if (!match) throw new Error('score-number-invalid');
  if (match[2]) return beat(Number(match[1]), Number(match[2]));
  const scale = 10 ** (match[3]?.length ?? 0);
  return beat(Number(match[1]) * scale + Number(match[3] || 0), scale);
}
const writeBeat = (value: Beat) => value.d === 1 || Number.isInteger(1024 / value.d) ? String(asNumber(value)) : `${value.n}/${value.d}`;
const firstNotePage = (value: ScoreDraft) => Math.floor(asNumber(value.notes.find(note => note.pitch !== null)?.start ?? beat(0)) / 4) * 4;

// @nimi-authority: rule.overtone.score.r003
export function ScoreEditor({ initial, onSave, busy }: {
  initial: ScoreDraft;
  onSave: (draft: ScoreDraft) => Promise<void>;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<readonly ScoreDraft[]>([initial]);
  const draft = history[history.length - 1]!;
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [pageBeat, setPageBeat] = useState(() => firstNotePage(initial));
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  const playGeneration = useRef(0);
  const current = draft.notes.find(note => note.id === selected[0]);
  const [onset, setOnset] = useState(''); const [duration, setDuration] = useState(''); const [chord, setChord] = useState('');
  const [section, setSection] = useState('');
  const [tempo, setTempo] = useState(String(draft.tempo)); const [key, setKey] = useState(draft.key);
  useEffect(() => { setHistory([initial]); setSelected([]); setPageBeat(firstNotePage(initial)); setTempo(String(initial.tempo)); setKey(initial.key); }, [initial]);
  useEffect(() => { setTempo(String(draft.tempo)); setKey(draft.key); }, [draft.tempo, draft.key]);
  const stopAudition = () => { playGeneration.current += 1; stop.current?.(); stop.current = null; setPlaying(false); };
  useEffect(() => () => { playGeneration.current += 1; stop.current?.(); }, []);
  useEffect(() => {
    setOnset(current ? writeBeat(add(current.start, beat(1))) : '');
    setDuration(current ? writeBeat(current.duration) : '');
    setChord(current ? draft.chords.find(c => compare(c.at, current.start) === 0)?.symbol ?? '' : '');
    setSection(current ? draft.sections.find(s => compare(s.at, current.start) === 0)?.label ?? '' : '');
  }, [current, draft.chords, draft.sections]);
  const commit = (next: ScoreDraft) => {
    validateDraft(next); stopAudition(); setError(''); setHistory(previous => [...previous.slice(-31), next]);
  };
  const attempt = (action: () => void) => { try { action(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } };
  function select(id: string, extend = false) {
    setSelected(includeTiedNotes(draft, extend ? [...selected, id] : [id]));
  }
  async function play(value: ScoreDraft) {
    stopAudition(); const generation = playGeneration.current; setPlaying(true); setError('');
    try {
      const end = await auditionScore(auditionWindow(value, beat(pageBeat), beat(pageBeat + 16)), () => { if (generation === playGeneration.current) setPlaying(false); });
      if (generation !== playGeneration.current) end(); else stop.current = end;
    } catch (cause) { if (generation === playGeneration.current) { setPlaying(false); setError(String(cause)); } }
  }
  const visible = useMemo(() => draft.notes.filter(note => asNumber(endOf(note)) > pageBeat && asNumber(note.start) < pageBeat + 16), [draft, pageBeat]);
  const pitched = visible.flatMap(note => note.pitch === null ? [] : [note.pitch]);
  const lowest = Math.min(60, ...pitched) - 2; const highest = Math.max(72, ...pitched) + 2;
  const rowHeight = 14; const top = 24; const bottom = top + (highest - lowest + 1) * rowHeight;
  return <section className="ot-score-editor" aria-label={t('Overtone.score.editTitle')}>
    <div className="overtone-row">
      <Button tone="secondary" disabled={playing} onClick={() => void play(initial)}>{t('Overtone.score.hearBefore')}</Button>
      <Button tone="secondary" disabled={playing} onClick={() => void play(draft)}>{t('Overtone.score.hearAfter')}</Button>
      {playing ? <Button tone="ghost" onClick={stopAudition}>{t('Overtone.score.stop')}</Button> : null}
      <Button tone="ghost" disabled={history.length < 2 || busy} onClick={() => { stopAudition(); setHistory(previous => previous.slice(0, -1)); }}>{t('Overtone.score.undo')}</Button>
    </div>
    <p className="ot-score-help">{t('Overtone.score.synthHint')}</p>
    <div className="ot-score-window-controls">
      <Button tone="ghost" size="sm" disabled={pageBeat === 0} onClick={() => setPageBeat(value => Math.max(0, value - 16))}>{t('Overtone.score.previousPhrase')}</Button>
      <span>{t('Overtone.score.beatWindow', { from: pageBeat + 1, to: pageBeat + 16 })}</span>
      <Button tone="ghost" size="sm" disabled={pageBeat + 16 >= asNumber(scoreEnd(draft))} onClick={() => setPageBeat(value => value + 16)}>{t('Overtone.score.nextPhrase')}</Button>
      <Button tone="ghost" size="sm" onClick={() => setSelected(includeTiedNotes(draft, visible.map(note => note.id)))}>{t('Overtone.score.selectPhrase')}</Button>
    </div>
    <div className="ot-score-roll">
      <svg viewBox={`0 0 880 ${bottom + 22}`} aria-label={t('Overtone.score.melodyRoll')}>
        {Array.from({ length: highest - lowest + 1 }, (_, index) => <g key={index}>
          <line x1="48" x2="872" y1={top + index * rowHeight} y2={top + index * rowHeight} />
          {(highest - index) % 12 === 0 ? <text x="2" y={top + index * rowHeight + 4}>{pitchName(highest - index)}</text> : null}
        </g>)}
        {Array.from({ length: 17 }, (_, index) => <g key={index}>
          <line x1={48 + index * 51} x2={48 + index * 51} y1={top - 8} y2={bottom} />
          <text x={48 + index * 51} y="12">{pageBeat + index + 1}</text>
        </g>)}
        <text x="2" y={bottom - 3}>{t('Overtone.score.rest')}</text>
        {visible.map(note => {
          const x = 48 + Math.max(0, asNumber(note.start) - pageBeat) * 51;
          const until = Math.min(pageBeat + 16, asNumber(endOf(note)));
          const width = Math.max(4, (until - Math.max(pageBeat, asNumber(note.start))) * 51 - 2);
          return <rect key={note.id} x={x} y={note.pitch === null ? bottom - 8 : top + (highest - note.pitch) * rowHeight - 6}
            width={width} height={note.pitch === null ? 4 : 12} rx="2" data-rest={note.pitch === null} data-selected={selected.includes(note.id)}
            tabIndex={selected[0] === note.id || (!selected.length && note.id === visible[0]?.id) ? 0 : -1} role="button"
            aria-label={t('Overtone.score.noteLabel', { pitch: note.pitch === null ? t('Overtone.score.rest') : pitchName(note.pitch), beat: writeBeat(add(note.start, beat(1))), duration: writeBeat(note.duration) })}
            aria-pressed={selected.includes(note.id)} onClick={event => select(note.id, event.shiftKey)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(note.id, event.shiftKey); }
              if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); attempt(() => commit(transposeNotes(draft, selected.length ? selected : includeTiedNotes(draft, [note.id]), event.key === 'ArrowUp' ? 1 : -1))); }
            }} />;
        })}
      </svg>
    </div>
    <p className="ot-score-help">{t('Overtone.score.keyboardHint')}</p>
    <div className="overtone-row">
      <span>{t('Overtone.score.selectedCount', { count: selected.length })}</span>
      <Button tone="secondary" disabled={!selected.length || busy} onClick={() => attempt(() => commit(transposeNotes(draft, selected, -1)))}>{t('Overtone.score.lower')}</Button>
      <Button tone="secondary" disabled={!selected.length || busy} onClick={() => attempt(() => commit(transposeNotes(draft, selected, 1)))}>{t('Overtone.score.raise')}</Button>
    </div>
    {current ? <div className="ot-score-fields">
      <FieldShell label={t('Overtone.score.onset')}><TextField value={onset} onChange={event => setOnset(event.target.value)} disabled={busy} /></FieldShell>
      <FieldShell label={t('Overtone.score.duration')}><TextField value={duration} onChange={event => setDuration(event.target.value)} disabled={busy} /></FieldShell>
      <FieldShell label={t('Overtone.score.chord')}><TextField value={chord} onChange={event => setChord(event.target.value)} disabled={busy} /></FieldShell>
      <FieldShell label={t('Overtone.score.section')}><TextField value={section} onChange={event => setSection(event.target.value)} disabled={busy} /></FieldShell>
      <Button tone="secondary" disabled={selected.length !== 1 || busy} onClick={() => attempt(() => {
        const next = editNote(draft, current.id, { start: subtract(readBeat(onset), beat(1)), duration: readBeat(duration) });
        const at = next.notes.find(n => n.id === current.id)!.start;
        commit({ ...next, chords: [...next.chords.filter(c => compare(c.at, current.start) !== 0), ...(chord.trim() ? [{ at, symbol: chord.trim() }] : [])],
          sections: [...next.sections.filter(s => compare(s.at, current.start) !== 0), ...(section.trim() ? [{ at, label: section.trim() }] : [])] });
      })}>{t('Overtone.score.applyNote')}</Button>
    </div> : null}
    <div className="ot-score-fields">
      <FieldShell label={t('Overtone.score.tempo')}><TextField type="number" min={20} max={400} value={tempo} onChange={event => setTempo(event.target.value)} disabled={busy} /></FieldShell>
      <FieldShell label={t('Overtone.score.key')}><TextField value={key} onChange={event => setKey(event.target.value)} disabled={busy} /></FieldShell>
      <Button tone="secondary" disabled={busy} onClick={() => attempt(() => commit({ ...transposeScoreKey(draft, key), tempo: Number(tempo) }))}>{t('Overtone.score.applyScore')}</Button>
    </div>
    <p className="ot-score-help">{t('Overtone.score.keyHint')}</p>
    {error ? <InlineAlert tone="warning">{t(`Overtone.score.errors.${error.split(':')[0]}`, { defaultValue: t('Overtone.score.editRejected') })}<details><summary>{t('Overtone.playground.errorDetails')}</summary>{error}</details></InlineAlert> : null}
    <Button tone="primary" loading={busy} disabled={busy} onClick={() => { stopAudition(); void onSave(draft).catch(cause => setError(String(cause))); }}>{t('Overtone.score.saveCopy')}</Button>
  </section>;
}
