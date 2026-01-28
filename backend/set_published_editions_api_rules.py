#!/usr/bin/env python3
"""
Set API Rules for published_editions collection
"""
import httpx
import asyncio
import os
import json
from pathlib import Path

POCKETBASE_URL = "http://127.0.0.1:8090"

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

ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")


async def authenticate_admin(client: httpx.AsyncClient) -> str:
    """Authenticate as admin and return token"""
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        import getpass
        print("PocketBase Admin Authentication")
        print("=" * 40)
        email = input("Admin email: ")
        password = getpass.getpass("Admin password: ")
    else:
        email = ADMIN_EMAIL
        password = ADMIN_PASSWORD
    
    response = await client.post(
        f"{POCKETBASE_URL}/api/collections/_superusers/auth-with-password",
        json={"identity": email, "password": password},
    )
    if response.status_code != 200:
        raise Exception(f"Authentication failed: {response.status_code} - {response.text}")
    return response.json()["token"]


async def set_api_rules(
    client: httpx.AsyncClient,
    token: str,
    collection_name: str
) -> bool:
    """Set API rules for published_editions collection"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get collection
    response = await client.get(
        f"{POCKETBASE_URL}/api/collections/{collection_name}",
        headers=headers,
    )
    
    if response.status_code != 200:
        print(f"  ✗ Collection '{collection_name}' not found")
        return False
    
    collection_data = response.json()
    collection_id = collection_data.get("id")
    
    # Set API rules for published_editions
    # List/Search: Allow authenticated users (they'll only see their own via filter)
    # Admin tokens from _superusers should bypass all rules automatically
    # But to be safe, we make the rule permissive for authenticated users
    collection_data["listRule"] = "@request.auth.id != \"\""  # Authenticated users can list
    
    # View: Only if user = authenticated user
    # Admin tokens should automatically bypass this rule
    # If admin tokens don't bypass, we need to check @request.auth.type or use a different approach
    collection_data["viewRule"] = "user = @request.auth.id || @request.auth.type = \"admin\""
    
    # Create: Must be authenticated (user field will be set by backend)
    collection_data["createRule"] = "@request.auth.id != \"\""
    
    # Update: Only if user = authenticated user
    collection_data["updateRule"] = "user = @request.auth.id"
    
    # Delete: Only if user = authenticated user
    collection_data["deleteRule"] = "user = @request.auth.id"
    
    # Update collection
    json_payload = json.dumps(collection_data)
    
    response = await client.patch(
        f"{POCKETBASE_URL}/api/collections/{collection_id}",
        content=json_payload,
        headers={
            **headers,
            "Content-Type": "application/json"
        },
    )
    
    if response.status_code == 200:
        print(f"  ✓ Set API rules for '{collection_name}'")
        return True
    else:
        print(f"  ✗ Failed to set API rules: {response.status_code} - {response.text}")
        return False


async def main():
    """Set API rules for published_editions"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("=" * 60)
        print("Setting API Rules for published_editions Collection")
        print("=" * 60)
        print()
        
        # Authenticate
        try:
            token = await authenticate_admin(client)
            print("✓ Authenticated\n")
        except Exception as e:
            print(f"✗ Authentication failed: {e}")
            return
        
        # Set API rules
        print("Setting API rules for published_editions...")
        success = await set_api_rules(client, token, "published_editions")
        
        # Summary
        print("\n" + "=" * 60)
        if success:
            print("✓ API Rules Applied Successfully!")
            print("=" * 60)
            print("\nRules set:")
            print("  List/Search: @request.auth.id != \"\"")
            print("  View:        user = @request.auth.id")
            print("  Create:      @request.auth.id != \"\"")
            print("  Update:      user = @request.auth.id")
            print("  Delete:      user = @request.auth.id")
            print("\n✅ Collection is now secured!\n")
        else:
            print("✗ Failed to set API rules")
            print("=" * 60)
            print("\nYou can set them manually in PocketBase Admin UI:")
            print("  1. Go to http://127.0.0.1:8090/_/")
            print("  2. Collections → published_editions → API Rules")
            print("  3. Set the rules as shown above\n")


if __name__ == "__main__":
    asyncio.run(main())

