import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

for (const dir of [config.dataDir, config.originalsDir, config.thumbsDir, config.backupsDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(path.join(config.dataDir, 'blog.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS images (
    id         TEXT PRIMARY KEY,
    post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    ext        TEXT NOT NULL,
    mime       TEXT NOT NULL,
    bytes      INTEGER NOT NULL,
    width      INTEGER,
    height     INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS images_post ON images(post_id);
`);

/** Migration: editable post timestamp (the feed is sorted by this). */
const postCols = db.prepare('PRAGMA table_info(posts)').all() as { name: string }[];
if (!postCols.some((c) => c.name === 'published_at')) {
  db.exec('ALTER TABLE posts ADD COLUMN published_at INTEGER');
  db.exec('UPDATE posts SET published_at = created_at');
}
db.exec('CREATE INDEX IF NOT EXISTS posts_published ON posts(published_at)');

/** Daily consistent snapshot of the database (images are write-once files, back those up with rsync). */
function backup() {
  const file = path.join(config.backupsDir, `blog-${new Date().toISOString().slice(0, 10)}.sqlite`);
  db.backup(file)
    .then(() => {
      const old = fs.readdirSync(config.backupsDir).filter((f) => f.endsWith('.sqlite')).sort().slice(0, -14);
      for (const f of old) fs.rmSync(path.join(config.backupsDir, f), { force: true });
    })
    .catch((e) => console.error('Backup failed:', e));
}
backup();
setInterval(backup, 24 * 60 * 60 * 1000).unref();
