import type { VaultDir } from './vaultDir';
import { assertVaultId, fileToNode, nodeToFile, type VaultMedia, type VaultSnapshot } from './vaultFormat';

interface VaultManifest {
  version: 1;
  workspaces: VaultSnapshot['workspaces'];
  queries: VaultSnapshot['queries'];
  objectTypes: VaultSnapshot['objectTypes'];
  collections: VaultSnapshot['collections'];
  templates: VaultSnapshot['templates'];
}

export async function writeSnapshot(dir: VaultDir, snapshot: VaultSnapshot): Promise<void> {
  const manifest: VaultManifest = {
    version: 1,
    workspaces: snapshot.workspaces,
    queries: snapshot.queries,
    objectTypes: snapshot.objectTypes,
    collections: snapshot.collections,
    templates: snapshot.templates,
  };
  await dir.writeText('vault.json', `${JSON.stringify(manifest, null, 2)}\n`);

  const nodeNames = new Set<string>();
  for (const node of snapshot.nodes) {
    const name = `${node.id}.md`;
    nodeNames.add(name);
    await dir.writeText(`objects/${name}`, nodeToFile(node));
  }
  for (const name of await dir.list('objects')) {
    if (!nodeNames.has(name)) await dir.remove(`objects/${name}`);
  }

  const mediaMeta = snapshot.media.map(({ id, name, mimeType, createdAt }) => ({ id, name, mimeType, createdAt }));
  await dir.writeText('media.json', `${JSON.stringify(mediaMeta, null, 2)}\n`);
  const mediaNames = new Set<string>();
  for (const item of snapshot.media) {
    assertVaultId(item.id);
    mediaNames.add(item.id);
    await dir.writeBytes(`media/${item.id}`, item.bytes);
  }
  for (const name of await dir.list('media')) {
    if (!mediaNames.has(name)) await dir.remove(`media/${name}`);
  }
}

export async function readSnapshot(dir: VaultDir): Promise<VaultSnapshot> {
  const raw = await dir.readText('vault.json');
  if (!raw) throw new Error('missing vault.json');
  const manifest = JSON.parse(raw) as VaultManifest;
  if (manifest.version !== 1) throw new Error('unsupported vault');

  const nodes = [];
  for (const name of await dir.list('objects')) {
    if (!name.endsWith('.md')) continue;
    const text = await dir.readText(`objects/${name}`);
    if (!text) continue;
    const node = fileToNode(text);
    if (`${node.id}.md` !== name) throw new Error(`vault id mismatch in ${name}`);
    nodes.push(node);
  }

  const mediaRaw = await dir.readText('media.json');
  const meta = (mediaRaw ? JSON.parse(mediaRaw) : []) as Array<Omit<VaultMedia, 'bytes'>>;
  const media: VaultMedia[] = [];
  for (const item of meta) {
    assertVaultId(item.id);
    const bytes = await dir.readBytes(`media/${item.id}`);
    if (!bytes) throw new Error(`missing media ${item.id}`);
    media.push({ ...item, bytes });
  }

  return {
    version: 1,
    workspaces: manifest.workspaces ?? [],
    queries: manifest.queries ?? [],
    objectTypes: manifest.objectTypes ?? [],
    collections: manifest.collections ?? [],
    templates: manifest.templates ?? [],
    nodes,
    media,
  };
}
