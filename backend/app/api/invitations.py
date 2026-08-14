from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import get_current_user
from app.schemas.invitation import (
    InvitationCreate,
    InvitationResponse,
)
from app.services.organization_service import require_organization_role
from app.services.supabase_service import supabase

from datetime import datetime, timezone

from app.config import FRONTEND_INVITE_URL

organization_router = APIRouter()
invitation_router = APIRouter()


@organization_router.post(
    "",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invitation(
    organization_id: UUID,
    payload: InvitationCreate,
    user=Depends(get_current_user),
):
    membership = require_organization_role(
        organization_id,
        user.id,
        {"owner", "admin"},
    )

    if membership["role"] == "admin" and payload.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the organization owner can invite admins",
        )

    email = payload.email.lower()

    organization_response = (
        supabase.table("organizations")
        .select("name")
        .eq("id", str(organization_id))
        .single()
        .execute()
    )

    if not organization_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    organization_name = organization_response.data["name"]

    response = (
        supabase.table("organization_invitations")
        .insert(
            {
                "organization_id": str(organization_id),
                "email": email,
                "role": payload.role,
                "invited_by": str(user.id),
            }
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create invitation",
        )

    invitation = response.data[0]

    supabase.auth.admin.invite_user_by_email(
        email,
        {
            "redirect_to": (f"{FRONTEND_INVITE_URL}?invite={invitation['token']}"),
            "data": {
                "organization_name": organization_name,
                "invited_by": user.email,
                "role": payload.role,
            },
        },
    )

    return invitation


@organization_router.get(
    "",
    response_model=list[InvitationResponse],
)
def list_invitations(
    organization_id: UUID,
    user=Depends(get_current_user),
):
    require_organization_role(
        organization_id,
        user.id,
        {"owner", "admin"},
    )

    response = (
        supabase.table("organization_invitations")
        .select("*")
        .eq("organization_id", str(organization_id))
        .is_("accepted_at", "null")
        .order("created_at")
        .execute()
    )

    return response.data


@organization_router.delete(
    "/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def revoke_invitation(
    organization_id: UUID,
    invitation_id: UUID,
    user=Depends(get_current_user),
):
    require_organization_role(
        organization_id,
        user.id,
        {"owner", "admin"},
    )

    response = (
        supabase.table("organization_invitations")
        .delete()
        .eq("id", str(invitation_id))
        .eq("organization_id", str(organization_id))
        .is_("accepted_at", "null")
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )

    return None


@invitation_router.post(
    "/{token}/accept",
    status_code=status.HTTP_200_OK,
)
def accept_invitation(
    token: UUID,
    user=Depends(get_current_user),
):
    response = (
        supabase.table("organization_invitations")
        .select("*")
        .eq("token", str(token))
        .is_("accepted_at", "null")
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )

    invitation = response.data[0]

    if not user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have an email address",
        )

    if user.email.lower() != invitation["email"].lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation belongs to another email address",
        )

    expires_at = datetime.fromisoformat(invitation["expires_at"].replace("Z", "+00:00"))

    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Invitation has expired",
        )

    membership_response = (
        supabase.table("organization_members")
        .insert(
            {
                "organization_id": invitation["organization_id"],
                "user_id": str(user.id),
                "role": invitation["role"],
            }
        )
        .execute()
    )

    if not membership_response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create organization membership",
        )

    accept_response = (
        supabase.table("organization_invitations")
        .update(
            {
                "accepted_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", invitation["id"])
        .execute()
    )

    if not accept_response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark invitation as accepted",
        )

    return {
        "organization_id": invitation["organization_id"],
        "role": invitation["role"],
    }
