import type { Block, BlockType, NodeRecord } from '../types';

export function newBlockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `b-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function parseContentField(value: unknown): Block[] {
  if (typeof value !== 'string' || !value.trim()) return [emptyBlock()];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      const blocks = parsed.filter(
        (item): item is Block =>
          !!item && typeof item === 'object' && typeof (item as Block).id === 'string' && typeof (item as Block).text === 'string',
      );
      if (blocks.length) return blocks;
    }
  } catch {
    // A plain string is one paragraph per line.
  }
  return value.split('\n').map((line) => ({ ...emptyBlock(), text: line }));
}

export function serializeContentField(blocks: Block[]): string {
  return JSON.stringify(blocks);
}

export function emptyBlock(type: BlockType = 'paragraph'): Block {
  return {
    id: newBlockId(),
    type,
    text: '',
    level: type === 'heading' ? 2 : undefined,
    checked: type === 'todo' ? false : undefined,
  };
}

export const MAX_BLOCK_INDENT = 4;

export function clampIndent(value: number | undefined): number {
  if (!value || value < 0) return 0;
  return Math.min(MAX_BLOCK_INDENT, Math.floor(value));
}

export function slashQuery(text: string): { command: string; title: string } | null {
  if (!text.startsWith('/')) return null;
  const body = text.slice(1).trimStart();
  const space = body.search(/\s/);
  if (space === -1) return { command: body.trim().toLowerCase(), title: '' };
  return { command: body.slice(0, space).toLowerCase(), title: body.slice(space + 1).trim() };
}

export function foldSlash(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export interface SlashCandidate {
  id: string;
  names: string[];
}

export function slashChoices<T extends SlashCandidate>(command: string, candidates: T[]): T[] {
  const folded = foldSlash(command);
  if (!folded) return candidates;
  const exact = candidates.filter((item) => matchesSlash(item, folded, false));
  if (exact.length > 0) return exact;
  return candidates.filter((item) => matchesSlash(item, folded, true));
}

export function slashPick<T extends SlashCandidate>(command: string, candidates: T[]): T | undefined {
  const folded = foldSlash(command);
  if (!folded) return undefined;
  const exact = candidates.filter((item) => matchesSlash(item, folded, false));
  if (exact.length > 0) return exact[0];
  const partial = candidates.filter((item) => matchesSlash(item, folded, true));
  return partial.length === 1 ? partial[0] : undefined;
}

function matchesSlash(item: SlashCandidate, folded: string, prefix: boolean): boolean {
  const names = [item.id, ...item.names];
  return names.some((name) => {
    const value = foldSlash(name);
    return prefix ? value.startsWith(folded) : value === folded;
  });
}

export function isEmbedText(text: string): boolean {
  return /^\[\[[0-9a-fA-F-]{8,}\]\]$/.test(text.trim());
}

export function embedIdFromText(text: string): string | null {
  const match = text.trim().match(/^\[\[([0-9a-fA-F-]{8,})\]\]$/);
  return match?.[1] ?? null;
}

export function adjustIndent(block: Block, delta: number): Block {
  return { ...block, indent: clampIndent((block.indent ?? 0) + delta) };
}

export function moveBlock(blocks: Block[], from: number, to: number): Block[] {
  if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return blocks;
  const next = [...blocks];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function withIndent(block: Block, indent: number): Block {
  return indent > 0 ? { ...block, indent } : block;
}

export function lineToBlock(line: string): Block {
  const spaces = line.match(/^ */)?.[0].length ?? 0;
  const indent = clampIndent(Math.floor(spaces / 2));
  const rest = line.slice(indent * 2);
  const todo = rest.match(/^-\s\[( |x|X)\]\s?(.*)$/);
  if (todo) {
    return withIndent(
      { id: newBlockId(), type: 'todo', text: todo[2] ?? '', checked: todo[1].toLowerCase() === 'x' },
      indent,
    );
  }
  const bullet = rest.match(/^[-*]\s+(.*)$/);
  if (bullet) return withIndent({ id: newBlockId(), type: 'bullet', text: bullet[1] ?? '' }, indent);
  const heading = rest.match(/^(#{1,3})\s+(.*)$/);
  if (heading) {
    return withIndent(
      {
        id: newBlockId(),
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2] ?? '',
      },
      indent,
    );
  }
  const quote = rest.match(/^>\s?(.*)$/);
  if (quote) return withIndent({ id: newBlockId(), type: 'quote', text: quote[1] ?? '' }, indent);
  return withIndent({ id: newBlockId(), type: 'paragraph', text: rest }, indent);
}

export function splitContent(content: string): { title: string; blocks: Block[] } {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const title = (lines[0] ?? '').trim();
  const rest = lines.slice(1);
  const blocks = rest.length > 0 ? rest.map(lineToBlock) : [emptyBlock()];
  return { title, blocks };
}

export function mirrorContent(title: string, blocks: Block[]): string {
  const body = blocks
    .filter((block) => block.text.trim() || block.type === 'todo')
    .map((block) => {
      const pad = '  '.repeat(clampIndent(block.indent));
      if (block.type === 'todo') return `${pad}- [${block.checked ? 'x' : ' '}] ${block.text}`;
      if (block.type === 'bullet') return `${pad}- ${block.text}`;
      if (block.type === 'heading') return `${pad}${'#'.repeat(block.level ?? 2)} ${block.text}`;
      if (block.type === 'quote') return `${pad}> ${block.text}`;
      return `${pad}${block.text}`;
    })
    .join('\n');
  if (!title.trim()) return body;
  if (!body) return title;
  return `${title}\n${body}`;
}

export function blockPlainText(blocks: Block[] | undefined): string {
  return (blocks ?? []).map((block) => block.text).join('\n');
}

const LINK_RE = /\[\[([0-9a-fA-F-]{8,})\]\]/g;

export function extractLinkIds(text: string): string[] {
  return [...text.matchAll(LINK_RE)].map((match) => match[1]);
}

export function linkIdsInNode(node: NodeRecord): string[] {
  const fromContent = extractLinkIds(node.content);
  const fromBlocks = (node.blocks ?? []).flatMap((block) => extractLinkIds(block.text));
  return [...new Set([...fromContent, ...fromBlocks])];
}

export function objectTitle(node: Pick<NodeRecord, 'title' | 'content' | 'id'> | undefined): string {
  if (!node) return '';
  const title = node.title?.trim();
  if (title) return title;
  const line = node.content.split('\n')[0]?.trim() ?? '';
  return line;
}

export function splitIds(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  return value.split('|').map((part) => part.trim()).filter(Boolean);
}

export function joinIds(ids: string[]): string {
  return [...new Set(ids.filter(Boolean))].join('|');
}
