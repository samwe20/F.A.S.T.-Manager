import Database from 'better-sqlite3';
import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 3847;
const DB_PATH = process.env.DB_PATH || './fast-sync.db';

const sqlite = new Database(DB_PATH);
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS changes (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    client_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_changes_updated ON changes(updated_at);
`);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(change) {
  const msg = JSON.stringify({ type: 'change', change });
  for (const client of clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'fast-sync-server' });
});

app.post('/api/sync/push', (req, res) => {
  const { clientId, changes } = req.body;
  if (!Array.isArray(changes)) {
    return res.status(400).json({ error: 'changes required' });
  }

  const insert = sqlite.prepare(`
    INSERT OR REPLACE INTO changes (id, entity_type, entity_id, payload, updated_at, deleted, client_id)
    VALUES (@id, @entityType, @entityId, @payload, @updatedAt, @deleted, @clientId)
  `);

  const tx = sqlite.transaction((items) => {
    for (const change of items) {
      insert.run({
        id: change.id || uuidv4(),
        entityType: change.entityType,
        entityId: change.entityId,
        payload: change.payload,
        updatedAt: change.updatedAt,
        deleted: change.deleted ? 1 : 0,
        clientId,
      });
      broadcast(change);
    }
  });

  tx(changes);
  res.json({ ok: true, count: changes.length, serverTime: new Date().toISOString() });
});

app.get('/api/sync/pull', (req, res) => {
  const since = String(req.query.since || '1970-01-01T00:00:00.000Z');
  const rows = sqlite
    .prepare(`SELECT id, entity_type as entityType, entity_id as entityId, payload, updated_at as updatedAt, deleted FROM changes WHERE updated_at > ? ORDER BY updated_at ASC`)
    .all(since);

  const changes = rows.map((r) => ({
    ...r,
    deleted: !!r.deleted,
  }));

  res.json({ changes, serverTime: new Date().toISOString() });
});

httpServer.listen(PORT, () => {
  console.log(`FAST sync server running on http://localhost:${PORT}`);
});
