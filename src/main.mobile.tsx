import { createMobileNimiAppSession } from '@nimiplatform/kit/auth/app/mobile';
import type { NimiRemoteAppConfig } from '@nimiplatform/kit/core/app-session';
import { openNimiAppAssetMediaUrl, readNimiAppAssetBlob } from '@nimiplatform/kit/core/app-asset-media';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { mountOvertone } from './shell/mount-overtone.js';

declare const __NIMI_APP_MOBILE_CONFIG__: Omit<NimiRemoteAppConfig, 'fetch'>;

// @nimi-authority: rule.overtone.auth.r002
const dispose = mountOvertone(createMobileNimiAppSession(__NIMI_APP_MOBILE_CONFIG__), {
  kind: 'mobile',
  openMedia(scope, path) { return openNimiAppAssetMediaUrl(scope.client.storage.assets, path, scope.signal); },
  // @nimi-authority: rule.overtone.exploration.r003
  async deliver(scope, path, name) {
    if (!name || name === '.' || name === '..' || /[/\\\0]/u.test(name)) throw new Error('Invalid export filename');
    const blob = await readNimiAppAssetBlob(scope.client.storage.assets, path, scope.signal);
    scope.signal.throwIfAborted();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]!);
      reader.onerror = () => reject(reader.error ?? new Error('Could not prepare the export'));
      reader.readAsDataURL(blob);
    });
    scope.signal.throwIfAborted();
    const file = await Filesystem.writeFile({
      path: `overtone-exports/${crypto.randomUUID()}/${name}`,
      directory: Directory.Cache, data, recursive: true,
    });
    scope.signal.throwIfAborted();
    // Keep the cache file available while the selected recipient reads it.
    // Android may evict cache bytes; the canonical asset remains on Runtime.
    await Share.share({ files: [file.uri], title: name });
  },
});
if (import.meta.hot) import.meta.hot.dispose(dispose);
