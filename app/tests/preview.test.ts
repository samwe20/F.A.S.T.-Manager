import { describe, expect, it } from 'vitest';
import type { NodeRecord } from '../src/types';
import { canonicalName, dayPreviewNodes, getReferenceCandidates, matchesTypeFilters, previewSnippet, sameObjectName, tasksAssignedTo } from '../src/utils/nodeUtils';

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

describe('type filters', () => {
  const petr = node({ id: 't1', typeId: 'task', title: 'Zavolat', fieldValues: { task: { status: 'new', assignee: 'petr' } } });
  const done = node({ id: 't2', typeId: 'task', title: 'Hotovo', fieldValues: { task: { status: 'done', assignee: 'jana' } } });

  it('keeps every task when both filters are empty', () => {
    expect([petr, done].filter((item) => matchesTypeFilters(item, {})).map((item) => item.id)).toEqual(['t1', 't2']);
  });

  it('keeps a task only when status and assignee both match', () => {
    expect(matchesTypeFilters(petr, { status: 'new', assignee: 'petr' })).toBe(true);
    expect(matchesTypeFilters(petr, { status: 'done', assignee: 'petr' })).toBe(false);
    expect(matchesTypeFilters(done, { status: 'done' })).toBe(true);
    expect(matchesTypeFilters(done, { assignee: 'petr' })).toBe(false);
  });
});

describe('assignee candidates', () => {
  it('lists people and leaves out the daily note, its date, and other types', () => {
    const day = node({
      id: 'day',
      typeId: 'dailyNote',
      title: '2026-11-04',
      supertagIds: ['dailyNote'],
      fieldValues: { dailyNote: { date: '2026-11-04' } },
    });
    const datedPerson = node({ id: 'dated', typeId: 'person', title: '2026-11-04' });
    const petra = node({ id: 'petra', typeId: 'person', title: 'Petra' });
    const sona = node({ id: 'sona', typeId: 'person', title: 'Soňa P.' });
    const aurora = node({ id: 'aurora', typeId: 'project', title: 'Aurora' });
    const gone = node({ id: 'gone', typeId: 'person', title: 'Smazaná', deleted: true });
    expect(getReferenceCandidates([day, datedPerson, petra, sona, aurora, gone], 'person').map((item) => item.id)).toEqual([
      'petra',
      'sona',
    ]);
  });
});

describe('same object name', () => {
  it('treats Aurora and Aurora. as the same name', () => {
    expect(canonicalName('Aurora.')).toBe('Aurora');
    expect(sameObjectName('Aurora.', 'aurora')).toBe(true);
    expect(sameObjectName('Soňa P.', 'soňa p')).toBe(true);
    expect(sameObjectName('Petr', 'Petra')).toBe(false);
  });
});

describe('tasks on a person', () => {
  it('keeps only tasks assigned to that person', () => {
    const petr = node({ id: 'petr', typeId: 'person', title: 'Petr' });
    const his = node({ id: 't1', typeId: 'task', title: 'Zavolat', fieldValues: { task: { assignee: 'petr' } } });
    const other = node({ id: 't2', typeId: 'task', title: 'Jiný', fieldValues: { task: { assignee: 'jana' } } });
    expect(tasksAssignedTo([petr, his, other], 'petr').map((item) => item.id)).toEqual(['t1']);
  });
});
