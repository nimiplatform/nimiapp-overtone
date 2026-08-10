import { InlineAlert, Surface } from '@nimiplatform/kit/ui';
import { useTranslation } from 'react-i18next';

export function IterationPanel() {
  const { t } = useTranslation();
  return (
    <Surface tone="panel" padding="md" className="overtone-section">
      <div className="overtone-section__heading">
        <h2>{t('Overtone.iteration.title')}</h2>
      </div>
      <InlineAlert tone="warning">
        {t('Overtone.iteration.appAccessUnavailable')}
      </InlineAlert>
    </Surface>
  );
}
