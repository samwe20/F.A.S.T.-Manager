import { db } from '../db/database';
import { applyRemoteChange } from '../services/dataService';
import type { AppSettings, SyncChange } from '../types';

type SyncListener = (status: SyncStatus) => void;

export interface SyncStatus {
  enabled: boolean;
  connected: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  error: string | null;
  pendingCount: number;
}

export class SyncClient {
  private ws: WebSocket | null = null;
  private settings: AppSettings;
  private listeners = new Set<SyncListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private status: SyncStatus = {
    enabled: false,
    connected: false,
    syncing: false,
    lastSyncAt: null,
    error: null,
    pendingCount: 0,
  };

  constructor(settings: AppSettings) {
    this.settings = settings;
    this.status.enabled = settings.syncEnabled;
  }

  updateSettings(settings: AppSettings) {
    this.settings = settings;
    this.status.enabled = settings.syncEnabled;
    this.disconnect();
    if (settings.syncEnabled) void this.connect();
    else this.emit({ connected: false, syncing: false, error: null, pendingCount: 0 });
  }

  subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private emit(partial: Partial<SyncStatus>) {
    this.status = { ...this.status, ...partial };
    this.listeners.forEach((l) => l(this.status));
  }

  isEnabled(): boolean {
    return this.settings.syncEnabled;
  }

  getSyncBaseUrl(): string {
    if (!this.settings.syncEnabled) return '';
    if (this.settings.syncUrl) return this.settings.syncUrl.replace(/\/$/, '');
    return '';
  }

  private apiUrl(path: string): string {
    const base = this.getSyncBaseUrl();
    return base ? `${base}${path}` : path;
  }

  async connect(): Promise<void> {
    if (!this.settings.syncEnabled) {
      this.emit({ enabled: false, connected: false, syncing: false, error: null, pendingCount: 0 });
      return;
    }

    this.emit({ enabled: true });
    await this.pushPending();
    await this.pullRemote();

    const wsUrl = this.buildWsUrl();
    if (!wsUrl) {
      this.emit({ connected: false, error: null });
      return;
    }

    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => {
        this.emit({ connected: true, error: null });
        this.ws?.send(JSON.stringify({ type: 'register', clientId: this.settings.clientId }));
      };
      this.ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'change') {
          await applyRemoteChange(msg.change as SyncChange);
          this.emit({ lastSyncAt: new Date().toISOString() });
        }
      };
      this.ws.onclose = () => {
        this.emit({ connected: false });
        if (this.settings.syncEnabled) this.scheduleReconnect();
      };
      this.ws.onerror = () => {
        this.emit({ connected: false, error: 'WebSocket error' });
      };
    } catch {
      this.emit({ connected: false, error: 'Connection failed' });
      if (this.settings.syncEnabled) this.scheduleReconnect();
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  private scheduleReconnect() {
    if (!this.settings.syncEnabled) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => void this.connect(), 5000);
  }

  private buildWsUrl(): string | null {
    if (!this.settings.syncEnabled || typeof window === 'undefined') return null;

    if (this.settings.syncUrl) {
      const u = new URL(this.settings.syncUrl);
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
      u.pathname = '/ws';
      return u.toString();
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  async pushPending(): Promise<void> {
    if (!this.settings.syncEnabled) return;

    const pending = await db.syncQueue.toArray();
    this.emit({ pendingCount: pending.length, syncing: true });
    if (pending.length === 0) {
      this.emit({ syncing: false });
      return;
    }

    try {
      const res = await fetch(this.apiUrl('/api/sync/push'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: this.settings.clientId,
          changes: pending,
        }),
      });
      if (!res.ok) throw new Error(`Push failed: ${res.status}`);
      await db.syncQueue.clear();
      this.emit({
        syncing: false,
        pendingCount: 0,
        lastSyncAt: new Date().toISOString(),
        error: null,
      });
    } catch (e) {
      this.emit({
        syncing: false,
        pendingCount: pending.length,
        error: e instanceof Error ? e.message : 'Sync push failed',
      });
    }
  }

  async pullRemote(): Promise<void> {
    if (!this.settings.syncEnabled) return;

    try {
      const since = this.settings.lastSyncAt ?? '1970-01-01T00:00:00.000Z';
      const res = await fetch(this.apiUrl(`/api/sync/pull?since=${encodeURIComponent(since)}`));
      if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
      const data = await res.json();
      for (const change of data.changes as SyncChange[]) {
        await applyRemoteChange(change);
      }
      this.emit({ lastSyncAt: data.serverTime ?? new Date().toISOString(), error: null });
    } catch (e) {
      this.emit({ error: e instanceof Error ? e.message : 'Sync pull failed' });
    }
  }

  async syncNow(): Promise<void> {
    if (!this.settings.syncEnabled) return;
    await this.pushPending();
    await this.pullRemote();
  }
}
