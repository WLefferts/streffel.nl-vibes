# streffel.nl-vibes

A personal space-photo blog for sharing telescope images and the stories behind them. Visitors can browse posts
and view full-resolution originals; the owner can sign in to publish, edit, and remove posts and images.

## Technologies and implementation

- **Frontend:** React 18 and TypeScript, bundled and served in production with Vite. React Router handles the
  home, login, new-post, and edit-post views. The editor uses React state for post fields, image previews, and
  upload progress.
- **API:** A TypeScript server built with Hono and `@hono/node-server`. The same server exposes the JSON API,
  streams image files, and serves the built frontend. During development, Vite proxies `/api` and `/media` to
  the API server.
- **Authentication:** There is no public registration. The owner password is verified with Node's scrypt
  implementation; successful login sets a signed, stateless session in an HttpOnly, SameSite=Strict cookie.
  Write routes require a valid session, login failures are rate-limited, and cross-origin writes are rejected.
- **Data and files:** `better-sqlite3` stores posts and image metadata in SQLite, using prepared statements,
  foreign keys, and write-ahead logging. Original images are kept byte-for-byte on disk, separate from the
  database. The database is backed up daily, retaining the latest 14 snapshots.
- **Image processing:** `sharp` reads uploaded JPEG, PNG, WebP, and AVIF files and creates orientation-corrected,
  proportionally resized WebP thumbnails (up to 1600 pixels, quality 82). The feed uses thumbnails; each
  original remains available separately.
- **Deployment:** A multi-stage Node 22 Docker build compiles the app and runs the production server as the
  unprivileged `node` user. Data is stored under `/data` in the container. The site is intended to run on a
  home server and be published through a Cloudflare Tunnel, without opening router ports.

## Data layout

The data directory (default `./data`; `/data` in Docker) contains:

| Path | Contents |
| --- | --- |
| `blog.sqlite` | Posts and image metadata |
| `originals/` | Uploaded images, stored byte-for-byte |
| `thumbs/` | Generated WebP thumbnails |
| `backups/` | Daily SQLite snapshots; the 14 newest are retained |

## Local development

```bash
npm install
npm run hash-password          # prints ADMIN_PASSWORD_HASH=...
cp .env.example .env           # set ADMIN_PASSWORD_HASH and SESSION_SECRET (openssl rand -hex 32)
npm run dev                    # web on :5173, API on :3000
```

## HTTP API

JSON API routes are under `/api`; image files are served under `/media`. Read routes are public; routes marked
**Owner** require a valid login session. JSON endpoints accept and return JSON unless noted; API errors include
an `error` message.

### Posts

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/posts` | Public | List posts, newest publication date first, including image metadata. |
| `GET` | `/api/posts/:id` | Public | Get one post and its image metadata. |
| `POST` | `/api/posts` | Owner | Create a post. JSON body: `{ "title": "...", "body": "...", "publishedAt": 0 }`. `publishedAt` is an optional Unix timestamp in milliseconds. |
| `PUT` | `/api/posts/:id` | Owner | Update a post using the same JSON fields as create. |
| `DELETE` | `/api/posts/:id` | Owner | Delete a post and its associated images. |

### Images

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/posts/:id/images?name=...` | Owner | Upload one image as the **raw request body** (not multipart form data). Set `Content-Type` to the image MIME type. Supports JPEG, PNG, WebP, and AVIF, up to 150 MB per file; returns image metadata. |
| `DELETE` | `/api/images/:id` | Owner | Delete an image and its files. |
| `GET` | `/media/original/:file` | Public | Stream the full-resolution original. |
| `GET` | `/media/thumb/:file` | Public | Stream the generated WebP thumbnail. |

### Session and status

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/login` | Public | Sign in with JSON body `{ "password": "..." }`; sets the session cookie. |
| `POST` | `/api/logout` | Public | Clear the session cookie. |
| `GET` | `/api/me` | Public | Return `{ "owner": true/false }` for the current session. |
| `GET` | `/api/health` | Public | Health check; returns `{ "ok": true }`. |
