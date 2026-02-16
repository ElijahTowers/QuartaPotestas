# Game State 404 – Troubleshooting

Als je na inloggen "user record not found" (404) ziet bij game-state op quartapotestas.com:

## Snel oplossen (productie)

1. Bewerk `backend/.env` op de server:
   ```bash
   POCKETBASE_URL=https://db.quartapotestas.com
   ```

2. Herstart de backend:
   ```bash
   pm2 restart backend
   # of: Ctrl+C en opnieuw starten als je uvicorn direct draait
   ```

## 1. Backend moet dezelfde PocketBase gebruiken als de frontend

| Omgeving | Frontend PocketBase        | Backend `POCKETBASE_URL` (moet gelijk zijn) |
|----------|----------------------------|---------------------------------------------|
| Lokaal   | `http://127.0.0.1:8090`   | `http://127.0.0.1:8090`                     |
| Productie (quartapotestas.com) | `https://db.quartapotestas.com` | `https://db.quartapotestas.com`      |

**Als de backend `http://127.0.0.1:8090` gebruikt terwijl de frontend op `https://db.quartapotestas.com` inlogt, staan de gebruikers in een andere database → 404.**

Bij Docker: als de backend in een container draait, gebruik dan `http://host.docker.internal:8090` of de hostnaam van de PocketBase-container in plaats van `127.0.0.1`.

## 2. Users-collectie moet game state velden hebben

Voer het script uit tegen dezelfde PocketBase die de frontend gebruikt:

```bash
cd backend
python add_game_state_fields.py
```

Dit voegt `treasury`, `purchased_upgrades`, `readers`, `credibility` toe aan de users-collectie.

## 3. Publish-streak velden (optioneel)

Voor publish-streak tracking:

```bash
cd backend
python add_publish_streak_fields.py
```

## 4. Controleren

- **Frontend**: PocketBase-URL staat in `frontend/lib/pocketbase.ts` (hostname-based).
- **Backend**: `POCKETBASE_URL` in `backend/.env` op de server waar de backend draait.
- **Gebruiker bestaat**: In PocketBase Admin (zelfde URL als frontend) → Users → zoek op e-mail.
