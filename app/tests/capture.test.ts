import { describe, expect, it } from 'vitest';
import { captureChoices, parseCapture } from '../src/utils/capture';

const sentence =
  '/úkol pro /Frantu je v tom, že v projektu /Malostop je mnoho nejasností ohledně akvizice a má je vyjasnit.';

describe('capture shortcuts', () => {
  it('waits for a name after a bare shortcut', () => {
    expect(parseCapture('/o')).toEqual({ typeId: 'person', title: '' });
    expect(parseCapture('/u')).toEqual({ typeId: 'task', title: '' });
    expect(parseCapture('/pro')).toEqual({ typeId: 'project', title: '' });
    expect(parseCapture('/s')).toEqual({ typeId: 'meeting', title: '' });
    expect(parseCapture('/poz')).toEqual({ typeId: 'note', title: '' });
    expect(parseCapture('/?')).toEqual({ typeId: 'question', title: '' });
  });

  it('saves the name written on the same line', () => {
    expect(parseCapture('/o Honza Krulda')).toEqual({ typeId: 'person', title: 'Honza Krulda' });
    expect(parseCapture('/osoba Honza Krulda')).toEqual({ typeId: 'person', title: 'Honza Krulda' });
    expect(parseCapture('/u koupit mléko')).toEqual({ typeId: 'task', title: 'koupit mléko' });
  });

  it('does not guess a type out of a sentence', () => {
    expect(parseCapture(sentence)?.typeId).toBe('task');
    expect(parseCapture(sentence)?.title).toContain('/Frantu');
    expect(parseCapture('Zítra zavolat /Frantu.')).toBeNull();
    expect(parseCapture('/p')).toBeNull();
    expect(parseCapture('/složka Archiv')).toBeNull();
  });

  it('keeps an unfinished prefix open until it is unique', () => {
    expect(captureChoices('p').map((item) => item.typeId).sort()).toEqual(['note', 'project']);
    expect(captureChoices('pro').map((item) => item.typeId)).toEqual(['project']);
    expect(captureChoices('o').map((item) => item.typeId)).toEqual(['person']);
  });
});
