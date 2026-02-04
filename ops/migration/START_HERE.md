# 🚀 START HERE - Mac Mini Setup

## Eén Commando Setup

Kopieer en plak dit ENKEL commando op je Mac Mini:

```bash
cd ~/Projects && git clone https://github.com/ElijahTowers/QuartaPotestas.git && cd QuartaPotestas && chmod +x ops/migration/ONE_COMMAND_SETUP.sh && ./ops/migration/ONE_COMMAND_SETUP.sh
```

Dit doet **ALLES** automatisch:
- ✅ Clone repository
- ✅ Installeert Python dependencies
- ✅ Installeert Node.js dependencies
- ✅ Download PocketBase
- ✅ Setup Ollama
- ✅ Maakt PM2 config
- ✅ Restore backup (als aanwezig)

## Na het Script

### 1. Wachtwoord instellen
```bash
nano backend/.env
```
Zet je `POCKETBASE_ADMIN_PASSWORD` hierin.

### 2. Services starten
```bash
pm2 start ecosystem.config.js
pm2 save
```

### 3. Klaar! 🎉
- PocketBase: http://localhost:8090/_/
- Backend: http://localhost:8000/docs
- Frontend: http://localhost:3000

## Backup Overzetten (optioneel)

Als je je data wilt overzetten:

1. Kopieer `quartapotestas-backup.tar.gz` naar Mac Mini
2. Pak uit:
```bash
cd ~/Projects/QuartaPotestas
tar -xzf ~/Downloads/quartapotestas-backup.tar.gz
mv quartapotestas-backup-* migration-backup
```
3. Run setup script opnieuw (het detecteert de backup automatisch)

## Troubleshooting

### Services starten niet
```bash
pm2 logs
pm2 status
```

### Ollama werkt niet
```bash
ollama serve
# In andere terminal:
ollama pull llama3
```

### Cloudflare Tunnel
```bash
cloudflared tunnel login
```

