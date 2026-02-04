# Migration to Mac Mini

Dit script migreert automatisch de hele Quarta Potestas installatie naar je Mac Mini via SSH.

## Vereisten

1. **Remote Login ingeschakeld op Mac Mini**
   - System Settings → General → Sharing → Remote Login: ON
   - Zorg dat je gebruiker toegang heeft

2. **SSH toegang testen**
   ```bash
   ssh lowie@192.168.1.84
   ```
   Als dit werkt, kun je doorgaan.

3. **Op Mac Mini geïnstalleerd:**
   - Python 3
   - Node.js & npm
   - Git (optioneel, voor updates)

## Gebruik

### Automatische Migratie

```bash
cd /Users/lowiehartjes/CursorProjects/QuartaPotestas
./ops/migration/migrate-to-mac-mini.sh
```

Het script doet automatisch:
1. ✅ Backup maken van alle belangrijke data
2. ✅ Project kopiëren naar Mac Mini (exclusief node_modules, venv, etc.)
3. ✅ PocketBase data overzetten
4. ✅ Environment files overzetten
5. ✅ Dependencies installeren op Mac Mini
6. ✅ PocketBase downloaden voor macOS
7. ✅ Cloudflare tunnel config overzetten

### Na de Migratie

1. **SSH naar Mac Mini:**
   ```bash
   ssh lowie@192.168.1.84
   ```

2. **Controleer .env bestanden:**
   ```bash
   cd ~/QuartaPotestas
   # Update paths in .env files als nodig
   nano backend/.env
   ```

3. **Setup Ollama (als nog niet geïnstalleerd):**
   ```bash
   # Install Ollama
   brew install ollama
   
   # Start Ollama service
   ollama serve
   
   # Pull model (in andere terminal)
   ollama pull llama3
   ```

4. **Cloudflare Tunnel re-authenticeren:**
   ```bash
   cloudflared tunnel login
   ```

5. **Start alle services:**
   ```bash
   cd ~/QuartaPotestas
   ./ops/migration/start-all.sh
   ```

## Handmatige Stappen (als automatisch niet werkt)

### 1. Backup maken
```bash
./ops/migration/backup.sh
```

### 2. Backup overzetten
```bash
scp -r ~/quartapotestas-backup-* lowie@192.168.1.84:~/
```

### 3. Project clonen op Mac Mini
```bash
ssh lowie@192.168.1.84
cd ~
git clone https://github.com/ElijahTowers/QuartaPotestas.git
```

### 4. Restore uitvoeren
```bash
cd ~/QuartaPotestas
./ops/migration/restore.sh
```

## Troubleshooting

### SSH connectie faalt
- Controleer of Remote Login aan staat op Mac Mini
- Controleer IP adres: `ifconfig | grep "inet "`
- Test connectie: `ssh lowie@192.168.1.84`

### Dependencies installeren faalt
- Controleer Python: `python3 --version`
- Controleer Node.js: `node --version`
- Installeer ontbrekende tools: `brew install python3 node`

### PocketBase werkt niet
- Download handmatig: https://github.com/pocketbase/pocketbase/releases
- Kies `pocketbase_darwin_arm64.zip` voor M1/M2 Mac
- Of `pocketbase_darwin_amd64.zip` voor Intel Mac

### Cloudflare Tunnel werkt niet
- Re-authenticate: `cloudflared tunnel login`
- Controleer config: `cat ops/tunnel/config.yml`

## Service Management

### Start alle services
```bash
./ops/migration/start-all.sh
```

### Stop alle services
```bash
./ops/migration/stop-all.sh
```

### Check service status
```bash
# PocketBase
lsof -i :8090

# Backend
lsof -i :8000

# Frontend
lsof -i :3000
```

## Remote Access

Na migratie kun je alles remote beheren:

```bash
# Start services remote
ssh lowie@192.168.1.84 'cd ~/QuartaPotestas && ./ops/migration/start-all.sh'

# Check logs remote
ssh lowie@192.168.1.84 'tail -f /tmp/quartapotestas-backend.log'

# Stop services remote
ssh lowie@192.168.1.84 'cd ~/QuartaPotestas && ./ops/migration/stop-all.sh'
```

