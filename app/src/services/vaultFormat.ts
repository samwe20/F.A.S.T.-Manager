import type {
  CollectionRecord,
  NodeRecord,
  ObjectTypeRecord,
  SavedQueryRecord,
  TemplateRecord,
  WorkspaceRecord,
} from '../types';
import { mirrorContent } from '../utils/blocks';

export interface VaultMedia {
  id: string;
  name: string;
  mimeType: string;
  createdAt: string;
  bytes: Uint8Array;
}

export interface VaultSnapshot {
  version: 1;
  nodes: NodeRecord[];
  workspaces: WorkspaceRecord[];
  queries: SavedQueryRecord[];
  objectTypes: ObjectTypeRecord[];
  collections: CollectionRecord[];
  templates: TemplateRecord[];
  media: VaultMedia[];
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function assertVaultId(id: string): void {
  if (!SAFE_ID.test(id)) throw new Error(`unsafe vault id ${id}`);
}

export function nodeToFile(node: NodeRecord): string {
  assertVaultId(node.id);
  const body = mirrorContent('', node.blocks ?? []).trim();
  return `---\n${JSON.stringify(node, null, 2)}\n---\n\n${body}\n`;
}

export function fileToNode(text: string): NodeRecord {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) throw new Error('vault object is missing its header');
  const node = JSON.parse(match[1]) as NodeRecord;
  if (!node || typeof node.id !== 'string') throw new Error('vault object is missing an id');
  assertVaultId(node.id);
  return node;
}
