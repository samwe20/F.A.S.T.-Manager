import { db } from '../db/database';
import type { MediaRecord } from '../types';
import { bytesToArrayBuffer } from '../utils/media';
import type { VaultSnapshot } from './vaultFormat';

function asBytes(bytes: ArrayBuffer | Uint8Array): Uint8Array {
  return bytes instanceof Uint8Array ? new Uint8Array(bytes) : new Uint8Array(bytes);
}

export async function snapshotFromDb(): Promise<VaultSnapshot> {
  const [nodes, workspaces, queries, objectTypes, collections, templates, media] = await Promise.all([
    db.nodes.toArray(),
    db.workspaces.toArray(),
    db.queries.toArray(),
    db.objectTypes.toArray(),
    db.collections.toArray(),
    db.templates.toArray(),
    db.media.toArray(),
  ]);
  return {
    version: 1,
    nodes: nodes.filter((item) => !item.deleted),
    workspaces: workspaces.filter((item) => !item.deleted),
    queries: queries.filter((item) => !item.deleted),
    objectTypes: objectTypes.filter((item) => !item.deleted),
    collections: collections.filter((item) => !item.deleted),
    templates: templates.filter((item) => !item.deleted),
    media: media.map((item) => ({
      id: item.id,
      name: item.name,
      mimeType: item.mimeType,
      createdAt: item.createdAt,
      bytes: asBytes(item.bytes),
    })),
  };
}

export async function snapshotToDb(snapshot: VaultSnapshot): Promise<void> {
  const media: MediaRecord[] = snapshot.media.map((item) => ({
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    createdAt: item.createdAt,
    bytes: bytesToArrayBuffer(item.bytes),
  }));
  await db.transaction(
    'rw',
    [db.nodes, db.workspaces, db.queries, db.objectTypes, db.collections, db.templates, db.media],
    async () => {
      await db.nodes.clear();
      await db.workspaces.clear();
      await db.queries.clear();
      await db.objectTypes.clear();
      await db.collections.clear();
      await db.templates.clear();
      await db.media.clear();
      await db.nodes.bulkPut(snapshot.nodes);
      await db.workspaces.bulkPut(snapshot.workspaces);
      await db.queries.bulkPut(snapshot.queries);
      await db.objectTypes.bulkPut(snapshot.objectTypes);
      await db.collections.bulkPut(snapshot.collections);
      await db.templates.bulkPut(snapshot.templates);
      await db.media.bulkPut(media);
    },
  );
}
