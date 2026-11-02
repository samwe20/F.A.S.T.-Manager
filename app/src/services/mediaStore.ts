import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import type { MediaRecord, NodeRecord } from '../types';
import { blobRef, bytesToArrayBuffer, isDataUrl, parseBlobRef, parseDataUrl } from '../utils/media';

const now = () => new Date().toISOString();

export async function saveMediaBytes(name: string, mimeType: string, bytes: ArrayBuffer): Promise<string> {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : uuidv4();
  const record: MediaRecord = {
    id,
    name,
    mimeType: mimeType || 'application/octet-stream',
    bytes,
    createdAt: now(),
  };
  await db.media.put(record);
  return id;
}

export async function saveMediaFile(file: File): Promise<string> {
  return saveMediaBytes(file.name || 'file', file.type || 'application/octet-stream', await file.arrayBuffer());
}

export async function readMedia(id: string): Promise<MediaRecord | undefined> {
  return db.media.get(id);
}

export function mediaObjectUrl(record: MediaRecord): string {
  return URL.createObjectURL(new Blob([record.bytes], { type: record.mimeType || 'application/octet-stream' }));
}

export async function rewriteNodeMedia(node: NodeRecord): Promise<NodeRecord> {
  let changed = false;
  const fieldValues: NodeRecord['fieldValues'] = {};
  for (const [typeId, bag] of Object.entries(node.fieldValues)) {
    const nextBag = { ...bag };
    for (const [key, value] of Object.entries(bag)) {
      if (!isDataUrl(value)) continue;
      const parsed = parseDataUrl(value);
      if (!parsed) continue;
      const fileName = typeof bag.fileName === 'string' && bag.fileName ? bag.fileName : 'file';
      const id = await saveMediaBytes(fileName, parsed.mimeType, bytesToArrayBuffer(parsed.bytes));
      nextBag[key] = blobRef(id);
      changed = true;
    }
    fieldValues[typeId] = nextBag;
  }
  if (!changed) return node;
  return { ...node, fieldValues, updatedAt: now() };
}

export async function migrateStoredMedia(): Promise<number> {
  const nodes = await db.nodes.toArray();
  let count = 0;
  for (const node of nodes) {
    const next = await rewriteNodeMedia(node);
    if (next === node) continue;
    await db.nodes.put(next);
    count += 1;
  }
  return count;
}

export { parseBlobRef };
