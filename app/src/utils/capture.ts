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

export type LinePiece =
  | { kind: 'text'; text: string }
  | { kind: 'create'; typeId: string; title: string }
  | { kind: 'name'; typeId: string };

/** A slash token at the end of the line, still without its name. */
export function openShortcut(text: string): { command: string } | null {
  const match = text.match(/(?:^|\s)\/(\S*)$/);
  if (!match) return null;
  return { command: match[1] ?? '' };
}

function exactAt(text: string, index: number): { typeId: string; commandEnd: number } | null {
  if (text[index] !== '/') return null;
  if (index > 0 && !/\s/.test(text[index - 1] ?? '')) return null;
  const command = text.slice(index + 1).match(/^(\S+)/);
  if (!command) return null;
  const hit = CAPTURE_SHORTCUTS.find((item) => isExact(item, foldSlash(command[1])));
  if (!hit) return null;
  return { typeId: hit.typeId, commandEnd: index + 1 + command[1].length };
}

/**
 * Exact shortcuts anywhere in the line. The name runs until the next shortcut.
 * A shortcut with no name asks for one. A slash that is not a shortcut stays text.
 */
export function lineCaptures(text: string): LinePiece[] | null {
  const hits: { start: number; commandEnd: number; typeId: string }[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const found = exactAt(text, i);
    if (!found) continue;
    hits.push({ start: i, ...found });
    i = found.commandEnd - 1;
  }
  if (hits.length === 0) return null;
  const pieces: LinePiece[] = [];
  let cursor = 0;
  hits.forEach((hit, index) => {
    const before = text.slice(cursor, hit.start).trim();
    if (before) pieces.push({ kind: 'text', text: before });
    const next = hits[index + 1]?.start ?? text.length;
    const title = text.slice(hit.commandEnd, next).trim();
    pieces.push(title ? { kind: 'create', typeId: hit.typeId, title } : { kind: 'name', typeId: hit.typeId });
    cursor = next;
  });
  return pieces;
}

export function captureChoices(command: string): CaptureShortcut[] {
  const folded = foldSlash(command);
  if (!folded) return CAPTURE_SHORTCUTS;
  const exact = CAPTURE_SHORTCUTS.filter((item) => isExact(item, folded));
  if (exact.length > 0) return exact;
  return CAPTURE_SHORTCUTS.filter((item) => foldSlash(item.code).startsWith(folded));
}
