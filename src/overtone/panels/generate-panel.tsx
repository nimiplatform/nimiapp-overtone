import { useState } from 'react';
import { InlineAlert, NumberStepper, Surface, TextField, Toggle } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';
import { useOvertoneState } from '../store.js';

export function GeneratePanel() {
  const { t } = useTranslation();
  const { project } = useOvertoneState();
  const brief = project?.brief ?? null;
  const [durationSeconds, setDurationSeconds] = useState(120);
  const [instrumental, setInstrumental] = useState(false);
  const [styleTags, setStyleTags] = useState('');

  return (
    <Surface tone="panel" padding="md" className="overtone-section" data-testid="overtone-music-app-access-unavailable">
      <div className="overtone-section__heading">
        <h2>{t('Overtone.generate.title')}</h2>
      </div>
      <InlineAlert tone="warning">
        {t('Overtone.generate.appAccessUnavailable')}
      </InlineAlert>
      <fieldset disabled style={{ border: 0, margin: 0, padding: 0 }}>
        <div className="overtone-field">
          <label htmlFor="overtone-style-tags">{t('Overtone.generate.styleTags')}</label>
          <TextField
            id="overtone-style-tags"
            value={styleTags}
            onChange={(event) => setStyleTags(event.target.value)}
            placeholder={brief ? [brief.genre, brief.mood].filter(Boolean).join(', ') : t('Overtone.generate.stylePlaceholder')}
          />
        </div>
        <div className="overtone-row">
          <div className="overtone-field" style={{ flex: 1 }}>
            <label htmlFor="overtone-duration">{t('Overtone.generate.duration')}</label>
            <NumberStepper
              min={10}
              max={600}
              value={durationSeconds}
              onValueChange={setDurationSeconds}
              ariaLabel={t('Overtone.generate.durationSecondsAria')}
            />
          </div>
          <div className="overtone-row overtone-toggle-row">
            <Toggle checked={instrumental} onChange={setInstrumental} />
            <span>{t('Overtone.generate.instrumental')}</span>
          </div>
        </div>
      </fieldset>
    </Surface>
  );
}
