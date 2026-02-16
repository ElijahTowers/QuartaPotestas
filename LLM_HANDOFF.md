# Quarta Potestas – Volledige Project Samenvatting voor LLM-handoff

Dit document beschrijft het volledige Quarta Potestas-project zodat een andere LLM het systeem kan begrijpen, verder ontwikkelen of debuggen.

---

## 1. Projectconcept en doel

**Quarta Potestas** is een dystopische satirische krantensimulatie-game waarin spelers:

- Kranten samenstellen uit AI-gegenereerde artikelvarianten (feitelijk, sensatie, propaganda)
- Publiceren en scoren op basis van lezersreacties
- Hun kredietwaardigheid, lezersaantallen en schatkist beheren
- Faction-gebaseerde publieksreacties beïnvloeden

Het spel gebruikt **echte RSS-feeds** (BBC World) als bron; een lokale LLM (Ollama, standaard `llama3.1`) genereert per artikel drie varianten en extraheert metadata (tags, locatie, faction-scores).

**"Quarta Potestas"** verwijst naar de vierde macht (de pers). Het thema is dystopisch: cynische editor, chaos als content, winst boven waarheid.

---

## 2. Tech stack

| Component | Technologie |
|-----------|-------------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion, Leaflet |
| **Backend** | Python 3.11+, FastAPI |
| **Database** | PocketBase (embedded SQLite) |
| **AI/LLM** | Ollama (lokaal), standaard model `llama3.1` |
| **Procesbeheer** | PM2 |
| **Tunneling** | Cloudflare Tunnel |
| **Domain** | quartapotestas.com |

De README noemt PostgreSQL, maar de huidige implementatie gebruikt **PocketBase**, niet PostgreSQL. PostgreSQL is legacy/deprecated.

---

## 3. Architectuur en dataflow

### 3.1 Overzicht

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Browser (quartapotestas.com of localhost:3000)                             │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          │  - Auth: PocketBase direct (db.quartapotestas.com / 127.0.0.1:8090)
          │  - API: FastAPI via Next.js proxy (localhost:3000 → localhost:8000)
          │  - Debug BBC RSS: Next.js route haalt direct van BBC (geen backend)
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Next.js Frontend (port 3000)                                               │
│  - App Router: /, /editor, /hub, /archives, /leaderboard, /debug, /monitor   │
│  - API routes: /api/proxy/[...path], /api/proxy/debug/bbc-rss               │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          │  Proxy: /api/proxy/* → BACKEND_URL/api/*
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FastAPI Backend (port 8000)                                                │
│  - Auth, articles, feed, published-editions, submissions, achievements      │
│  - Debug: trigger-ingest, reset-and-ingest, bbc-rss, rss-poll-status       │
│  - Authenticatie via JWT (PocketBase token)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          │  PocketBase Client (admin auth voor writes)
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PocketBase (port 8090)                                                     │
│  Collecties: users, articles, daily_editions, published_editions,           │
│              ads, achievements, telemetry, ...                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Ollama (port 11434) – optioneel, voor ingestion                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Frontend API-routing

- **Localhost**: Frontend praat direct met `http://localhost:8000` (FastAPI).
- **Productie (quartapotestas.com)**: Frontend praat via **Next.js proxy** (`/api/proxy/*`) naar backend (`BACKEND_URL`). Dit is nodig omdat de browser niet direct naar de backend kan (andere host/port).
- **PocketBase**: Frontend praat direct met PocketBase:
  - Localhost: `http://127.0.0.1:8090`
  - Productie: `https://db.quartapotestas.com`

### 3.3 Proxy-routes (Next.js App Router)

| Route | Doel |
|-------|------|
| `/api/proxy/[...path]` | Alle requests naar FastAPI `BACKEND_URL/api/{path}` |
| `/api/proxy/debug/bbc-rss` | BBC World RSS, direct gefetched (geen backend), admin-only |

---

## 4. Belangrijkste flows

### 4.1 Ingestie (RSS → PocketBase)

1. **Trigger**:
   - Handmatig: Admin roept `POST /api/debug/trigger-ingest` of `POST /api/debug/reset-and-ingest` aan (alleen `lowiehartjes@gmail.com`).
   - Automatisch (optioneel): `RSS_POLL_ENABLED=true` → scheduler draait elke `RSS_POLL_INTERVAL_MINUTES` minuten.
2. **RSSService** haalt BBC World RSS (`https://feeds.bbci.co.uk/news/world/rss.xml`).
3. **AIService** (Ollama) genereert per artikel:
   - Drie varianten: **factual**, **sensationalist**, **propaganda** (title + body)
   - Tags (topic_tags, sentiment)
   - Locatie (location_city, country_code)
   - Faction audience_scores (elite, working_class, patriots, syndicate, technocrats, faithful, resistance, doomers)
4. **IngestionServicePB** schrijft naar PocketBase `articles` en `daily_editions`.
5. **Test mode** (`TEST_MODE=true`): maximaal 5 artikelen per run (`INGEST_MAX_ARTICLES`).

### 4.2 Spelerflow: Krant maken en publiceren

1. **Map view** (`/`): Speler ziet artikelmarkers, kan wire-refresh triggeren (admin), of scoops ophalen.
2. **Editor** (`/editor`): Speler sleept artikelen naar een 3-row grid:
   - Row 1: 1 breed artikel
   - Row 2: 2 artikelen naast elkaar
   - Row 3: 3 artikelen naast elkaar
3. Per artikel kiest de speler variant: **factual**, **sensationalist**, of **propaganda**.
4. **Submit** (preview): `POST /api/submissions/submit` → score, sales, outrage, faction_balance (geen publish).
5. **Publish**: `POST /api/published-editions` → opslaan in PocketBase, dagelijkse limiet.
6. Na publicatie: stats (cash, credibility, readers) updaten, achievements checken.

### 4.3 Authenticatie

- **PocketBase**: Registreren, inloggen, wachtwoord reset.
- Token (JWT) wordt meegestuurd bij backend-calls (`Authorization: Bearer <token>`).
- Backend decodeert JWT en valideert via PocketBase `/api/users/me` indien nodig.
- **Guest mode**: LocalStorage `guestMode=true`, geen echte gebruiker.

---

## 5. Factions (8 stammen)

| ID | Naam | Profiel |
|----|------|---------|
| elite | Elite | Pro-business, anti-tax |
| working_class | Working Class | Pro-jobs, anti-automation |
| patriots | Patriots | Pro-militaire/politie, anti-immigrant |
| syndicate | Syndicate | Crimineel, zwakke politie = gunstig |
| technocrats | Technocrats | Pro-AI/tech |
| faithful | Faithful | Religieus/natuur, anti-tech |
| resistance | Resistance | Anti-overheid, pro-waarheid |
| doomers | Doomers | Preppers, houden van slecht nieuws |

Per artikel variant geven de AI-generated `audience_scores` een score (-10 tot +10) per faction. Bij publicatie bepalen die mee hoe readers/credibility/cash veranderen.

---

## 6. Pagina’s en features

| Route | Beschrijving | Toegang |
|-------|--------------|---------|
| `/` | Map view – artikelmarkers, Influence Layer (choropleth), wire | Iedereen |
| `/editor` | Grid editor – krant samenstellen, publish | Ingelogd |
| `/hub` | Hub/dashboard – stats, recente transacties | Ingelogd |
| `/archives` | Archief van gepubliceerde edities | Ingelogd |
| `/archives/[id]` | Detail van één editie | Ingelogd |
| `/leaderboard` | Ranglijst op profit | Iedereen |
| `/newspaper` | Gedeelde krant (share link) | Publiek |
| `/login` | Inloggen / registreren | Iedereen |
| `/monitor` | Admin: RSS poll status, job status | Admin |
| `/debug` | Admin: BBC RSS feed, 30 min refresh | Admin |
| `/updates` | Changelog/updates | Iedereen |
| `/reset` | Wachtwoord reset | Iedereen |

**Admin e-mail**: `lowiehartjes@gmail.com` – heeft toegang tot Monitor, Debug en “Fetch new scoops”.

---

## 7. PocketBase-schema (belangrijkste collecties)

- **users**: PocketBase-standaard + custom fields: `newspaper_name`, `username`, `treasury`, `credibility`, `readers`, `purchased_upgrades`, `publish_streak`, `last_publish_date`, etc.
- **articles**: `original_title`, `processed_variants` (factual/sensationalist/propaganda), `tags`, `location_*`, `country_code`, `audience_scores`, `date`, `published_at`.
- **daily_editions**: Koppeling datum → artikelen.
- **published_editions**: `user`, `date`, `newspaper_name`, `grid_layout`, `stats`, `published_at`.
- **ads**: Advertenties (nog beperkt geïmplementeerd).
- **achievements**: Definities + user progress.
- **telemetry**: Events (optioneel).

---

## 8. Belangrijke bestanden

| Doel | Pad |
|------|-----|
| Backend entry | `backend/app/main.py` |
| Auth API | `backend/app/api/auth.py` |
| Artikel-API | `backend/app/api/articles_pb.py` |
| Published editions | `backend/app/api/published_editions.py` |
| Submissions (scoring) | `backend/app/api/submissions.py` |
| Debug/ingest API | `backend/app/api/debug_pb.py` |
| AI-service (Ollama) | `backend/app/services/ai_service.py` |
| Ingestie | `backend/app/services/ingestion_service_pb.py` |
| Scoring | `backend/app/services/scoring_service.py` |
| PocketBase client | `backend/lib/pocketbase_client.py` |
| Frontend API-client | `frontend/lib/api.ts` |
| PocketBase frontend | `frontend/lib/pocketbase.ts` |
| Auth context | `frontend/context/AuthContext.tsx` |
| Game context | `frontend/context/GameContext.tsx` |
| Hoofdmap | `frontend/components/Map.tsx` |
| Influence layer | `frontend/components/map/InfluenceLayer.tsx` |
| Grid editor | `frontend/components/GridEditor.tsx` |
| Layout + navigatie | `frontend/components/GameLayout.tsx` |
| Proxy naar backend | `frontend/app/api/proxy/[...path]/route.ts` |
| Debug BBC RSS | `frontend/app/api/proxy/debug/bbc-rss/route.ts` |
| PM2 config | `ecosystem.config.js` |
| Env-variabelen | `backend/.env` (niet in git) |

---

## 9. Omgevingsvariabelen

**Backend (`backend/.env`):**
```
POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_ADMIN_EMAIL=...
POCKETBASE_ADMIN_PASSWORD=...
BACKEND_URL=http://127.0.0.1:8000
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1
TEST_MODE=true
INGEST_MAX_ARTICLES=5
RSS_POLL_ENABLED=false
RSS_POLL_INTERVAL_MINUTES=30
ENV=development
```

**Frontend (`.env.local`):**
```
NEXT_PUBLIC_POCKETBASE_URL=https://db.quartapotestas.com  # productie
NEXT_PUBLIC_API_URL=...  # optioneel override
BACKEND_URL=http://localhost:8000  # voor server-side proxy
```

---

## 10. PM2-services

| Naam | Script | Poort |
|------|--------|-------|
| pocketbase | `./backend/pocketbase serve` | 8090 |
| backend | `uvicorn app.main:app --host 0.0.0.0 --port 8000` | 8000 |
| frontend | `next dev` | 3000 |
| tunnel | `cloudflared tunnel --config ops/tunnel/config.yml run` | – |

---

## 11. Beperkingen en known issues

- **AI title drift**: Prompts zijn geoptimaliseerd zodat o.a. “Obama addresses X” niet wordt omgezet in “Trump shares X”; focus moet gelijk blijven.
- **Proxy 500**: Bij netwerk/timeouts kunnen `/api/proxy/*` 500 geven; controleer `BACKEND_URL` en of de backend draait.
- **524 timeouts**: Lange ingestion-jobs kunnen timeouts veroorzaken; status via `/api/debug/rss-poll-status` of job-status endpoint.
- **PocketBase users collection**: Soms 404 bij directe record-access; backend gebruikt dan JWT decode + optioneel `/api/users/me`.
- **Test mode**: Standaard slechts 5 artikelen per ingestion run; zet `TEST_MODE=false` voor volledige runs.

---

## 12. Handige commando’s

```bash
# Alle services starten
pm2 start ecosystem.config.js

# Logs bekijken
pm2 logs

# Backend herstarten na code-wijziging
pm2 restart backend

# Health check
curl http://localhost:8000/health
```

---

## 13. Referenties in codebase

- `CURSOR_START_PROMPT.md` – Korte projectoverview voor Cursor
- `DATABASE_RECOMMENDATIONS.md` – Aanbevelingen voor extra PocketBase-collecties
- `INFLUENCE_MAP_IMPLEMENTATION.md` – Influence map (country choropleth)
- `INFLUENCE_MAP_SETUP_COMPLETE.md` – Setup-status influence map
- `ops/` – Scripts voor backup, health, tunnel, migratie

---

*Laatste update: februari 2025*
