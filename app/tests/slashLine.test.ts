import { describe, expect, it } from 'vitest';
import { BUILTIN_SUPERTAGS, fieldsForLineObject } from '../src/data/supertags';
import {
  linkMentionFields,
  planSlashLine,
  renderSlashText,
  replacementFor,
  type SlashObjectRef,
  type SlashTypeRef,
} from '../src/utils/slashLine';

const types: SlashTypeRef[] = [
  { id: 'task', names: ['Task', 'Úkol'] },
  { id: 'person', names: ['Person', 'Osoba'] },
  { id: 'project', names: ['Project', 'Projekt'] },
  { id: 'note', names: ['Note', 'Poznámka'] },
  { id: 'folder', names: ['Folder', 'Složka'] },
  { id: 'tag', names: ['Tag', 'Štítek'] },
];

const sentence =
  '/úkol pro /Frantu je v tom, že v projektu /Malostop je mnoho nejasností ohledně akvizice a má je vyjasnit.';

describe('slash line', () => {
  it('reads a task sentence as a task for a person in a project', () => {
    const plan = planSlashLine(sentence, types, []);
    expect(plan.kind).toBe('create');
    if (plan.kind !== 'create') return;
    expect(plan.typeId).toBe('task');
    expect(plan.mentions.map((mention) => [mention.token.raw, mention.action, mention.typeId])).toEqual([
      ['Frantu', 'create', 'person'],
      ['Malostop', 'create', 'project'],
    ]);
  });

  it('reuses an existing person even when the sentence inflects the name', () => {
    const people: SlashObjectRef[] = [{ id: 'p1', typeId: 'person', names: ['Franta'] }];
    const plan = planSlashLine(sentence, types, people);
    expect(plan.kind).toBe('create');
    if (plan.kind !== 'create') return;
    expect(plan.mentions[0]).toMatchObject({ action: 'link', id: 'p1', typeId: 'person' });
    expect(plan.mentions[1]).toMatchObject({ action: 'create', typeId: 'project', title: 'Malostop' });
  });

  it('keeps the sentence readable and links the named objects', () => {
    const plan = planSlashLine(sentence, types, []);
    if (plan.kind !== 'create') throw new Error('expected create');
    const resolved = plan.mentions.map((mention, index) => replacementFor(mention, `id-${index + 1}`));
    const rendered = renderSlashText(sentence, resolved, plan.leading);
    expect(rendered.plain).toBe(
      'pro Frantu je v tom, že v projektu Malostop je mnoho nejasností ohledně akvizice a má je vyjasnit.',
    );
    expect(rendered.linked).toBe(
      'pro [[id-1]] je v tom, že v projektu [[id-2]] je mnoho nejasností ohledně akvizice a má je vyjasnit.',
    );
  });

  it('puts the person on the assignee and the project on the project field', () => {
    const task = BUILTIN_SUPERTAGS.find((type) => type.id === 'task');
    if (!task) throw new Error('missing task');
    const fields = linkMentionFields(task, fieldsForLineObject(task, '2026-11-02'), [
      { id: 'p1', typeId: 'person' },
      { id: 'j1', typeId: 'project' },
    ]);
    expect(fields.dueDate).toBe('2026-11-02');
    expect(fields.status).toBe('new');
    expect(fields.assignee).toBe('p1');
    expect(fields.project).toBe('j1');
  });

  it('links a bare name inside a sentence without turning the line into a task', () => {
    const plan = planSlashLine('Zítra zavolat /Frantu.', types, []);
    expect(plan.kind).toBe('mentions');
    if (plan.kind !== 'mentions') return;
    expect(plan.mentions[0]).toMatchObject({ action: 'create', typeId: 'person', title: 'Frantu' });
  });

  it('does not invent a folder or a tag from a slash', () => {
    expect(planSlashLine('/složka Archiv', types, []).kind).toBe('none');
    expect(planSlashLine('/štítek vesmír', types, []).kind).toBe('none');
    const hinted = planSlashLine('Dej to do složky /Archiv', types, []);
    expect(hinted.kind).toBe('mentions');
    if (hinted.kind !== 'mentions') return;
    expect(hinted.mentions[0].action).toBe('keep');
  });

  it('leaves an ambiguous type prefix alone', () => {
    expect(planSlashLine('/p něco', types, []).kind).toBe('ambiguous');
  });
});
