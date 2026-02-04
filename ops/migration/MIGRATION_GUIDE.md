# Migration Guide: Moving Quarta Potestas to Mac Mini

This guide covers migrating the entire Quarta Potestas project from your current machine to a Mac Mini.

## Prerequisites

Before starting, ensure you have:
- Access to both machines (current and Mac Mini)
- Admin access on Mac Mini
- Cloudflare account credentials
- Git repository access

## What Needs to be Migrated

1. **Code Repository** (Git)
2. **PocketBase Database** (Critical - contains all game data)
3. **PocketBase Executable** (platform-specific)
4. **Python Virtual Environment** (or recreate)
5. **Node.js Dependencies** (or reinstall)
6. **Ollama Installation & Models**
7. **Cloudflare Tunnel Configuration**
8. **Environment Variables** (`.env` files)
9. **Local Data Files** (if any)

---

## Step-by-Step Migration

### Phase 1: Preparation (On Current Machine)

#### 1.1 Backup PocketBase Data

```bash
# Stop PocketBase if running
cd backend
./stop_pocketbase.sh  # or kill the process manually

# Create backup directory
mkdir -p ~/quartapotestas-backup

# Backup PocketBase data directory
cp -r pb_data ~/quartapotestas-backup/

# Backup PocketBase executable (for reference, but you'll need Mac version)
cp pocketbase ~/quartapotestas-backup/pocketbase-$(uname -m)
```

#### 1.2 Backup Environment Variables

```bash
# Find all .env files
find . -name ".env*" -type f > ~/quartapotestas-backup/env-files-list.txt

# Copy them (be careful with sensitive data)
find . -name ".env*" -type f -exec cp {} ~/quartapotestas-backup/ \;
```

#### 1.3 Backup Cloudflare Tunnel Config

```bash
# Backup tunnel config
cp -r ops/tunnel ~/quartapotestas-backup/

# Backup Cloudflare credentials (if they exist)
cp -r ~/.cloudflared ~/quartapotestas-backup/cloudflared-credentials 2>/dev/null || true
```

#### 1.4 Backup Ollama Models (Optional - can re-download)

```bash
# List installed models
ollama list > ~/quartapotestas-backup/ollama-models-list.txt

# Note: Ollama models are large. You can either:
# Option A: Copy them (if you have space)
cp -r ~/.ollama ~/quartapotestas-backup/ollama-models 2>/dev/null || true

# Option B: Just note which models you use and re-download on Mac Mini
```

#### 1.5 Create Migration Package

```bash
# Create a compressed archive (excluding large files)
cd ~
tar -czf quartapotestas-migration.tar.gz \
  quartapotestas-backup/ \
  --exclude='*.db-journal' \
  --exclude='node_modules' \
  --exclude='venv' \
  --exclude='.next' \
  --exclude='__pycache__'
```

---

### Phase 2: Transfer to Mac Mini

#### Option A: Direct Transfer (Same Network)

```bash
# On Mac Mini, create transfer directory
mkdir -p ~/Downloads/quartapotestas-migration

# On current machine, use scp or rsync
scp ~/quartapotestas-migration.tar.gz user@mac-mini-ip:~/Downloads/

# Or use rsync for better progress tracking
rsync -avz --progress ~/quartapotestas-migration.tar.gz user@mac-mini-ip:~/Downloads/
```

#### Option B: External Drive

1. Copy `quartapotestas-migration.tar.gz` to external drive
2. Connect drive to Mac Mini
3. Copy to `~/Downloads/quartapotestas-migration/`

#### Option C: Cloud Storage

Upload to Dropbox, Google Drive, or iCloud, then download on Mac Mini.

---

### Phase 3: Setup on Mac Mini

#### 3.1 Install Prerequisites

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Git
brew install git

# Install Python 3.11+
brew install python@3.11

# Install Node.js (LTS version)
brew install node

# Install Ollama
brew install ollama

# Install Cloudflared
brew install cloudflare/cloudflare/cloudflared
```

#### 3.2 Extract Migration Package

```bash
cd ~/Downloads
tar -xzf quartapotestas-migration.tar.gz
cd quartapotestas-backup
```

#### 3.3 Clone Git Repository

```bash
# Navigate to where you want the project
cd ~/Projects  # or wherever you keep projects

# Clone the repository
git clone <your-repo-url> QuartaPotestas
cd QuartaPotestas
```

#### 3.4 Restore PocketBase

```bash
# Download PocketBase for macOS
cd backend
curl -L https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_darwin_amd64.zip -o pocketbase.zip
unzip pocketbase.zip
chmod +x pocketbase
rm pocketbase.zip

# Restore PocketBase data
cp -r ~/Downloads/quartapotestas-backup/pb_data .

# Verify data
ls -la pb_data/
```

#### 3.5 Setup Python Environment

```bash
cd backend

# Create virtual environment
python3.11 -m venv venv

# Activate it
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

#### 3.6 Setup Node.js Dependencies

```bash
cd frontend

# Install dependencies
npm install

# Or if using yarn
yarn install
```

#### 3.7 Restore Environment Variables

```bash
# Copy .env files from backup
cp ~/Downloads/quartapotestas-backup/.env* . 2>/dev/null || true
cp ~/Downloads/quartapotestas-backup/backend/.env* backend/ 2>/dev/null || true
cp ~/Downloads/quartapotestas-backup/frontend/.env* frontend/ 2>/dev/null || true

# Review and update paths if needed
# Edit .env files to ensure paths are correct for Mac Mini
```

#### 3.8 Setup Ollama

```bash
# Start Ollama service
ollama serve &

# Download the model you use (check ollama-models-list.txt from backup)
# Default is usually llama3
ollama pull llama3

# Or if you backed up models, restore them
# cp -r ~/Downloads/quartapotestas-backup/ollama-models ~/.ollama
```

#### 3.9 Setup Cloudflare Tunnel

```bash
# Restore tunnel config
cp -r ~/Downloads/quartapotestas-backup/tunnel ops/

# Login to Cloudflare (will open browser)
cloudflared tunnel login

# Restore tunnel credentials (if you backed them up)
# cp ~/Downloads/quartapotestas-backup/cloudflared-credentials/* ~/.cloudflared/

# Verify tunnel config
cat ops/tunnel/config.yml

# Update tunnel ID if needed (the tunnel should be the same, but verify)
```

---

### Phase 4: Verification & Testing

#### 4.1 Start Services

```bash
# Terminal 1: Start PocketBase
cd backend
./start_pocketbase.sh

# Terminal 2: Start Backend API
cd backend
source venv/bin/activate
uvicorn app.main:app --reload

# Terminal 3: Start Frontend
cd frontend
npm run dev

# Terminal 4: Start Cloudflare Tunnel
npm run host:public
```

#### 4.2 Verify Everything Works

1. **PocketBase**: Open http://localhost:8090/_/ and verify:
   - Collections exist
   - Data is present
   - Can log in with admin account

2. **Backend API**: Open http://localhost:8000/docs and verify:
   - API endpoints are accessible
   - Can authenticate

3. **Frontend**: Open http://localhost:3000 and verify:
   - Can log in
   - Map loads
   - Articles display
   - Can publish newspapers

4. **Cloudflare Tunnel**: Verify:
   - Tunnel is running
   - Domain resolves correctly
   - HTTPS works

#### 4.3 Test Critical Functions

- [ ] Login/Logout
- [ ] Fetch new scoops
- [ ] Publish newspaper
- [ ] View published newspapers
- [ ] Check hub stats
- [ ] View map with articles

---

## Automated Migration Script

For convenience, use the provided migration script:

```bash
# On current machine
./ops/migration/backup.sh

# Transfer the backup to Mac Mini, then:
./ops/migration/restore.sh
```

---

## Troubleshooting

### PocketBase Issues

**Problem**: PocketBase won't start
```bash
# Check if port 8090 is in use
lsof -i :8090

# Kill process if needed
kill -9 <PID>

# Try starting again
./backend/start_pocketbase.sh
```

**Problem**: Data not showing
```bash
# Verify data directory
ls -la backend/pb_data/

# Check PocketBase logs
tail -f backend/pb_data/logs.db
```

### Python Issues

**Problem**: Module not found
```bash
# Reinstall dependencies
cd backend
source venv/bin/activate
pip install -r requirements.txt --force-reinstall
```

### Node.js Issues

**Problem**: Build errors
```bash
# Clear cache and reinstall
cd frontend
rm -rf .next node_modules
npm install
```

### Ollama Issues

**Problem**: Model not found
```bash
# List available models
ollama list

# Pull the model
ollama pull llama3
```

### Cloudflare Tunnel Issues

**Problem**: Tunnel won't connect
```bash
# Re-login
cloudflared tunnel login

# Check tunnel status
cloudflared tunnel info quartapotestas-local

# Verify DNS
dig quartapotestas.com
```

---

## Post-Migration Checklist

- [ ] All services start successfully
- [ ] Database data is intact
- [ ] User accounts work
- [ ] Published newspapers are visible
- [ ] Cloudflare tunnel is active
- [ ] Domain resolves correctly
- [ ] HTTPS is working
- [ ] Ollama generates content
- [ ] RSS feeds are being fetched
- [ ] All game features work

---

## Notes

1. **PocketBase Data**: The `pb_data/` directory contains all your game data. This is the most critical backup.

2. **Environment Variables**: Make sure to update any paths in `.env` files that might be machine-specific.

3. **Cloudflare Tunnel**: The tunnel ID should remain the same, but you may need to re-authenticate.

4. **Ollama Models**: Models are large (several GB). Consider re-downloading on Mac Mini if transfer is slow.

5. **Git Repository**: If you have uncommitted changes, commit them before migration or use `git stash`.

6. **Mac Mini Setup**: Ensure Mac Mini doesn't sleep (System Preferences → Energy Saver → Prevent computer from sleeping).

---

## Quick Reference Commands

```bash
# Start all services
./ops/migration/start-all.sh

# Stop all services
./ops/migration/stop-all.sh

# Check service status
./ops/migration/status.sh
```

