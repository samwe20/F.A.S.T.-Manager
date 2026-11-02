import { nextDueDate } from '../utils/contentUtils';
import { localToday } from '../utils/dateUtils';
import { mirrorContent, splitContent } from '../utils/blocks';
import { v4 as uuidv4 } from 'uuid';
import { BUILTIN_SUPERTAGS, getDefaultFieldValues } from '../data/supertags';
import { db, loadSettings, saveSettings } from '../db/database';
import type {
  AppSettings,
  Block,
  NodeEmbed,
  NodeRecord,
  QueryExpression,
  SavedQueryRecord,
  SupertagDef,
  SyncChange,
  WorkspaceRecord,
} from '../types';

const now = () => new Date().toISOString();

async function enqueueSync(change: Omit<SyncChange, 'id'>): Promise<void> {
  const settings = await loadSettings();
  if (!settings.syncEnabled) return;
  await db.syncQueue.put({ id: uuidv4(), ...change });
}

export async function seedIfEmpty(): Promise<void> {
  const seeded = await db.transaction('rw', db.workspaces, db.nodes, db.queries, async () => {
  const count = await db.workspaces.count();
  if (count > 0) return null;

  const wsId = 'default';
  const today = new Date().toISOString().slice(0, 10);
  const ts = now();

  const workspace: WorkspaceRecord = {
    id: wsId,
    name: 'Main',
    icon: 'inbox',
    order: 0,
    createdAt: ts,
    updatedAt: ts,
    deleted: false,
  };

  const nodes: NodeRecord[] = [
    {
      id: uuidv4(),
      workspaceId: wsId,
      parentId: null,
      content: 'Welcome to F.A.S.T Manager',
      order: 0,
      supertagIds: ['inform'],
      fieldValues: {
        inform: {
          category: 'Getting started',
          source: 'FAST',
          importance: 'high',
          verified: true,
        },
      },
      createdAt: ts,
      updatedAt: ts,
      deleted: false,
    },
    {
      id: uuidv4(),
      workspaceId: wsId,
      parentId: null,
      content: `Daily note ${today}`,
      order: 1,
      supertagIds: ['dailyNote'],
      fieldValues: { dailyNote: { date: today } },
      createdAt: ts,
      updatedAt: ts,
      deleted: false,
    },
    {
      id: uuidv4(),
      workspaceId: wsId,
      parentId: null,
      content: 'Explore supertags: type # and pick Task, Question, or Inform',
      order: 2,
      supertagIds: ['task'],
      fieldValues: {
        task: {
          dueDate: today,
          priority: 'medium',
          status: 'new',
          assignee: '',
          project: '',
        },
      },
      createdAt: ts,
      updatedAt: ts,
      deleted: false,
    },
  ];

  const queries: SavedQueryRecord[] = [
    {
      id: 'q-tasks',
      name: 'My Tasks',
      icon: 'check-square',
      expression: {
        supertagId: 'task',
        filters: [{ field: 'status', op: 'neq', value: 'done' }],
        sortBy: 'dueDate',
        sortDir: 'asc',
      },
      order: 0,
      createdAt: ts,
      updatedAt: ts,
      deleted: false,
    },
    {
      id: 'q-questions',
      name: 'Open Questions',
      icon: 'help-circle',
      expression: {
        supertagId: 'question',
        filters: [{ field: 'status', op: 'neq', value: 'answered' }],
        sortBy: 'dueDate',
        sortDir: 'asc',
      },
      order: 1,
      createdAt: ts,
      updatedAt: ts,
      deleted: false,
    },
    {
      id: 'q-overdue',
      name: 'Overdue',
      icon: 'alert-circle',
      expression: {
        supertagId: 'task',
        filters: [
          { field: 'status', op: 'neq', value: 'done' },
          { field: 'dueDate', op: 'lt', value: today },
        ],
        sortBy: 'dueDate',
        sortDir: 'asc',
      },
      order: 2,
      createdAt: ts,
      updatedAt: ts,
      deleted: false,
    },
  ];

    await db.workspaces.put(workspace);
    await db.nodes.bulkPut(nodes);
    await db.queries.bulkPut(queries);
    return { workspace, nodes, queries };
  });

  if (!seeded) return;
  const { workspace, nodes, queries } = seeded;

  for (const node of nodes) {
    await enqueueSync({
      entityType: 'node',
      entityId: node.id,
      payload: JSON.stringify(node),
      updatedAt: node.updatedAt,
      deleted: false,
    });
  }
  await enqueueSync({
    entityType: 'workspace',
    entityId: workspace.id,
    payload: JSON.stringify(workspace),
    updatedAt: workspace.updatedAt,
    deleted: false,
  });
  for (const q of queries) {
    await enqueueSync({
      entityType: 'query',
      entityId: q.id,
      payload: JSON.stringify(q),
      updatedAt: q.updatedAt,
      deleted: false,
    });
  }
}

export async function getAllNodes(workspaceId: string): Promise<NodeRecord[]> {
  return db.nodes
    .where('workspaceId')
    .equals(workspaceId)
    .filter((n) => !n.deleted)
    .sortBy('order');
}

async function findTypeDef(typeId: string): Promise<SupertagDef | undefined> {
  const stored = await db.objectTypes.get(typeId);
  if (stored && !stored.deleted) return stored;
  return BUILTIN_SUPERTAGS.find((tag) => tag.id === typeId);
}

export async function createNode(input: {
  workspaceId: string;
  parentId: string | null;
  content: string;
  supertagIds?: string[];
  fieldValues?: NodeRecord['fieldValues'];
  order?: number;
  typeId?: string;
  title?: string;
  blocks?: Block[];
  tagIds?: string[];
  aliases?: string[];
}): Promise<NodeRecord> {
  const ts = now();
  const typeId = input.typeId ?? input.supertagIds?.[0];
  const supertagIds = input.supertagIds ?? (typeId ? [typeId] : []);
  const fieldValues: NodeRecord['fieldValues'] = input.fieldValues ? { ...input.fieldValues } : {};
  for (const tagId of supertagIds) {
    if (!fieldValues[tagId]) {
      const tag = await findTypeDef(tagId);
      if (tag) fieldValues[tagId] = getDefaultFieldValues(tag);
    }
  }

  const split = input.title === undefined && input.blocks === undefined ? splitContent(input.content) : null;
  const title = input.title ?? split?.title ?? input.content.trim();
  const blocks = input.blocks ?? split?.blocks ?? [];
  const content = input.blocks || input.title !== undefined ? mirrorContent(title, blocks) : input.content;

  const siblings = (await getAllNodes(input.workspaceId)).filter(
    (n) => n.parentId === input.parentId,
  );

  const node: NodeRecord = {
    id: uuidv4(),
    workspaceId: input.workspaceId,
    parentId: input.parentId,
    content: content || title,
    title,
    blocks,
    aliases: input.aliases ?? [],
    tagIds: input.tagIds ?? [],
    typeId,
    order: input.order ?? siblings.length,
    supertagIds,
    fieldValues,
    embeds: [],
    createdAt: ts,
    updatedAt: ts,
    deleted: false,
  };

  await db.nodes.put(node);
  await enqueueSync({
    entityType: 'node',
    entityId: node.id,
    payload: JSON.stringify(node),
    updatedAt: node.updatedAt,
    deleted: false,
  });
  return node;
}

export async function updateNode(
  id: string,
  patch: Partial<
    Pick<
      NodeRecord,
      | 'content'
      | 'parentId'
      | 'order'
      | 'supertagIds'
      | 'fieldValues'
      | 'embeds'
      | 'typeId'
      | 'title'
      | 'aliases'
      | 'tagIds'
      | 'blocks'
      | 'reviewed'
      | 'legacySupertagIds'
    >
  >,
): Promise<NodeRecord | undefined> {
  const node = await db.nodes.get(id);
  if (!node || node.deleted) return undefined;

  const updated: NodeRecord = {
    ...node,
    ...patch,
    fieldValues: patch.fieldValues ? { ...node.fieldValues, ...patch.fieldValues } : node.fieldValues,
    updatedAt: now(),
  };

  const typeIds = [...(patch.supertagIds ?? []), ...(patch.typeId ? [patch.typeId] : [])];
  for (const tagId of typeIds) {
    if (!updated.fieldValues[tagId]) {
      const tag = await findTypeDef(tagId);
      if (tag) updated.fieldValues[tagId] = getDefaultFieldValues(tag);
    }
  }

  await db.nodes.put(updated);
  await enqueueSync({
    entityType: 'node',
    entityId: updated.id,
    payload: JSON.stringify(updated),
    updatedAt: updated.updatedAt,
    deleted: false,
  });
  return updated;
}

export async function deleteNode(id: string): Promise<void> {
  const node = await db.nodes.get(id);
  if (!node) return;
  const updated = { ...node, deleted: true, updatedAt: now() };
  await db.nodes.put(updated);
  await enqueueSync({
    entityType: 'node',
    entityId: id,
    payload: JSON.stringify(updated),
    updatedAt: updated.updatedAt,
    deleted: true,
  });
}

export async function addSupertagToNode(nodeId: string, tagId: string): Promise<NodeRecord | undefined> {
  const node = await db.nodes.get(nodeId);
  if (!node || node.supertagIds.includes(tagId)) return node;
  const tag = await findTypeDef(tagId);
  if (!tag) return node;
  return updateNode(nodeId, {
    supertagIds: [...node.supertagIds, tagId],
    fieldValues: { [tagId]: getDefaultFieldValues(tag) },
  });
}

export async function removeSupertagFromNode(nodeId: string, tagId: string): Promise<NodeRecord | undefined> {
  const node = await db.nodes.get(nodeId);
  if (!node) return undefined;
  const fieldValues = { ...node.fieldValues };
  delete fieldValues[tagId];
  return updateNode(nodeId, {
    supertagIds: node.supertagIds.filter((id) => id !== tagId),
    fieldValues,
  });
}

export async function updateNodeField(
  nodeId: string,
  tagId: string,
  fieldKey: string,
  value: string | number | boolean,
): Promise<NodeRecord | undefined> {
  const node = await db.nodes.get(nodeId);
  if (!node) return undefined;
  const tagFields = { ...(node.fieldValues[tagId] ?? {}), [fieldKey]: value };
  let updated = await updateNode(nodeId, { fieldValues: { [tagId]: tagFields } });

  if (
    updated &&
    tagId === 'task' &&
    fieldKey === 'status' &&
    value === 'done'
  ) {
    updated = await spawnRecurringTask(updated);
  }

  return updated;
}

async function spawnRecurringTask(node: NodeRecord): Promise<NodeRecord> {
  const taskFields = node.fieldValues.task ?? {};
  const recurrence = String(taskFields.recurrence ?? 'none');
  if (recurrence === 'none' || !recurrence) return node;

  const nextDate = nextDueDate(String(taskFields.dueDate ?? ''), recurrence);
  if (!nextDate) return node;

  await createNode({
    workspaceId: node.workspaceId,
    parentId: node.parentId,
    content: node.title || node.content,
    title: node.title,
    blocks: node.blocks,
    supertagIds: ['task'],
    typeId: 'task',
    fieldValues: {
      task: {
        ...taskFields,
        dueDate: nextDate,
        status: 'new',
        recurrence,
      },
    },
  });

  return node;
}

export async function moveNode(
  nodeId: string,
  newParentId: string | null,
  newOrder: number,
): Promise<void> {
  const node = await db.nodes.get(nodeId);
  if (!node) return;

  const siblings = (await getAllNodes(node.workspaceId))
    .filter((n) => n.parentId === newParentId && n.id !== nodeId)
    .sort((a, b) => a.order - b.order);

  siblings.splice(newOrder, 0, { ...node, parentId: newParentId, order: newOrder });

  for (let i = 0; i < siblings.length; i++) {
    await updateNode(siblings[i].id, { parentId: newParentId, order: i });
  }
}

export async function restoreNodesSnapshot(nodes: NodeRecord[]): Promise<void> {
  const workspaceIds = [...new Set(nodes.map((n) => n.workspaceId))];
  for (const wsId of workspaceIds) {
    const existing = await db.nodes.where('workspaceId').equals(wsId).toArray();
    for (const n of existing) {
      await db.nodes.delete(n.id);
    }
  }
  await db.nodes.bulkPut(nodes);
  for (const node of nodes) {
    await enqueueSync({
      entityType: 'node',
      entityId: node.id,
      payload: JSON.stringify(node),
      updatedAt: node.updatedAt,
      deleted: node.deleted,
    });
  }
}

export async function completeTask(nodeId: string): Promise<NodeRecord | undefined> {
  return updateNodeField(nodeId, 'task', 'status', 'done');
}

export async function addNodeEmbed(
  nodeId: string,
  expression: QueryExpression,
  title?: string,
): Promise<NodeRecord | undefined> {
  const node = await db.nodes.get(nodeId);
  if (!node || node.deleted) return undefined;
  const embed: NodeEmbed = {
    id: uuidv4(),
    title: title ?? '',
    expression,
  };
  return updateNode(nodeId, { embeds: [...(node.embeds ?? []), embed] });
}

export async function removeNodeEmbed(nodeId: string, embedId: string): Promise<NodeRecord | undefined> {
  const node = await db.nodes.get(nodeId);
  if (!node) return undefined;
  return updateNode(nodeId, { embeds: (node.embeds ?? []).filter((e) => e.id !== embedId) });
}

export async function updateNodeEmbed(
  nodeId: string,
  embedId: string,
  patch: Partial<Pick<NodeEmbed, 'title' | 'expression'>>,
): Promise<NodeRecord | undefined> {
  const node = await db.nodes.get(nodeId);
  if (!node) return undefined;
  const embeds = (node.embeds ?? []).map((e) => (e.id === embedId ? { ...e, ...patch } : e));
  return updateNode(nodeId, { embeds });
}

export async function getWorkspaces(): Promise<WorkspaceRecord[]> {
  return db.workspaces.filter((w) => !w.deleted).sortBy('order');
}

export async function getQueries(): Promise<SavedQueryRecord[]> {
  return db.queries.filter((q) => !q.deleted).sortBy('order');
}

export function evaluateQuery(nodes: NodeRecord[], expression: QueryExpression): NodeRecord[] {
  const today = localToday();
  let result = nodes.filter((n) => {
    const typeId = n.typeId ?? n.supertagIds[0];
    if (
      expression.supertagId &&
      typeId !== expression.supertagId &&
      !n.supertagIds.includes(expression.supertagId)
    ) {
      return false;
    }
    const fieldBagId = expression.supertagId && n.fieldValues[expression.supertagId] ? expression.supertagId : typeId;
    const fields = fieldBagId ? n.fieldValues[fieldBagId] ?? {} : {};
    return expression.filters.every((f) => {
      const val = fields[f.field];
      switch (f.op) {
        case 'eq':
          return val === f.value;
        case 'neq':
          return val !== f.value;
        case 'lt':
          return typeof val === 'string' && val < String(f.value);
        case 'gt':
          return typeof val === 'string' && val > String(f.value);
        case 'contains':
          return String(val).toLowerCase().includes(String(f.value).toLowerCase());
        case 'exists':
          return val !== undefined && val !== '' && val !== false;
        default:
          return true;
      }
    });
  });

  if (expression.sortBy && expression.supertagId) {
    const key = expression.sortBy;
    const dir = expression.sortDir === 'desc' ? -1 : 1;
    result = [...result].sort((a, b) => {
      const av = String(a.fieldValues[expression.supertagId!]?.[key] ?? '');
      const bv = String(b.fieldValues[expression.supertagId!]?.[key] ?? '');
      if (key === 'dueDate' && !av && bv) return 1;
      if (key === 'dueDate' && av && !bv) return -1;
      return av.localeCompare(bv) * dir;
    });
  }

  if (expression.filters.some((f) => f.field === 'dueDate' && f.op === 'lt' && f.value === today)) {
    result = result.filter((n) => {
      const d = n.fieldValues.task?.dueDate;
      return typeof d === 'string' && d !== '' && d < today;
    });
  }

  return result;
}

export async function applyRemoteChange(change: SyncChange): Promise<void> {
  const payload = JSON.parse(change.payload);
  switch (change.entityType) {
    case 'node':
      await db.nodes.put(payload);
      break;
    case 'workspace':
      await db.workspaces.put(payload);
      break;
    case 'query':
      await db.queries.put(payload);
      break;
    case 'supertag':
      await db.objectTypes.put(payload);
      break;
    case 'collection':
      await db.collections.put(payload);
      break;
    case 'template':
      await db.templates.put(payload);
      break;
  }
}

export async function saveQuery(input: {
  id?: string;
  name: string;
  expression: QueryExpression;
  icon?: string;
}): Promise<SavedQueryRecord> {
  const existing = input.id ? await db.queries.get(input.id) : undefined;
  const ts = now();
  const queries = await getQueries();
  const record: SavedQueryRecord = {
    id: input.id ?? uuidv4(),
    name: input.name.trim() || 'Query',
    icon: input.icon ?? existing?.icon ?? 'search',
    expression: input.expression,
    order: existing?.order ?? queries.length,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
    deleted: false,
  };
  await db.queries.put(record);
  await enqueueSync({
    entityType: 'query',
    entityId: record.id,
    payload: JSON.stringify(record),
    updatedAt: record.updatedAt,
    deleted: false,
  });
  return record;
}

export { loadSettings, saveSettings };
export type { AppSettings };
