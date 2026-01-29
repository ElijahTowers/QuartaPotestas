# Migratiehandleiding: MacBook Pro → Mac mini

Deze handleiding beschrijft hoe je het Quarta Potestas project volledig migreert naar een nieuwe Mac mini.

## 📋 Pre-migratie Checklist

### 1. Inventarisatie

**Code & Repository:**
- ✅ Project staat al op GitHub (`ElijahTowers/QuartaPotestas`)
- ✅ Alle code is gecommit en gepusht

**Lokale Data:**
- ⚠️ PocketBase database (`backend/pb_data/`)
- ⚠️ Environment variables (`.env.local` files)
- ⚠️ Node modules (kan opnieuw geïnstalleerd worden)
- ⚠️ Python virtual environment (kan opnieuw aangemaakt worden)

**Configuraties:**
- ⚠️ Cloudflare Tunnel credentials (`~/.cloudflared/`)
- ⚠️ PocketBase admin credentials
- ⚠️ API keys en secrets

## 🚀 Migratiestappen

### Stap 1: Backup op MacBook Pro

```bash
# 1. Backup PocketBase data
cd /Users/lowiehartjes/CursorProjects/QuartaPotestas/backend
tar -czf pocketbase-backup-$(date +%Y%m%d).tar.gz pb_data/

# 2. Backup environment files (zorg dat je .env files niet in .gitignore staan voor backup)
cd /Users/lowiehartjes/CursorProjects/QuartaPotestas
tar -czf env-backup-$(date +%Y%m%d).tar.gz \
  frontend/.env.local \
  backend/.env \
  2>/dev/null || echo "Some .env files may not exist"

# 3. Backup Cloudflare Tunnel credentials
tar -czf cloudflare-tunnel-backup-$(date +%Y%m%d).tar.gz ~/.cloudflared/

# 4. Verplaats backups naar een veilige locatie (USB, iCloud, etc.)
# Bijvoorbeeld:
# cp *.tar.gz ~/Desktop/
# of
# cp *.tar.gz ~/iCloud\ Drive/Backups/
```

### Stap 2: Setup op Mac mini

#### 2.1 Basis Software Installeren

```bash
# Homebrew (als nog niet geïnstalleerd)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js (via Homebrew of nvm)
brew install node
# of voor LTS versie:
brew install node@20

# Python 3
brew install python@3.11

# Git (meestal al geïnstalleerd)
brew install git

# Cloudflared
brew install cloudflare/cloudflare/cloudflared
```

#### 2.2 Project Clonen

```bash
# Clone repository
cd ~/Projects  # of waar je projecten wilt hebben
git clone https://github.com/ElijahTowers/QuartaPotestas.git
cd QuartaPotestas
```

#### 2.3 Dependencies Installeren

```bash
# Frontend dependencies
cd frontend
npm install

# Backend dependencies
cd ../backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Stap 3: Data Restoren

#### 3.1 PocketBase Data

```bash
# Kopieer backup naar Mac mini
# Bijvoorbeeld via USB, AirDrop, of iCloud

# Extract PocketBase backup
cd backend
tar -xzf pocketbase-backup-YYYYMMDD.tar.gz

# Verifieer dat pb_data/ directory bestaat
ls -la pb_data/
```

#### 3.2 Environment Variables

```bash
# Extract environment files
cd /path/to/QuartaPotestas
tar -xzf env-backup-YYYYMMDD.tar.gz

# Verifieer dat .env files bestaan
ls -la frontend/.env.local
ls -la backend/.env
```

**Belangrijke environment variables om te controleren:**

**`frontend/.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
# Andere frontend vars
```

**`backend/.env`:**
```env
POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_ADMIN_EMAIL=your-admin@email.com
POCKETBASE_ADMIN_PASSWORD=your-password
# Andere backend vars
```

#### 3.3 Cloudflare Tunnel

```bash
# Extract Cloudflare credentials
tar -xzf cloudflare-tunnel-backup-YYYYMMDD.tar.gz -C ~/

# Verifieer
ls -la ~/.cloudflared/

# Test tunnel login
cloudflared tunnel list
```

### Stap 4: PocketBase Setup

```bash
# Download PocketBase (als nog niet aanwezig)
cd backend
# PocketBase binary zou al in de repo moeten zitten, anders:
# wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_darwin_amd64.zip
# unzip pocketbase_darwin_amd64.zip
# chmod +x pocketbase

# Start PocketBase
./start_pocketbase.sh

# Verifieer dat PocketBase draait
curl http://localhost:8090/api/health
```

### Stap 5: Services Starten

```bash
# Terminal 1: PocketBase
cd backend
./start_pocketbase.sh

# Terminal 2: Backend (FastAPI)
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 3: Frontend (Next.js)
cd frontend
npm run dev

# Terminal 4: Cloudflare Tunnel (optioneel)
npm run host:public
```

### Stap 6: Verificatie

1. **PocketBase Admin UI:**
   - Open: `http://localhost:8090/_/`
   - Login met admin credentials
   - Verifieer dat alle collecties aanwezig zijn

2. **Frontend:**
   - Open: `http://localhost:3000`
   - Test login
   - Verifieer dat data correct wordt geladen

3. **Backend API:**
   - Test: `curl http://localhost:8000/api/health`
   - Verifieer endpoints

4. **Cloudflare Tunnel:**
   - Test: `cloudflared tunnel info quartapotestas-local`
   - Verifieer dat tunnel verbonden is

## 🔧 Troubleshooting

### PocketBase data niet zichtbaar

```bash
# Check permissions
ls -la backend/pb_data/
chmod -R 755 backend/pb_data/

# Check of PocketBase de data kan lezen
./backend/pocketbase serve --dir=./backend/pb_data
```

### Environment variables ontbreken

```bash
# Check welke vars nodig zijn
cat frontend/.env.example  # als dit bestaat
cat backend/.env.example   # als dit bestaat

# Of check de code voor process.env references
grep -r "process.env" frontend/
grep -r "os.getenv" backend/
```

### Cloudflare Tunnel werkt niet

```bash
# Re-authenticate
cloudflared tunnel login

# Check tunnel status
cloudflared tunnel list
cloudflared tunnel info quartapotestas-local

# Update config als nodig
# Check: ops/tunnel/config.yml
```

### Ports al in gebruik

```bash
# Check welke processen poorten gebruiken
lsof -ti:3000  # Next.js
lsof -ti:8000  # FastAPI
lsof -ti:8090  # PocketBase

# Kill indien nodig
kill -9 $(lsof -ti:3000)
```

## 📝 Post-Migratie Checklist

- [ ] Alle services draaien (PocketBase, Backend, Frontend)
- [ ] Login werkt
- [ ] Data is zichtbaar (articles, users, etc.)
- [ ] Cloudflare Tunnel is verbonden
- [ ] Public domain werkt (`quartapotestas.com`)
- [ ] Telemetry tracking werkt
- [ ] Alle collecties zijn aanwezig in PocketBase

## 🔐 Security Notes

**Na migratie:**
1. Verwijder oude backups van onveilige locaties
2. Update wachtwoorden als je denkt dat ze gecompromitteerd zijn
3. Verifieer dat `.env` files niet in Git staan:
   ```bash
   git check-ignore frontend/.env.local backend/.env
   ```

## 💡 Tips

1. **Gebruik een deployment script:**
   ```bash
   # Maak een start.sh script
   #!/bin/bash
   cd backend && ./start_pocketbase.sh &
   sleep 2
   cd backend && source venv/bin/activate && uvicorn app.main:app --reload &
   sleep 2
   cd frontend && npm run dev &
   ```

2. **Gebruik tmux of screen voor persistent sessions:**
   ```bash
   brew install tmux
   tmux new -s quarta
   # Start services in tmux panes
   ```

3. **Automatische startup (optioneel):**
   - Gebruik `launchd` op macOS voor auto-start
   - Of gebruik een process manager zoals `pm2`

## 📦 Alternatieve Migratiemethode: Time Machine

Als je Time Machine gebruikt:
1. Restore de hele project folder via Time Machine
2. Volg Stap 2.1 en 2.2 (software installeren)
3. Volg Stap 2.3 (dependencies installeren)
4. Skip Stap 3 (data is al gerestored)

## 🆘 Hulp Nodig?

Als er problemen zijn:
1. Check de logs:
   - PocketBase: `backend/pb_data/logs/`
   - Backend: terminal output
   - Frontend: browser console + terminal
2. Verifieer alle environment variables
3. Check of alle poorten beschikbaar zijn
4. Verifieer dat alle dependencies geïnstalleerd zijn

