import { createMobileNimiAppSession } from '@nimiplatform/kit/auth/app/mobile';
import type { NimiRemoteAppConfig } from '@nimiplatform/kit/core/app-session';
import { Capacitor } from '@capacitor/core';
import { mountOvertone } from './shell/mount-overtone.js';
import { cacheAndroidAsset, shareAndroidAsset } from './shell/android-assets.js';

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
    await shareAndroidAsset(scope, path, name);
  },
});
if (import.meta.hot) import.meta.hot.dispose(dispose);
