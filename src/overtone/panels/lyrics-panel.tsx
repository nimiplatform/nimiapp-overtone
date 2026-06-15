import { useCallback, useState } from 'react';
import { Button, InlineAlert, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import { getRuntimeNimiClient } from '../../shell/auth/runtime-platform.js';
import { generateRuntimeText } from '../runtime-workflow.js';
import type { SongBrief } from '../types.js';

const LYRICS_SYSTEM = `You are a songwriting assistant.
Write singable lyrics that follow the provided brief.
Return plain lyrics only, with section labels (Verse, Chorus, Bridge) when useful.`;

export function LyricsPanel() {
  const state = useOvertoneState();
  const { setLyrics } = useOvertoneActions();
  const project = state.project;
  const lyrics = project?.lyrics ?? null;
  const brief = project?.brief ?? null;
  const { readiness } = state;

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCallAi = Boolean(
    readiness.textConnectorAvailable &&
    readiness.selectedTextConnectorId &&
    readiness.selectedTextModelId,
  );

  const handleGenerate = useCallback(async () => {
    if (!canCallAi || !brief?.description) return;
    setGenerating(true);
    setError(null);
    try {
      const text = await generateRuntimeText({
        runtime: getRuntimeNimiClient().runtime,
        model: readiness.selectedTextModelId!,
        connectorId: readiness.selectedTextConnectorId!,
        input: buildBriefContext(brief),
        system: LYRICS_SYSTEM,
        temperature: 0.85,
        maxTokens: 768,
      });
      setLyrics(text.trim(), 'assistant');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setGenerating(false);
    }
  }, [brief, canCallAi, readiness.selectedTextConnectorId, readiness.selectedTextModelId, setLyrics]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value;
    const nextSource: 'manual' | 'mixed' = lyrics?.source === 'assistant' ? 'mixed' : 'manual';
    setLyrics(text, nextSource);
  }, [lyrics, setLyrics]);

  return (
    <Surface tone="panel" padding="md" className="overtone-section">
      <div className="overtone-section__heading">
        <h2>Lyrics</h2>
        {lyrics ? <StatusBadge tone="info">{lyrics.source}</StatusBadge> : null}
      </div>

      <div className="overtone-row">
        <Button
          type="button"
          tone="secondary"
          size="sm"
          onClick={handleGenerate}
          disabled={generating || !canCallAi || !brief?.description}
        >
          {generating ? 'Writing...' : lyrics ? 'Regenerate Lyrics' : 'Generate Lyrics'}
        </Button>
      </div>

      {!brief?.description ? (
        <InlineAlert tone="info">Write a brief description first; the assistant uses it to shape lyrics.</InlineAlert>
      ) : null}

      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

      <textarea
        className="nimi-input"
        rows={10}
        style={{ fontFamily: 'monospace', lineHeight: 1.65 }}
        value={lyrics?.text ?? ''}
        onChange={handleChange}
        placeholder="Write or paste lyrics here. Manual edits always win over regenerated text."
      />
    </Surface>
  );
}

function buildBriefContext(brief: SongBrief): string {
  return [
    `Title: ${brief.title}`,
    `Genre: ${brief.genre}`,
    `Mood: ${brief.mood}`,
    `Tempo: ${brief.tempo}`,
    `Description: ${brief.description}`,
  ].filter(Boolean).join('\n');
}
