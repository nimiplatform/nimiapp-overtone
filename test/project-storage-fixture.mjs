import { createHash } from 'node:crypto';

// Isolated protected-storage-shaped fault backend. This verifies App document
// commits and references; it does not establish Runtime or native acceptance.
export function attachProjectAssets(storage, documents) {
  const assetBodies = new Map(); const assetRecords = new Map();
  storage.assetBodies = assetBodies; storage.assetRecords = assetRecords;
  storage.removeJson ??= async path => ({ removed: documents.delete(path) });
  storage.assets = {
    async write({ relativePath, mediaType, body, overwrite = false }) {
      if (!overwrite && assetRecords.has(relativePath)) throw Error('asset exists');
      let bytes;
      if (body instanceof Uint8Array) bytes = body.slice();
      else if (body instanceof Blob) bytes = new Uint8Array(await body.arrayBuffer());
      else { const chunks = []; for await (const part of body) chunks.push(part); bytes = new Uint8Array(Buffer.concat(chunks)); }
      const asset = { relativePath, mediaType, sizeBytes: bytes.length, sha256: 'sha256:' + createHash('sha256').update(bytes).digest('hex'), createdAt: '2026-09-30', updatedAt: '2026-09-30' };
      assetBodies.set(relativePath, bytes); assetRecords.set(relativePath, asset); return asset;
    },
    async read({ relativePath }) {
      if (!assetRecords.has(relativePath)) throw Object.assign(Error('absent asset'), { reasonCode: 'APP_STORAGE_ENTRY_NOT_FOUND' });
      const bytes = assetBodies.get(relativePath);
      return { asset: assetRecords.get(relativePath), range: { offset: 0, length: bytes.length, totalSize: bytes.length }, body: (async function* () { yield bytes; })() };
    },
    async stat(path) { return assetRecords.get(path); },
    async list({ prefix, cursor, pageSize = 100 }) {
      const items = [...assetRecords.values()].filter(asset => asset.relativePath.startsWith(prefix)).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
      const start = Number(cursor || 0); const assets = items.slice(start, start + pageSize);
      return { assets, nextCursor: start + assets.length < items.length ? String(start + assets.length) : '' };
    },
    async remove(path) { const removed = assetRecords.delete(path); assetBodies.delete(path); return { removed }; },
  };
  return storage;
}
export function createProjectStorage() {
  const documents = new Map();
  return attachProjectAssets({ documents,
    async readJson(path) { if (!documents.has(path)) throw Object.assign(Error('absent'), { reasonCode: 'APP_STORAGE_ENTRY_NOT_FOUND' }); return { value: structuredClone(documents.get(path)) }; },
    async writeJson(path, value) { documents.set(path, structuredClone(value)); return { value }; },
  }, documents);
}
export function storedProject(storage, documents, projectId) {
  const head = storedHead(documents, projectId);
  return head ? JSON.parse(new TextDecoder().decode(storage.assetBodies.get(head.document.relativePath))) : undefined;
}
export function storedHead(documents, projectId) {
  return documents.get('workspace/projects.json')?.heads.find(head => head.projectId === projectId);
}
