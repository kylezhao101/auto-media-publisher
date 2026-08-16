from fastapi import HTTPException, status
from app.services.supabase_service import supabase


def build_member_response(membership: dict) -> dict:
    auth_response = supabase.auth.admin.get_user_by_id(membership["user_id"])

    auth_user = auth_response.user

    if not auth_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load member account",
        )

    metadata = auth_user.user_metadata or {}

    return {
        "user_id": membership["user_id"],
        "email": auth_user.email or "",
        "display_name": (metadata.get("full_name") or metadata.get("name")),
        "avatar_url": (metadata.get("avatar_url") or metadata.get("picture")),
        "role": membership["role"],
        "created_at": membership["created_at"],
    }
