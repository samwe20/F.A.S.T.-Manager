import type { NodeRecord } from '../types';

export function isFolderNode(node: NodeRecord): boolean {
  return node.typeId === 'folder' || node.supertagIds.includes('folder');
}

export function getFolderNodes(nodes: NodeRecord[], parentId: string | null = null): NodeRecord[] {
  return nodes
    .filter((n) => isFolderNode(n) && n.parentId === parentId)
    .sort((a, b) => a.order - b.order);
}

export function getFolderDocuments(nodes: NodeRecord[], folderId: string): NodeRecord[] {
  return nodes.filter((n) => n.parentId === folderId).sort((a, b) => a.order - b.order);
}

export function resolveFolderTitle(nodes: NodeRecord[], folderId: string): string {
  const folder = nodes.find((n) => n.id === folderId);
  if (!folder) return '—';
  return (folder.title || folder.content).trim() || '—';
}
