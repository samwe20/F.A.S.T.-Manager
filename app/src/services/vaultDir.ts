export interface VaultDir {
  kind: 'memory' | 'tauri' | 'browser';
  label: string;
  path: string | null;
  writeText(path: string, text: string): Promise<void>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  readText(path: string): Promise<string | null>;
  readBytes(path: string): Promise<Uint8Array | null>;
  list(path: string): Promise<string[]>;
  remove(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class MemoryVaultDir implements VaultDir {
  readonly kind = 'memory' as const;
  readonly path = null;
  readonly label: string;
  private files = new Map<string, Uint8Array>();

  constructor(label = 'memory') {
    this.label = label;
  }

  writeText(path: string, text: string): Promise<void> {
    this.files.set(path, encoder.encode(text));
    return Promise.resolve();
  }

  writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    this.files.set(path, new Uint8Array(bytes));
    return Promise.resolve();
  }

  readText(path: string): Promise<string | null> {
    const bytes = this.files.get(path);
    return Promise.resolve(bytes ? decoder.decode(bytes) : null);
  }

  readBytes(path: string): Promise<Uint8Array | null> {
    const bytes = this.files.get(path);
    return Promise.resolve(bytes ? new Uint8Array(bytes) : null);
  }

  list(path: string): Promise<string[]> {
    const prefix = path ? `${path}/` : '';
    const names = new Set<string>();
    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      if (!rest || rest.includes('/')) continue;
      names.add(rest);
    }
    return Promise.resolve([...names]);
  }

  remove(path: string): Promise<void> {
    this.files.delete(path);
    return Promise.resolve();
  }

  exists(path: string): Promise<boolean> {
    if (this.files.has(path)) return Promise.resolve(true);
    const prefix = `${path}/`;
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }
}
