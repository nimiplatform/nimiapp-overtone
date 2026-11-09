import { createWebNimiAppSession, type NimiRemoteAppConfig } from '@nimiplatform/kit/auth/app/web';
import { openNimiAppAssetMediaUrl, readNimiAppAssetBlob } from '@nimiplatform/kit/core/app-asset-media';
import { mountOvertone } from './shell/mount-overtone.js';
declare const __NIMI_APP_WEB_CONFIG__: NimiRemoteAppConfig;
const dispose = mountOvertone(createWebNimiAppSession(__NIMI_APP_WEB_CONFIG__), {
  kind: 'web',
  openMedia(scope, path) { return openNimiAppAssetMediaUrl(scope.client.storage.assets, path, scope.signal); },
  async deliver(scope, path, name) {
    const blob = await readNimiAppAssetBlob(scope.client.storage.assets, path, scope.signal);
    scope.signal.throwIfAborted();
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  },
});
if (import.meta.hot) import.meta.hot.dispose(dispose);
