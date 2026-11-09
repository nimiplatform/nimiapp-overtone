import { createDesktopNimiAppSession } from '@nimiplatform/kit/auth/app/desktop';
import { openNimiLocalAppAssetMediaUrl, createNimiLocalAppStandardShellSurface } from '@nimiplatform/kit/shell/renderer/bridge';
import { mountOvertone } from './shell/mount-overtone.js';
const session = createDesktopNimiAppSession();
const host = createNimiLocalAppStandardShellSurface();
const dispose = mountOvertone(session, {
  kind: 'desktop',
  async openMedia(scope, path) { scope.signal.throwIfAborted(); return openNimiLocalAppAssetMediaUrl(path); },
  async deliver(scope, path) { scope.signal.throwIfAborted(); await host.storage.assets.reveal(path); },
});
if (import.meta.hot) import.meta.hot.dispose(dispose);
