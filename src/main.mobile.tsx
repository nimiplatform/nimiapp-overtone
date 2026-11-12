import { createMobileNimiAppSession } from '@nimiplatform/kit/auth/app/mobile';
import type { NimiRemoteAppConfig } from '@nimiplatform/kit/core/app-session';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { mountOvertone } from './shell/mount-overtone.js';
import { cacheAndroidAsset } from './shell/android-assets.js';

declare const __NIMI_APP_MOBILE_CONFIG__: Omit<NimiRemoteAppConfig, 'fetch'>;

// @nimi-authority: rule.overtone.auth.r002
const dispose = mountOvertone(createMobileNimiAppSession(__NIMI_APP_MOBILE_CONFIG__), {
  kind: 'mobile',
  async openMedia(scope, path) {
    const file = await cacheAndroidAsset(scope, path, path.split('/').at(-1) ?? '', 'media');
    return { url: Capacitor.convertFileSrc(file.uri), revoke: file.remove };
  },
  // @nimi-authority: rule.overtone.exploration.r003
  async deliver(scope, path, name) {
    const file = await cacheAndroidAsset(scope, path, name, 'exports');
    scope.signal.throwIfAborted();
    // Keep the cache file available while the selected recipient reads it.
    // Android may evict cache bytes; the canonical asset remains on Runtime.
    await Share.share({ files: [file.uri], title: name });
  },
});
if (import.meta.hot) import.meta.hot.dispose(dispose);
