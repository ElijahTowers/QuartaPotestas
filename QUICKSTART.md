# Quarta Potestas – Quick Start (Mac Mini)

Get the stack running after cloning to `~/QuartaPotestas`.

## Verification summary

| Item | Status |
|------|--------|
| **ecosystem.config.js** | ✅ Present – PM2 runs PocketBase, backend, frontend |
| **Backend venv** | ✅ Present – Python 3.12 in `backend/venv` |
| **Backend .env** | ✅ Present – Ensure `POCKETBASE_ADMIN_PASSWORD` is set |
| **PocketBase binary** | ⚠️ Missing – Download via script below |
| **Frontend deps** | Run `npm install` in `frontend/` if needed |

## 1. One-command start (recommended)

From the project root:

```bash
cd ~/QuartaPotestas
./start-services.sh
```

This will:

- Download PocketBase into `backend/` if missing
- Create `backend/.env` from `backend/.env.example` if missing
- Start PocketBase (8090), FastAPI (8000), and Next.js (3000) with PM2

## 2. Manual steps

### Backend env

- If `backend/.env` is missing, copy from the template:
  ```bash
  cp backend/.env.example backend/.env
  ```
- Edit `backend/.env` and set at least:
  - `POCKETBASE_ADMIN_EMAIL` – admin email for PocketBase
  - `POCKETBASE_ADMIN_PASSWORD` – admin password (required for API admin actions)

### PocketBase binary

If `backend/pocketbase` is missing:

```bash
cd ~/QuartaPotestas/backend
ARCH=$(uname -m); [ "$ARCH" = "arm64" ] && PB_ARCH=arm64 || PB_ARCH=amd64
curl -L -s "https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_darwin_${PB_ARCH}.zip" -o pocketbase.zip
unzip -q -o pocketbase.zip && chmod +x pocketbase && rm pocketbase.zip
cd ..
```

### Start with PM2

```bash
cd ~/QuartaPotestas
pm2 start ecosystem.config.js
pm2 save
```

## 3. URLs

- **PocketBase admin**: http://localhost:8090/_/
- **Backend API docs**: http://localhost:8000/docs
- **Frontend**: http://localhost:3000

## 4. Optional: frontend env

For a different API or PocketBase URL (e.g. tunnel), create `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_POCKETBASE_URL=http://localhost:8090
```

## 5. Troubleshooting

| Issue | What to do |
|-------|------------|
| **PocketBase won’t start** | Check `backend/pocketbase` exists and is executable; first run creates `backend/pb_data` and you must set admin in the UI or via env. |
| **Backend 500 / auth errors** | Ensure `backend/.env` has correct `POCKETBASE_ADMIN_EMAIL` and `POCKETBASE_ADMIN_PASSWORD` (same as PocketBase admin). |
| **Port in use** | Stop other processes on 8090, 8000, 3000 or change ports in ecosystem.config.js and .env. |
| **PM2 not found** | `npm install -g pm2` (or use `npx pm2`). |
| **Ollama (AI)** | Install: `brew install --cask ollama`. Run `ollama serve` and `ollama pull llama3` if you use AI features. |
| **PocketBase crashes on start** | Migrations may fail with "sql: no rows in result set" if `pb_data` was created on another machine. Restore a known-good `backend/pb_data` from backup, or start with fresh data: `rm -rf backend/pb_data`, start PocketBase once, then set admin at http://localhost:8090/_/ |

Useful PM2 commands:

```bash
pm2 status
pm2 logs
pm2 logs backend --lines 50
pm2 restart all
pm2 stop all
```

## 6. Cloudflare Tunnel (optional)

For public access:

```bash
# One-time login
cloudflared tunnel login

# Expose frontend
cd frontend && npm run broadcast
```

See `ops/tunnel/README.md` for full tunnel setup.
