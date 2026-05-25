import React from 'react';
import { createRoot } from 'react-dom/client';
import { NimiThemeProvider, TooltipProvider } from '@nimiplatform/kit/ui';
import './styles.css';
import './shell/auth/auth-i18n.js';
import { WorkspacePage } from './overtone/workspace-page.js';

function DevPreview() {
  return (
    <div className="app-shell" data-testid="nimi-overtone-dev-preview-shell">
      <div className="app-shell__body">
        <WorkspacePage />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <NimiThemeProvider accentPack="overtone-accent">
      <TooltipProvider>
        <DevPreview />
      </TooltipProvider>
    </NimiThemeProvider>
  </React.StrictMode>,
);
