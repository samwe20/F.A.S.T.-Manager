import { describe, expect, it } from 'vitest';
import type { NodeRecord } from '../src/types';
import { dayPreviewNodes, previewSnippet } from '../src/utils/nodeUtils';

const link = '22222222-2222-2222-2222-222222222222';

function node(partial: Partial<NodeRecord> & Pick<NodeRecord, 'id'>): NodeRecord {
  return {
    workspaceId: 'w',
    parentId: null,
    content: '',
    order: 0,
    supertagIds: [],
    fieldValues: {},
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: false,
    ...partial,
  };
}

describe('preview snippet', () => {
  it('keeps the lines under the title and drops a bare embed', () => {
    const note = node({
      id: 'n1',
      typeId: 'note',
      title: 'první řádek',
      blocks: [
        { id: 'b1', type: 'paragraph', text: 'první řádek\ndruhý řádek' },
        { id: 'b2', type: 'paragraph', text: `[[${link}]]` },
      ],
    });
    expect(previewSnippet(note, [note], 'první řádek')).toBe('druhý řádek');
  });

  it('keeps four lines under the title', () => {
    const note = node({
      id: 'n2',
      typeId: 'note',
      title: 'nadpis',
      blocks: [{ id: 'b', type: 'paragraph', text: 'nadpis\njedna\ndvě\ntři\nčtyři\npět' }],
    });
    expect(previewSnippet(note, [note], 'nadpis')).toBe('jedna\ndvě\ntři\nčtyři');
  });
});

describe('day previews', () => {
  it('puts this day first and skips empty notes, daily notes, and listed tasks', () => {
    const task = node({
      id: 'task',
      typeId: 'task',
      title: 'koupit mléko',
      createdAt: '2026-11-02T08:00:00.000Z',
      updatedAt: '2026-11-02T08:00:00.000Z',
      fieldValues: { task: { dueDate: '2026-11-02', status: 'new' } },
    });
    const daily = node({ id: 'day', typeId: 'dailyNote', title: '2026-11-02' });
    const empty = node({ id: 'empty', typeId: 'note' });
    const older = node({
      id: 'older',
      typeId: 'note',
      content: 'starší věta',
      updatedAt: '2026-11-01T12:00:00.000Z',
    });
    const todayNote = node({
      id: 'today',
      typeId: 'note',
      content: 'dnešní věta',
      createdAt: '2026-11-02T09:00:00.000Z',
      updatedAt: '2026-11-02T09:00:00.000Z',
    });
    const image = node({
      id: 'pic',
      typeId: 'image',
      fieldValues: { image: { src: 'blob:abc' } },
      updatedAt: '2026-11-01T18:00:00.000Z',
    });
    const picked = dayPreviewNodes([task, daily, empty, older, todayNote, image], '2026-11-02', ['day', 'task']);
    expect(picked.map((item) => item.id)).toEqual(['today', 'pic', 'older']);
  });

  it('shows more than the first six cards', () => {
    const notes = Array.from({ length: 13 }, (_, index) =>
      node({
        id: `n${index}`,
        typeId: 'note',
        content: `věta ${index}`,
        updatedAt: `2026-11-01T00:${String(index).padStart(2, '0')}:00.000Z`,
      }),
    );
    expect(dayPreviewNodes(notes, '2026-11-02', []).map((item) => item.id)).toHaveLength(12);
  });
});
