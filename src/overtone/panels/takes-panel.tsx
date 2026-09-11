import { useCallback, useEffect, useState } from 'react';
import {
  ActionMenu,
  AppCardSurface,
  Button,
  DashedAddButton,
  EmptyState,
  IconButton,
  NimiText,
  Popover,
  PopoverContent,
  PopoverTrigger,
  StatusBadge,
  Surface,
  TextField,
  type NimiMenuItem,
} from '@nimiplatform/kit/ui';
import { GenerationStatusList, type GenerationStatusListProps } from '@nimiplatform/kit/features/generation/ui';
import { useTranslation } from 'react-i18next';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import type { SongTake } from '../types.js';
import { Waveform } from './waveform.js';

const JOB_STATUS_LABEL_KEY: Record<string, string> = {
  pending: 'Overtone.runtime.status.queued',
  running: 'Overtone.runtime.status.running',
  completed: 'Overtone.runtime.status.completed',
  failed: 'Overtone.runtime.status.failed',
  canceled: 'Overtone.runtime.status.canceled',
  timeout: 'Overtone.runtime.status.timeout',
};

interface TakesPanelProps {
  onPublish: (takeId: string) => void;
}

export function TakesPanel({ onPublish }: TakesPanelProps) {
  const { t } = useTranslation();
  const state = useOvertoneState();
  const { clearCompare } = useOvertoneActions();
  const project = state.project;

  const handleFocusGenerate = useCallback(() => {
    const panel = document.getElementById('overtone-generate-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const field = document.getElementById('overtone-style-tags');
    if (field instanceof HTMLElement) field.focus({ preventScroll: true });
  }, []);

  if (!project) return null;

  const visibleTakes = project.takes.filter((take) => !take.discarded).sort((a, b) => b.createdAt - a.createdAt);
  const hasCompare = project.comparedTakeIds[0] || project.comparedTakeIds[1];
  const compareA = visibleTakes.find((take) => take.takeId === project.comparedTakeIds[0]) ?? null;
  const compareB = visibleTakes.find((take) => take.takeId === project.comparedTakeIds[1]) ?? null;

  if (visibleTakes.length === 0 && Object.keys(state.activeJobs).length === 0) {
    return (
      <div className="overtone-empty">
        <EmptyState
          title={<NimiText as="span" role="helper">{t('Overtone.takes.empty')}</NimiText>}
        />
      </div>
    );
  }

  const jobItems: GenerationStatusListProps['items'] = Object.values(state.activeJobs).map((job) => ({
    runId: job.jobId,
    status: job.status,
    label: job.progressLabel || t('Overtone.takes.generating'),
    error: job.errorMessage,
  }));

  const getJobStatusLabel = (status: string) => {
    const key = JOB_STATUS_LABEL_KEY[status];
    return key ? t(key) : status;
  };

  return (
    <div className="overtone-takes-stack">
      <div className="overtone-section__heading">
        <NimiText as="h2" role="section-title">{t('Overtone.takes.title', { count: visibleTakes.length })}</NimiText>
        {hasCompare ? (
          <Button type="button" tone="secondary" size="sm" onClick={clearCompare}>
            {t('Overtone.takes.exitCompare')}
          </Button>
        ) : null}
      </div>

      {compareA && compareB ? (
        <Surface tone="panel" padding="md" className="overtone-compare">
          <div className="overtone-section__heading">
            <NimiText as="h3" role="card-title">{t('Overtone.takes.compareTitle')}</NimiText>
            <StatusBadge tone="info">{t('Overtone.takes.compareCount', { count: 2 })}</StatusBadge>
          </div>
          <div className="overtone-compare__grid">
            <CompareTakePanel slot="A" take={compareA} buffer={state.audioBuffers[compareA.takeId] ?? null} />
            <CompareTakePanel slot="B" take={compareB} buffer={state.audioBuffers[compareB.takeId] ?? null} />
          </div>
        </Surface>
      ) : hasCompare ? (
        <Surface tone="card" padding="sm" className="overtone-compare">
          <NimiText role="helper">{t('Overtone.takes.comparePartial')}</NimiText>
        </Surface>
      ) : null}

      {jobItems.length > 0 ? (
        <GenerationStatusList
          items={jobItems}
          getStatusLabel={getJobStatusLabel}
        />
      ) : null}

      <div className="overtone-take-grid">
        {visibleTakes.map((take) => (
          <TakeCard
            key={take.takeId}
            take={take}
            isSelected={take.takeId === project.selectedTakeId}
            buffer={state.audioBuffers[take.takeId]}
            onPublish={onPublish}
          />
        ))}
        <DashedAddButton
          shape="tile"
          label={t('Overtone.takes.generateAnother')}
          onClick={handleFocusGenerate}
        />
      </div>
    </div>
  );
}

function TakeCard({ take, isSelected, buffer, onPublish }: {
  take: SongTake;
  isSelected: boolean;
  buffer: ArrayBuffer | undefined;
  onPublish: (takeId: string) => void;
}) {
  const { i18n, t } = useTranslation();
  const state = useOvertoneState();
  const { selectTake, favoriteTake, renameTake, discardTake, setCompareSlot } = useOvertoneActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(take.title);

  const parentTitle = take.parentTakeId
    ? state.project?.takes.find((entry) => entry.takeId === take.parentTakeId)?.title || take.parentTakeId
    : null;

  const beginRename = useCallback(() => {
    setDraft(take.title);
    setEditing(true);
  }, [take.title]);

  const menuItems: NimiMenuItem[] = [
    { id: 'rename', label: t('Overtone.takes.rename'), onSelect: beginRename },
    { id: 'compare-a', label: t('Overtone.takes.setCompareA'), onSelect: () => setCompareSlot(0, take.takeId) },
    { id: 'compare-b', label: t('Overtone.takes.setCompareB'), onSelect: () => setCompareSlot(1, take.takeId) },
  ];
  if (isSelected) {
    menuItems.push({ id: 'publish', label: t('Overtone.takes.publish'), onSelect: () => onPublish(take.takeId) });
  }
  menuItems.push({ id: 'discard', label: t('Overtone.takes.discard'), tone: 'danger', onSelect: () => discardTake(take.takeId) });

  const handleMenuSelect = (onSelect?: () => void) => {
    setMenuOpen(false);
    onSelect?.();
  };

  return (
    <AppCardSurface
      as="div"
      kind="operational-solid"
      interactive
      active={isSelected}
      className="overtone-take-card"
      onClick={() => selectTake(take.takeId)}
    >
      <TakeWaveformPreview buffer={buffer ?? null} />
      <div className="overtone-row overtone-row--between">
        <div className="overtone-take-card__heading">
          <Button type="button" tone="ghost" size="sm" className="overtone-ellipsis"
            aria-pressed={isSelected}
            onClick={(event) => { event.stopPropagation(); selectTake(take.takeId); }}>
            {take.title}
          </Button>
          <NimiText as="p" role="caption">
            {new Date(take.createdAt).toLocaleTimeString(i18n.language)}
          </NimiText>
        </div>
        <StatusBadge tone="info">{t(`Overtone.common.takeOrigins.${take.origin}`)}</StatusBadge>
      </div>
      {parentTitle ? (
        <NimiText as="p" role="caption">
          {'↳ '}
          {t('Overtone.takes.fromParent', { title: parentTitle })}
        </NimiText>
      ) : null}
      {editing ? (
        <span className="overtone-rename-row" onClick={(event) => event.stopPropagation()}>
          <TextField
            className="overtone-rename-field"
            aria-label={t('Overtone.takes.rename')}
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
          />
          <Button
            type="button"
            tone="primary"
            size="sm"
            onClick={() => { renameTake(take.takeId, draft.trim() || take.title); setEditing(false); }}
          >
            {t('Overtone.takes.save')}
          </Button>
          <Button type="button" tone="secondary" size="sm" onClick={() => setEditing(false)}>
            {t('Overtone.takes.cancel')}
          </Button>
        </span>
      ) : (
        <div className="overtone-row overtone-row--between" onClick={(event) => event.stopPropagation()}>
          <Button
            type="button"
            tone={take.favorite ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => favoriteTake(take.takeId)}
          >
            {take.favorite ? t('Overtone.takes.favoriteActive') : t('Overtone.takes.favoriteInactive')}
          </Button>
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <IconButton
                tone="secondary"
                size="sm"
                icon={<OverflowIcon />}
                aria-label={t('Overtone.takes.moreActions')}
              />
            </PopoverTrigger>
            <PopoverContent align="end" className="border-none bg-transparent p-0 shadow-none">
              <ActionMenu
                items={menuItems.map((item) => ({ ...item, onSelect: () => handleMenuSelect(item.onSelect) }))}
                ariaLabel={t('Overtone.takes.moreActions')}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </AppCardSurface>
  );
}

function OverflowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
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
  const { i18n, t } = useTranslation();
  return (
    <Surface tone="card" padding="sm" className="overtone-compare__item">
      <div className="overtone-row overtone-row--between">
        <NimiText as="span" role="overline">
          {t(slot === 'A' ? 'Overtone.takes.compareSlotA' : 'Overtone.takes.compareSlotB')}
        </NimiText>
        <StatusBadge tone="info">{t(`Overtone.common.takeOrigins.${take.origin}`, { defaultValue: take.origin })}</StatusBadge>
      </div>
      <TakeWaveformPreview buffer={buffer} />
      <NimiText as="p" role="card-title">{take.title}</NimiText>
      <NimiText as="p" role="caption">
        {take.durationSeconds ? `${Math.round(take.durationSeconds)}s · ` : ''}{take.artifactMimeType} · {new Date(take.createdAt).toLocaleTimeString(i18n.language)}
      </NimiText>
    </Surface>
  );
}
