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

## Deploy on the home server (Ubuntu Server)

### 1. DNS and tunnel (once)
The domain stays registered at TransIP. Only its nameservers move to Cloudflare, so Cloudflare can create the
tunnel's DNS record. Order of work:
1. Cloudflare: add `streffel.nl` (Free plan), check the imported records, set the old Firebase `A` records to *DNS only*.
2. TransIP: remove any DNSSEC DS entry, turn off "TransIP settings", replace the nameservers with Cloudflare's two.
3. Wait until Cloudflare shows the domain as Active.
4. Cloudflare: Networking > Tunnels > Create Tunnel (Cloudflared), copy the token into `.env` as `TUNNEL_TOKEN`.
5. Start the stack on the server (section 2), the tunnel turns Healthy.
6. Cutover: delete the old Firebase `A`/`AAAA`/TXT records for `streffel.nl` (and `www`), then on the tunnel:
   Routes > Add route > Published application, hostname `streffel.nl`, service URL `http://app:3000`.
7. Optional: SSL/TLS > Edge Certificates > Always Use HTTPS.

### 2. Server (once)
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER && newgrp docker

git clone git@github.com:<you>/streffel.nl-vibes.git && cd streffel.nl-vibes
cp .env.example .env
mkdir -p data                  # the container runs as uid 1000; if you are not uid 1000: sudo chown 1000:1000 data

docker compose build app
docker compose run --rm -it app node server-dist/hash-password.js   # paste the printed line into .env
openssl rand -hex 32                                                # paste as SESSION_SECRET in .env
nano .env                                                           # also paste TUNNEL_TOKEN

docker compose up -d --build
docker compose logs -f         # expect "Listening on :3000" and "Registered tunnel connection"
```
Open https://streffel.nl, go to `/login`.

### 3. Update later
```bash
git pull && docker compose up -d --build
```

### 4. Backups
Images are write-once files and the database snapshot lands in `data/backups` every day, so copying the folder is safe:
```bash
rsync -a /home/<you>/streffel.nl-vibes/data/ /mnt/backup/streffel/    # run from cron, e.g. nightly
```
To restore: stop the stack, copy `data/` back (or replace `blog.sqlite` with a file from `backups/`), start it.

### 5. Keeping the server unexposed
- `docker-compose.yml` publishes no ports. `cloudflared` only makes outbound connections.
- Do not port-forward anything for this site. If you use `ufw`, nothing needs to be opened for it.
- Cloudflare's free plan limits a request body to 100 MB. The editor uploads one file per request, so each image must be under 100 MB.
- Optional hardening in Cloudflare: a WAF rate-limit rule on `/api/login`, or Zero Trust Access in front of `/login`.
- Rotating `SESSION_SECRET` logs out every session.

### 6. Retire Firebase
After the site works on the tunnel: remove `streffel.nl` from Firebase Hosting, and archive the old repo
(its GitHub Action keeps deploying to Firebase otherwise). Re-create the old posts through the editor.

## API (for reference)
`GET /api/posts`, `GET /api/posts/:id`, `POST/PUT/DELETE /api/posts[/:id]`, `POST /api/posts/:id/images?name=`
(raw file body), `DELETE /api/images/:id`, `POST /api/login`, `POST /api/logout`, `GET /api/me`, `GET /api/health`.
