import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/database';
import { migrateStoredMedia, readMedia, rewriteNodeMedia, saveMediaFile } from '../src/services/mediaStore';
import type { NodeRecord } from '../src/types';
import { blobRef, parseBlobRef, parseDataUrl } from '../src/utils/media';

function asBytes(value: ArrayBuffer | Uint8Array): Uint8Array {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

function node(partial: Partial<NodeRecord> & Pick<NodeRecord, 'id'>): NodeRecord {
  return {
    workspaceId: 'default',
    parentId: null,
    content: 'Obrázek',
    title: 'Obrázek',
    order: 0,
    supertagIds: ['image'],
    typeId: 'image',
    fieldValues: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: false,
    ...partial,
  };
}

describe('media bytes', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('parses a data URL and names a blob reference', () => {
    const parsed = parseDataUrl('data:text/plain;base64,aGVsbG8=');
    expect(parsed?.mimeType).toBe('text/plain');
    expect(new TextDecoder().decode(parsed?.bytes)).toBe('hello');
    expect(parseBlobRef(blobRef('abc'))).toBe('abc');
    expect(parseBlobRef('data:text/plain,hi')).toBeNull();
  });

  it('round-trips a file through the media table', async () => {
    const file = new File([new TextEncoder().encode('hello')], 'note.txt', { type: 'text/plain' });
    const id = await saveMediaFile(file);
    const stored = await readMedia(id);
    expect(stored?.name).toBe('note.txt');
    expect(stored?.mimeType).toBe('text/plain');
    expect(new TextDecoder().decode(asBytes(stored!.bytes))).toBe('hello');
  });

  it('moves a data URL out of the node and into the media table', async () => {
    const original = node({
      id: 'img-1',
      fieldValues: {
        image: { src: 'data:text/plain;base64,aGVsbG8=', caption: 'popisek' },
      },
    });
    await db.nodes.put(original);
    const rewritten = await rewriteNodeMedia(original);
    const id = parseBlobRef(rewritten.fieldValues.image?.src);
    expect(id).toBeTruthy();
    expect(rewritten.fieldValues.image?.caption).toBe('popisek');
    const stored = await readMedia(id!);
    expect(new TextDecoder().decode(asBytes(stored!.bytes))).toBe('hello');

    await db.nodes.put(rewritten);
    await db.nodes.put(
      node({
        id: 'img-2',
        fieldValues: { image: { src: 'data:text/plain;base64,aGVsbG8=' } },
      }),
    );
    expect(await migrateStoredMedia()).toBe(1);
    const migrated = await db.nodes.get('img-2');
    expect(String(migrated?.fieldValues.image?.src).startsWith('blob:')).toBe(true);
    expect(await migrateStoredMedia()).toBe(0);
  });
});
