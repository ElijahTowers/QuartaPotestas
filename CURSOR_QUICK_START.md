# Quick Start Prompt for Cursor

Copy and paste this into Cursor when starting:

---

I'm working on **Quarta Potestas**, a dystopian newspaper management game. The project has been migrated to this Mac Mini and I need help getting it running.

**Tech Stack:**
- Frontend: Next.js 16 (TypeScript, React, Tailwind)
- Backend: FastAPI (Python)
- Database: PocketBase
- AI: Ollama (local LLM)
- Process Manager: PM2

**Current Status:**
- Project is cloned to `~/QuartaPotestas`
- PM2 config exists (`ecosystem.config.js`)
- Need to: set up `backend/.env`, start services with PM2

**Services to run:**
1. PocketBase (port 8090) - Database
2. Backend FastAPI (port 8000) - API server
3. Frontend Next.js (port 3000) - Web app
4. Cloudflare Tunnel (optional) - Public access

**Key Files:**
- `backend/.env` - Environment variables (needs to be created)
- `ecosystem.config.js` - PM2 process configuration
- `frontend/app/editor/page.tsx` - Main editor
- `backend/app/services/ingestion_service_pb.py` - Article ingestion

**What I need:**
Help me verify the setup, start the services, and troubleshoot any issues that come up.

---

