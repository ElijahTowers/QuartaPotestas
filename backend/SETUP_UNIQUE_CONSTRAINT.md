# Setup Unique Constraint for Articles Collection

To prevent duplicate articles from being created, you should add a unique constraint on the `original_title` field in the `articles` collection.

## Manual Setup in PocketBase Admin UI

1. **Open PocketBase Admin UI**: http://localhost:8090/_/

2. **Navigate to Collections**:
   - Click on "Collections" in the sidebar
   - Find and click on the "articles" collection

3. **Edit the `original_title` field**:
   - Find the `original_title` field in the fields list
   - Click on it to edit

4. **Add Unique Constraint**:
   - Check the "Unique" checkbox
   - Save the field

5. **Verify**:
   - Try to create a duplicate article manually to verify the constraint works

## Alternative: Use the Script

The ingestion service now automatically checks for duplicates before creating articles, so the unique constraint is optional but recommended for database-level enforcement.

## Notes

- The unique constraint will prevent duplicate articles at the database level
- The ingestion service also checks for duplicates before creating (application-level check)
- Both checks work together for maximum protection
- If you have existing duplicates, run `backend/remove_duplicate_articles.py` first

