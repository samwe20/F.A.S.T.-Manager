import { describe, expect, it } from 'vitest';
import { BUILTIN_SUPERTAGS, fieldsForLineObject } from '../src/data/supertags';
import { slashChoices, slashPick, slashQuery } from '../src/utils/blocks';

const types = [
  { id: 'task', names: ['Task', 'Úkol'] },
  { id: 'note', names: ['Note', 'Poznámka'] },
  { id: 'project', names: ['Project', 'Projekt'] },
];

describe('slash commands', () => {
  it('splits a command from the rest of the line', () => {
    expect(slashQuery('/úkol koupit mléko')).toEqual({ command: 'úkol', title: 'koupit mléko' });
    expect(slashQuery('/úkol')).toEqual({ command: 'úkol', title: '' });
    expect(slashQuery('koupit mléko')).toBeNull();
  });

  it('matches a Czech name without the accent', () => {
    expect(slashPick('ukol', types)?.id).toBe('task');
    expect(slashPick('úkol', types)?.id).toBe('task');
    expect(slashPick('task', types)?.id).toBe('task');
    expect(slashPick('pozn', types)?.id).toBe('note');
  });

  it('leaves an ambiguous prefix for the menu', () => {
    expect(slashPick('p', types)).toBeUndefined();
    expect(slashChoices('p', types).map((item) => item.id).sort()).toEqual(['note', 'project']);
    expect(slashChoices('', types)).toHaveLength(3);
  });

  it('dates a task created from a daily note and leaves a note undated', () => {
    const task = BUILTIN_SUPERTAGS.find((type) => type.id === 'task');
    const note = BUILTIN_SUPERTAGS.find((type) => type.id === 'note');
    expect(task && fieldsForLineObject(task, '2026-11-02').dueDate).toBe('2026-11-02');
    expect(task && fieldsForLineObject(task).status).toBe('new');
    expect(note && fieldsForLineObject(note, '2026-11-02').dueDate).toBeUndefined();
  });
});
