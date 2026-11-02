export type FieldType = 'text' | 'date' | 'datetime' | 'select' | 'number' | 'checkbox' | 'reference' | 'content' | 'cover';

export interface FieldDef {
  key: string;
  type: FieldType;
  label?: string;
  required?: boolean;
  defaultValue?: string | number | boolean;
  options?: string[];
  referenceSupertag?: string;
  multiple?: boolean;
  bidirectionalKey?: string;
}

export interface SupertagDef {
  id: string;
  name: string;
  color: string;
  icon: string;
  fields: FieldDef[];
  description?: string;
}

export type DataView = 'list' | 'table' | 'cards' | 'kanban';

export type BlockType = 'paragraph' | 'heading' | 'bullet' | 'todo' | 'quote';

export type LinkView = 'glyph' | 'card' | 'wide';

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  level?: 1 | 2 | 3;
  /** Outline nesting. Heading size stays on `level`. */
  indent?: number;
  checked?: boolean;
  tagIds?: string[];
  /** How an embedded [[object]] is drawn. */
  linkView?: LinkView;
}

export interface MediaRecord {
  id: string;
  name: string;
  mimeType: string;
  bytes: ArrayBuffer;
  createdAt: string;
}

export interface ObjectTypeRecord extends SupertagDef {
  builtin: boolean;
  order: number;
  defaultView: DataView;
  updatedAt: string;
  deleted: boolean;
}

export interface CollectionRecord {
  id: string;
  name: string;
  typeId: string;
  objectIds: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

export interface TemplateRecord {
  id: string;
  typeId: string;
  name: string;
  title: string;
  fieldValues: Record<string, string | number | boolean>;
  blocks: Block[];
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

export interface NodeEmbed {
  id: string;
  title?: string;
  expression: QueryExpression;
}

export interface NodeRecord {
  id: string;
  workspaceId: string;
  parentId: string | null;
  content: string;
  title?: string;
  aliases?: string[];
  order: number;
  supertagIds: string[];
  legacySupertagIds?: string[];
  typeId?: string;
  tagIds?: string[];
  blocks?: Block[];
  reviewed?: boolean;
  fieldValues: Record<string, Record<string, string | number | boolean>>;
  embeds?: NodeEmbed[];
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  icon: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

export interface SavedQueryRecord {
  id: string;
  name: string;
  icon: string;
  expression: QueryExpression;
  order: number;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

export interface QueryExpression {
  supertagId?: string;
  filters: QueryFilter[];
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface QueryFilter {
  field: string;
  op: 'eq' | 'neq' | 'lt' | 'gt' | 'contains' | 'exists';
  value?: string | number | boolean;
}

export interface SyncChange {
  id: string;
  entityType: 'node' | 'workspace' | 'query' | 'supertag' | 'collection' | 'template';
  entityId: string;
  payload: string;
  updatedAt: string;
  deleted: boolean;
}

export type Theme = 'light' | 'dark' | 'system';
export type Language = 'cs' | 'en';

export interface AppSettings {
  theme: Theme;
  language: Language;
  syncEnabled: boolean;
  syncUrl: string;
  workspaceId: string;
  lastSyncAt: string | null;
  clientId: string;
  onboardingDone: boolean;
  /** Absolute folder in the desktop app. Empty in the browser, which keeps a folder handle. */
  vaultPath?: string | null;
  vaultLabel?: string | null;
  /** Stretch the reading column past the default 45rem. */
  wideLayout?: boolean;
}

export interface QuickCaptureInput {
  content: string;
  supertagId?: string;
  dueDate?: string;
  reminderTime?: string;
}
