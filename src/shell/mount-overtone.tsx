import React from 'react';
import { createRoot } from 'react-dom/client';
import { NimiThemeProvider, TooltipProvider } from '@nimiplatform/kit/ui';
import { NimiAppSessionProvider, NimiAppAccessGate, type NimiAppSession } from '@nimiplatform/kit/auth/app';
import type { OvertoneHost } from './auth/app-session.js';
import { resolveInitialOvertoneScheme } from '../overtone/theme-scheme.js';
import { applyOvertoneDocumentLocale, resolveInitialOvertoneLocale } from '../overtone/i18n.js';
import { App } from './App.js';
import '../styles.css';

// @nimi-authority: rule.overtone.auth.r002
export function mountOvertone(session: NimiAppSession, host: OvertoneHost) {
  applyOvertoneDocumentLocale(resolveInitialOvertoneLocale());
  const root = createRoot(document.getElementById('root')!);
  root.render(<React.StrictMode><NimiThemeProvider accentPack="nimi-accent" defaultScheme={resolveInitialOvertoneScheme()}><TooltipProvider>
    <NimiAppSessionProvider session={session}><NimiAppAccessGate title="Overtone" language={resolveInitialOvertoneLocale()} requireRuntime={false}><App host={host} /></NimiAppAccessGate></NimiAppSessionProvider>
  </TooltipProvider></NimiThemeProvider></React.StrictMode>);
  void session.start();
  return () => { session.dispose(); root.unmount(); };
}
