"""
PocketBase User Authentication Service

Handles user registration and login using PocketBase API.
"""
import httpx
import asyncio
from typing import Dict, Any, Optional, Tuple
from datetime import datetime


class AuthService:
    """Service for handling user authentication with PocketBase"""
    
    def __init__(self, base_url: str = "http://127.0.0.1:8090"):
        """
        Initialize the authentication service.
        
        Args:
            base_url: Base URL of the PocketBase instance
        """
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(base_url=base_url, timeout=30.0)
    
    async def register(
        self,
        email: str,
        password: str,
        password_confirm: str,
        **extra_fields
    ) -> Dict[str, Any]:
        """
        Register a new user account.
        
        Args:
            email: User's email address
            password: User's password
            password_confirm: Password confirmation (must match password)
            **extra_fields: Additional fields to include in registration
                           (e.g., name, avatar, etc.)
        
        Returns:
            Dictionary containing the created user record
        
        Raises:
            ValueError: If password and password_confirm don't match
            httpx.HTTPStatusError: If registration fails (e.g., email already exists)
        """
        # Validate password match
        if password != password_confirm:
            raise ValueError("Password and password confirmation do not match")
        
        # Validate password length (PocketBase default minimum is usually 8)
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters long")
        
        # Prepare registration payload
        payload = {
            "email": email,
            "password": password,
            "passwordConfirm": password_confirm,
            **extra_fields
        }
        
        try:
            response = await self.client.post(
                "/api/collections/users/records",
                json=payload,
            )
            
            # Raise exception for non-2xx status codes
            response.raise_for_status()
            
            # Return the created user record
            return response.json()
            
        except httpx.HTTPStatusError as e:
            # Handle validation errors
            if e.response.status_code == 400:
                error_data = e.response.json()
                error_message = error_data.get("message", "Registration failed")
                
                # Extract field-specific errors if available
                data = error_data.get("data", {})
                field_errors = []
                for field, error_info in data.items():
                    if isinstance(error_info, dict):
                        error_msg = error_info.get("message", str(error_info))
                        field_errors.append(f"{field}: {error_msg}")
                
                if field_errors:
                    error_message = f"{error_message}. Details: {', '.join(field_errors)}"
                
                raise ValueError(f"Registration failed: {error_message}") from e
            else:
                # Re-raise for other HTTP errors
                raise
    
    async def login(
        self,
        identity: str,
        password: str
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Authenticate a user and get an access token.
        
        Args:
            identity: User's email address or username
            password: User's password
        
        Returns:
            Tuple of (token, user_record):
            - token: JWT token for authenticated requests
            - user_record: User model data from PocketBase
        
        Raises:
            ValueError: If credentials are invalid (400 status)
            httpx.HTTPStatusError: For other HTTP errors
        """
        payload = {
            "identity": identity,
            "password": password
        }
        
        try:
            response = await self.client.post(
                "/api/collections/users/auth-with-password",
                json=payload,
            )
            
            # Raise exception for non-2xx status codes
            response.raise_for_status()
            
            data = response.json()
            
            # Extract token and user model
            token = data.get("token")
            user = data.get("record", {})
            
            if not token:
                raise ValueError("Authentication succeeded but no token received")
            
            return token, user
            
        except httpx.HTTPStatusError as e:
            # Handle authentication errors
            if e.response.status_code == 400:
                error_data = e.response.json()
                error_message = error_data.get("message", "Invalid email or password")
                raise ValueError(f"Login failed: {error_message}") from e
            else:
                # Re-raise for other HTTP errors
                raise
    
    async def logout(self, token: str) -> bool:
        """
        Logout a user (clear their session).
        
        Args:
            token: JWT token to invalidate
        
        Returns:
            True if logout was successful
        """
        headers = {"Authorization": f"Bearer {token}"}
        
        try:
            response = await self.client.post(
                "/api/auth/logout",
                headers=headers,
            )
            response.raise_for_status()
            return True
        except httpx.HTTPStatusError:
            # Logout might fail if token is already invalid, which is fine
            return False
    
    async def get_current_user(self, token: str) -> Dict[str, Any]:
        """
        Get the current authenticated user's information.
        
        Args:
            token: JWT token
        
        Returns:
            User record dictionary
        
        Raises:
            ValueError: If token is invalid or expired
        """
        headers = {"Authorization": f"Bearer {token}"}
        
        try:
            response = await self.client.get(
                "/api/collections/users/records/@me",
                headers=headers,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise ValueError("Invalid or expired token") from e
            raise
    
    async def refresh_token(self, token: str) -> Tuple[str, Dict[str, Any]]:
        """
        Refresh an existing JWT token.
        
        Args:
            token: Current JWT token
        
        Returns:
            Tuple of (new_token, user_record)
        
        Raises:
            ValueError: If token is invalid or expired
        """
        headers = {"Authorization": f"Bearer {token}"}
        
        try:
            response = await self.client.post(
                "/api/collections/users/auth-refresh",
                headers=headers,
            )
            response.raise_for_status()
            
            data = response.json()
            new_token = data.get("token")
            user = data.get("record", {})
            
            if not new_token:
                raise ValueError("Token refresh succeeded but no token received")
            
            return new_token, user
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise ValueError("Invalid or expired token") from e
            raise
    
    async def request_password_reset(self, email: str) -> bool:
        """
        Request a password reset email.
        
        Args:
            email: User's email address
        
        Returns:
            True if request was successful
        """
        payload = {"email": email}
        
        try:
            response = await self.client.post(
                "/api/collections/users/request-password-reset",
                json=payload,
            )
            response.raise_for_status()
            return True
        except httpx.HTTPStatusError:
            # Don't reveal if email exists or not (security best practice)
            return True  # Always return True to prevent email enumeration
    
    async def confirm_password_reset(
        self,
        token: str,
        password: str,
        password_confirm: str
    ) -> bool:
        """
        Confirm password reset with a token.
        
        Args:
            token: Password reset token from email
            password: New password
            password_confirm: Password confirmation
        
        Returns:
            True if password was reset successfully
        
        Raises:
            ValueError: If passwords don't match or token is invalid
        """
        if password != password_confirm:
            raise ValueError("Password and password confirmation do not match")
        
        payload = {
            "token": token,
            "password": password,
            "passwordConfirm": password_confirm
        }
        
        try:
            response = await self.client.post(
                "/api/collections/users/confirm-password-reset",
                json=payload,
            )
            response.raise_for_status()
            return True
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 400:
                error_data = e.response.json()
                error_message = error_data.get("message", "Password reset failed")
                raise ValueError(f"Password reset failed: {error_message}") from e
            raise
    
    @staticmethod
    def get_authenticated_headers(token: str) -> Dict[str, str]:
        """
        Helper method to get authenticated headers for API requests.
        
        Args:
            token: JWT authentication token
            
        Returns:
            Dictionary with Authorization header: {"Authorization": f"Bearer {token}"}
        """
        return {"Authorization": f"Bearer {token}"}
    
    async def close(self):
        """Close the HTTP client connection."""
        await self.client.aclose()
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()


async def main():
    """Example usage of AuthService"""
    
    # Initialize the auth service
    auth = AuthService(base_url="http://127.0.0.1:8090")
    
    try:
        # Example: Register a new user
        print("=" * 60)
        print("Example: User Registration")
        print("=" * 60)
        
        # Use timestamp to create unique test user
        import time
        timestamp = int(time.time())
        test_email = f"testuser{timestamp}@example.com"
        test_password = "testpassword123"
        
        try:
            user = await auth.register(
                email=test_email,
                password=test_password,
                password_confirm=test_password,
            )
            print(f"✅ User registered successfully!")
            print(f"   User ID: {user.get('id')}")
            print(f"   Email: {user.get('email')}")
        except ValueError as e:
            if "already exists" in str(e).lower() or "unique" in str(e).lower():
                print(f"⚠️  User '{test_email}' already exists, proceeding with login...")
            else:
                print(f"❌ Registration failed: {e}")
                return
        
        # Example: Login
        print("\n" + "=" * 60)
        print("Example: User Login")
        print("=" * 60)
        
        try:
            token, user_record = await auth.login(
                identity=test_email,
                password=test_password,
            )
            print(f"✅ Login successful!")
            print(f"   Token: {token[:50]}...")
            print(f"   User ID: {user_record.get('id')}")
            print(f"   Email: {user_record.get('email')}")
            
            # Example: Get authenticated headers
            print("\n" + "=" * 60)
            print("Example: Get Authenticated Headers")
            print("=" * 60)
            headers = AuthService.get_authenticated_headers(token)
            print(f"✅ Headers: {headers}")
            print(f"   Use these headers for authenticated API requests:")
            print(f"   Example: client.get('/api/endpoint', headers=headers)")
            
        except ValueError as e:
            print(f"❌ Login failed: {e}")
        
    finally:
        # Clean up
        await auth.close()


if __name__ == "__main__":
    asyncio.run(main())

