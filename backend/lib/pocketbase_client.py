"""
PocketBase Python client for backend services
"""

import httpx
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, date


class PocketBaseClient:
    def __init__(self, base_url: str = "http://127.0.0.1:8090"):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(base_url=base_url, timeout=30.0)
        self.admin_token: Optional[str] = None

    async def _get_user_by_email(self, email: str, password: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Fetch a user record by email (for get-or-create when create fails with unique)."""
        try:
            email_clean = email.strip()
            # 1. Try list with filter (admin token)
            if self.admin_token:
                headers = {"Authorization": f"Bearer {self.admin_token}"}
                for filter_val in [f'email = "{email_clean}"', f"email = '{email_clean}'"]:
                    r = await self.client.get(
                        "/api/collections/users/records",
                        params={"filter": filter_val, "perPage": 1},
                        headers=headers,
                    )
                    if r.status_code == 200:
                        data = r.json()
                        items = (data.get("items") or []) if isinstance(data, dict) else []
                        if items and (str(items[0].get("email") or "")).strip() == email_clean:
                            return items[0]
                # 2. Fallback: list all and filter
                r = await self.client.get(
                    "/api/collections/users/records",
                    params={"perPage": 500},
                    headers=headers,
                )
                if r.status_code == 200:
                    data = r.json()
                    items = (data.get("items") or []) if isinstance(data, dict) else []
                    for u in items:
                        if (str(u.get("email") or "").strip() == email_clean):
                            return u
            # 3. Fallback: auth-with-password (works when list is forbidden - returns user record)
            if password:
                auth_r = await self.client.post(
                    "/api/collections/users/auth-with-password",
                    json={"identity": email_clean, "password": password},
                )
                if auth_r.status_code == 200:
                    data = auth_r.json()
                    user = data.get("record") or data.get("user") or data
                    if user and user.get("email"):
                        return user if isinstance(user, dict) else None
            return None
        except Exception as e:
            print(f"DEBUG _get_user_by_email: {e}")
            return None

    async def authenticate_admin(self, email: str, password: str) -> bool:
        """Authenticate as admin/superuser"""
        try:
            # PocketBase 0.36.1 uses _superusers collection for admin auth
            response = await self.client.post(
                "/api/collections/_superusers/auth-with-password",
                json={"identity": email, "password": password},
            )
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get("token")
                if self.admin_token:
                    auth_header = f"Bearer {self.admin_token}"
                    # Don't set global headers - set per request instead
                    # self.client.headers.update({"Authorization": auth_header})
                    print(f"DEBUG: Admin authenticated successfully. Token length: {len(self.admin_token)}")
                    print(f"DEBUG: Authorization header will be set per request: {auth_header[:50]}...")
                    return True
                else:
                    print("ERROR: No token in authentication response")
                    return False
            else:
                print(f"Admin authentication failed: {response.status_code} - {response.text}")
            return False
        except Exception as e:
            print(f"Admin authentication failed: {e}")
            return False

    async def create_record(
        self, collection: str, data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Create a new record in a collection"""
        try:
            # Ensure Authorization header is set
            headers = {}
            if self.admin_token:
                headers["Authorization"] = f"Bearer {self.admin_token}"
            else:
                print(f"WARNING: No admin token available for creating record in {collection}")
            
            # Use collection API (admin API may not exist in 0.36.1)
            response = await self.client.post(
                f"/api/collections/{collection}/records",
                json=data,
                headers=headers,
            )
            if response.status_code == 200:
                return response.json()
            else:
                error_text = response.text
                # User already exists (email unique) - fetch and return existing record
                if (
                    collection == "users"
                    and response.status_code == 400
                    and ("validation_not_unique" in error_text or "Value must be unique" in error_text)
                ):
                    email = data.get("email")
                    password = data.get("password")
                    if email:
                        existing = await self._get_user_by_email(email, password=password)
                        if existing:
                            print(f"INFO: User {email} already exists, returning existing record")
                            return existing
                error_msg = f"Failed to create record in {collection}: {response.status_code} - {error_text}"
                print(f"ERROR: {error_msg}")
                raise Exception(error_msg)
        except Exception as e:
            # Re-raise if it's already our custom exception
            if isinstance(e, Exception) and "Failed to create" in str(e):
                raise
            error_msg = f"Error creating record in {collection}: {str(e)}"
            print(f"ERROR: {error_msg}")
            raise Exception(error_msg)

    async def get_list(
        self,
        collection: str,
        page: int = 1,
        per_page: int = 50,
        filter: Optional[str] = None,
        sort: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get a list of records from a collection"""
        try:
            params = {"page": page, "perPage": per_page}
            if filter:
                params["filter"] = filter
            if sort:
                params["sort"] = sort

            # Use collection API with explicit Authorization header
            endpoint = f"/api/collections/{collection}/records"
            
            # Ensure Authorization header is explicitly set for each request
            headers = {}
            if self.admin_token:
                headers["Authorization"] = f"Bearer {self.admin_token}"
                # Debug: verify token is set
                if collection == "published_editions" or collection == "daily_editions":
                    print(f"DEBUG: Sending request to {collection} with Authorization header (token length: {len(self.admin_token)})")
            else:
                print(f"WARNING: No admin token available for {collection}")
            
            response = await self.client.get(
                endpoint,
                params=params,
                headers=headers,
            )
            
            # Debug: check response
            if collection == "daily_editions" and response.status_code == 200:
                data = response.json()
                items = data.get("items", [])
                if items:
                    print(f"DEBUG: Response headers: {dict(response.headers)}")
                    print(f"DEBUG: First item from response: {list(items[0].keys())}")
            
            # Handle 403 errors (authentication issues)
            if response.status_code == 403:
                error_text = response.text
                print(f"ERROR: PocketBase returned 403 for {collection}: {error_text}")
                print(f"DEBUG: Request URL: {endpoint}")
                print(f"DEBUG: Request params: {params}")
                print(f"DEBUG: Request headers: {headers}")
                # Try to re-authenticate if token might be expired
                if self.admin_token:
                    print(f"WARNING: Admin token exists but request was rejected. Token length: {len(self.admin_token)}")
                    print(f"DEBUG: Token preview: {self.admin_token[:50]}...")
                else:
                    print(f"ERROR: No admin token available!")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get("items", [])
                
                # Debug: check what we're getting back
                if items and collection == "daily_editions":
                    first_item = items[0]
                    print(f"DEBUG: First item keys: {list(first_item.keys())}")
                    print(f"DEBUG: First item full: {first_item}")
                
                # If we only get metadata, the collection might have view restrictions
                # Check if we need to expand fields or use a different approach
                if items and len(items[0].keys()) <= 3:
                    print(f"WARNING: Only got metadata fields. Fetching full records individually...")
                    # Fetch full records by ID for all items
                    full_items = []
                    for item in items:
                        record_id = item.get("id")
                        if record_id:
                            full_record = await self.get_record_by_id(collection, record_id)
                            if full_record:
                                full_items.append(full_record)
                            else:
                                # Fallback to metadata if we can't get full record
                                full_items.append(item)
                        else:
                            full_items.append(item)
                    return full_items
                
                return items
            else:
                error_text = response.text
                print(f"DEBUG pocketbase_client: get_list failed with status {response.status_code}: {error_text}")
                # Raise exception for 403 errors so caller can handle them
                if response.status_code == 403:
                    raise Exception(f"PocketBase authentication failed (403): {error_text}")
            return []
        except Exception as e:
            # Re-raise if it's already our custom exception
            if "403" in str(e) or "authentication" in str(e).lower():
                raise
            print(f"Error getting list: {e}")
            return []

    async def get_record_by_id(
        self, collection: str, record_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get a single record by ID with all fields"""
        try:
            # Use collection API (should work with proper permissions)
            endpoint = f"/api/collections/{collection}/records/{record_id}"
            
            # Ensure Authorization header is set
            headers = {}
            if self.admin_token:
                headers["Authorization"] = f"Bearer {self.admin_token}"
            
            response = await self.client.get(endpoint, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                # Debug
                if collection == "daily_editions":
                    print(f"DEBUG get_record_by_id: Keys: {list(data.keys())}, Has date: {'date' in data}")
                return data
            else:
                print(f"get_record_by_id failed: {response.status_code} - {response.text}")
            return None
        except Exception as e:
            print(f"Error getting record by ID: {e}")
            return None

    async def update_record(
        self, collection: str, record_id: str, data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update a record (uses admin token if set)."""
        try:
            headers = {}
            if self.admin_token:
                headers["Authorization"] = f"Bearer {self.admin_token}"
            response = await self.client.patch(
                f"/api/collections/{collection}/records/{record_id}",
                json=data,
                headers=headers,
            )
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            print(f"Error updating record: {e}")
            return None

    async def delete_record(self, collection: str, record_id: str) -> bool:
        """Delete a record"""
        try:
            headers = {}
            if self.admin_token:
                headers["Authorization"] = f"Bearer {self.admin_token}"
            response = await self.client.delete(
                f"/api/collections/{collection}/records/{record_id}",
                headers=headers,
            )
            return response.status_code == 204
        except Exception as e:
            print(f"Error deleting record: {e}")
            return False

    async def ensure_articles_source_url_field(self) -> bool:
        """
        Ensure the articles collection has a source_url field (type url).
        If missing, add it via PATCH so that ingestion can store RSS link.
        Returns True if the field exists or was added, False on error.
        """
        if not self.admin_token:
            return False
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = await self.client.get("/api/collections/articles", headers=headers)
            if resp.status_code != 200:
                return False
            data = resp.json()
            fields = data.get("fields", [])
            if any(f.get("name") == "source_url" for f in fields):
                return True
            new_field = {"name": "source_url", "type": "url", "required": False, "options": {}}
            updated = {"fields": fields + [new_field]}
            patch = await self.client.patch(
                f"/api/collections/{data['id']}",
                json=updated,
                headers=headers,
            )
            if patch.status_code in (200, 204):
                print("[PocketBase] Added source_url field to articles collection.")
                return True
            print(f"[PocketBase] Failed to add source_url: {patch.status_code} - {patch.text}")
            return False
        except Exception as e:
            print(f"[PocketBase] ensure_articles_source_url_field: {e}")
            return False

    async def delete_all_records(self, collection: str) -> bool:
        """Delete all records in a collection (use with caution)"""
        try:
            # Get all records
            all_records = await self.get_list(collection, per_page=500)
            # Delete each one
            for record in all_records:
                await self.delete_record(collection, record["id"])
            return True
        except Exception as e:
            print(f"Error deleting all records: {e}")
            return False

    async def update_collection_permissions(
        self, collection_id: str, permissions: Dict[str, Any]
    ) -> bool:
        """Update collection permissions to allow admin access"""
        try:
            response = await self.client.patch(
                f"/api/collections/{collection_id}",
                json={"options": {"permissions": permissions}},
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Error updating collection permissions: {e}")
            return False

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


# Helper function to convert Python dates to ISO strings for PocketBase
def serialize_for_pb(data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert Python objects to PocketBase-compatible format"""
    result = {}
    for key, value in data.items():
        if isinstance(value, (date, datetime)):
            result[key] = value.isoformat()
        elif isinstance(value, dict):
            # PocketBase expects JSON fields as strings
            result[key] = json.dumps(value)
        elif isinstance(value, list):
            # Lists should also be JSON strings
            result[key] = json.dumps(value)
        else:
            result[key] = value
    return result

