# Achievements Collection Setup

The achievements collection needs to be created manually in the PocketBase admin UI because the API doesn't properly save the schema.

## Steps:

1. Open PocketBase Admin UI (usually http://localhost:8090/_/)
2. Go to Collections
3. Click "New Collection"
4. Set Name: `achievements`
5. Set Type: `Base`
6. Click "Create"

## Add Fields:

After creating the collection, add these fields one by one:

1. **achievement_id** (Text)
   - Required: Yes
   - Unique: Yes
   - Presentable: Yes

2. **name** (Text)
   - Required: Yes
   - Presentable: Yes

3. **description** (Text)
   - Required: Yes

4. **category** (Select)
   - Required: Yes
   - Options: publishing, financial, readers, credibility, factions, shop, streaks, special, general
   - Presentable: Yes

5. **rarity** (Select)
   - Required: Yes
   - Options: common, uncommon, rare, epic, legendary
   - Presentable: Yes

6. **points** (Number)
   - Required: Yes
   - Presentable: Yes

## Set Permissions:

After adding fields, set all permissions to empty string (`""`) to allow admin access:
- List Rule: (empty)
- View Rule: (empty)
- Create Rule: (empty)
- Update Rule: (empty)
- Delete Rule: (empty)

## Populate Data:

After the collection is created with the schema, run:
```bash
python3 backend/create_achievements_collection.py
```

This will populate all 99 achievements.
