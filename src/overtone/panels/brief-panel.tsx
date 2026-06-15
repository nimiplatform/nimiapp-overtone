import { useCallback, useState } from 'react';
import { Button, InlineAlert, StatusBadge, Surface } from '@nimiplatform/kit/ui';
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
        input: idea.trim(),
        system: BRIEF_SYSTEM,
        temperature: 0.9,
        maxTokens: 1024,
      });
      const parsed = parseBriefJson(text);
      if (!parsed) throw new Error('Assistant returned non-JSON brief content.');
      setBrief(parsed);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setGenerating(false);
    }
  }, [idea, canCallAi, readiness.selectedTextModelId, readiness.selectedTextConnectorId, setBrief]);

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
        <h2>Song Brief</h2>
        {brief ? <StatusBadge tone="success" shape="dot">ready</StatusBadge> : null}
      </div>

      <div className="overtone-field">
        <label htmlFor="overtone-idea">Idea</label>
        <textarea
          id="overtone-idea"
          className="nimi-input"
          rows={3}
          value={idea}
          onChange={(event) => setIdea(event.target.value)}
          placeholder="Describe your song idea..."
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
          {generating ? 'Generating...' : 'AI Generate Brief'}
        </Button>
        <Button
          type="button"
          tone="secondary"
          size="sm"
          onClick={handleManualBrief}
          disabled={!idea.trim()}
        >
          Manual Brief
        </Button>
      </div>

      {!canCallAi ? (
        <InlineAlert tone="warning">
          No text connector/model pair is ready. Use Manual Brief or configure runtime text access.
        </InlineAlert>
      ) : null}

      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

      {brief ? (
        <div className="overtone-field" style={{ marginTop: 8 }}>
          <BriefField label="Title" value={brief.title} onChange={(value) => setBrief({ ...brief, title: value })} />
          <BriefField label="Genre" value={brief.genre} onChange={(value) => setBrief({ ...brief, genre: value })} />
          <BriefField label="Mood" value={brief.mood} onChange={(value) => setBrief({ ...brief, mood: value })} />
          <BriefField label="Tempo" value={brief.tempo} onChange={(value) => setBrief({ ...brief, tempo: value })} />
          <div className="overtone-field">
            <label htmlFor="overtone-brief-description">Description</label>
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

function BriefField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const fieldId = `overtone-brief-${label.toLowerCase()}`;
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
