import { useEffect, useRef, useState } from 'react';
import { Button, InlineAlert, NimiText, TextareaField } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertoneActions, useOvertoneState } from '../store.js';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { generateRuntimeText, textFailureMessage } from '../runtime-workflow.js';
import { normalizeGeneratedLyrics } from '../lyrics.js';

const LYRICS_SYSTEM = 'You are a songwriting collaborator. Write 4-12 short singable lines in the requested language, under 1500 characters, with [verse] and [chorus] tags on their own lines, followed by sung words on new lines. Return only actual lyrics. Follow the provided scene and arrangement.';

// @nimi-authority: rule.overtone.workflow.r003
export function LyricsPanel() {
  const { t, i18n } = useTranslation();
  const { project, readiness } = useOvertoneState();
  const { setLyrics } = useOvertoneActions();
  const lyrics = project?.lyrics;
  const brief = project?.brief;
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [candidate, setCandidate] = useState('');
  const revision = useRef(lyrics);
  revision.current = lyrics;
  const invocation = useRef(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { invocation.current += 1; request.current?.abort(); }, []);

  async function generate() {
    if (!brief?.description || !readiness.textCapabilityAvailable || generating) return;
    const id = ++invocation.current;
    const before = lyrics;
    const controller = new AbortController(); request.current = controller;
    const chinese = (i18n.resolvedLanguage || i18n.language).startsWith('zh');
    setGenerating(true);
    setError('');
    try {
      const text = await generateRuntimeText({ client: getNimiLocalAppClient(), signal: controller.signal, system: `${LYRICS_SYSTEM}\n${chinese ? '用简体中文写歌词，不要使用英文。' : 'Write the lyrics in English.'}`,
        input: JSON.stringify({ brief, language: chinese ? 'Chinese' : 'English' }), temperature: .85, maxTokens: 800 });
      if (id !== invocation.current) return;
      if (revision.current === before) setLyrics(normalizeGeneratedLyrics(text), 'assistant');
      else setCandidate(normalizeGeneratedLyrics(text));
    } catch (cause) {
      if (id === invocation.current) setError(textFailureMessage(cause, t));
    } finally { if (id === invocation.current) setGenerating(false); }
  }

  return <section className="ot-lyrics-editor" id="overtone-lyrics-fold">
    <div className="overtone-section__heading"><h3>{t('Overtone.lyrics.title')}</h3><span className="ot-muted">{lyrics?.text.trim() ? t('Overtone.playground.lyricsReady') : t('Overtone.playground.lyricsNeeded')}</span></div>
    <div className="overtone-field-stack">
      <div className="overtone-row overtone-row--between"><NimiText role="caption">{t('Overtone.playground.lyricsHint')}</NimiText>
        {generating ? <Button tone="secondary" size="sm" onClick={() => { request.current?.abort(); invocation.current += 1; setGenerating(false); setError(t('Overtone.text.canceled')); }}>{t('Overtone.text.cancel')}</Button> : null}
        <Button tone="secondary" size="sm" disabled={generating || !readiness.textCapabilityAvailable || !brief?.description} onClick={() => void generate()}>
          {t(generating ? 'Overtone.lyrics.writing' : lyrics?.text ? 'Overtone.lyrics.regenerate' : 'Overtone.lyrics.generate')}
        </Button></div>
      <TextareaField rows={7} maxLength={6000} aria-label={t('Overtone.lyrics.title')} value={lyrics?.text ?? ''}
        onChange={(event) => setLyrics(event.target.value, lyrics?.source === 'assistant' || lyrics?.source === 'mixed' ? 'mixed' : 'manual')}
        placeholder={t('Overtone.lyrics.placeholder')} />
      {error ? <InlineAlert tone="warning">{error}</InlineAlert> : null}
      {candidate ? <div className="overtone-field-stack"><p className="overtone-lyric-sketch">{candidate}</p><Button tone="secondary" onClick={() => { setLyrics(candidate, 'assistant'); setCandidate(''); }}>{t('Overtone.playground.applyLyrics')}</Button></div> : null}
    </div>
  </section>;
}
