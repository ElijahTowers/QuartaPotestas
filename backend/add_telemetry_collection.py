#!/usr/bin/env python3
"""
Script to create the telemetry collection in PocketBase for analytics.
Run this script to set up the telemetry collection.
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")

def get_admin_token():
    """Authenticate as admin and get token"""
    # PocketBase uses _superusers collection for admin auth
    response = requests.post(
        f"{POCKETBASE_URL}/api/collections/_superusers/auth-with-password",
        json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    if response.status_code != 200:
        raise Exception(f"Failed to authenticate: {response.text}")
    return response.json()["token"]

def create_telemetry_collection(token):
    """Create the telemetry collection"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Check if collection already exists
    response = requests.get(
        f"{POCKETBASE_URL}/api/collections",
        headers=headers,
    )
    collections = response.json().get("items", [])
    existing = next((c for c in collections if c["name"] == "telemetry"), None)
    
    if existing:
        print("✅ Telemetry collection already exists!")
        return existing["id"]
    
    # Create collection
    collection_data = {
        "name": "telemetry",
        "type": "base",
        "schema": [
            {
                "name": "visitor_id",
                "type": "text",
                "required": True,
                "presentable": True,
                "options": {"min": 1, "max": 100}
            },
            {
                "name": "path",
                "type": "text",
                "required": True,
                "presentable": True,
                "options": {"min": 1, "max": 500}
            },
            {
                "name": "country",
                "type": "text",
                "required": False,
                "presentable": True,
                "options": {"min": 0, "max": 10}
            },
            {
                "name": "city",
                "type": "text",
                "required": False,
                "presentable": True,
                "options": {"min": 0, "max": 100}
            },
            {
                "name": "device_type",
                "type": "text",
                "required": False,
                "presentable": True,
                "options": {"min": 0, "max": 50}
            },
            {
                "name": "browser",
                "type": "text",
                "required": False,
                "presentable": True,
                "options": {"min": 0, "max": 100}
            },
            {
                "name": "user_id",
                "type": "relation",
                "required": False,
                "presentable": True,
                "options": {
                    "collectionId": "_pb_users_auth_",
                    "cascadeDelete": False,
                    "minSelect": None,
                    "maxSelect": 1,
                    "displayFields": ["email"]
                }
            },
            {
                "name": "created",
                "type": "date",
                "required": False,
                "options": {}
            }
        ]
    }
    
    response = requests.post(
        f"{POCKETBASE_URL}/api/collections",
        headers=headers,
        json=collection_data,
    )
    
    if response.status_code != 200:
        raise Exception(f"Failed to create collection: {response.text}")
    
    collection_id = response.json()["id"]
    print(f"✅ Created telemetry collection with ID: {collection_id}")
    
    # Set API rules - allow anonymous creation for telemetry (needed for server actions)
    rules_data = {
        "listRule": "@request.auth.id != \"\"",
        "viewRule": "@request.auth.id != \"\"",
        "createRule": "",  # Empty string = allow anyone to create (needed for server actions)
        "updateRule": "@request.auth.id != \"\" || @request.auth.type = \"admin\"",
        "deleteRule": "@request.auth.type = \"admin\""
    }
    
    response = requests.patch(
        f"{POCKETBASE_URL}/api/collections/{collection_id}",
        headers=headers,
        json=rules_data,
    )
    
    if response.status_code != 200:
        print(f"⚠️  Warning: Failed to set API rules: {response.text}")
    else:
        print("✅ Set API rules for telemetry collection")
    
    return collection_id

if __name__ == "__main__":
    try:
        print("🔧 Creating telemetry collection...")
        token = get_admin_token()
        collection_id = create_telemetry_collection(token)
        print(f"\n✅ Success! Telemetry collection is ready.")
        print(f"   Collection ID: {collection_id}")
    except Exception as e:
        print(f"❌ Error: {e}")
        exit(1)

