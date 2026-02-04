# Quarta Potestas - Cursor Start Prompt

## Project Overview
Quarta Potestas is a dystopian newspaper management game where players create and publish newspapers, manage their publication's credibility, readers, and treasury. The game features AI-generated article variants, faction-based audience system, achievements, and a full gameplay loop with daily publishing cycles.

## Tech Stack
- **Frontend**: Next.js 16 (React, TypeScript, Tailwind CSS)
- **Backend**: FastAPI (Python)
- **Database**: PocketBase
- **AI**: Ollama (local LLM)
- **Process Manager**: PM2
- **Tunneling**: Cloudflare Tunnel
- **Deployment**: Local Mac Mini with custom domain (quartapotestas.com)

## Current Status
✅ Project has been migrated to Mac Mini
✅ PM2 configuration created
✅ Environment variables need to be set in `backend/.env`
⚠️ Services need to be started with PM2

## Project Structure
```
QuartaPotestas/
├── frontend/          # Next.js application
├── backend/           # FastAPI application
│   ├── app/          # Main application code
│   ├── lib/          # Shared libraries (PocketBase client, etc.)
│   ├── pocketbase    # PocketBase executable
│   └── venv/         # Python virtual environment
├── ops/              # Operations scripts
│   ├── migration/    # Migration scripts
│   └── tunnel/       # Cloudflare tunnel config
└── ecosystem.config.js  # PM2 configuration
```

## Environment Variables Required
Create `backend/.env` with:
```
POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_ADMIN_EMAIL=your-admin-email@example.com
POCKETBASE_ADMIN_PASSWORD=your-secure-password
TEST_MODE=true
```

## Services to Run
1. **PocketBase** - Database (port 8090)
2. **Backend** - FastAPI (port 8000)
3. **Frontend** - Next.js (port 3000)
4. **Cloudflare Tunnel** - For public access via quartapotestas.com

## PM2 Commands
```bash
# Start all services
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs

# Stop all
pm2 stop all

# Restart all
pm2 restart all

# Save current process list
pm2 save

# Setup auto-start on boot
pm2 startup
```

## Key Features Implemented
- User authentication (PocketBase)
- Daily article ingestion from RSS feeds
- AI-generated article variants (factual, sensationalist, propaganda)
- Grid-based newspaper editor
- Publishing system with daily cycle
- Faction-based audience system (8 factions)
- Treasury and upgrades system
- Achievements system (100 achievements)
- Tutorial system
- Guest mode
- Mobile-responsive design
- Leaderboard
- Archives
- Share functionality
- Search functionality
- Telemetry/analytics

## Important Files
- `frontend/app/editor/page.tsx` - Main editor interface
- `frontend/app/page.tsx` - Map view
- `frontend/app/hub/page.tsx` - Hub/dashboard
- `backend/app/services/ingestion_service_pb.py` - Article ingestion
- `backend/app/services/ai_service.py` - Ollama integration
- `backend/lib/pocketbase_client.py` - PocketBase client
- `frontend/lib/api.ts` - API client functions

## Common Tasks
- **Fetch new scoops**: Trigger ingestion via debug endpoint (admin only)
- **Check services**: Use `ops/health-check.sh`
- **View logs**: `pm2 logs [service-name]`
- **Restart service**: `pm2 restart [service-name]`

## Next Steps
1. ✅ Set up environment variables in `backend/.env`
2. ✅ Start services with PM2
3. ⏳ Verify all services are running
4. ⏳ Test the application
5. ⏳ Set up Cloudflare Tunnel if needed
6. ⏳ Configure auto-start on boot

## Notes
- The project uses PocketBase for authentication and data storage
- Ollama must be running locally for AI features
- Cloudflare Tunnel is configured for public access
- PM2 manages all processes
- The game has a daily cycle: users can publish once per day
- Test mode limits article ingestion to 5 articles for faster testing

## Troubleshooting
- **Services not starting**: Check PM2 logs with `pm2 logs`
- **Database errors**: Verify PocketBase is running on port 8090
- **AI not working**: Ensure Ollama is installed and running
- **Port conflicts**: Check if ports 3000, 8000, 8090 are available
- **Permission errors**: Ensure PocketBase executable has execute permissions

## Development Workflow
1. Make changes to code
2. Frontend auto-reloads (Next.js dev mode)
3. Backend requires restart: `pm2 restart backend`
4. PocketBase persists data automatically
5. Check logs: `pm2 logs`

---

**Last Updated**: After migration to Mac Mini
**Status**: Setup in progress - services need to be started

