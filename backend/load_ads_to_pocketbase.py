#!/usr/bin/env python3
"""
Script to load ads from ads.json into PocketBase
"""
import asyncio
import httpx
import json
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from lib.pocketbase_client import PocketBaseClient

POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")

# Try to load from .env file if it exists
def load_env_file():
    """Load environment variables from .env file"""
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        with open(env_file, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ[key.strip()] = value.strip()

load_env_file()


async def load_ads_to_pocketbase():
    """Load ads from ads.json into PocketBase"""
    print("=" * 60)
    print("Load Ads to PocketBase")
    print("=" * 60)
    print()
    
    # Load ads from JSON file
    ads_path = Path(__file__).parent / "app" / "data" / "ads.json"
    
    if not ads_path.exists():
        print(f"✗ ads.json not found at: {ads_path}")
        return
    
    try:
        with open(ads_path, "r") as f:
            ads_data = json.load(f)
        print(f"✓ Loaded {len(ads_data)} ads from ads.json\n")
    except Exception as e:
        print(f"✗ Failed to load ads.json: {e}")
        return
    
    # Initialize PocketBase client
    pb_client = PocketBaseClient(POCKETBASE_URL)
    
    # Authenticate
    admin_email = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
    admin_password = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")
    
    if not admin_email or not admin_password:
        print("✗ POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set")
        print("  Set them in .env file or environment variables")
        return
    
    print("Authenticating with PocketBase...")
    authenticated = await pb_client.authenticate_admin(admin_email, admin_password)
    
    if not authenticated:
        print("✗ Failed to authenticate with PocketBase")
        return
    
    print("✓ Authenticated successfully\n")
    
    # Check existing ads
    print("Checking existing ads in PocketBase...")
    existing_ads = await pb_client.get_list("ads", per_page=100)
    print(f"  Found {len(existing_ads)} existing ads\n")
    
    # Delete existing ads if any
    if existing_ads:
        print(f"Deleting {len(existing_ads)} existing ads...")
        for ad in existing_ads:
            try:
                await pb_client.delete_record("ads", ad["id"])
            except Exception as e:
                print(f"  ⚠ Failed to delete ad {ad.get('id', 'unknown')}: {e}")
        print("✓ Deleted existing ads\n")
    
    # Create new ads
    print(f"Creating {len(ads_data)} ads in PocketBase...\n")
    created_count = 0
    failed_count = 0
    
    for ad_data in ads_data:
        try:
            # Prepare data for PocketBase (remove id, convert tags to JSON string)
            # Use tagline as headline and description as body if those fields are required
            company = ad_data.get("company", "")
            tagline = ad_data.get("tagline", "")
            description = ad_data.get("description", "")
            
            pb_data = {
                "company": company,
                "tagline": tagline,
                "description": description,
                "tags": json.dumps(ad_data.get("tags", [])),  # Convert to JSON string
            }
            
            # Add headline and body if they exist in the collection schema
            # Use tagline as headline and description as body
            pb_data["headline"] = tagline  # Use tagline as headline
            pb_data["body"] = description   # Use description as body
            
            # Create record
            created_ad = await pb_client.create_record("ads", pb_data)
            
            if created_ad:
                created_count += 1
                print(f"  ✓ Created: {ad_data.get('company', 'Unknown')}")
            else:
                failed_count += 1
                print(f"  ✗ Failed: {ad_data.get('company', 'Unknown')}")
        except Exception as e:
            failed_count += 1
            print(f"  ✗ Error creating {ad_data.get('company', 'Unknown')}: {e}")
    
    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"  Created: {created_count}")
    print(f"  Failed: {failed_count}")
    print(f"  Total: {len(ads_data)}")
    
    if created_count > 0:
        print("\n✓ Ads successfully loaded into PocketBase!")
    else:
        print("\n✗ No ads were created. Check errors above.")
    print()


if __name__ == "__main__":
    asyncio.run(load_ads_to_pocketbase())

