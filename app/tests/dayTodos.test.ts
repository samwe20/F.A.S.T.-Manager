import { describe, expect, it } from 'vitest';
import type { NodeRecord } from '../src/types';
import { dayTodoBlocks } from '../src/utils/nodeUtils';

function node(partial: Partial<NodeRecord> & Pick<NodeRecord, 'id'>): NodeRecord {
  return {
    workspaceId: 'default',
    parentId: null,
    content: '',
    order: 0,
    supertagIds: [],
    fieldValues: {},
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
    deleted: false,
    ...partial,
  };
}

describe('dayTodoBlocks', () => {
  const open = node({
    id: 'note',
    typeId: 'note',
    fieldValues: { note: { dueDate: '2026-11-02' } },
    blocks: [
      { id: 'open', type: 'todo', text: 'koupit mléko', checked: false },
      { id: 'done', type: 'todo', text: 'hotovo', checked: true },
    ],
  });
  const daily = node({
    id: 'day',
    typeId: 'dailyNote',
    createdAt: '2026-11-02T08:00:00.000Z',
    blocks: [{ id: 'inside', type: 'todo', text: 'uvnitř dne', checked: false }],
  });

  it('shows an open checkbox from an object dated that day', () => {
    expect(dayTodoBlocks([open, daily], '2026-11-02', ['day'])).toEqual([
      { nodeId: 'note', blockId: 'open', text: 'koupit mléko' },
    ]);
  });

  it('skips objects that do not belong to the day', () => {
    expect(dayTodoBlocks([node({ id: 'old', typeId: 'note', blocks: [{ id: 'b', type: 'todo', text: 'mimo', checked: false }] })], '2026-11-02')).toEqual([]);
  });
});
