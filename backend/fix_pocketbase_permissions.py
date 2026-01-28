#!/usr/bin/env python3
"""
Fix PocketBase collection permissions to allow admin access to all fields
"""
import asyncio
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from lib.pocketbase_client import PocketBaseClient

async def fix_permissions():
    """Fix collection permissions"""
    # Load .env
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        with open(env_file, "r") as f:
            for line in f:
                if '=' in line and not line.strip().startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value
    
    client = PocketBaseClient()
    email = os.getenv("POCKETBASE_ADMIN_EMAIL")
    password = os.getenv("POCKETBASE_ADMIN_PASSWORD")
    
    if not await client.authenticate_admin(email, password):
        print("Failed to authenticate")
        return
    
    # Get collection IDs by name
    collection_names = ["daily_editions", "articles", "ads"]
    
    print("\nUpdating collection permissions...")
    for collection_name in collection_names:
        # Get collection by name (we need to use the admin API)
        try:
            # Try to get collection info
            response = await client.client.get(f"/api/collections/{collection_name}")
            if response.status_code == 200:
                collection_data = response.json()
                collection_id = collection_data.get("id")
                
                # Update permissions to allow admin access
                # Set all API rules to allow authenticated users
                update_data = {
                    "options": {
                        "permissions": {
                            "list": {
                                "rule": "@request.auth.id != \"\"",
                                "allow": "auth"
                            },
                            "view": {
                                "rule": "@request.auth.id != \"\"",
                                "allow": "auth"
                            },
                            "create": {
                                "rule": "@request.auth.id != \"\"",
                                "allow": "auth"
                            },
                            "update": {
                                "rule": "@request.auth.id != \"\"",
                                "allow": "auth"
                            },
                            "delete": {
                                "rule": "@request.auth.id != \"\"",
                                "allow": "auth"
                            }
                        }
                    }
                }
                
                update_response = await client.client.patch(
                    f"/api/collections/{collection_id}",
                    json=update_data
                )
                
                if update_response.status_code == 200:
                    print(f"✓ Updated permissions for {collection_name}")
                else:
                    print(f"✗ Failed to update {collection_name}: {update_response.status_code} - {update_response.text}")
            else:
                print(f"✗ Could not find collection {collection_name}")
        except Exception as e:
            print(f"✗ Error updating {collection_name}: {e}")
    
    print("\n⚠️  If automatic update failed, adjust permissions manually:")
    print("1. Go to http://127.0.0.1:8090/_/")
    print("2. For each collection (daily_editions, articles, ads):")
    print("   - Go to Settings → API Rules")
    print("   - Set all rules to: @request.auth.id != \"\"")
    print("   - Or set to 'Public' for development")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(fix_permissions())

