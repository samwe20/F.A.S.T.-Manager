import { foldSlash } from './blocks';

export interface CaptureShortcut {
  code: string;
  typeId: string;
  aliases: string[];
}

/** Short codes the writer types on purpose. The app does not infer a type from a sentence. */
export const CAPTURE_SHORTCUTS: CaptureShortcut[] = [
  { code: 'o', typeId: 'person', aliases: ['osoba', 'person'] },
  { code: 'u', typeId: 'task', aliases: ['ukol', 'úkol', 'task'] },
  { code: 'pro', typeId: 'project', aliases: ['projekt', 'project'] },
  { code: 's', typeId: 'meeting', aliases: ['schuzka', 'schůzka', 'meeting'] },
  { code: 'poz', typeId: 'note', aliases: ['poznamka', 'poznámka', 'note'] },
  { code: '?', typeId: 'question', aliases: ['otazka', 'otázka', 'question'] },
];

export interface CapturePlan {
  typeId: string;
  /** Empty when the writer still has to type the name on the next line. */
  title: string;
}

function namesOf(item: CaptureShortcut): string[] {
  return [item.code, ...item.aliases];
}

function isExact(item: CaptureShortcut, command: string): boolean {
  return namesOf(item).some((name) => foldSlash(name) === command);
}

export function parseCapture(text: string): CapturePlan | null {
  if (!text.startsWith('/')) return null;
  const body = text.slice(1);
  const match = body.match(/^(\S*)(?:\s+([\s\S]*))?$/);
  if (!match) return null;
  const command = foldSlash(match[1] ?? '');
  if (!command) return null;
  const hit = CAPTURE_SHORTCUTS.find((item) => isExact(item, command));
  if (!hit) return null;
  return { typeId: hit.typeId, title: (match[2] ?? '').trim() };
}

export function captureChoices(command: string): CaptureShortcut[] {
  const folded = foldSlash(command);
  if (!folded) return CAPTURE_SHORTCUTS;
  const exact = CAPTURE_SHORTCUTS.filter((item) => isExact(item, folded));
  if (exact.length > 0) return exact;
  return CAPTURE_SHORTCUTS.filter((item) => foldSlash(item.code).startsWith(folded));
}
