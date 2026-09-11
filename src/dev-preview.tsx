import React from 'react';
import { createRoot } from 'react-dom/client';
import { NimiThemeProvider, TooltipProvider } from '@nimiplatform/kit/ui';
import { resolveInitialOvertoneScheme } from './overtone/theme-scheme.js';
import './styles.css';
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
    <NimiThemeProvider accentPack="nimi-accent" defaultScheme={resolveInitialOvertoneScheme()}>
      <TooltipProvider>
        <DevPreview />
      </TooltipProvider>
    </NimiThemeProvider>
  </React.StrictMode>,
);
