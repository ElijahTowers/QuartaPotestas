#!/usr/bin/env python3
"""
Script to manually create the system user for ingestion.
This can be run if the automatic creation fails.
"""
import os
import sys
import asyncio

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.pocketbase_client import PocketBaseClient


async def create_system_user():
    """Create the system user for ingestion"""
    pb_client = PocketBaseClient()
    
    # Get admin credentials from environment
    admin_email = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
    admin_password = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")
    
    if not admin_email or not admin_password:
        print("❌ ERROR: POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set in environment")
        print("   Set them in backend/.env file")
        return False
    
    print(f"🔐 Authenticating as admin: {admin_email}")
    authenticated = await pb_client.authenticate_admin(admin_email, admin_password)
    
    if not authenticated:
        print("❌ ERROR: Failed to authenticate with PocketBase admin credentials")
        return False
    
    print("✅ Admin authenticated successfully")
    
    # Check if system user already exists
    print("🔍 Checking for existing system user...")
    users = await pb_client.get_list(
        "users",
        filter='email = "system@ingestion.local"',
    )
    
    if users and len(users) > 0:
        user_id = users[0]["id"]
        print(f"✅ System user already exists: {user_id}")
        return True
    
    # Create system user
    print("📝 Creating system user...")
    system_user_data = {
        "email": "system@ingestion.local",
        "password": "system_password_change_me",
        "passwordConfirm": "system_password_change_me",
    }
    
    try:
        system_user = await pb_client.create_record("users", system_user_data)
        
        if not system_user:
            print("❌ ERROR: create_record returned None")
            return False
        
        user_id = system_user.get("id")
        if not user_id:
            print(f"❌ ERROR: System user created but no ID returned. Response: {system_user}")
            return False
        
        print(f"✅ System user created successfully!")
        print(f"   ID: {user_id}")
        print(f"   Email: system@ingestion.local")
        return True
        
    except Exception as e:
        print(f"❌ ERROR: Failed to create system user: {e}")
        return False
    finally:
        await pb_client.close()


if __name__ == "__main__":
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("👤 Create System User for Ingestion")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("")
    
    # Load environment variables from .env file
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"✅ Loaded environment from: {env_path}")
    else:
        print(f"⚠️  No .env file found at: {env_path}")
        print("   Using system environment variables")
    print("")
    
    success = asyncio.run(create_system_user())
    
    print("")
    if success:
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("✅ System user setup complete!")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        sys.exit(0)
    else:
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("❌ System user setup failed!")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        sys.exit(1)

