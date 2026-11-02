import { describe, expect, it } from 'vitest';
import type { NodeRecord } from '../src/types';
import { blocksWithTag, displayTitle, getBacklinks } from '../src/utils/nodeUtils';

function node(partial: Partial<NodeRecord> & Pick<NodeRecord, 'id'>): NodeRecord {
  return {
    workspaceId: 'default',
    parentId: null,
    content: '',
    order: 0,
    supertagIds: [],
    fieldValues: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: false,
    ...partial,
  };
}

describe('block tags', () => {
  const tag = node({ id: 'tag-1', typeId: 'tag', title: 'vesmír', content: 'vesmír' });
  const note = node({
    id: 'note-1',
    typeId: 'note',
    title: 'Poznámka',
    content: 'Poznámka',
    blocks: [
      { id: 'b1', type: 'paragraph', text: 'první', tagIds: ['tag-1'] },
      { id: 'b2', type: 'paragraph', text: 'druhý' },
    ],
  });
  const deleted = node({
    id: 'gone',
    deleted: true,
    blocks: [{ id: 'b3', type: 'paragraph', text: 'skrytý', tagIds: ['tag-1'] }],
  });

  it('lists blocks that carry the tag and skips deleted notes', () => {
    expect(blocksWithTag([tag, note, deleted], 'tag-1')).toEqual([
      { nodeId: 'note-1', blockId: 'b1', text: 'první' },
    ]);
  });

  it('treats a block tag as a backlink to the parent note', () => {
    const hits = getBacklinks([tag, note], 'tag-1').map((item) => item.id);
    expect(hits).toEqual(['note-1']);
  });

  it('does not list the tag object as its own backlink', () => {
    expect(getBacklinks([tag], 'tag-1')).toEqual([]);
  });

  it('shows the linked object title instead of the raw id', () => {
    const link = node({
      id: '11111111-1111-1111-1111-111111111111',
      typeId: 'weblink',
      title: 'example.com/docs',
      content: 'example.com/docs',
    });
    const host = node({
      id: '22222222-2222-2222-2222-222222222222',
      title: '',
      content: '[[11111111-1111-1111-1111-111111111111]]',
    });
    expect(displayTitle([link, host], host)).toBe('example.com/docs');
  });
});
