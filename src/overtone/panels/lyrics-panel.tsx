import { useCallback, useState } from 'react';
import { Button, InlineAlert, NimiText, nimiToast, StatusBadge, Surface, TextareaField } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { generateRuntimeText } from '../runtime-workflow.js';
import type { SongBrief } from '../types.js';

const LYRICS_SYSTEM = `You are a songwriting assistant.
Write singable lyrics that follow the provided brief.
Return plain lyrics only, with section labels (Verse, Chorus, Bridge) when useful.`;

export function LyricsPanel() {
  const { t } = useTranslation();
  const state = useOvertoneState();
  const { setLyrics } = useOvertoneActions();
  const project = state.project;
  const lyrics = project?.lyrics ?? null;
  const brief = project?.brief ?? null;
  const { readiness } = state;

  const [generating, setGenerating] = useState(false);

  const canCallAi = readiness.textCapabilityAvailable;

  const handleGenerate = useCallback(async () => {
    if (!canCallAi || !brief?.description) return;
    setGenerating(true);
    try {
      const text = await generateRuntimeText({
        client: getNimiLocalAppClient(),
        input: buildBriefContext(brief),
        system: LYRICS_SYSTEM,
        temperature: 0.85,
        maxTokens: 768,
      });
      setLyrics(text.trim(), 'assistant');
    } catch (nextError) {
      nimiToast.danger(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setGenerating(false);
    }
  }, [brief, canCallAi, setLyrics]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value;
    const nextSource: 'manual' | 'mixed' = lyrics?.source === 'assistant' ? 'mixed' : 'manual';
    setLyrics(text, nextSource);
  }, [lyrics, setLyrics]);

  return (
    <Surface tone="panel" padding="md" className="overtone-section">
      <div className="overtone-section__heading">
        <NimiText as="h2" role="section-title">{t('Overtone.lyrics.title')}</NimiText>
        {lyrics ? <StatusBadge tone="info">{t(`Overtone.lyrics.sources.${lyrics.source}`)}</StatusBadge> : null}
      </div>

      <div className="overtone-row">
        <Button
          type="button"
          tone="secondary"
          size="sm"
          onClick={handleGenerate}
          disabled={generating || !canCallAi || !brief?.description}
        >
          {generating
            ? t('Overtone.lyrics.writing')
            : lyrics ? t('Overtone.lyrics.regenerate') : t('Overtone.lyrics.generate')}
        </Button>
      </div>

      {!brief?.description ? (
        <InlineAlert tone="info">{t('Overtone.lyrics.briefRequired')}</InlineAlert>
      ) : null}

      <TextareaField
        rows={10}
        textareaClassName="overtone-lyrics-textarea"
        aria-label={t('Overtone.lyrics.title')}
        value={lyrics?.text ?? ''}
        onChange={handleChange}
        placeholder={t('Overtone.lyrics.placeholder')}
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
