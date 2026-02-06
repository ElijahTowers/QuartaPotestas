"""
Authentication API endpoints for PocketBase user authentication
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
import os
import sys

# Add parent directory to path to import lib
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from lib.auth_service import AuthService
from lib.pocketbase_client import PocketBaseClient
from app.utils.date_format import format_datetime_dutch, format_date_dutch

router = APIRouter(prefix="/auth", tags=["auth"])

# Initialize auth service
_auth_service: Optional[AuthService] = None

# PocketBase admin client for game state (when user token cannot read/update users collection)
_pb_client: Optional[PocketBaseClient] = None


async def _get_pb_admin_client() -> PocketBaseClient:
    """Get PocketBase client authenticated as admin (for game state read/update on users collection)."""
    global _pb_client
    if _pb_client is None:
        _pb_client = PocketBaseClient(base_url=os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090"))
        admin_email = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
        admin_password = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")
        if not admin_email or not admin_password:
            raise HTTPException(
                status_code=500,
                detail="POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set for game state",
            )
        ok = await _pb_client.authenticate_admin(admin_email, admin_password)
        if not ok:
            raise HTTPException(status_code=500, detail="Failed to authenticate with PocketBase admin")
    return _pb_client


def get_auth_service() -> AuthService:
    """Get or create AuthService instance"""
    global _auth_service
    if _auth_service is None:
        pocketbase_url = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
        _auth_service = AuthService(base_url=pocketbase_url)
    return _auth_service


# Security scheme for Bearer token
# auto_error=False allows the dependency to return None if token is missing
security = HTTPBearer(auto_error=False)


# Request/Response Models
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    password_confirm: str


class RegisterResponse(BaseModel):
    id: str
    email: str
    created: Optional[str] = None
    updated: Optional[str] = None


class LoginRequest(BaseModel):
    identity: str  # Email or username
    password: str


class LoginResponse(BaseModel):
    token: str
    user: Dict[str, Any]


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    token: str
    password: str
    password_confirm: str

class DailyEditionCreate(BaseModel):
    date: str  # YYYY-MM-DD format
    global_mood: str  # String representation of mood


class DailyEditionResponse(BaseModel):
    id: str
    date: str
    global_mood: str
    user: str
    created: Optional[str] = None
    updated: Optional[str] = None


# Dependency to get current user from token
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    """
    Verify token and return current user info.
    Decodes the JWT token to extract user ID and other claims.
    """
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Decode JWT to get user info
    try:
        import base64
        import json
        
        # JWT format: header.payload.signature
        parts = token.split(".")
        if len(parts) < 2:
            raise ValueError("Invalid JWT format")
        
        # Decode payload (add padding if needed)
        payload = parts[1]
        payload += "=" * (4 - len(payload) % 4)  # Add padding
        decoded = base64.urlsafe_b64decode(payload)
        token_data = json.loads(decoded)
        
        # Extract user ID from token
        user_id = token_data.get("id") or token_data.get("userId")
        
        if not user_id:
            raise ValueError("User ID not found in token")
        
        # Try to get email from token first
        email = token_data.get("email")
        
        # Fetch user record from PocketBase to get email (prefer /api/users/me to avoid 404 on restricted users collection)
        if not email:
            try:
                import httpx
                pocketbase_url = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
                async with httpx.AsyncClient(base_url=pocketbase_url, timeout=5.0) as client:
                    response = await client.get(
                        "/api/users/me",
                        headers={"Authorization": f"Bearer {token}"},
                    )
                    if response.status_code != 200 and user_id:
                        response = await client.get(
                            f"/api/collections/users/records/{user_id}",
                            headers={"Authorization": f"Bearer {token}"},
                        )
                    if response.status_code == 200:
                        user_record = response.json()
                        email = user_record.get("email")
                    else:
                        print(f"[DEBUG get_current_user] Failed to fetch user: {response.status_code} - {response.text}")
            except Exception as e:
                print(f"[DEBUG get_current_user] Warning: Could not fetch user email: {e}")
        
        print(f"[DEBUG get_current_user] User ID: {user_id}, Email: {email}")
        
        return {
            "token": token,
            "id": user_id,
            "email": email,
            "token_data": token_data,  # Include full token data for debugging
        }
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# Helper to get auth headers from dependency
def get_auth_headers(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    """Get authentication headers from current user dependency"""
    token = current_user.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="No token available")
    return AuthService.get_authenticated_headers(token)


@router.get("/me")
async def get_me(
    current_user: Dict[str, Any] = Depends(get_current_user),
    headers: Dict[str, str] = Depends(get_auth_headers),
):
    """
    Return the current user record (from PocketBase /api/users/me).
    If PocketBase is unreachable or returns an error, return minimal user from token (id, email)
    so callers (e.g. monitor admin check) can still validate.
    """
    import httpx
    pocketbase_url = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
    try:
        async with httpx.AsyncClient(base_url=pocketbase_url, timeout=10.0) as client:
            response = await client.get("/api/users/me", headers=headers)
            if response.status_code == 200:
                return response.json()
            if response.status_code in (403, 404) and current_user.get("id"):
                fallback = await client.get(
                    f"/api/collections/users/records/{current_user['id']}",
                    headers=headers,
                )
                if fallback.status_code == 200:
                    return fallback.json()
    except HTTPException:
        raise
    except Exception as e:
        print(f"[auth/me] PocketBase fetch failed: {e}")
    # Fallback: return minimal user from token so admin check etc. still works
    return {
        "id": current_user.get("id"),
        "email": current_user.get("email"),
    }


@router.post("/register", response_model=RegisterResponse)
async def register(request: RegisterRequest):
    """
    Register a new user account.
    
    Returns the created user record.
    """
    auth = get_auth_service()
    
    try:
        user = await auth.register(
            email=request.email,
            password=request.password,
            password_confirm=request.password_confirm,
        )
        return RegisterResponse(
            id=user.get("id", ""),
            email=user.get("email", request.email),
            created=format_datetime_dutch(user.get("created")),
            updated=format_datetime_dutch(user.get("updated")),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Authenticate a user and get an access token.
    
    Returns the JWT token and user record.
    """
    auth = get_auth_service()
    
    try:
        token, user_record = await auth.login(
            identity=request.identity,
            password=request.password,
        )
        return LoginResponse(
            token=token,
            user=user_record,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")


@router.post("/request-password-reset")
async def request_password_reset(request: PasswordResetRequest):
    """
    Request a password reset email.

    Always returns success (even if the email does not exist) to prevent email enumeration.
    """
    auth = get_auth_service()

    try:
        # This method already hides whether the email exists (always returns True)
        await auth.request_password_reset(request.email)
        return {"success": True}
    except Exception as e:
        # Log server-side, but don't leak info to client
        print(f"[auth] Password reset request error for {request.email}: {e}")
        return {"success": True}


@router.post("/confirm-password-reset")
async def confirm_password_reset(request: PasswordResetConfirmRequest):
    """
    Confirm password reset with a token and new password.
    """
    auth = get_auth_service()

    try:
        await auth.confirm_password_reset(
            token=request.token,
            password=request.password,
            password_confirm=request.password_confirm,
        )
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Password reset failed: {str(e)}")


@router.post("/daily-editions", response_model=DailyEditionResponse)
async def create_daily_edition(
    edition: DailyEditionCreate,
    headers: Dict[str, str] = Depends(get_auth_headers),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Create a new daily edition (requires authentication).
    
    The edition will be linked to the authenticated user.
    """
    import httpx
    from datetime import date
    
    pocketbase_url = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
    
    # Get user ID from decoded token (already done in get_current_user)
    user_id = current_user.get("id")
    
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="User ID not found in token"
        )
    
    try:
        async with httpx.AsyncClient(base_url=pocketbase_url, timeout=30.0) as client:
            # Prepare payload with user link
            payload = {
                "date": edition.date,
                "global_mood": edition.global_mood,
                "user": user_id,  # Link to authenticated user
            }
            
            # Create daily edition
            response = await client.post(
                "/api/collections/daily_editions/records",
                json=payload,
                headers=headers,
            )
            
            if response.status_code == 200:
                edition_data = response.json()
                return DailyEditionResponse(
                    id=edition_data.get("id", ""),
                    date=format_date_dutch(edition_data.get("date", edition.date)),
                    global_mood=edition_data.get("global_mood", edition.global_mood),
                    user=edition_data.get("user", user_id),
                    created=format_datetime_dutch(edition_data.get("created")),
                    updated=format_datetime_dutch(edition_data.get("updated")),
                )
            else:
                error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                error_message = error_data.get("message", response.text)
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to create daily edition: {error_message}"
                )
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


class NewspaperNameRequest(BaseModel):
    newspaper_name: str


class NewspaperNameResponse(BaseModel):
    newspaper_name: str


class UsernameRequest(BaseModel):
    username: str


class UsernameResponse(BaseModel):
    username: str


@router.get("/newspaper-name", response_model=NewspaperNameResponse)
async def get_newspaper_name(
    current_user: Dict[str, Any] = Depends(get_current_user),
    headers: Dict[str, str] = Depends(get_auth_headers),
):
    """
    Get the current user's newspaper name.
    Requires authentication.
    """
    import httpx
    
    pocketbase_url = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
    user_id = current_user.get("id")
    
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="User ID not found in token"
        )
    
    try:
        async with httpx.AsyncClient(base_url=pocketbase_url, timeout=30.0) as client:
            # Get user record
            response = await client.get(
                f"/api/collections/users/records/{user_id}",
                headers=headers,
            )
            
            if response.status_code == 200:
                user_data = response.json()
                newspaper_name = user_data.get("newspaper_name", "THE DAILY DYSTOPIA")
                return NewspaperNameResponse(newspaper_name=newspaper_name)
            else:
                # If user doesn't have newspaper_name field, return default
                return NewspaperNameResponse(newspaper_name="THE DAILY DYSTOPIA")
                
    except Exception as e:
        # On error, return default
        return NewspaperNameResponse(newspaper_name="THE DAILY DYSTOPIA")


@router.put("/newspaper-name", response_model=NewspaperNameResponse)
async def update_newspaper_name(
    request: NewspaperNameRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    headers: Dict[str, str] = Depends(get_auth_headers),
):
    """
    Update the current user's newspaper name.
    Requires authentication.
    Enforces unique newspaper names across all users.
    """
    import httpx
    from urllib.parse import quote
    
    pocketbase_url = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
    user_id = current_user.get("id")
    
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="User ID not found in token"
        )
    
    # Sanitize input: trim whitespace and convert to uppercase
    new_name = request.newspaper_name.strip().upper()
    
    if not new_name:
        raise HTTPException(
            status_code=400,
            detail="Newspaper name cannot be empty"
        )
    
    if len(new_name) > 50:
        raise HTTPException(
            status_code=400,
            detail="Newspaper name cannot exceed 50 characters"
        )
    
    try:
        async with httpx.AsyncClient(base_url=pocketbase_url, timeout=30.0) as client:
            # Check for uniqueness: search for any OTHER user with this newspaper_name
            # We need to use admin auth to check other users' records
            # First, authenticate as admin
            admin_email = os.getenv("POCKETBASE_ADMIN_EMAIL", "admin@example.com")
            admin_password = os.getenv("POCKETBASE_ADMIN_PASSWORD", "admin")
            
            admin_auth_response = await client.post(
                "/api/collections/_superusers/auth-with-password",
                json={"identity": admin_email, "password": admin_password},
            )
            
            if admin_auth_response.status_code != 200:
                # If admin auth fails, fall back to user token (may have limited access)
                admin_headers = headers
            else:
                admin_token = admin_auth_response.json()["token"]
                admin_headers = {
                    "Authorization": f"Bearer {admin_token}",
                    "Content-Type": "application/json"
                }
            
            # URL-encode the filter to handle special characters
            filter_query = f'newspaper_name = "{new_name}" && id != "{user_id}"'
            encoded_filter = quote(filter_query)
            
            check_response = await client.get(
                f"/api/collections/users/records?filter={encoded_filter}&perPage=1",
                headers=admin_headers,
            )
            
            if check_response.status_code == 200:
                check_data = check_response.json()
                existing_users = check_data.get("items", [])
                
                if len(existing_users) > 0:
                    # Another user already has this name
                    raise HTTPException(
                        status_code=409,  # Conflict
                        detail="This newspaper name is already taken by another editor. Please choose a different name."
                    )
            elif check_response.status_code == 403:
                # Permission denied - user token doesn't have access to read other users
                # This is expected, so we'll use admin auth for the check
                # If admin auth also failed above, we need to be more strict
                error_text = check_response.text[:200] if check_response.text else "Permission denied"
                print(f"[WARNING] Uniqueness check permission denied: {error_text}")
                # Don't proceed if we can't verify uniqueness
                raise HTTPException(
                    status_code=500,
                    detail="Unable to verify newspaper name uniqueness. Please try again or contact support."
                )
            else:
                # Other error - log and fail safely
                error_text = check_response.text[:200] if check_response.text else "Unknown error"
                print(f"[ERROR] Uniqueness check failed (status {check_response.status_code}): {error_text}")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to verify newspaper name uniqueness. Please try again."
                )
            
            # No duplicate found, proceed with update
            response = await client.patch(
                f"/api/collections/users/records/{user_id}",
                json={"newspaper_name": new_name},
                headers=headers,
            )
            
            if response.status_code == 200:
                user_data = response.json()
                return NewspaperNameResponse(newspaper_name=user_data.get("newspaper_name", new_name))
            else:
                error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                error_message = error_data.get("message", response.text)
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to update newspaper name: {error_message}"
                )
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.get("/username", response_model=UsernameResponse)
async def get_username(
    current_user: Dict[str, Any] = Depends(get_current_user),
    headers: Dict[str, str] = Depends(get_auth_headers),
):
    """
    Get the current user's username.
    Requires authentication.
    """
    import httpx
    
    pocketbase_url = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
    user_id = current_user.get("id")
    
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="User ID not found in token"
        )
    
    try:
        async with httpx.AsyncClient(base_url=pocketbase_url, timeout=30.0) as client:
            # Get user record
            response = await client.get(
                f"/api/collections/users/records/{user_id}",
                headers=headers,
            )
            
            if response.status_code == 200:
                user_data = response.json()
                username = user_data.get("username", "")
                return UsernameResponse(username=username)
            else:
                # If user doesn't have username field, return empty
                return UsernameResponse(username="")
                
    except Exception as e:
        # On error, return empty
        return UsernameResponse(username="")


@router.put("/username", response_model=UsernameResponse)
async def update_username(
    request: UsernameRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    headers: Dict[str, str] = Depends(get_auth_headers),
):
    """
    Update the current user's username.
    Requires authentication.
    Enforces unique usernames across all users (case-insensitive).
    """
    import httpx
    from urllib.parse import quote
    
    pocketbase_url = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
    user_id = current_user.get("id")
    
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="User ID not found in token"
        )
    
    # Sanitize input: trim whitespace
    new_username = request.username.strip()
    
    # Validate username
    if not new_username:
        raise HTTPException(
            status_code=400,
            detail="Username cannot be empty"
        )
    
    if len(new_username) < 3:
        raise HTTPException(
            status_code=400,
            detail="Username must be at least 3 characters"
        )
    
    if len(new_username) > 30:
        raise HTTPException(
            status_code=400,
            detail="Username cannot exceed 30 characters"
        )
    
    # Only allow alphanumeric and underscores
    if not all(c.isalnum() or c == '_' for c in new_username):
        raise HTTPException(
            status_code=400,
            detail="Username can only contain letters, numbers, and underscores"
        )
    
    try:
        async with httpx.AsyncClient(base_url=pocketbase_url, timeout=30.0) as client:
            # Check for uniqueness: search for any OTHER user with this username (case-insensitive)
            # We need to use admin auth to check other users' records
            admin_email = os.getenv("POCKETBASE_ADMIN_EMAIL", "admin@example.com")
            admin_password = os.getenv("POCKETBASE_ADMIN_PASSWORD", "admin")
            
            admin_auth_response = await client.post(
                "/api/collections/_superusers/auth-with-password",
                json={"identity": admin_email, "password": admin_password},
            )
            
            if admin_auth_response.status_code != 200:
                # If admin auth fails, fall back to user token (may have limited access)
                admin_headers = headers
            else:
                admin_token = admin_auth_response.json()["token"]
                admin_headers = {
                    "Authorization": f"Bearer {admin_token}",
                    "Content-Type": "application/json"
                }
            
            # Check for duplicates (case-insensitive)
            # PocketBase doesn't have case-insensitive filter, so we'll fetch all and check in Python
            all_users_response = await client.get(
                "/api/collections/users/records?perPage=500",
                headers=admin_headers,
            )
            
            if all_users_response.status_code == 200:
                all_users = all_users_response.json().get("items", [])
                # Check if any other user has this username (case-insensitive)
                for user in all_users:
                    if user.get("id") != user_id:
                        existing_username = user.get("username", "").strip()
                        if existing_username.lower() == new_username.lower():
                            raise HTTPException(
                                status_code=409,  # Conflict
                                detail="This username is already taken. Please choose a different username."
                            )
            elif all_users_response.status_code == 403:
                # Permission denied - try with filter query instead
                # Use a filter that checks for exact match (case-sensitive as fallback)
                filter_query = f'username = "{new_username}" && id != "{user_id}"'
                encoded_filter = quote(filter_query)
                
                check_response = await client.get(
                    f"/api/collections/users/records?filter={encoded_filter}&perPage=1",
                    headers=admin_headers,
                )
                
                if check_response.status_code == 200:
                    check_data = check_response.json()
                    existing_users = check_data.get("items", [])
                    
                    if len(existing_users) > 0:
                        raise HTTPException(
                            status_code=409,
                            detail="This username is already taken. Please choose a different username."
                        )
                else:
                    # If check fails, don't proceed
                    raise HTTPException(
                        status_code=500,
                        detail="Unable to verify username uniqueness. Please try again or contact support."
                    )
            else:
                # Other error - log and fail safely
                error_text = all_users_response.text[:200] if all_users_response.text else "Unknown error"
                print(f"[ERROR] Username uniqueness check failed (status {all_users_response.status_code}): {error_text}")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to verify username uniqueness. Please try again."
                )
            
            # No duplicate found, proceed with update
            response = await client.patch(
                f"/api/collections/users/records/{user_id}",
                json={"username": new_username},
                headers=headers,
            )
            
            if response.status_code == 200:
                user_data = response.json()
                return UsernameResponse(username=user_data.get("username", new_username))
            else:
                error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                error_message = error_data.get("message", response.text)
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to update username: {error_message}"
                )
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


class GameStateResponse(BaseModel):
    treasury: float
    purchased_upgrades: list[str]
    readers: int
    credibility: float


class GameStateUpdateRequest(BaseModel):
    treasury: Optional[float] = None
    purchased_upgrades: Optional[list[str]] = None
    readers: Optional[int] = None
    credibility: Optional[float] = None


def _parse_game_state_from_user(user_data: dict) -> "GameStateResponse":
    """Extract game state fields from a PocketBase user record."""
    import json
    treasury = user_data.get("treasury", 0.0) or 0.0
    purchased_upgrades = user_data.get("purchased_upgrades", []) or []
    readers = user_data.get("readers", 0) or 0
    credibility = user_data.get("credibility", 0.0) or 0.0
    if isinstance(purchased_upgrades, str):
        try:
            purchased_upgrades = json.loads(purchased_upgrades)
        except Exception:
            purchased_upgrades = []
    return GameStateResponse(
        treasury=float(treasury),
        purchased_upgrades=purchased_upgrades if isinstance(purchased_upgrades, list) else [],
        readers=int(readers),
        credibility=float(credibility),
    )


async def _fetch_current_user_pb(
    client: "httpx.AsyncClient", headers: Dict[str, str], user_id_from_token: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Fetch current user record from PocketBase. Tries /users/me, then /records/@me, then /records/{id}."""
    for path in ["/api/users/me", "/api/collections/users/records/@me"]:
        try:
            r = await client.get(path, headers=headers)
            if r.status_code == 200:
                return r.json()
        except Exception:
            continue
    if user_id_from_token:
        try:
            r = await client.get(
                f"/api/collections/users/records/{user_id_from_token}",
                headers=headers,
            )
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
    return None


@router.get("/game-state", response_model=GameStateResponse)
async def get_game_state(
    current_user: Dict[str, Any] = Depends(get_current_user),
    headers: Dict[str, str] = Depends(get_auth_headers),
):
    """
    Get the current user's game state (treasury, purchased_upgrades, readers, credibility).
    Requires authentication. Tries user token first, then admin client to read users collection.
    """
    import httpx
    
    user_id = current_user.get("id")
    pocketbase_url = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
    
    try:
        async with httpx.AsyncClient(base_url=pocketbase_url, timeout=30.0) as client:
            user_data = await _fetch_current_user_pb(client, headers, user_id)
            if user_data:
                return _parse_game_state_from_user(user_data)
        # Fallback: admin client can read users collection
        if user_id:
            try:
                pb = await _get_pb_admin_client()
                user_data = await pb.get_record_by_id("users", user_id)
                if user_data:
                    return _parse_game_state_from_user(user_data)
            except HTTPException:
                raise
            except Exception:
                pass
    except HTTPException:
        raise
    except Exception:
        pass
    return GameStateResponse(treasury=0.0, purchased_upgrades=[], readers=0, credibility=0.0)


@router.put("/game-state", response_model=GameStateResponse)
async def update_game_state(
    request: GameStateUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    headers: Dict[str, str] = Depends(get_auth_headers),
):
    """
    Update the current user's game state (treasury, purchased_upgrades, readers, credibility).
    Requires authentication. Uses PocketBase admin client to update users collection (user token often has no update permission).
    """
    import json
    
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")
    
    update_payload = {}
    if request.treasury is not None:
        update_payload["treasury"] = request.treasury
    if request.purchased_upgrades is not None:
        update_payload["purchased_upgrades"] = json.dumps(request.purchased_upgrades)
    if request.readers is not None:
        update_payload["readers"] = request.readers
    if request.credibility is not None:
        update_payload["credibility"] = request.credibility
    
    if not update_payload:
        # No fields to update: return current state (same as get_game_state)
        return await get_game_state(current_user=current_user, headers=headers)
    
    try:
        pb = await _get_pb_admin_client()
        updated = await pb.update_record("users", user_id, update_payload)
        if updated:
            return _parse_game_state_from_user(updated)
        # update_record returned None (e.g. 404): try to return current state
        user_data = await pb.get_record_by_id("users", user_id)
        if user_data:
            return _parse_game_state_from_user(user_data)
        raise HTTPException(
            status_code=404,
            detail="Failed to update game state (user record not found)",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
