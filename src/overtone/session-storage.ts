import type { NimiAppScope } from '@nimiplatform/kit/core/app-session';
import type { ProjectStorage } from './project-storage.js';

// @nimi-authority: rule.overtone.data-model.r008
// One connection's writer. Queue callbacks retain this port instead of looking
// up a new account/connection after an await. No retry or migration is implied.
export function bindProjectStorage(scope: NimiAppScope): ProjectStorage {
  const storage = scope.client.storage;
  const call = async <T,>(operation: () => Promise<T>): Promise<T> => {
    scope.signal.throwIfAborted(); const value = await operation(); scope.signal.throwIfAborted(); return value;
  };
  return {
    readJson: path => call(() => storage.readJson(path)),
    writeJson: (path, value) => call(() => storage.writeJson(path, value)),
    removeJson: path => call(() => storage.removeJson(path)),
    assets: {
      stat: path => call(() => storage.assets.stat(path)),
      list: input => call(() => storage.assets.list(input)),
      write: input => call(() => storage.assets.write(input)),
      read: input => call(() => storage.assets.read(input)),
      remove: path => call(() => storage.assets.remove(path)),
      move: input => call(() => storage.assets.move(input)),
      adoptArtifact: input => call(() => storage.assets.adoptArtifact(input)),
    },
  };
}
