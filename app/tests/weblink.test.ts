import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/database';
import { createWeblinkObject, ensureObjectModel } from '../src/services/objectModel';
import type { NodeRecord } from '../src/types';
import { isStandaloneUrl, weblinkTitle } from '../src/utils/weblink';

describe('weblink helpers', () => {
  it('accepts a lone http or https address', () => {
    expect(isStandaloneUrl('https://capacities.io/docs')).toBe(true);
    expect(isStandaloneUrl('  http://example.com  ')).toBe(true);
  });

  it('rejects text that is not only an address', () => {
    expect(isStandaloneUrl('see https://example.com')).toBe(false);
    expect(isStandaloneUrl('https://example.com and more')).toBe(false);
    expect(isStandaloneUrl('ftp://example.com')).toBe(false);
    expect(isStandaloneUrl('')).toBe(false);
  });

  it('builds a short title from host and path', () => {
    expect(weblinkTitle('https://www.example.com/docs/')).toBe('example.com/docs');
    expect(weblinkTitle('https://example.com/')).toBe('example.com');
  });
});

describe('weblink objects', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('stores the address once and reuses the same object', async () => {
    const first = await createWeblinkObject('default', 'https://www.example.com/docs/');
    const again = await createWeblinkObject('default', 'https://www.example.com/docs/');
    expect(again.id).toBe(first.id);
    expect(first.title).toBe('example.com/docs');
    expect(first.fieldValues.weblink?.url).toBe('https://www.example.com/docs/');
    expect(first.typeId).toBe('weblink');
    const rows = await db.nodes.filter((node) => node.typeId === 'weblink').toArray();
    expect(rows).toHaveLength(1);
  });

  it('adds the weblink type without dropping existing tables', async () => {
    await ensureObjectModel();
    const type = await db.objectTypes.get('weblink');
    expect(type?.icon).toBe('link');
    expect(type?.fields.map((field) => field.key)).toEqual(['url', 'description']);
    expect(await db.nodes.count()).toBe(0);
    expect(db.tables.map((table) => table.name).sort()).toEqual(
      ['collections', 'media', 'nodes', 'objectTypes', 'queries', 'settings', 'syncQueue', 'templates', 'workspaces'].sort(),
    );
  });

  it('keeps notes when opening the media schema over an older database', async () => {
    await db.delete();
    const legacy = new Dexie('fast-manager');
    legacy.version(1).stores({
      nodes: 'id, workspaceId, parentId, updatedAt, deleted',
      workspaces: 'id, order, updatedAt, deleted',
      queries: 'id, order, updatedAt, deleted',
      syncQueue: 'id, updatedAt',
      settings: 'id',
    });
    legacy.version(2).stores({
      nodes: 'id, workspaceId, parentId, updatedAt, deleted, typeId',
      workspaces: 'id, order, updatedAt, deleted',
      queries: 'id, order, updatedAt, deleted',
      syncQueue: 'id, updatedAt',
      settings: 'id',
      objectTypes: 'id, order, deleted',
      collections: 'id, typeId, order, deleted',
      templates: 'id, typeId, deleted',
    });
    const kept: NodeRecord = {
      id: 'kept-note',
      workspaceId: 'default',
      parentId: null,
      content: 'zůstává',
      title: 'zůstává',
      order: 0,
      supertagIds: ['note'],
      typeId: 'note',
      fieldValues: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deleted: false,
    };
    await legacy.open();
    await legacy.table('nodes').put(kept);
    legacy.close();

    await db.open();
    expect((await db.nodes.get('kept-note'))?.title).toBe('zůstává');
    expect(db.media).toBeTruthy();
    expect(await db.media.count()).toBe(0);
  });
});
