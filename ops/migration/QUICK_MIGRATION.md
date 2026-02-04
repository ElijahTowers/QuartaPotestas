# Quick Migration Guide - Mac Mini

Aangezien je al de basis tools hebt geïnstalleerd op de Mac Mini, volg deze stappen:

## Stap 1: Project Clonen

Op de Mac Mini:

```bash
cd ~/Projects
git clone https://github.com/ElijahTowers/QuartaPotestas.git
cd QuartaPotestas
```

## Stap 2: Setup Script Uitvoeren

```bash
chmod +x ops/migration/setup-on-mac-mini.sh
./ops/migration/setup-on-mac-mini.sh
```

Dit script:
- ✅ Installeert Python dependencies
- ✅ Installeert Node.js dependencies  
- ✅ Download PocketBase voor macOS
- ✅ Restore data (als je een backup hebt)

## Stap 3: Data Overzetten (van je huidige machine)

Als je data wilt overzetten van je huidige machine:

### Optie A: Via GitHub (als alles al gepusht is)
- Data staat al in GitHub, dus gewoon pullen

### Optie B: Handmatig via USB/Network
1. Maak backup op huidige machine:
   ```bash
   ./ops/migration/backup.sh
   ```

2. Kopieer backup naar Mac Mini (via USB, network share, etc.)

3. Plaats backup in project directory:
   ```bash
   # Op Mac Mini
   cd ~/Projects/QuartaPotestas
   # Plaats backup hier als: migration-backup/
   ```

4. Run setup script opnieuw (het detecteert de backup automatisch)

## Stap 4: Environment Files Aanpassen

Controleer en pas aan indien nodig:

```bash
cd ~/Projects/QuartaPotestas
nano backend/.env
```

Belangrijke instellingen:
- `POCKETBASE_URL` - moet `http://127.0.0.1:8090` zijn
- `POCKETBASE_ADMIN_EMAIL` - je admin email
- `POCKETBASE_ADMIN_PASSWORD` - je admin password

## Stap 5: Ollama Setup

```bash
# Start Ollama service
ollama serve

# In een andere terminal, pull het model
ollama pull llama3
```

## Stap 6: Cloudflare Tunnel

```bash
# Authenticate
cloudflared tunnel login

# Controleer config
cat ops/tunnel/config.yml
```

## Stap 7: Start Services

```bash
cd ~/Projects/QuartaPotestas
./ops/migration/start-all.sh
```

Of met PM2 (voor persistentie):

```bash
# Maak PM2 config (zie hieronder)
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## PM2 Setup (Optioneel - voor auto-start)

Maak `ecosystem.config.js` in project root:

```javascript
module.exports = {
  apps: [
    {
      name: 'pocketbase',
      script: './backend/pocketbase',
      args: 'serve',
      cwd: './backend',
      autorestart: true,
    },
    {
      name: 'backend',
      script: 'uvicorn',
      args: 'app.main:app --host 0.0.0.0 --port 8000',
      cwd: './backend',
      interpreter: './venv/bin/python',
      autorestart: true,
    },
    {
      name: 'frontend',
      script: 'npm',
      args: 'run dev',
      cwd: './frontend',
      autorestart: true,
    },
  ],
};
```

Start met:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Volg de instructies voor auto-start
```

## Troubleshooting

### Services starten niet
- Check logs: `tail -f /tmp/quartapotestas-*.log`
- Check ports: `lsof -i :8090`, `lsof -i :8000`, `lsof -i :3000`

### PocketBase werkt niet
- Check of executable bestaat: `ls -la backend/pocketbase`
- Check permissions: `chmod +x backend/pocketbase`

### Python dependencies falen
- Check Python versie: `python3 --version`
- Recreate venv: `rm -rf backend/venv && python3 -m venv backend/venv`

### Node dependencies falen
- Check Node versie: `node --version`
- Reinstall: `rm -rf frontend/node_modules && cd frontend && npm install`

