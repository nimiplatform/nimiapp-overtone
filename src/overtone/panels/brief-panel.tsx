import { useCallback, useState } from 'react';
import { Button, InlineAlert, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import { getRuntimeNimiClient } from '../../shell/auth/runtime-platform.js';
import { generateRuntimeText } from '../runtime-workflow.js';
import type { SongBrief } from '../types.js';

const BRIEF_SYSTEM = `You are a music production assistant. Given a song idea, output a structured brief as JSON with these fields:
- title (max 50 chars)
- genre (primary genre or genres)
- mood (emotional tone)
- tempo (slow / moderate / fast)
- description (1-2 sentence creative direction)
Output ONLY valid JSON. No markdown fences. No extra text.`;

export function BriefPanel() {
  const { t } = useTranslation();
  const state = useOvertoneState();
  const { setBrief } = useOvertoneActions();
  const project = state.project;
  const brief = project?.brief ?? null;
  const { readiness } = state;

  const [idea, setIdea] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCallAi = Boolean(
    readiness.textConnectorAvailable &&
    readiness.selectedTextTargetRef &&
    readiness.selectedTextConnectorId &&
    readiness.selectedTextModelId,
  );

  const handleGenerate = useCallback(async () => {
    if (!idea.trim() || !canCallAi) return;
    setGenerating(true);
    setError(null);
    try {
      const text = await generateRuntimeText({
        runtime: getRuntimeNimiClient().runtime,
        model: readiness.selectedTextModelId!,
        connectorId: readiness.selectedTextConnectorId!,
        targetRef: readiness.selectedTextTargetRef!,
        input: idea.trim(),
        system: BRIEF_SYSTEM,
        temperature: 0.9,
        maxTokens: 1024,
      });
      const parsed = parseBriefJson(text);
      if (!parsed) throw new Error(t('Overtone.brief.errors.nonJson'));
      setBrief(parsed);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setGenerating(false);
    }
  }, [idea, canCallAi, readiness.selectedTextTargetRef, readiness.selectedTextModelId, readiness.selectedTextConnectorId, setBrief, t]);

  const handleManualBrief = useCallback(() => {
    setBrief({
      title: '',
      genre: '',
      mood: '',
      tempo: '',
      description: idea.trim(),
    });
    setError(null);
  }, [idea, setBrief]);

  return (
    <Surface tone="panel" padding="md" className="overtone-section">
      <div className="overtone-section__heading">
        <h2>{t('Overtone.brief.title')}</h2>
        {brief ? <StatusBadge tone="success" shape="dot">{t('Overtone.common.status.ready')}</StatusBadge> : null}
      </div>

      <div className="overtone-field">
        <label htmlFor="overtone-idea">{t('Overtone.brief.ideaLabel')}</label>
        <textarea
          id="overtone-idea"
          className="nimi-input"
          rows={3}
          value={idea}
          onChange={(event) => setIdea(event.target.value)}
          placeholder={t('Overtone.brief.ideaPlaceholder')}
        />
      </div>

      <div className="overtone-row">
        <Button
          type="button"
          tone="primary"
          size="sm"
          onClick={handleGenerate}
          disabled={!idea.trim() || generating || !canCallAi}
        >
          {generating ? t('Overtone.brief.generating') : t('Overtone.brief.generate')}
        </Button>
        <Button
          type="button"
          tone="secondary"
          size="sm"
          onClick={handleManualBrief}
          disabled={!idea.trim()}
        >
          {t('Overtone.brief.manual')}
        </Button>
      </div>

      {!canCallAi ? (
        <InlineAlert tone="warning">
          {t('Overtone.brief.noTextRoute')}
        </InlineAlert>
      ) : null}

      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

      {brief ? (
        <div className="overtone-field" style={{ marginTop: 8 }}>
          <BriefField id="title" label={t('Overtone.brief.fields.title')} value={brief.title} onChange={(value) => setBrief({ ...brief, title: value })} />
          <BriefField id="genre" label={t('Overtone.brief.fields.genre')} value={brief.genre} onChange={(value) => setBrief({ ...brief, genre: value })} />
          <BriefField id="mood" label={t('Overtone.brief.fields.mood')} value={brief.mood} onChange={(value) => setBrief({ ...brief, mood: value })} />
          <BriefField id="tempo" label={t('Overtone.brief.fields.tempo')} value={brief.tempo} onChange={(value) => setBrief({ ...brief, tempo: value })} />
          <div className="overtone-field">
            <label htmlFor="overtone-brief-description">{t('Overtone.brief.fields.description')}</label>
            <textarea
              id="overtone-brief-description"
              className="nimi-input"
              rows={3}
              value={brief.description}
              onChange={(event) => setBrief({ ...brief, description: event.target.value })}
            />
          </div>
        </div>
      ) : null}
    </Surface>
  );
}

function BriefField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const fieldId = `overtone-brief-${id}`;
  return (
    <div className="overtone-field">
      <label htmlFor={fieldId}>{label}</label>
      <input
        id={fieldId}
        className="nimi-input"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function parseBriefJson(text: string): SongBrief | null {
  try {
    const cleaned = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    const value = JSON.parse(cleaned) as Record<string, unknown>;
    return {
      title: String(value.title || '').slice(0, 80),
      genre: String(value.genre || ''),
      mood: String(value.mood || ''),
      tempo: String(value.tempo || ''),
      description: String(value.description || ''),
    };
  } catch {
    return null;
  }
}
