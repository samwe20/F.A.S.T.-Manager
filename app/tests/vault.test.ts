import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/database';
import { snapshotFromDb, snapshotToDb } from '../src/services/vaultDb';
import { MemoryVaultDir } from '../src/services/vaultDir';
import { fileToNode, nodeToFile } from '../src/services/vaultFormat';
import { readSnapshot, writeSnapshot } from '../src/services/vaultIo';
import type { NodeRecord } from '../src/types';

function note(partial: Partial<NodeRecord> & Pick<NodeRecord, 'id'>): NodeRecord {
  return {
    workspaceId: 'default',
    parentId: null,
    content: 'první řádek\ndruhý řádek',
    title: 'Poznámka',
    order: 0,
    supertagIds: ['note'],
    typeId: 'note',
    blocks: [{ id: 'b1', type: 'paragraph', text: 'první řádek\ndruhý řádek' }],
    fieldValues: {},
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: false,
    ...partial,
  };
}

describe('vault files', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('keeps a line break inside one object file', () => {
    const node = note({ id: 'note-1' });
    const restored = fileToNode(nodeToFile(node));
    expect(restored.blocks?.[0]?.text).toBe('první řádek\ndruhý řádek');
    expect(restored.title).toBe('Poznámka');
  });

  it('writes one file per object and reads the folder back', async () => {
    const kept = note({ id: 'note-1' });
    const removed = note({ id: 'note-2', title: 'Pryč', deleted: true });
    await db.workspaces.put({
      id: 'default',
      name: 'Main',
      icon: 'inbox',
      order: 0,
      createdAt: kept.createdAt,
      updatedAt: kept.updatedAt,
      deleted: false,
    });
    await db.nodes.bulkPut([kept, removed]);
    await db.media.put({
      id: 'media-1',
      name: 'swatch.png',
      mimeType: 'image/png',
      bytes: new Uint8Array([1, 2, 3, 4]).buffer,
      createdAt: kept.createdAt,
    });

    const dir = new MemoryVaultDir('Poznámky');
    await dir.writeText('objects/stale.md', 'old');
    await dir.writeBytes('media/stale', new Uint8Array([9]));
    await writeSnapshot(dir, await snapshotFromDb());

    const names = await dir.list('objects');
    expect(names).toEqual(['note-1.md']);
    expect(await dir.exists('media/stale')).toBe(false);
    const text = await dir.readText('objects/note-1.md');
    expect(text).toContain('druhý řádek');

    await db.nodes.clear();
    await db.media.clear();
    await snapshotToDb(await readSnapshot(dir));
    const nodes = await db.nodes.toArray();
    expect(nodes.map((item) => item.id)).toEqual(['note-1']);
    expect(nodes[0]?.blocks?.[0]?.text).toContain('\n');
    const media = await db.media.get('media-1');
    const bytes = media?.bytes instanceof Uint8Array ? media.bytes : new Uint8Array(media?.bytes ?? []);
    expect([...bytes]).toEqual([1, 2, 3, 4]);
  });
});
