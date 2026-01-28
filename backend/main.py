#!/usr/bin/env python3
"""
Main Application Loop - Interactive CLI for PocketBase User Flow

Demonstrates user registration, login, and authenticated data operations.
"""
import asyncio
import httpx
from datetime import date
from typing import Optional, Dict, Any
import sys
import os

# Add lib directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.auth_service import AuthService

# Configuration
POCKETBASE_URL = "http://127.0.0.1:8090"

# Global state
current_token: Optional[str] = None
current_user: Optional[Dict[str, Any]] = None


def print_header(title: str):
    """Print a formatted header"""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_menu(options: list[str]):
    """Print a formatted menu"""
    print()
    for i, option in enumerate(options, 1):
        print(f"  {i}. {option}")
    print()


async def get_user_input(prompt: str, password: bool = False) -> str:
    """Get user input with optional password masking"""
    if password:
        import getpass
        return getpass.getpass(prompt)
    return input(prompt).strip()


async def register_user(auth: AuthService) -> bool:
    """Register a new user"""
    print_header("User Registration")
    
    email = await get_user_input("Email: ")
    if not email:
        print("❌ Email is required")
        return False
    
    password = await get_user_input("Password: ", password=True)
    if not password:
        print("❌ Password is required")
        return False
    
    password_confirm = await get_user_input("Confirm Password: ", password=True)
    
    try:
        user = await auth.register(
            email=email,
            password=password,
            password_confirm=password_confirm,
        )
        print(f"\n✅ Registration successful!")
        print(f"   User ID: {user.get('id')}")
        print(f"   Email: {user.get('email', email)}")
        return True
    except ValueError as e:
        print(f"\n❌ Registration failed: {e}")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return False


async def login_user(auth: AuthService) -> bool:
    """Login a user and store token/user"""
    global current_token, current_user
    
    print_header("User Login")
    
    identity = await get_user_input("Email/Username: ")
    if not identity:
        print("❌ Email/Username is required")
        return False
    
    password = await get_user_input("Password: ", password=True)
    if not password:
        print("❌ Password is required")
        return False
    
    try:
        token, user_record = await auth.login(
            identity=identity,
            password=password,
        )
        
        # Store token and user
        current_token = token
        current_user = user_record
        
        print(f"\n✅ Login successful!")
        print(f"   User ID: {user_record.get('id')}")
        print(f"   Email: {user_record.get('email', identity)}")
        print(f"   Token: {token[:50]}...")
        
        return True
    except ValueError as e:
        print(f"\n❌ Login failed: {e}")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return False


async def add_daily_edition() -> bool:
    """Add a new daily edition (requires authentication)"""
    global current_token, current_user
    
    if not current_token or not current_user:
        print("❌ You must be logged in to add a daily edition")
        return False
    
    print_header("Add Daily Edition")
    
    # Get user input for global_mood
    mood_input = await get_user_input("Global Mood (integer, e.g., 1-10): ")
    try:
        global_mood = int(mood_input)
    except ValueError:
        print("❌ Global mood must be an integer")
        return False
    
    # Get current date
    today = date.today()
    
    # Prepare payload
    payload = {
        "date": today.isoformat(),
        "global_mood": str(global_mood),  # PocketBase might expect string
        "user": current_user.get("id"),  # Link to logged-in user
    }
    
    print(f"\n📝 Creating daily edition...")
    print(f"   Date: {today.isoformat()}")
    print(f"   Global Mood: {global_mood}")
    print(f"   User ID: {current_user.get('id')}")
    
    try:
        # Make authenticated request
        headers = AuthService.get_authenticated_headers(current_token)
        
        async with httpx.AsyncClient(base_url=POCKETBASE_URL, timeout=30.0) as client:
            response = await client.post(
                "/api/collections/daily_editions/records",
                json=payload,
                headers=headers,
            )
            
            if response.status_code == 200:
                edition = response.json()
                print(f"\n✅ Daily edition created successfully!")
                print(f"   Edition ID: {edition.get('id')}")
                print(f"   Date: {edition.get('date')}")
                print(f"   Global Mood: {edition.get('global_mood')}")
                return True
            else:
                error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                error_message = error_data.get("message", response.text)
                print(f"\n❌ Failed to create daily edition: {error_message}")
                print(f"   Status: {response.status_code}")
                if error_data.get("data"):
                    print(f"   Details: {error_data.get('data')}")
                return False
                
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return False


async def logout():
    """Logout the current user"""
    global current_token, current_user
    
    current_token = None
    current_user = None
    print("\n✅ Logged out successfully")


async def main_menu(auth: AuthService):
    """Main menu loop (when not logged in)"""
    while True:
        print_header("Main Menu")
        print_menu([
            "Register",
            "Login",
            "Quit"
        ])
        
        choice = await get_user_input("Select an option: ")
        
        if choice == "1":
            await register_user(auth)
        elif choice == "2":
            success = await login_user(auth)
            if success:
                # Switch to user menu
                await user_menu(auth)
        elif choice == "3" or choice.lower() == "q":
            print("\n👋 Goodbye!")
            break
        else:
            print("❌ Invalid option. Please try again.")


async def user_menu(auth: AuthService):
    """User menu loop (when logged in)"""
    global current_user
    
    while current_token and current_user:
        user_email = current_user.get("email", "User")
        print_header(f"Welcome, {user_email}!")
        print_menu([
            "Add Daily Edition",
            "Logout"
        ])
        
        choice = await get_user_input("Select an option: ")
        
        if choice == "1":
            await add_daily_edition()
        elif choice == "2" or choice.lower() == "q":
            await logout()
            break
        else:
            print("❌ Invalid option. Please try again.")


async def main():
    """Main application entry point"""
    print_header("PocketBase User Flow Demo")
    print("This application demonstrates user authentication and data operations.")
    
    # Initialize auth service
    auth = AuthService(base_url=POCKETBASE_URL)
    
    try:
        await main_menu(auth)
    except KeyboardInterrupt:
        print("\n\n👋 Interrupted by user. Goodbye!")
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await auth.close()


if __name__ == "__main__":
    asyncio.run(main())

