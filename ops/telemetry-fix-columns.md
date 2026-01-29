# Fix Telemetry Columns in PocketBase UI

De velden zijn wel aanwezig in de data, maar PocketBase toont ze niet standaard als kolommen in de lijstweergave. Je moet ze handmatig toevoegen:

## Stappen om kolommen zichtbaar te maken:

1. **Open de telemetry collectie** in PocketBase Admin UI

2. **Klik op het instellingen-icoon** (tandwiel) rechtsboven in de collectie view

3. **Ga naar "List view" of "View options"**

4. **Selecteer de kolommen** die je wilt zien:
   - `path`
   - `country`
   - `city`
   - `device_type`
   - `browser`
   - `visitor_id`
   - `user_id`
   - `created`

5. **Sla op** - de kolommen zouden nu zichtbaar moeten zijn

## Alternatief: Via de API Preview

1. Klik op **"</> API Preview"** knop rechtsboven
2. Dit toont de raw JSON data met alle velden
3. Je kunt hier zien dat de data wel aanwezig is

## Verificatie

Na het toevoegen van de kolommen zou je moeten zien:
- **path**: `/hub`, `/editor`, etc.
- **country**: `NL` (of null op localhost)
- **city**: `Amsterdam` (of null op localhost)
- **device_type**: `Mobile` of `Desktop`
- **browser**: `Chrome 120`, `Safari 17`, etc.
- **visitor_id**: `visitor_...`
- **user_id**: `user_...` (alleen als ingelogd)

