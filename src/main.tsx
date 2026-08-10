import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { NimiThemeProvider, TooltipProvider } from '@nimiplatform/kit/ui';
import { installNimiShellRuntimeBridge } from '@nimiplatform/kit/shell/renderer/bridge';
import {
  DEFAULT_DEV_RENDERER_ENTRY_IMPORT_RETRY_DELAYS_MS,
  createRendererEntryModuleLoader,
} from '@nimiplatform/kit/shell/renderer/bootstrap';
import './styles.css';

// Install the Kit-owned standard shell bridge before the protected Local App
// client is constructed. The host owns the carrier and its session posture.
installNimiShellRuntimeBridge();

const entryModuleLoader = createRendererEntryModuleLoader({
  retryDelaysMs: DEFAULT_DEV_RENDERER_ENTRY_IMPORT_RETRY_DELAYS_MS,
});

const App = lazy(async () => {
  const mod = await entryModuleLoader.load('entry:nimi-overtone-app', () => import('./shell/App.js'));
  return { default: mod.App };
});

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <NimiThemeProvider accentPack="nimi-accent">
      <TooltipProvider>
        <Suspense fallback={null}>
          <App />
        </Suspense>
      </TooltipProvider>
    </NimiThemeProvider>
  </React.StrictMode>,
);
