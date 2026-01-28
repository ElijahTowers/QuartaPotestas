# Setup Published Editions Collection

## Stap 1: Maak de Collection aan in PocketBase

### Optie A: Via Setup Script (Aanbevolen)

```bash
cd backend
python setup_pocketbase_collections.py
```

Dit script maakt automatisch de `published_editions` collection aan met alle benodigde velden.

### Optie B: Handmatig via PocketBase Admin UI

1. Ga naar http://127.0.0.1:8090/_/
2. Login met je admin account
3. Ga naar "Collections" → "New Collection"
4. Naam: `published_editions`
5. Voeg de volgende velden toe:

#### Velden:

1. **user** (Relation)
   - Type: Relation
   - Collection: `users`
   - Required: ✓
   - Max select: 1

2. **date** (Date)
   - Type: Date
   - Required: ✓

3. **newspaper_name** (Text)
   - Type: Text
   - Required: ✗

4. **grid_layout** (JSON)
   - Type: JSON
   - Required: ✓

5. **stats** (JSON)
   - Type: JSON
   - Required: ✓

6. **published_at** (Date)
   - Type: Date
   - Required: ✓

### Stap 2: Configureer API Rules

In PocketBase Admin UI, ga naar de `published_editions` collection → "API Rules":

**List/Search:**
```
@request.auth.id != ""
```

**View:**
```
user = @request.auth.id
```

**Create:**
```
@request.auth.id != ""
```

**Update:**
```
user = @request.auth.id
```

**Delete:**
```
user = @request.auth.id
```

## Stap 3: Test

1. Start de backend: `cd backend && source venv/bin/activate && uvicorn app.main:app --reload`
2. Start de frontend: `cd frontend && npm run dev`
3. Login in de frontend
4. Maak een krant in de editor
5. Klik op "Publish"
6. De krant wordt nu opgeslagen in PocketBase!

## API Endpoints

### POST `/api/published-editions`
Publiceer een nieuwe editie.

**Request:**
```json
{
  "stats": {
    "cash": 5000,
    "credibility": 75,
    "readers": 15000
  },
  "placedItems": [...],
  "newspaper_name": "My Newspaper"
}
```

**Response:**
```json
{
  "id": "abc123",
  "user": "user_id",
  "date": "23-01-2026",
  "newspaper_name": "My Newspaper",
  "grid_layout": {...},
  "stats": {...},
  "published_at": "23-01-2026 14:30:00"
}
```

### GET `/api/published-editions`
Haal alle publicaties van de ingelogde gebruiker op.

**Response:**
```json
[
  {
    "id": "abc123",
    "user": "user_id",
    "date": "23-01-2026",
    "newspaper_name": "My Newspaper",
    ...
  },
  ...
]
```

### GET `/api/published-editions/{edition_id}`
Haal een specifieke publicatie op (alleen eigen publicaties).

## Volgende Stappen

- [ ] Voeg een "My Publications" pagina toe aan de frontend
- [ ] Toon publicatie geschiedenis
- [ ] Voeg mogelijkheid toe om publicaties te verwijderen
- [ ] Voeg leaderboard functionaliteit toe

