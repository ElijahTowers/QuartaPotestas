# 📋 KOPIEER EN PLAK DIT OP JE MAC MINI

## Optie 1: Direct Download & Run (Aanbevolen)

Kopieer en plak dit **ENKEL** commando in Terminal op je Mac Mini:

```bash
curl -fsSL https://raw.githubusercontent.com/ElijahTowers/QuartaPotestas/main/ops/migration/install-everything.sh | bash
```

Dit doet **ALLES** automatisch!

---

## Optie 2: Handmatig (als Optie 1 niet werkt)

```bash
cd ~/Projects && git clone https://github.com/ElijahTowers/QuartaPotestas.git && cd QuartaPotestas && chmod +x ops/migration/ONE_COMMAND_SETUP.sh && ./ops/migration/ONE_COMMAND_SETUP.sh
```

---

## Na de Installatie

### 1. Wachtwoord instellen
```bash
cd ~/Projects/QuartaPotestas
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

---

## Backup Overzetten (optioneel)

Als je je data wilt overzetten:

1. Kopieer `quartapotestas-backup.tar.gz` naar Mac Mini
2. Pak uit:
```bash
cd ~/Projects/QuartaPotestas
tar -xzf ~/Downloads/quartapotestas-backup.tar.gz
mv quartapotestas-backup-* migration-backup
```
3. Run setup opnieuw (detecteert backup automatisch)

