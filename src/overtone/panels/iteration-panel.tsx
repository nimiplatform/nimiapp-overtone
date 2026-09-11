import { InlineAlert, NimiText, Surface } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';

export function IterationPanel() {
  const { t } = useTranslation();
  return (
    <Surface tone="panel" padding="md" className="overtone-section">
      <div className="overtone-section__heading">
        <NimiText as="h2" role="section-title">{t('Overtone.iteration.title')}</NimiText>
      </div>
      <InlineAlert tone="warning">
        {t('Overtone.iteration.appAccessUnavailable')}
      </InlineAlert>
    </Surface>
  );
}
