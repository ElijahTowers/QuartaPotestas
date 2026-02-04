#!/usr/bin/env python3
"""
Script to create the user_achievements collection in PocketBase.
This tracks which achievements each user has unlocked.
"""
import os
import sys
import asyncio

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.pocketbase_client import PocketBaseClient
from dotenv import load_dotenv

async def create_user_achievements_collection():
    """Create user_achievements collection"""
    pb_client = PocketBaseClient()
    
    # Get admin credentials from environment
    admin_email = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
    admin_password = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")
    
    if not admin_email or not admin_password:
        print("❌ ERROR: POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set in environment")
        return False
    
    print(f"🔐 Authenticating as admin: {admin_email}")
    authenticated = await pb_client.authenticate_admin(admin_email, admin_password)
    
    if not authenticated:
        print("❌ ERROR: Failed to authenticate with PocketBase admin credentials")
        return False
    
    print("✅ Admin authenticated successfully")
    print("")
    print("📦 Creating user_achievements collection...")
    print("")
    print("⚠️  Collection creation must be done manually in PocketBase admin UI")
    print("   Please create the collection with the following fields:")
    print("")
    print("   Collection Name: user_achievements")
    print("   Type: base")
    print("")
    print("   Fields:")
    print("   - user (relation, to: users, required)")
    print("   - achievement_id (text, required)")
    print("   - unlocked_at (date, required)")
    print("")
    print("   Indexes:")
    print("   - CREATE INDEX idx_user_achievement ON user_achievements (user, achievement_id)")
    print("")
    
    await pb_client.close()
    return True


if __name__ == "__main__":
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("🏆 Create User Achievements Collection")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("")
    
    # Load environment variables from .env file
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"✅ Loaded environment from: {env_path}")
    else:
        print(f"⚠️  No .env file found at: {env_path}")
        print("   Using system environment variables")
    print("")
    
    success = asyncio.run(create_user_achievements_collection())
    
    print("")
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

