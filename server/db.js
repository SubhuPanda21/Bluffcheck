import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'bluffcheck.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      fn_name TEXT,
      shape TEXT NOT NULL,
      score INTEGER,
      verdict TEXT,
      input TEXT NOT NULL,
      result TEXT,
      events TEXT,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS audits_client ON audits (client_id, created_at DESC);
  `);
  return db;
}

export function purgeOld(db, days) {
  const cutoff = Date.now() - days * 86400000;
  return db.prepare('DELETE FROM audits WHERE created_at < ?').run(cutoff).changes;
}
