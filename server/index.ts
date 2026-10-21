import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeWebStream } from 'node:stream/web';
import sharp from 'sharp';
import { makeSession, requireAuth, SESSION_MS, validSession, verifyPassword } from './auth.js';
import { config } from './config.js';
import { db } from './db.js';

interface PostRow { id: string; title: string; body: string; created_at: number; updated_at: number; published_at: number }
interface ImageRow { id: string; post_id: string; name: string; ext: string; mime: string; bytes: number; width: number | null; height: number | null }

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const auth = requireAuth(config.sessionSecret);
const originalPath = (i: Pick<ImageRow, 'id' | 'ext'>) => path.join(config.originalsDir, `${i.id}.${i.ext}`);
const thumbPath = (id: string) => path.join(config.thumbsDir, `${id}.webp`);

const serializeImage = (i: ImageRow) => ({
  id: i.id,
  name: i.name,
  width: i.width,
  height: i.height,
  bytes: i.bytes,
  // File extensions in the URL let Cloudflare cache these by default.
  url: `/media/original/${i.id}.${i.ext}`,
  thumbUrl: `/media/thumb/${i.id}.webp`,
});

function serializePost(p: PostRow) {
  const images = db.prepare('SELECT * FROM images WHERE post_id = ? ORDER BY created_at, rowid').all(p.id) as ImageRow[];
  return { id: p.id, title: p.title, body: p.body, createdAt: p.created_at, updatedAt: p.updated_at, publishedAt: p.published_at ?? p.created_at, images: images.map(serializeImage) };
}

async function readPostInput(c: Context) {
  const data = await c.req.json().catch(() => null);
  const title = typeof data?.title === 'string' ? data.title.trim() : '';
  const body = typeof data?.body === 'string' ? data.body : '';
  const raw = data?.publishedAt;
  const publishedAt =
    typeof raw === 'number' && Number.isFinite(raw) && raw > 0 && raw < Date.now() + 366 * 86_400_000 ? Math.round(raw) : null;
  if (!title || title.length > 200 || body.length > 50_000) return null;
  return { title, body, publishedAt };
}

// --- login rate limiting (5 failures / 15 min per client) -----------------------------------
const attempts = new Map<string, { count: number; resetAt: number }>();
const clientIp = (c: Context) => c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'local';
function isLimited(ip: string) {
  const a = attempts.get(ip);
  if (!a || a.resetAt < Date.now()) return false;
  return a.count >= 5;
}
function recordFailure(ip: string) {
  const a = attempts.get(ip);
  if (!a || a.resetAt < Date.now()) attempts.set(ip, { count: 1, resetAt: Date.now() + 15 * 60 * 1000 });
  else a.count++;
}

const app = new Hono();

app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'same-origin');
});

// Reject cross-site writes (the session cookie is also SameSite=Strict).
app.use('/api/*', async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const origin = c.req.header('origin');
    if (origin && new URL(origin).host !== c.req.header('host')) return c.json({ error: 'Bad origin' }, 403);
  }
  await next();
});

app.get('/api/health', (c) => c.json({ ok: true }));

// --- session -------------------------------------------------------------------------------
app.get('/api/me', (c) => c.json({ owner: validSession(config.sessionSecret, getCookie(c, 'session')) }));

app.post('/api/login', async (c) => {
  const ip = clientIp(c);
  if (isLimited(ip)) return c.json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
  const data = await c.req.json().catch(() => null);
  const password = typeof data?.password === 'string' ? data.password : '';
  if (!verifyPassword(password, config.adminPasswordHash)) {
    recordFailure(ip);
    await new Promise((r) => setTimeout(r, 500));
    return c.json({ error: 'Wrong password' }, 401);
  }
  attempts.delete(ip);
  setCookie(c, 'session', makeSession(config.sessionSecret), {
    httpOnly: true,
    secure: config.production,
    sameSite: 'Strict',
    path: '/',
    maxAge: SESSION_MS / 1000,
  });
  return c.json({ ok: true });
});

app.post('/api/logout', (c) => {
  deleteCookie(c, 'session', { path: '/' });
  return c.json({ ok: true });
});

// --- posts ---------------------------------------------------------------------------------
app.get('/api/posts', (c) => {
  const rows = db.prepare('SELECT * FROM posts ORDER BY published_at DESC, created_at DESC').all() as PostRow[];
  return c.json(rows.map(serializePost));
});

app.get('/api/posts/:id', (c) => {
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(c.req.param('id')) as PostRow | undefined;
  return row ? c.json(serializePost(row)) : c.json({ error: 'Post not found' }, 404);
});

app.post('/api/posts', auth, async (c) => {
  const input = await readPostInput(c);
  if (!input) return c.json({ error: 'A title is required' }, 400);
  const id = randomUUID();
  const now = Date.now();
  db.prepare('INSERT INTO posts (id, title, body, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, input.title, input.body, now, now, input.publishedAt ?? now);
  return c.json(serializePost(db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as PostRow), 201);
});

app.put('/api/posts/:id', auth, async (c) => {
  const input = await readPostInput(c);
  if (!input) return c.json({ error: 'A title is required' }, 400);
  const id = c.req.param('id');
  const res = db.prepare('UPDATE posts SET title = ?, body = ?, updated_at = ?, published_at = ? WHERE id = ?').run(input.title, input.body, Date.now(), input.publishedAt ?? Date.now(), id);
  if (!res.changes) return c.json({ error: 'Post not found' }, 404);
  return c.json(serializePost(db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as PostRow));
});

async function removeImageFiles(images: ImageRow[]) {
  await Promise.all(images.flatMap((i) => [rm(originalPath(i), { force: true }), rm(thumbPath(i.id), { force: true })]));
}

app.delete('/api/posts/:id', auth, async (c) => {
  const id = c.req.param('id');
  const images = db.prepare('SELECT * FROM images WHERE post_id = ?').all(id) as ImageRow[];
  await removeImageFiles(images);
  db.prepare('DELETE FROM posts WHERE id = ?').run(id); // images rows cascade
  return c.json({ ok: true });
});

// --- images --------------------------------------------------------------------------------
// Body is the raw file (one file per request). The original is stored byte-for-byte; only the
// thumbnail used in the feed is re-encoded.
app.post('/api/posts/:id/images', auth, async (c) => {
  const postId = c.req.param('id');
  if (!db.prepare('SELECT 1 FROM posts WHERE id = ?').get(postId)) return c.json({ error: 'Post not found' }, 404);

  const mime = (c.req.header('content-type') ?? '').split(';')[0].trim();
  const ext = EXT[mime];
  if (!ext) return c.json({ error: 'Only JPEG, PNG, WebP and AVIF images are supported' }, 415);
  const body = c.req.raw.body;
  if (!body) return c.json({ error: 'Empty upload' }, 400);

  const row: ImageRow = {
    id: randomUUID(),
    post_id: postId,
    name: (c.req.query('name') ?? 'image').slice(0, 200),
    ext,
    mime,
    bytes: 0,
    width: null,
    height: null,
  };

  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      row.bytes += chunk.length;
      if (row.bytes > config.maxUploadBytes) cb(new Error('File too large'));
      else cb(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(body as unknown as NodeWebStream), limiter, createWriteStream(originalPath(row)));
  } catch {
    await rm(originalPath(row), { force: true });
    return c.json({ error: 'Upload failed or file too large' }, 400);
  }

  try {
    const meta = await sharp(originalPath(row), { limitInputPixels: false }).metadata();
    const swap = (meta.orientation ?? 1) >= 5;
    row.width = (swap ? meta.height : meta.width) ?? null;
    row.height = (swap ? meta.width : meta.height) ?? null;
    await sharp(originalPath(row), { limitInputPixels: false })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(thumbPath(row.id));
  } catch {
    await removeImageFiles([row]);
    return c.json({ error: 'Could not read this image' }, 422);
  }

  db.prepare('INSERT INTO images (id, post_id, name, ext, mime, bytes, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(row.id, row.post_id, row.name, row.ext, row.mime, row.bytes, row.width, row.height, Date.now());
  return c.json(serializeImage(row), 201);
});

app.delete('/api/images/:id', auth, async (c) => {
  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(c.req.param('id')) as ImageRow | undefined;
  if (!row) return c.json({ error: 'Image not found' }, 404);
  await removeImageFiles([row]);
  db.prepare('DELETE FROM images WHERE id = ?').run(row.id);
  return c.json({ ok: true });
});

// --- media files ---------------------------------------------------------------------------
app.get('/media/:kind/:file', async (c) => {
  const { kind, file } = c.req.param();
  const m = /^([0-9a-f-]{36})\.[a-z0-9]+$/.exec(file);
  const row = m && (db.prepare('SELECT * FROM images WHERE id = ?').get(m[1]) as ImageRow | undefined);
  if (!row || (kind !== 'original' && kind !== 'thumb')) return c.notFound();

  const p = kind === 'original' ? originalPath(row) : thumbPath(row.id);
  const type = kind === 'original' ? row.mime : 'image/webp';
  try {
    const { size } = await stat(p);
    return new Response(Readable.toWeb(createReadStream(p)) as unknown as ReadableStream, {
      headers: {
        'Content-Type': type,
        'Content-Length': String(size),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return c.notFound();
  }
});

// --- frontend ------------------------------------------------------------------------------
app.use('/*', serveStatic({ root: './dist' }));
app.get('*', serveStatic({ path: './dist/index.html' }));

serve({ fetch: app.fetch, port: config.port }, (info) => console.log(`Listening on :${info.port}`));
