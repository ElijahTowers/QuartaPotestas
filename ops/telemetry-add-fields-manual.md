# Handmatig Velden Toevoegen aan Telemetry Collectie

De velden moeten handmatig worden toegevoegd via de PocketBase Admin UI.

## Stappen:

1. **Open PocketBase Admin UI:**
   - Ga naar: `http://localhost:8090/_/`
   - Login met je admin credentials

2. **Open de telemetry collectie:**
   - Klik op `telemetry` in de linker sidebar

3. **Open Settings:**
   - Klik op het **tandwiel-icoon** (⚙️) rechtsboven

4. **Ga naar "Fields" tab:**
   - Klik op de **"Fields"** tab in de settings

5. **Voeg de volgende velden toe** (klik op "+ New field" voor elk):

   **Field 1: visitor_id**
   - Name: `visitor_id`
   - Type: `Text`
   - Required: ✅ **Yes**
   - Options:
     - Min length: `1`
     - Max length: `100`

   **Field 2: path**
   - Name: `path`
   - Type: `Text`
   - Required: ✅ **Yes**
   - Options:
     - Min length: `1`
     - Max length: `500`

   **Field 3: country**
   - Name: `country`
   - Type: `Text`
   - Required: ❌ **No**
   - Options:
     - Min length: `0`
     - Max length: `10`

   **Field 4: city**
   - Name: `city`
   - Type: `Text`
   - Required: ❌ **No**
   - Options:
     - Min length: `0`
     - Max length: `100`

   **Field 5: device_type**
   - Name: `device_type`
   - Type: `Text`
   - Required: ❌ **No**
   - Options:
     - Min length: `0`
     - Max length: `50`

   **Field 6: browser**
   - Name: `browser`
   - Type: `Text`
   - Required: ❌ **No**
   - Options:
     - Min length: `0`
     - Max length: `100`

   **Field 7: user_id**
   - Name: `user_id`
   - Type: `Relation`
   - Required: ❌ **No**
   - Options:
     - Collection: `users` (select from dropdown)
     - Max select: `1`
     - Display fields: `email`
     - Cascade delete: ❌ **No**

6. **Sla op** na het toevoegen van elk veld

7. **Test:**
   - Bezoek een pagina op je site
   - Check de telemetry collectie
   - Je zou nu alle kolommen moeten zien!

## Na het toevoegen van velden:

- Oude records hebben deze velden niet (ze zijn leeg)
- Nieuwe records die worden aangemaakt hebben alle velden ingevuld
- Je kunt de oude records verwijderen als je wilt

## Kolommen zichtbaar maken:

Na het toevoegen van de velden:
1. Klik op het **tandwiel-icoon** (⚙️) rechtsboven
2. Ga naar **"List view"** of **"View options"**
3. Selecteer alle kolommen die je wilt zien
4. Sla op

Nu zou je alle kolommen moeten zien: `path`, `country`, `city`, `device_type`, `browser`, etc.

