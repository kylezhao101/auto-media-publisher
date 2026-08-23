from datetime import datetime, timezone
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from app.auth import get_current_user

from app.config import FRONTEND_INVITE_URL

from app.schemas.invitation import (
    InvitationCreate,
    InvitationDetailsResponse,
    InvitationResponse,
)

from app.services.email_service import (
    send_organization_invitation_email,
)

from app.services.organization_service import (
    require_organization_role,
)

from app.services.supabase_service import supabase
from app.api.helpers.member_email import get_member_email
from app.services.audit_log_service import log_organization_action

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
            detail=("Only the organization owner " "can invite admins"),
        )

    email = payload.email.strip().lower()

    members_response = (
        supabase.table("organization_members")
        .select("user_id")
        .eq(
            "organization_id",
            str(organization_id),
        )
        .execute()
    )

    for member in members_response.data:
        member_email = get_member_email(
            member["user_id"],
        )

        if member_email and member_email.lower() == email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=("This user is already a member " "of the organization"),
            )

    existing_invitation = (
        supabase.table("organization_invitations")
        .select("id")
        .eq(
            "organization_id",
            str(organization_id),
        )
        .eq(
            "email",
            email,
        )
        .is_(
            "accepted_at",
            "null",
        )
        .execute()
    )

    if existing_invitation.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=("This email already has " "a pending invitation"),
        )

    organization_response = (
        supabase.table("organizations")
        .select("name")
        .eq(
            "id",
            str(organization_id),
        )
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
            status_code=(status.HTTP_500_INTERNAL_SERVER_ERROR),
            detail="Failed to create invitation",
        )

    invitation = response.data[0]

    invite_url = f"{FRONTEND_INVITE_URL}" f"?invite={invitation['token']}"

    try:
        send_organization_invitation_email(
            to=email,
            organization_name=organization_name,
            invited_by=user.email,
            role=payload.role,
            invite_url=invite_url,
        )
    except Exception as exc:
        (
            supabase.table("organization_invitations")
            .delete()
            .eq(
                "id",
                invitation["id"],
            )
            .execute()
        )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send invitation email",
        ) from exc

    log_organization_action(
        organization_id=organization_id,
        actor_user_id=user.id,
        actor_email=user.email,
        action="member.invited",
        details={
            "email": email,
            "role": payload.role,
            "invitation_id": invitation["id"],
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
        .eq(
            "organization_id",
            str(organization_id),
        )
        .is_(
            "accepted_at",
            "null",
        )
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

    existing = (
        supabase.table("organization_invitations")
        .select("id, email, role")
        .eq(
            "id",
            str(invitation_id),
        )
        .eq(
            "organization_id",
            str(organization_id),
        )
        .is_(
            "accepted_at",
            "null",
        )
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )

    invitation = existing.data[0]

    response = (
        supabase.table("organization_invitations")
        .delete()
        .eq(
            "id",
            str(invitation_id),
        )
        .eq(
            "organization_id",
            str(organization_id),
        )
        .is_(
            "accepted_at",
            "null",
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )

    log_organization_action(
        organization_id=organization_id,
        actor_user_id=user.id,
        actor_email=user.email,
        action="invitation.revoked",
        details={
            "invitation_id": str(invitation_id),
            "email": invitation["email"],
            "role": invitation["role"],
        },
    )

    return None


@invitation_router.get(
    "/{token}",
    response_model=InvitationDetailsResponse,
)
def get_invitation(
    token: UUID,
):
    response = (
        supabase.table("organization_invitations")
        .select("organization_id, email, role, " "expires_at, accepted_at")
        .eq(
            "token",
            str(token),
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )

    invitation = response.data[0]

    if invitation["accepted_at"]:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=("This invitation has already " "been accepted"),
        )

    expires_at = datetime.fromisoformat(
        invitation["expires_at"].replace(
            "Z",
            "+00:00",
        )
    )

    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Invitation has expired",
        )

    organization_response = (
        supabase.table("organizations")
        .select("name")
        .eq(
            "id",
            invitation["organization_id"],
        )
        .single()
        .execute()
    )

    if not organization_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    return {
        "organization_name": (organization_response.data["name"]),
        "email": invitation["email"],
        "role": invitation["role"],
        "expires_at": invitation["expires_at"],
    }


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
        .eq(
            "token",
            str(token),
        )
        .is_(
            "accepted_at",
            "null",
        )
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
            detail=("User does not have an " "email address"),
        )

    if user.email.lower() != invitation["email"].lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=("This invitation belongs to " "another email address"),
        )

    expires_at = datetime.fromisoformat(
        invitation["expires_at"].replace(
            "Z",
            "+00:00",
        )
    )

    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Invitation has expired",
        )

    existing_membership = (
        supabase.table("organization_members")
        .select("user_id")
        .eq(
            "organization_id",
            invitation["organization_id"],
        )
        .eq(
            "user_id",
            str(user.id),
        )
        .execute()
    )

    if existing_membership.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=("You are already a member " "of this organization"),
        )

    membership_response = (
        supabase.table("organization_members")
        .insert(
            {
                "organization_id": (invitation["organization_id"]),
                "user_id": str(user.id),
                "role": invitation["role"],
            }
        )
        .execute()
    )

    if not membership_response.data:
        raise HTTPException(
            status_code=(status.HTTP_500_INTERNAL_SERVER_ERROR),
            detail=("Failed to create " "organization membership"),
        )

    accept_response = (
        supabase.table("organization_invitations")
        .update(
            {
                "accepted_at": (
                    datetime.now(
                        timezone.utc,
                    ).isoformat()
                ),
            }
        )
        .eq(
            "id",
            invitation["id"],
        )
        .execute()
    )

    if not accept_response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark invitation as accepted",
        )

    log_organization_action(
        organization_id=invitation["organization_id"],
        actor_user_id=user.id,
        actor_email=user.email,
        action="member.joined",
        details={
            "role": invitation["role"],
            "invitation_id": invitation["id"],
        },
    )

    return {
        "organization_id": invitation["organization_id"],
        "role": invitation["role"],
    }
