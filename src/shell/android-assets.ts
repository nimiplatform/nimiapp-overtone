import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { NimiAppScope } from '@nimiplatform/kit/core/app-session';

const NATIVE_WRITE_BYTES = 64 * 1024;

export async function shareAndroidAsset(scope: NimiAppScope, relativePath: string, name: string): Promise<'handed-off' | 'cancelled'> {
  const file = await cacheAndroidAsset(scope, relativePath, name, 'exports');
  try {
    scope.signal.throwIfAborted();
    await Share.share({ files: [file.uri], title: name });
    // The receiving app may read after the sheet closes; Android owns cache eviction.
    return 'handed-off';
  } catch (error) {
    await file.remove().catch(() => undefined);
    // Capacitor Share 8 Android reports a dismissed chooser with this exact error.
    if (error instanceof Error && error.message === 'Share canceled') return 'cancelled';
    throw error;
  }
}

function base64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  }
  return btoa(parts.join(''));
}

// @nimi-authority: rule.overtone.exploration.r003
export async function cacheAndroidAsset(scope: NimiAppScope, relativePath: string, name: string, purpose: 'media' | 'exports') {
  if (!name || name === '.' || name === '..' || /[/\\\0]/u.test(name)) throw new Error('Invalid media filename');
  scope.signal.throwIfAborted();
  const folder = `overtone-${purpose}/${crypto.randomUUID()}`;
  const path = `${folder}/${name}`;
  const file = await Filesystem.writeFile({ directory: Directory.Cache, path, data: '', recursive: true });
  let removed: Promise<void> | undefined;
  const remove = () => removed ??= (async () => {
    await Filesystem.deleteFile({ directory: Directory.Cache, path });
    await Filesystem.rmdir({ directory: Directory.Cache, path: folder });
  })();
  try {
    const source = await scope.client.storage.assets.read({ relativePath });
    scope.signal.throwIfAborted();
    for await (const bytes of source.body) {
      for (let offset = 0; offset < bytes.length; offset += NATIVE_WRITE_BYTES) {
        scope.signal.throwIfAborted();
        await Filesystem.appendFile({ directory: Directory.Cache, path, data: base64(bytes.subarray(offset, offset + NATIVE_WRITE_BYTES)) });
      }
    }
    scope.signal.throwIfAborted();
    return { uri: file.uri, remove };
  } catch (error) {
    // A failed read never exposes a partial file as playable or shareable.
    await remove().catch(() => undefined);
    throw error;
  }
}
