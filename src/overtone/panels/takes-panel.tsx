import { useEffect, useState } from 'react';
import { Button, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import { Waveform } from './waveform.js';

interface TakesPanelProps {
  onPublish: (takeId: string) => void;
}

export function TakesPanel({ onPublish }: TakesPanelProps) {
  const state = useOvertoneState();
  const { selectTake, favoriteTake, renameTake, discardTake, setCompareSlot, clearCompare } = useOvertoneActions();
  const project = state.project;
  if (!project) return null;

  const visibleTakes = project.takes.filter((take) => !take.discarded).sort((a, b) => b.createdAt - a.createdAt);
  const hasCompare = project.comparedTakeIds[0] || project.comparedTakeIds[1];
  const compareA = visibleTakes.find((take) => take.takeId === project.comparedTakeIds[0]) ?? null;
  const compareB = visibleTakes.find((take) => take.takeId === project.comparedTakeIds[1]) ?? null;

  if (visibleTakes.length === 0 && Object.keys(state.activeJobs).length === 0) {
    return (
      <div className="overtone-empty">
        <div>
          <p>No takes yet. Use Generate to produce your first take.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overtone-section" style={{ minHeight: '100%' }}>
      <div className="overtone-section__heading">
        <h2>Takes ({visibleTakes.length})</h2>
        {hasCompare ? (
          <Button type="button" tone="secondary" size="sm" onClick={clearCompare}>Exit Compare</Button>
        ) : null}
      </div>

      {compareA && compareB ? (
        <Surface tone="panel" padding="md" className="overtone-compare">
          <div className="overtone-section__heading">
            <h3>A/B Compare</h3>
            <StatusBadge tone="info">2 takes</StatusBadge>
          </div>
          <div className="overtone-compare__grid">
            <CompareTakePanel slot="A" take={compareA} buffer={state.audioBuffers[compareA.takeId] ?? null} />
            <CompareTakePanel slot="B" take={compareB} buffer={state.audioBuffers[compareB.takeId] ?? null} />
          </div>
        </Surface>
      ) : hasCompare ? (
        <Surface tone="card" padding="sm" className="overtone-compare overtone-compare--partial">
          <span>Select both A and B slots to compare takes.</span>
        </Surface>
      ) : null}

      {Object.values(state.activeJobs).length > 0 ? (
        <div className="overtone-take-grid">
          {Object.values(state.activeJobs).map((job) => (
            <Surface key={job.jobId} tone="card" padding="md" className="overtone-take-card">
              <p className="overtone-take-card__title">{job.progressLabel || 'Generating...'}</p>
              <p className="overtone-take-card__meta">{job.errorMessage || 'Awaiting runtime…'}</p>
            </Surface>
          ))}
        </div>
      ) : null}

      <div className="overtone-take-grid">
        {visibleTakes.map((take) => {
          const isSelected = take.takeId === project.selectedTakeId;
          const buffer = state.audioBuffers[take.takeId];
          return (
            <Surface
              key={take.takeId}
              tone="card"
              padding="md"
              className="overtone-take-card"
              data-selected={isSelected}
              onClick={() => selectTake(take.takeId)}
            >
              <TakeWaveformPreview buffer={buffer ?? null} />
              <div className="overtone-row" style={{ justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0 }}>
                  <p className="overtone-take-card__title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {take.title}
                  </p>
                  <p className="overtone-take-card__meta">
                    {new Date(take.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <StatusBadge tone="info">{take.origin}</StatusBadge>
              </div>
              {take.parentTakeId ? (
                <p className="overtone-take-card__meta">↳ from {project.takes.find((t) => t.takeId === take.parentTakeId)?.title || take.parentTakeId}</p>
              ) : null}
              <div className="overtone-row" onClick={(event) => event.stopPropagation()}>
                <Button
                  type="button"
                  tone={take.favorite ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => favoriteTake(take.takeId)}
                >
                  {take.favorite ? '★ Favorite' : '☆ Favorite'}
                </Button>
                <Button type="button" tone="secondary" size="sm" onClick={() => setCompareSlot(0, take.takeId)}>A</Button>
                <Button type="button" tone="secondary" size="sm" onClick={() => setCompareSlot(1, take.takeId)}>B</Button>
                <RenameAffordance takeId={take.takeId} currentTitle={take.title} onRename={renameTake} />
                <Button type="button" tone="secondary" size="sm" onClick={() => discardTake(take.takeId)}>Discard</Button>
                {isSelected ? (
                  <Button type="button" tone="primary" size="sm" onClick={() => onPublish(take.takeId)}>Publish…</Button>
                ) : null}
              </div>
            </Surface>
          );
        })}
      </div>
    </div>
  );
}

function RenameAffordance({ takeId, currentTitle, onRename }: { takeId: string; currentTitle: string; onRename: (id: string, title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentTitle);

  if (!editing) {
    return <Button type="button" tone="secondary" size="sm" onClick={() => { setDraft(currentTitle); setEditing(true); }}>Rename</Button>;
  }

  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      <input
        className="nimi-input"
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        style={{ width: 140 }}
        autoFocus
      />
      <Button
        type="button"
        tone="primary"
        size="sm"
        onClick={() => { onRename(takeId, draft.trim() || currentTitle); setEditing(false); }}
      >
        Save
      </Button>
      <Button type="button" tone="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
    </span>
  );
}

function TakeWaveformPreview({ buffer }: { buffer: ArrayBuffer | null }) {
  const [decoded, setDecoded] = useState<AudioBuffer | null>(null);

  useEffect(() => {
    if (!buffer) {
      setDecoded(null);
      return;
    }
    const ctx = new AudioContext();
    let cancelled = false;
    ctx.decodeAudioData(buffer.slice(0))
      .then((value) => { if (!cancelled) setDecoded(value); })
      .catch(() => { if (!cancelled) setDecoded(null); });
    return () => {
      cancelled = true;
      void ctx.close();
    };
  }, [buffer]);

  return (
    <Waveform
      buffer={decoded}
      currentTime={0}
      duration={decoded?.duration ?? 0}
      trimStart={null}
      trimEnd={null}
      onSeek={() => {}}
      variant="mini"
    />
  );
}

function CompareTakePanel({ slot, take, buffer }: { slot: 'A' | 'B'; take: { title: string; origin: string; durationSeconds?: number; artifactMimeType: string; createdAt: number }; buffer: ArrayBuffer | null }) {
  return (
    <div className="overtone-compare__item">
      <div className="overtone-row" style={{ justifyContent: 'space-between' }}>
        <strong>{slot}</strong>
        <StatusBadge tone="info">{take.origin}</StatusBadge>
      </div>
      <TakeWaveformPreview buffer={buffer} />
      <p className="overtone-take-card__title">{take.title}</p>
      <p className="overtone-take-card__meta">
        {take.durationSeconds ? `${Math.round(take.durationSeconds)}s · ` : ''}{take.artifactMimeType} · {new Date(take.createdAt).toLocaleTimeString()}
      </p>
    </div>
  );
}
