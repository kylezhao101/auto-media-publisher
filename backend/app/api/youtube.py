from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, HTTPException, status

from app.auth import get_current_user
from app.services.organization_service import (
    get_organization_membership,
    require_organization_role,
)
from app.services.oauth_state_service import create_oauth_state, decode_oauth_state
from app.services.supabase_service import supabase
from app.services.youtube_oauth_service import (
    create_youtube_oauth_flow,
    exchange_code_for_credentials,
    get_youtube_channel,
    revoke_google_token,
    create_youtube_credentials_from_refresh_token,
    get_youtube_playlists,
)
from app.services.token_encryption_service import decrypt_token, encrypt_token

import secrets

organization_router = APIRouter()
oauth_router = APIRouter()


@organization_router.get("")
def get_youtube_connection(
    organization_id: UUID,
    user=Depends(get_current_user),
):
    get_organization_membership(
        organization_id,
        user.id,
    )

    response = (
        supabase.table("youtube_connections")
        .select(
            "organization_id, "
            "channel_id, "
            "channel_name, "
            "channel_handle, "
            "channel_thumbnail, "
            "connected_by, "
            "created_at, "
            "updated_at"
        )
        .eq(
            "organization_id",
            str(organization_id),
        )
        .execute()
    )

    if not response.data:
        return {
            "connected": False,
        }

    connection = response.data[0]

    return {
        "connected": True,
        **connection,
    }


@organization_router.post("/connect")
def connect_youtube(
    organization_id: UUID,
    user=Depends(get_current_user),
):
    require_organization_role(
        organization_id,
        user.id,
        {"owner", "admin"},
    )

    code_verifier = secrets.token_urlsafe(64)

    state = create_oauth_state(
        organization_id=str(organization_id),
        user_id=str(user.id),
        code_verifier=code_verifier,
    )

    flow = create_youtube_oauth_flow(
        code_verifier=code_verifier,
    )

    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=state,
    )

    return {
        "authorization_url": authorization_url,
    }


@organization_router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
)
def disconnect_youtube(
    organization_id: UUID,
    user=Depends(get_current_user),
):
    require_organization_role(
        organization_id,
        user.id,
        {"owner", "admin"},
    )

    connection_response = (
        supabase.table("youtube_connections")
        .select("refresh_token_encrypted")
        .eq(
            "organization_id",
            str(organization_id),
        )
        .execute()
    )

    # Already disconnected.
    if not connection_response.data:
        return None

    encrypted_refresh_token = connection_response.data[0]["refresh_token_encrypted"]

    refresh_token = decrypt_token(
        encrypted_refresh_token,
    )

    try:
        revoke_google_token(
            refresh_token,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to revoke Google access",
        )

    delete_response = (
        supabase.table("youtube_connections")
        .delete()
        .eq(
            "organization_id",
            str(organization_id),
        )
        .execute()
    )

    if not delete_response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Google access was revoked, " "but the connection could not be removed"
            ),
        )

    return None


@oauth_router.get("/oauth/callback")
def youtube_oauth_callback(
    code: str,
    state: str,
):
    state_data = decode_oauth_state(state)

    organization_id = state_data["organization_id"]
    user_id = state_data["user_id"]
    code_verifier = state_data["code_verifier"]

    credentials = exchange_code_for_credentials(
        code=code,
        code_verifier=code_verifier,
    )

    if not credentials.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google did not return a refresh token",
        )

    channel = get_youtube_channel(credentials)

    encrypted_refresh_token = encrypt_token(credentials.refresh_token)

    response = (
        supabase.table("youtube_connections")
        .upsert(
            {
                "organization_id": organization_id,
                "channel_id": channel["channel_id"],
                "channel_name": channel["channel_name"],
                "channel_handle": channel.get("channel_handle"),
                "channel_thumbnail": channel.get("channel_thumbnail"),
                "refresh_token_encrypted": encrypted_refresh_token,
                "scopes": list(credentials.scopes or []),
                "connected_by": user_id,
            },
            on_conflict="organization_id",
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save YouTube connection",
        )

    return {
        "connected": True,
        "channel_id": channel["channel_id"],
        "channel_name": channel["channel_name"],
        "channel_handle": channel.get("channel_handle"),
        "channel_thumbnail": channel.get("channel_thumbnail"),
    }


@organization_router.get(
    "/playlists",
)
def list_youtube_playlists(
    organization_id: UUID,
    user=Depends(get_current_user),
):
    get_organization_membership(
        organization_id,
        user.id,
    )

    response = (
        supabase.table("youtube_connections")
        .select("refresh_token_encrypted")
        .eq(
            "organization_id",
            str(organization_id),
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="YouTube is not connected for this organization",
        )

    encrypted_refresh_token = response.data[0]["refresh_token_encrypted"]

    refresh_token = decrypt_token(
        encrypted_refresh_token,
    )

    try:
        credentials = create_youtube_credentials_from_refresh_token(
            refresh_token,
        )

        return get_youtube_playlists(
            credentials,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to load YouTube playlists",
        ) from exc
