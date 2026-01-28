# Database Aanbevelingen voor Quarta Potestas

## Huidige Status

### ✅ Wat er al is:
1. **`users`** - Gebruikers accounts
2. **`articles`** - Nieuws artikelen (scoops) met AI-varianten
3. **`daily_editions`** - Dagelijkse edities met artikelen
4. **`ads`** - Advertenties (nog niet volledig geïmplementeerd)

### ❌ Wat er ontbreekt:

## Aanbevelingen (in volgorde van prioriteit)

### 1. **`published_editions` Collection** ⭐ HOOGSTE PRIORITEIT
**Waarom:** Gebruikers kunnen kranten publiceren, maar deze worden niet opgeslagen.

**Velden:**
- `id` (auto)
- `user` (relation naar `users`)
- `date` (date) - Publicatiedatum
- `newspaper_name` (text) - Naam van de krant
- `grid_layout` (json) - De volledige grid layout (welke artikelen waar staan)
- `stats` (json) - Game statistieken:
  - `cash` (number)
  - `credibility` (number)
  - `readers` (number)
  - `outrage_meter` (number)
  - `faction_balance` (json) - { elite, populace, gov }
- `published_at` (datetime)
- `created` (datetime, auto)
- `updated` (datetime, auto)

**Gebruik:**
- Gebruikers kunnen hun gepubliceerde edities terugzien
- Leaderboards/rankings
- Geschiedenis van publicaties
- Analytics per gebruiker

---

### 2. **`submissions` Collection** ⭐ HOGE PRIORITEIT
**Waarom:** Gebruikers kunnen grids indienen voor scoring, maar dit wordt niet opgeslagen.

**Velden:**
- `id` (auto)
- `user` (relation naar `users`)
- `grid_layout` (json) - De grid layout (6 items: row1, row2, row3)
- `score` (number) - Berekenende score
- `sales` (number) - Verwachte verkoop
- `outrage_meter` (number)
- `faction_balance` (json)
- `submitted_at` (datetime)
- `created` (datetime, auto)
- `updated` (datetime, auto)

**Gebruik:**
- Gebruikers kunnen verschillende layouts proberen en vergelijken
- A/B testing van layouts
- Feedback systeem

---

### 3. **`user_stats` Collection** ⭐ MEDIUM PRIORITEIT
**Waarom:** Track gebruikersprogressie en statistieken over tijd.

**Velden:**
- `id` (auto)
- `user` (relation naar `users`, unique)
- `total_editions_published` (number, default: 0)
- `total_submissions` (number, default: 0)
- `best_score` (number, default: 0)
- `total_readers` (number, default: 0)
- `total_cash_earned` (number, default: 0)
- `average_credibility` (number, default: 0)
- `favorite_topics` (json) - Array van meest gebruikte topics
- `last_played` (datetime)
- `created` (datetime, auto)
- `updated` (datetime, auto)

**Gebruik:**
- Progressie tracking
- Achievements/badges systeem
- Personalisatie

---

### 4. **`game_sessions` Collection** ⭐ LAGE PRIORITEIT
**Waarom:** Track individuele speelsessies voor analytics.

**Velden:**
- `id` (auto)
- `user` (relation naar `users`)
- `started_at` (datetime)
- `ended_at` (datetime, nullable)
- `editions_created` (number, default: 0)
- `submissions_made` (number, default: 0)
- `session_duration` (number) - In seconden
- `created` (datetime, auto)

**Gebruik:**
- Analytics over speelgedrag
- Engagement metrics
- Optimalisatie van UX

---

### 5. **`leaderboard` Collection** ⭐ LAGE PRIORITEIT (of computed view)
**Waarom:** Rankings en competitie element.

**Opmerking:** Dit kan ook een computed view zijn op basis van `published_editions` en `user_stats`.

**Velden (als separate collection):**
- `id` (auto)
- `user` (relation naar `users`, unique)
- `rank` (number)
- `total_score` (number)
- `best_edition_id` (relation naar `published_editions`)
- `updated_at` (datetime)

---

## Implementatie Volgorde

### Fase 1: Core Gameplay (Nu)
1. ✅ `published_editions` - **BELANGRIJKST** - Zonder dit verliezen gebruikers hun werk
2. ✅ `submissions` - Gebruikers kunnen layouts testen en opslaan

### Fase 2: User Experience (Later)
3. `user_stats` - Progressie en personalisatie
4. `game_sessions` - Analytics

### Fase 3: Social/Competition (Toekomst)
5. `leaderboard` - Rankings
6. `comments` of `reviews` - Social features

---

## Technische Details

### PocketBase Schema Setup
Voor elke collection:
1. Maak collection in PocketBase admin UI
2. Voeg velden toe met juiste types
3. Stel API rules in:
   - **List/Search:** `@request.auth.id != ""` (alleen ingelogde users)
   - **View:** `user = @request.auth.id` (eigen records)
   - **Create:** `@request.auth.id != ""` (alleen ingelogde users)
   - **Update:** `user = @request.auth.id` (alleen eigen records)
   - **Delete:** `user = @request.auth.id` (alleen eigen records)

### Backend Implementation
- Update `backend/app/api/submissions.py` om naar PocketBase te schrijven
- Maak nieuwe `backend/app/api/published_editions.py` endpoint
- Update `frontend/lib/api.ts` om nieuwe endpoints te gebruiken

---

## Quick Win: Start met `published_editions`

Dit is de belangrijkste omdat:
- Gebruikers kunnen nu kranten publiceren maar verliezen ze
- Het is de core gameplay feature
- Relatief simpel om te implementeren
- Geeft directe waarde aan gebruikers

**Volgende stap:** Implementeer `published_editions` collection en endpoint.

