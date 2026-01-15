# Scripts

## reset_and_ingest.py

Delete today's articles and daily edition, then trigger a new ingestion.

**Usage:**
```bash
cd backend
python scripts/reset_and_ingest.py
```

Or if you're in the backend directory:
```bash
python scripts/reset_and_ingest.py
```

This script will:
1. Find today's daily edition
2. Delete all articles for that edition
3. Delete the daily edition
4. Trigger a new ingestion with fresh data from the RSS feed

