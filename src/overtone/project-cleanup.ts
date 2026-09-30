import { PROJECT_DOCUMENT_PREFIX, readProjectCatalog, readProjectDocument, removeProjectHeads, type ProjectStorage } from './project-storage.js';
import type { SongProject } from './types.js';

export function projectHasRecovery(project: SongProject): boolean {
  return [project.recoverableResults, project.recoverableTranscriptions, project.recoverableVoiceConversions, project.recoverableSeparations].some(items => Boolean(items?.length));
}
function referencedAssets(project: SongProject): Set<string> {
  const paths = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if ('relativePath' in value && typeof value.relativePath === 'string') paths.add(value.relativePath);
    for (const child of Object.values(value)) visit(child);
  };
  visit(project); return paths;
}

async function listAssetPaths(storage: ProjectStorage, prefix: string): Promise<string[]> {
  const paths: string[] = []; let cursor: string | undefined;
  const cursors = new Set<string>();
  do {
    const page = await storage.assets.list({ prefix, pageSize: 100, ...(cursor ? { cursor } : {}) });
    paths.push(...page.assets.map(asset => asset.relativePath));
    cursor = page.nextCursor || undefined;
    if (cursor && cursors.has(cursor)) throw new Error('OVERTONE_STORAGE_CURSOR_INVALID');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return paths;
}

// @nimi-authority: rule.overtone.data-model.r011-storage-lifecycle
export async function cleanupProjectStorage(storage: ProjectStorage, currentProjectId: string, protectedProjectIds: ReadonlySet<string>) {
  const catalog = await readProjectCatalog(storage);
  const known = new Set(catalog.heads.map(head => head.projectId));
  if (![currentProjectId, ...protectedProjectIds].every(projectId => known.has(projectId))) throw new Error('OVERTONE_PROJECT_HEAD_MISSING');
  const retained = new Set<string>();
  const obsolete: { projectId: string; paths: Set<string> }[] = [];
  let pendingRecovery = false;
  // Read every catalogued document before deleting anything, including heads
  // whose document no longer appears in the asset listing.
  for (const head of catalog.heads) {
    const project = await readProjectDocument(storage, head);
    pendingRecovery ||= projectHasRecovery(project);
    const paths = referencedAssets(project);
    if (head.projectId === currentProjectId || protectedProjectIds.has(head.projectId) || projectHasRecovery(project)) {
      paths.forEach(path => retained.add(path)); retained.add(head.document.relativePath);
    } else {
      obsolete.push({ projectId: head.projectId, paths });
    }
  }
  const snapshots = await listAssetPaths(storage, PROJECT_DOCUMENT_PREFIX);
  let removedAssets = 0;
  for (const entry of obsolete) {
    for (const path of entry.paths) if (!retained.has(path) && (await storage.assets.remove(path)).removed) removedAssets += 1;
  }
  // Keep readable documents until the catalog commit succeeds. If its response
  // is lost, the next attempt can sweep the now-unreferenced snapshots safely.
  const removedProjects = obsolete.map(entry => entry.projectId);
  if (removedProjects.length) await removeProjectHeads(storage, new Set(removedProjects));
  for (const path of snapshots) if (!retained.has(path) && (await storage.assets.remove(path)).removed) removedAssets += 1;
  // A pending result can already have valid adopted output not yet referenced
  // by its saved document. Keep such assets until all recovery work is resolved.
  if (!pendingRecovery && !protectedProjectIds.size) {
    for (const prefix of ['music/results/', 'music/imports/', 'scores/']) {
      const candidates = await listAssetPaths(storage, prefix);
      for (const path of candidates) if (!retained.has(path) && (await storage.assets.remove(path)).removed) removedAssets += 1;
    }
  }
  return { removedProjects, removedAssets };
}
