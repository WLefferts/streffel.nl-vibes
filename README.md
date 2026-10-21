# streffel.nl-vibes

Space photo blog. React + Vite frontend, Hono (Node) API, SQLite, images on disk. Runs in Docker on a home server
and is published through a Cloudflare Tunnel, so no router ports are opened.

- Anyone can read. Only you can write: password login, signed HttpOnly session cookie, login rate limit,
  every write is checked on the server.
- Originals are stored byte-for-byte. The feed shows a 1600px WebP thumbnail; clicking opens the original.
- Data lives in `./data`: `blog.sqlite`, `originals/`, `thumbs/`, `backups/` (daily DB snapshots, last 14 kept).

## Local development

```bash
npm install
npm run hash-password          # prints ADMIN_PASSWORD_HASH=...
cp .env.example .env           # fill ADMIN_PASSWORD_HASH and SESSION_SECRET (openssl rand -hex 32)
npm run dev                    # web on :5173, api on :3000
```

## API (for reference)

`GET /api/posts`, `GET /api/posts/:id`, `POST/PUT/DELETE /api/posts[/:id]`, `POST /api/posts/:id/images?name=`
(raw file body), `DELETE /api/images/:id`, `POST /api/login`, `POST /api/logout`, `GET /api/me`, `GET /api/health`.
