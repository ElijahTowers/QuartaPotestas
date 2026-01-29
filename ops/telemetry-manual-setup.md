# Manual Telemetry Collection Setup

Since the automated script may have issues, here's how to create the telemetry collection manually in PocketBase Admin UI:

## Steps

1. **Open PocketBase Admin UI:**
   - Go to: `http://localhost:8090/_/` (or `https://db.quartapotestas.com/_/` if using tunnel)
   - Login with your admin credentials

2. **Create New Collection:**
   - Click **"New collection"** button (top right)
   - Name: `telemetry`
   - Type: `Base`
   - Click **"Create"**

3. **Add Fields:**

   **Field 1: visitor_id**
   - Name: `visitor_id`
   - Type: `Text`
   - Required: ✅ Yes
   - Options:
     - Min: `1`
     - Max: `100`

   **Field 2: path**
   - Name: `path`
   - Type: `Text`
   - Required: ✅ Yes
   - Options:
     - Min: `1`
     - Max: `500`

   **Field 3: country**
   - Name: `country`
   - Type: `Text`
   - Required: ❌ No
   - Options:
     - Min: `0`
     - Max: `10`

   **Field 4: city**
   - Name: `city`
   - Type: `Text`
   - Required: ❌ No
   - Options:
     - Min: `0`
     - Max: `100`

   **Field 5: device_type**
   - Name: `device_type`
   - Type: `Text`
   - Required: ❌ No
   - Options:
     - Min: `0`
     - Max: `50`

   **Field 6: browser**
   - Name: `browser`
   - Type: `Text`
   - Required: ❌ No
   - Options:
     - Min: `0`
     - Max: `100`

   **Field 7: user_id**
   - Name: `user_id`
   - Type: `Relation`
   - Required: ❌ No
   - Options:
     - Collection: `users` (select from dropdown)
     - Max select: `1`
     - Display fields: `email`
     - Cascade delete: ❌ No

   **Field 8: created** (usually auto-created)
   - This field is usually created automatically by PocketBase
   - If not present, add as:
     - Name: `created`
     - Type: `Date`
     - Required: ❌ No

4. **Set API Rules:**
   - Go to **Settings** tab in the collection
   - Set the following rules:

   **List Rule:**
   ```
   @request.auth.id != ""
   ```

   **View Rule:**
   ```
   @request.auth.id != ""
   ```

   **Create Rule:**
   ```
   @request.auth.id != "" || @request.auth.type = "admin"
   ```
   *(This allows anonymous tracking via server actions)*

   **Update Rule:**
   ```
   @request.auth.id != "" || @request.auth.type = "admin"
   ```

   **Delete Rule:**
   ```
   @request.auth.type = "admin"
   ```

5. **Save and Test:**
   - Click **"Save"**
   - The collection is now ready!
   - Visit any page on your site to test
   - Check the `telemetry` collection to see records appear

## Quick Verification

After setup, visit a page on your site and check the `telemetry` collection. You should see a new record with:
- `path`: The page you visited (e.g., `/hub`)
- `country`: Your country code (e.g., `NL`)
- `device_type`: `Mobile` or `Desktop`
- `browser`: Your browser (e.g., `Chrome 120`)

