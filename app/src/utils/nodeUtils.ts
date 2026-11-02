import type { NodeRecord } from '../types';
import { linkIdsInNode, objectTitle, splitIds } from './blocks';

export interface TaggedBlockHit {
  nodeId: string;
  blockId: string;
  text: string;
}

export interface DayTodoHit {
  nodeId: string;
  blockId: string;
  text: string;
}

function belongsToDay(node: NodeRecord, dayKey: string): boolean {
  if (node.createdAt.slice(0, 10) === dayKey) return true;
  return Object.values(node.fieldValues).some((bag) =>
    Object.values(bag).some((value) => typeof value === 'string' && value.slice(0, 10) === dayKey),
  );
}

/** Open checkbox blocks on other objects that belong to this day. */
export function dayTodoBlocks(nodes: NodeRecord[], dayKey: string, excludeIds: string[] = []): DayTodoHit[] {
  if (!dayKey) return [];
  const hidden = new Set(['dailyNote', 'tag', 'folder', ...excludeIds]);
  const hits: DayTodoHit[] = [];
  for (const node of nodes) {
    if (node.deleted || hidden.has(node.id) || hidden.has(node.typeId ?? '')) continue;
    if (!belongsToDay(node, dayKey)) continue;
    for (const block of node.blocks ?? []) {
      if (block.type === 'todo' && !block.checked && block.text.trim()) {
        hits.push({ nodeId: node.id, blockId: block.id, text: block.text });
      }
    }
  }
  return hits;
}

export { objectTitle };

export function searchNodes(nodes: NodeRecord[], query: string): NodeRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return nodes.filter((node) => {
    if (objectTitle(node).toLowerCase().includes(q)) return true;
    if ((node.aliases ?? []).some((alias) => alias.toLowerCase().includes(q))) return true;
    if (node.content.toLowerCase().includes(q)) return true;
    if ((node.blocks ?? []).some((block) => block.text.toLowerCase().includes(q))) return true;
    const typeIds = [node.typeId, ...node.supertagIds].filter(Boolean) as string[];
    for (const tagId of typeIds) {
      if (tagId.toLowerCase().includes(q)) return true;
      const fields = node.fieldValues[tagId] ?? {};
      for (const val of Object.values(fields)) {
        if (String(val).toLowerCase().includes(q)) return true;
      }
    }
    return false;
  });
}

function fieldPointsAt(value: string | number | boolean, targetId: string): boolean {
  if (value === targetId) return true;
  return splitIds(value).includes(targetId);
}

export function getBacklinks(nodes: NodeRecord[], targetId: string): NodeRecord[] {
  return nodes.filter((node) => {
    if (node.id === targetId) return false;
    if ((node.tagIds ?? []).includes(targetId)) return true;
    if ((node.blocks ?? []).some((block) => (block.tagIds ?? []).includes(targetId))) return true;
    for (const fields of Object.values(node.fieldValues)) {
      for (const val of Object.values(fields)) {
        if (fieldPointsAt(val, targetId)) return true;
      }
    }
    return linkIdsInNode(node).includes(targetId);
  });
}

export function blocksWithTag(nodes: NodeRecord[], tagId: string): TaggedBlockHit[] {
  const hits: TaggedBlockHit[] = [];
  for (const node of nodes) {
    if (node.deleted) continue;
    for (const block of node.blocks ?? []) {
      if ((block.tagIds ?? []).includes(tagId)) {
        hits.push({ nodeId: node.id, blockId: block.id, text: block.text });
      }
    }
  }
  return hits;
}

export function getUnlinkedMentions(nodes: NodeRecord[], target: NodeRecord): NodeRecord[] {
  const names = [objectTitle(target), ...(target.aliases ?? [])]
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length >= 3);
  if (!names.length) return [];
  return nodes.filter((node) => {
    if (node.id === target.id) return false;
    if (linkIdsInNode(node).includes(target.id)) return false;
    const haystack = `${objectTitle(node)}\n${node.content}\n${(node.blocks ?? []).map((block) => block.text).join('\n')}`.toLowerCase();
    return names.some((name) => haystack.includes(name));
  });
}

export function resolveLinks(text: string, nodes: NodeRecord[]): string {
  return text.replace(/\[\[([0-9a-fA-F-]{8,})\]\]/g, (_, id: string) => {
    const target = nodes.find((item) => item.id === id);
    const title = objectTitle(target).trim();
    if (!title || /^\[\[[0-9a-fA-F-]{8,}\]\]$/.test(title)) return id.slice(0, 8);
    return title;
  });
}

export function displayTitle(nodes: NodeRecord[], node: NodeRecord | undefined): string {
  return resolveLinks(objectTitle(node), nodes);
}

const EMBED_LINE = /^\[\[[0-9a-fA-F-]{8,}\]\]$/;

export function previewSnippet(node: NodeRecord, nodes: NodeRecord[], title: string): string {
  const fromBlocks = (node.blocks ?? []).flatMap((block) => block.text.split('\n'));
  const source = fromBlocks.some((line) => line.trim()) ? fromBlocks : node.content.split('\n');
  const lines = source
    .map((line) => line.trim())
    .filter((line) => line && !EMBED_LINE.test(line))
    .map((line) => resolveLinks(line, nodes).replace(/\s+/g, ' ').trim())
    .filter((line) => line && line !== title.trim());
  return lines.slice(0, 4).join('\n');
}

const PREVIEW_HIDDEN = new Set(['dailyNote', 'tag', 'folder']);

export function dayPreviewNodes(nodes: NodeRecord[], dayKey: string, excludeIds: string[], limit = 12): NodeRecord[] {
  const excluded = new Set(excludeIds);
  const eligible = nodes.filter((item) => {
    if (item.deleted || excluded.has(item.id)) return false;
    if (!item.typeId || PREVIEW_HIDDEN.has(item.typeId)) return false;
    const title = displayTitle(nodes, item).trim();
    const fields = item.fieldValues[item.typeId] ?? {};
    const hasImage = item.typeId === 'image' && typeof fields.src === 'string' && fields.src.length > 0;
    const hasLink = item.typeId === 'weblink' && typeof fields.url === 'string' && fields.url.length > 0;
    if (!title && !hasImage && !hasLink && !previewSnippet(item, nodes, title)) return false;
    return true;
  });
  const onDay = (item: NodeRecord) => {
    if (item.createdAt.slice(0, 10) === dayKey) return 1;
    const bag = item.fieldValues[item.typeId ?? ''] ?? {};
    return Object.values(bag).some((value) => typeof value === 'string' && value.slice(0, 10) === dayKey) ? 1 : 0;
  };
  return eligible
    .sort((a, b) => onDay(b) - onDay(a) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export function resolveNodeTitle(nodes: NodeRecord[], nodeId: string): string {
  if (!nodeId) return '—';
  const node = nodes.find((n) => n.id === nodeId);
  return displayTitle(nodes, node) || nodeId.slice(0, 8);
}

export function getReferenceCandidates(
  nodes: NodeRecord[],
  referenceSupertag?: string,
): NodeRecord[] {
  if (!referenceSupertag) return nodes;
  return nodes.filter((n) => n.typeId === referenceSupertag || n.supertagIds.includes(referenceSupertag));
}
