import { v4 as uuidv4 } from 'uuid';
import { BUILTIN_SUPERTAGS, getDefaultFieldValues } from '../data/supertags';
import { db } from '../db/database';
import type {
  Block,
  CollectionRecord,
  FieldDef,
  NodeRecord,
  ObjectTypeRecord,
  SupertagDef,
  TemplateRecord,
} from '../types';
import { joinIds, mirrorContent, objectTitle, splitContent, splitIds } from '../utils/blocks';
import { weblinkTitle } from '../utils/weblink';
import { createNode, getAllNodes, updateNode, updateNodeField } from './dataService';
import { migrateStoredMedia } from './mediaStore';

const now = () => new Date().toISOString();

const TAG_TYPE: SupertagDef = {
  id: 'tag',
  name: 'Tag',
  color: '#a16207',
  icon: 'tag',
  description: 'Theme that connects objects across types',
  fields: [],
};

const IMAGE_TYPE: SupertagDef = {
  id: 'image',
  name: 'Image',
  color: '#0f766e',
  icon: 'image',
  description: 'Picture you can tag and write beside',
  fields: [
    { key: 'src', type: 'text', label: 'File' },
    { key: 'caption', type: 'text', label: 'Caption' },
  ],
};

const FILE_TYPE: SupertagDef = {
  id: 'file',
  name: 'File',
  color: '#57534e',
  icon: 'file-text',
  description: 'File kept as its own object',
  fields: [
    { key: 'src', type: 'text', label: 'File' },
    { key: 'fileName', type: 'text', label: 'File name' },
  ],
};

const WEBLINK_TYPE: SupertagDef = {
  id: 'weblink',
  name: 'Weblink',
  color: '#0369a1',
  icon: 'link',
  description: 'A page on the web, kept as its own object',
  fields: [
    { key: 'url', type: 'text' },
    { key: 'description', type: 'text' },
  ],
};

const EXTRA_TYPES = [TAG_TYPE, IMAGE_TYPE, FILE_TYPE, WEBLINK_TYPE];

async function enqueue(entityType: 'supertag' | 'collection' | 'template', entityId: string, payload: unknown, deleted = false) {
  const { loadSettings } = await import('../db/database');
  const settings = await loadSettings();
  if (!settings.syncEnabled) return;
  await db.syncQueue.put({
    id: uuidv4(),
    entityType,
    entityId,
    payload: JSON.stringify(payload),
    updatedAt: now(),
    deleted,
  });
}

function toTypeRecord(def: SupertagDef, order: number): ObjectTypeRecord {
  return {
    ...def,
    builtin: true,
    order,
    defaultView: 'list',
    updatedAt: now(),
    deleted: false,
  };
}

export async function getObjectTypes(): Promise<ObjectTypeRecord[]> {
  return db.objectTypes.filter((type) => !type.deleted).sortBy('order');
}

export async function getCollections(): Promise<CollectionRecord[]> {
  return db.collections.filter((collection) => !collection.deleted).sortBy('order');
}

export async function getTemplates(): Promise<TemplateRecord[]> {
  return db.templates.filter((template) => !template.deleted).toArray();
}

export async function ensureObjectModel(): Promise<void> {
  await seedObjectTypes();
  await migrateNodes();
  await migrateStoredMedia();
}

export async function createWeblinkObject(workspaceId: string, url: string): Promise<NodeRecord> {
  const trimmed = url.trim();
  const existing = (await getAllNodes(workspaceId)).find(
    (node) => node.typeId === 'weblink' && String(node.fieldValues.weblink?.url ?? '') === trimmed,
  );
  if (existing) return existing;
  const title = weblinkTitle(trimmed);
  return createNode({
    workspaceId,
    parentId: null,
    content: title,
    title,
    typeId: 'weblink',
    supertagIds: ['weblink'],
    fieldValues: { weblink: { url: trimmed } },
  });
}

async function seedObjectTypes(): Promise<void> {
  const existing = await db.objectTypes.toArray();
  const known = new Set(existing.map((type) => type.id));
  const defs = [...BUILTIN_SUPERTAGS, ...EXTRA_TYPES];
  const missing = defs
    .map((def, index) => ({ def, index }))
    .filter(({ def }) => !known.has(def.id))
    .map(({ def, index }) => toTypeRecord(def, index));
  if (missing.length) await db.objectTypes.bulkPut(missing);
}

async function migrateNodes(): Promise<void> {
  const nodes = await db.nodes.toArray();
  const types = await db.objectTypes.toArray();
  const typeName = (id: string) => types.find((type) => type.id === id)?.name ?? id;
  const pending: NodeRecord[] = [];
  const tagCache = nodes.filter((node) => node.typeId === 'tag' || node.supertagIds.includes('tag'));

  for (const node of nodes) {
    if (node.typeId) continue;
    const original = node.supertagIds ?? [];
    const typeId = original.find((id) => id !== 'folder') ?? (original.includes('folder') ? 'folder' : 'note');
    const extra = original.filter((id) => id !== typeId && id !== 'folder');
    const tagIds: string[] = [];
    for (const extraId of extra) {
      const name = typeName(extraId);
      let tag = tagCache.find((item) => objectTitle(item).toLowerCase() === name.toLowerCase());
      if (!tag) {
        tag = await createNode({
          workspaceId: node.workspaceId,
          parentId: null,
          content: name,
          typeId: 'tag',
          supertagIds: ['tag'],
          title: name,
        });
        tagCache.push(tag);
      }
      tagIds.push(tag.id);
    }
    const split = node.blocks?.length ? null : splitContent(node.content);
    pending.push({
      ...node,
      typeId,
      supertagIds: [typeId],
      legacySupertagIds: node.legacySupertagIds ?? original,
      tagIds: node.tagIds ?? tagIds,
      title: node.title ?? split?.title ?? objectTitle(node),
      blocks: node.blocks?.length ? node.blocks : split?.blocks ?? [],
      updatedAt: now(),
    });
  }
  if (pending.length) await db.nodes.bulkPut(pending);
}

export async function setObjectType(nodeId: string, typeId: string): Promise<NodeRecord | undefined> {
  const node = await db.nodes.get(nodeId);
  const type = await db.objectTypes.get(typeId);
  if (!node || !type || type.deleted) return node;
  const fieldValues = { ...node.fieldValues };
  if (!fieldValues[typeId]) fieldValues[typeId] = getDefaultFieldValues(type);
  return updateNode(nodeId, { typeId, supertagIds: [typeId], fieldValues });
}

export async function setObjectBody(nodeId: string, title: string, blocks: Block[]): Promise<NodeRecord | undefined> {
  return updateNode(nodeId, { title, blocks, content: mirrorContent(title, blocks) });
}

export async function createThemeTag(workspaceId: string, name: string): Promise<NodeRecord> {
  const trimmed = name.trim();
  const existing = (await getAllNodes(workspaceId)).find(
    (node) => node.typeId === 'tag' && objectTitle(node).toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) return existing;
  return createNode({
    workspaceId,
    parentId: null,
    content: trimmed,
    title: trimmed,
    typeId: 'tag',
    supertagIds: ['tag'],
  });
}

export async function addThemeTag(nodeId: string, tagNodeId: string): Promise<NodeRecord | undefined> {
  const node = await db.nodes.get(nodeId);
  if (!node) return undefined;
  const tagIds = node.tagIds ?? [];
  if (tagIds.includes(tagNodeId)) return node;
  return updateNode(nodeId, { tagIds: [...tagIds, tagNodeId] });
}

export async function removeThemeTag(nodeId: string, tagNodeId: string): Promise<NodeRecord | undefined> {
  const node = await db.nodes.get(nodeId);
  if (!node) return undefined;
  return updateNode(nodeId, { tagIds: (node.tagIds ?? []).filter((id) => id !== tagNodeId) });
}

export async function setObjectProperty(
  nodeId: string,
  typeId: string,
  key: string,
  value: string | number | boolean,
): Promise<NodeRecord | undefined> {
  const node = await db.nodes.get(nodeId);
  const type = await db.objectTypes.get(typeId);
  const field = type?.fields.find((item) => item.key === key);
  const previous = node?.fieldValues[typeId]?.[key];
  const updated = await updateNodeField(nodeId, typeId, key, value);
  if (updated && field?.type === 'reference' && field.bidirectionalKey && node) {
    await syncReverseLinks(node.id, field, previous, value);
  }
  return updated;
}

async function syncReverseLinks(
  sourceId: string,
  field: FieldDef,
  previous: string | number | boolean | undefined,
  next: string | number | boolean,
): Promise<void> {
  const reverseKey = field.bidirectionalKey;
  if (!reverseKey) return;
  const prevIds = splitIds(previous);
  const nextIds = splitIds(next);
  const removed = prevIds.filter((id) => !nextIds.includes(id));
  const added = nextIds.filter((id) => !prevIds.includes(id));
  for (const id of removed) await writeReverse(id, reverseKey, sourceId, false);
  for (const id of added) await writeReverse(id, reverseKey, sourceId, true);
}

async function writeReverse(targetId: string, fieldKey: string, sourceId: string, add: boolean): Promise<void> {
  const target = await db.nodes.get(targetId);
  if (!target?.typeId) return;
  const targetType = await db.objectTypes.get(target.typeId);
  const reverse = targetType?.fields.find((field) => field.key === fieldKey);
  const current = splitIds(target.fieldValues[target.typeId]?.[fieldKey]);
  const next = add
    ? reverse?.multiple === false
      ? [sourceId]
      : [...current, sourceId]
    : current.filter((id) => id !== sourceId);
  await updateNodeField(targetId, target.typeId, fieldKey, joinIds(next));
}

export async function saveObjectType(type: ObjectTypeRecord): Promise<void> {
  const saved = { ...type, updatedAt: now() };
  await db.objectTypes.put(saved);
  await enqueue('supertag', saved.id, saved, saved.deleted);
}

export async function createObjectType(name: string): Promise<ObjectTypeRecord> {
  const types = await getObjectTypes();
  const record: ObjectTypeRecord = {
    id: `type-${uuidv4().slice(0, 8)}`,
    name: name.trim() || 'Type',
    color: '#8a7560',
    icon: 'file-text',
    fields: [],
    builtin: false,
    order: types.length,
    defaultView: 'list',
    updatedAt: now(),
    deleted: false,
  };
  await saveObjectType(record);
  return record;
}

export async function saveCollection(collection: CollectionRecord): Promise<void> {
  const saved = { ...collection, updatedAt: now() };
  await db.collections.put(saved);
  await enqueue('collection', saved.id, saved, saved.deleted);
}

export async function createCollection(name: string, typeId: string): Promise<CollectionRecord> {
  const collections = await getCollections();
  const record: CollectionRecord = {
    id: uuidv4(),
    name: name.trim() || 'Collection',
    typeId,
    objectIds: [],
    order: collections.length,
    createdAt: now(),
    updatedAt: now(),
    deleted: false,
  };
  await saveCollection(record);
  return record;
}

export async function toggleCollectionItem(collectionId: string, objectId: string): Promise<void> {
  const collection = await db.collections.get(collectionId);
  if (!collection || collection.deleted) return;
  const has = collection.objectIds.includes(objectId);
  await saveCollection({
    ...collection,
    objectIds: has ? collection.objectIds.filter((id) => id !== objectId) : [...collection.objectIds, objectId],
  });
}

export async function saveTemplate(input: Omit<TemplateRecord, 'id' | 'createdAt' | 'updatedAt' | 'deleted'> & { id?: string }): Promise<TemplateRecord> {
  const existing = input.id ? await db.templates.get(input.id) : undefined;
  const record: TemplateRecord = {
    id: input.id ?? uuidv4(),
    typeId: input.typeId,
    name: input.name,
    title: input.title,
    fieldValues: input.fieldValues,
    blocks: input.blocks,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
    deleted: false,
  };
  await db.templates.put(record);
  await enqueue('template', record.id, record);
  return record;
}

export async function templateForType(typeId: string): Promise<TemplateRecord | undefined> {
  const templates = await db.templates.filter((template) => !template.deleted && template.typeId === typeId).toArray();
  return templates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export async function ensureDailyNote(workspaceId: string, date: string): Promise<NodeRecord> {
  const nodes = await getAllNodes(workspaceId);
  const found = nodes.find(
    (node) =>
      (node.typeId === 'dailyNote' || node.supertagIds.includes('dailyNote')) &&
      node.fieldValues.dailyNote?.date === date,
  );
  if (found) return found;
  return createNode({
    workspaceId,
    parentId: null,
    content: date,
    title: date,
    typeId: 'dailyNote',
    supertagIds: ['dailyNote'],
    fieldValues: { dailyNote: { date } },
  });
}

export function slugifyKey(label: string, taken: string[]): string {
  const base =
    label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 24) || 'field';
  let key = base;
  let n = 2;
  while (taken.includes(key)) {
    key = `${base}${n}`;
    n += 1;
  }
  return key;
}

export function exportSpace(data: {
  nodes: NodeRecord[];
  objectTypes: ObjectTypeRecord[];
  collections: CollectionRecord[];
  templates: TemplateRecord[];
}): string {
  return JSON.stringify(data, null, 2);
}

export function objectToMarkdown(node: NodeRecord, typeName: string, tagNames: string[]): string {
  const lines = [
    '---',
    `type: ${typeName}`,
    tagNames.length ? `tags: ${tagNames.join(', ')}` : '',
    '---',
    '',
    `# ${objectTitle(node) || 'Untitled'}`,
    '',
  ].filter((line, index, all) => line !== '' || all[index - 1] !== '');
  const fields = node.typeId ? node.fieldValues[node.typeId] ?? {} : {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'src' || value === '' || value === false) continue;
    lines.push(`- ${key}: ${String(value)}`);
  }
  if (Object.keys(fields).length) lines.push('');
  lines.push(mirrorContent('', node.blocks ?? []).trim());
  return lines.join('\n').trim() + '\n';
}
