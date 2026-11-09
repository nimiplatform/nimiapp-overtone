import { useTranslation } from 'react-i18next';
import { useMemo, useRef } from 'react';
import { NimiAccountControl, NimiAppAccessGate, useNimiAppSession, type NimiAppScope } from '@nimiplatform/kit/auth/app';
import { OvertoneSessionProvider, type OvertoneHost } from './auth/app-session.js';
import { OvertoneProvider } from '../overtone/store.js';
import { bindProjectStorage } from '../overtone/session-storage.js';
import { AuthenticatedShell } from './authenticated-shell.js';

// @nimi-authority: rule.overtone.auth.r001
export function App({ host }: { host: OvertoneHost }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const { snapshot } = useNimiAppSession();
  const connected = snapshot.runtime.status === 'connected';
  const retained = useRef<NimiAppScope | undefined>(undefined);
  if (snapshot.runtime.status === 'connected') retained.current = snapshot.runtime.scope;
  const scope = retained.current;
  const storage = useMemo(() => scope ? bindProjectStorage(scope) : undefined, [scope]);
  return <div className="ot-session-shell">
    {!connected && <section className="ot-session-disconnected"><NimiAppAccessGate title="Overtone" language={language}>{() => null}</NimiAppAccessGate>
      {scope && <p>{t('Overtone.session.offlineDraft')}</p>}<NimiAccountControl language={language} />
    </section>}
    {scope && storage && <OvertoneProvider storage={storage}><OvertoneSessionProvider scope={scope} host={host}>
      <div className="ot-session-content" inert={!connected}><AuthenticatedShell /></div>
    </OvertoneSessionProvider></OvertoneProvider>}
  </div>;
}
