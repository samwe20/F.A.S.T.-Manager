import { loadSettings, saveSettings } from './dataService';
import type { VaultDir } from './vaultDir';

interface DirHandle {
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
  removeEntry(name: string): Promise<void>;
  entries(): AsyncIterable<[string, { kind: string }]>;
  queryPermission(options: { mode: 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
}

interface FileHandleLike {
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: BufferSource | string): Promise<void>; close(): Promise<void> }>;
}

export class VaultUnsupportedError extends Error {
  constructor() {
    super('vault-unsupported');
  }
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function joinPath(root: string, rel: string): string {
  const sep = root.includes('\\') ? '\\' : '/';
  return `${root.replace(/[\\/]+$/, '')}${sep}${rel.split('/').join(sep)}`;
}

async function parentDir(path: string): Promise<string> {
  return path.replace(/[\\/][^\\/]+$/, '');
}

function tauriDir(root: string): VaultDir {
  return {
    kind: 'tauri',
    label: basename(root),
    path: root,
    async writeText(path, text) {
      const fs = await import('@tauri-apps/plugin-fs');
      const full = joinPath(root, path);
      await fs.mkdir(await parentDir(full), { recursive: true });
      await fs.writeTextFile(full, text);
    },
    async writeBytes(path, bytes) {
      const fs = await import('@tauri-apps/plugin-fs');
      const full = joinPath(root, path);
      await fs.mkdir(await parentDir(full), { recursive: true });
      await fs.writeFile(full, bytes);
    },
    async readText(path) {
      const fs = await import('@tauri-apps/plugin-fs');
      const full = joinPath(root, path);
      if (!(await fs.exists(full))) return null;
      return fs.readTextFile(full);
    },
    async readBytes(path) {
      const fs = await import('@tauri-apps/plugin-fs');
      const full = joinPath(root, path);
      if (!(await fs.exists(full))) return null;
      return fs.readFile(full);
    },
    async list(path) {
      const fs = await import('@tauri-apps/plugin-fs');
      const full = joinPath(root, path);
      if (!(await fs.exists(full))) return [];
      const entries = await fs.readDir(full);
      return entries.map((entry) => entry.name).filter((name): name is string => Boolean(name));
    },
    async remove(path) {
      const fs = await import('@tauri-apps/plugin-fs');
      const full = joinPath(root, path);
      if (await fs.exists(full)) await fs.remove(full);
    },
    async exists(path) {
      const fs = await import('@tauri-apps/plugin-fs');
      return fs.exists(joinPath(root, path));
    },
  };
}

async function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('fast-manager-vault', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('kv')) request.result.createObjectStore('kv');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveHandle(handle: DirHandle): Promise<void> {
  const database = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction('kv', 'readwrite').objectStore('kv').put(handle, 'dir');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  database.close();
}

async function loadHandle(): Promise<DirHandle | null> {
  const database = await openHandleDb();
  const handle = await new Promise<DirHandle | null>((resolve, reject) => {
    const request = database.transaction('kv').objectStore('kv').get('dir');
    request.onsuccess = () => resolve((request.result as DirHandle | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return handle;
}

async function clearHandle(): Promise<void> {
  const database = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction('kv', 'readwrite').objectStore('kv').delete('dir');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  database.close();
}

async function walkDir(root: DirHandle, path: string, create: boolean): Promise<DirHandle> {
  let dir = root;
  for (const part of path.split('/').filter(Boolean)) {
    dir = await dir.getDirectoryHandle(part, { create });
  }
  return dir;
}

interface BrowserVaultDir extends VaultDir {
  kind: 'browser';
  handle: DirHandle;
}

function browserDir(handle: DirHandle): BrowserVaultDir {
  return {
    kind: 'browser',
    handle,
    label: handle.name,
    path: null,
    async writeText(path, text) {
      const parts = path.split('/');
      const name = parts.pop() ?? path;
      const dir = await walkDir(handle, parts.join('/'), true);
      const file = await dir.getFileHandle(name, { create: true });
      const writable = await file.createWritable();
      await writable.write(text);
      await writable.close();
    },
    async writeBytes(path, bytes) {
      const parts = path.split('/');
      const name = parts.pop() ?? path;
      const dir = await walkDir(handle, parts.join('/'), true);
      const file = await dir.getFileHandle(name, { create: true });
      const writable = await file.createWritable();
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      await writable.write(copy);
      await writable.close();
    },
    async readText(path) {
      const bytes = await this.readBytes(path);
      return bytes ? new TextDecoder().decode(bytes) : null;
    },
    async readBytes(path) {
      try {
        const parts = path.split('/');
        const name = parts.pop() ?? path;
        const dir = await walkDir(handle, parts.join('/'), false);
        const file = await dir.getFileHandle(name);
        const blob = await file.getFile();
        return new Uint8Array(await blob.arrayBuffer());
      } catch {
        return null;
      }
    },
    async list(path) {
      try {
        const dir = await walkDir(handle, path, false);
        const names: string[] = [];
        for await (const [name, entry] of dir.entries()) {
          if (entry.kind === 'file') names.push(name);
        }
        return names;
      } catch {
        return [];
      }
    },
    async remove(path) {
      const parts = path.split('/');
      const name = parts.pop() ?? path;
      const dir = await walkDir(handle, parts.join('/'), false);
      await dir.removeEntry(name);
    },
    async exists(path) {
      const text = await this.readBytes(path);
      if (text) return true;
      const names = await this.list(path);
      return names.length > 0;
    },
  };
}

function picker(): ((options: { mode: 'readwrite' }) => Promise<DirHandle>) | null {
  const candidate = window as Window & { showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<DirHandle> };
  return typeof candidate.showDirectoryPicker === 'function' ? candidate.showDirectoryPicker.bind(candidate) : null;
}

export async function pickDirectory(title: string): Promise<VaultDir | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true, multiple: false, title });
    if (typeof selected !== 'string' || !selected) return null;
    return tauriDir(selected);
  }
  const show = picker();
  if (!show) throw new VaultUnsupportedError();
  const handle = await show({ mode: 'readwrite' });
  return browserDir(handle);
}

export async function persistLink(dir: VaultDir): Promise<{ vaultPath: string | null; vaultLabel: string }> {
  if (dir.kind === 'browser') await saveHandle((dir as BrowserVaultDir).handle);
  const settings = await loadSettings();
  const next = { ...settings, vaultPath: dir.path, vaultLabel: dir.label };
  await saveSettings(next);
  return { vaultPath: dir.path, vaultLabel: dir.label };
}

export async function linkedDirectory(): Promise<VaultDir | null> {
  const settings = await loadSettings();
  if (isTauri()) {
    if (!settings.vaultPath) return null;
    return tauriDir(settings.vaultPath);
  }
  const handle = await loadHandle();
  if (!handle) return null;
  const perm = await handle.queryPermission({ mode: 'readwrite' });
  if (perm !== 'granted') return null;
  return browserDir(handle);
}

export async function clearLink(): Promise<void> {
  await clearHandle();
  const settings = await loadSettings();
  await saveSettings({ ...settings, vaultPath: null, vaultLabel: null });
}
