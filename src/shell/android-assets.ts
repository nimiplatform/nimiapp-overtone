import { Directory, Filesystem } from '@capacitor/filesystem';
import type { NimiAppScope } from '@nimiplatform/kit/core/app-session';

const NATIVE_WRITE_BYTES = 64 * 1024;

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
