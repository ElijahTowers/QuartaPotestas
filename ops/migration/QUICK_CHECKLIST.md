# Quick Migration Checklist

## Before Migration (Current Machine)

- [ ] Run backup script: `./ops/migration/backup.sh`
- [ ] Verify backup directory was created
- [ ] Transfer backup to Mac Mini (via network, external drive, or cloud)

## On Mac Mini - Initial Setup

- [ ] Install Homebrew: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
- [ ] Install Git: `brew install git`
- [ ] Install Python 3.11+: `brew install python@3.11`
- [ ] Install Node.js: `brew install node`
- [ ] Install Ollama: `brew install ollama`
- [ ] Install Cloudflared: `brew install cloudflare/cloudflare/cloudflared`

## On Mac Mini - Project Setup

- [ ] Clone repository: `git clone <repo-url> QuartaPotestas`
- [ ] Run restore script: `./ops/migration/restore.sh`
- [ ] Review and update `.env` files if needed
- [ ] Setup Python venv: `cd backend && python3.11 -m venv venv && source venv/bin/activate && pip install -r requirements.txt`
- [ ] Install Node.js deps: `cd frontend && npm install`
- [ ] Download Ollama model: `ollama pull llama3`
- [ ] Login to Cloudflare: `cloudflared tunnel login`

## On Mac Mini - Verification

- [ ] Start PocketBase: `cd backend && ./start_pocketbase.sh`
- [ ] Verify PocketBase at http://localhost:8090/_/
- [ ] Start Backend: `cd backend && source venv/bin/activate && uvicorn app.main:app --reload`
- [ ] Verify Backend at http://localhost:8000/docs
- [ ] Start Frontend: `cd frontend && npm run dev`
- [ ] Verify Frontend at http://localhost:3000
- [ ] Start Tunnel: `npm run host:public`
- [ ] Verify domain resolves: `curl https://quartapotestas.com`

## Critical Tests

- [ ] Can log in to the game
- [ ] Map displays articles
- [ ] Can fetch new scoops
- [ ] Can publish a newspaper
- [ ] Published newspapers are visible
- [ ] Hub stats display correctly
- [ ] Cloudflare tunnel is active

## Post-Migration

- [ ] Update Mac Mini sleep settings (System Preferences → Energy Saver)
- [ ] Consider setting up auto-start scripts (optional)
- [ ] Document any Mac Mini-specific configurations

