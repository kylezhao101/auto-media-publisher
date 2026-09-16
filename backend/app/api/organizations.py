from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, status

from app.auth import get_current_user

from app.schemas.organization import OrganizationCreate, OrganizationResponse
from app.services.organization_service import (
    get_organization_membership,
    require_organization_role,
)

from app.services.supabase_service import supabase

router = APIRouter()


@router.post(
    "",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_organization(
    payload: OrganizationCreate,
    user=Depends(get_current_user),
):
    response = (
        supabase.table("organizations")
        .insert(
            {
                "name": payload.name.strip(),
            }
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create organization",
        )

    organization = response.data[0]

    membership_response = (
        supabase.table("organization_members")
        .insert(
            {
                "organization_id": organization["id"],
                "user_id": str(user.id),
                "role": "owner",
            }
        )
        .execute()
    )

    if not membership_response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create organization membership",
        )

    return organization


@router.delete(
    "/{organization_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_organization(
    organization_id: UUID,
    user=Depends(get_current_user),
):
    require_organization_role(
        organization_id,
        user.id,
        {"owner"},
    )

    response = (
        supabase.table("organizations")
        .delete()
        .eq("id", str(organization_id))
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    return None


@router.get(
    "",
    response_model=list[OrganizationResponse],
)
def list_organizations(
    user=Depends(get_current_user),
):
    memberships = (
        supabase.table("organization_members")
        .select("organization_id")
        .eq("user_id", str(user.id))
        .execute()
    )

    organization_ids = [
        membership["organization_id"] for membership in memberships.data
    ]

    if not organization_ids:
        return []

    response = (
        supabase.table("organizations")
        .select("*")
        .in_("id", organization_ids)
        .order("created_at")
        .execute()
    )

    return response.data


@router.get(
    "/{organization_id}",
    response_model=OrganizationResponse,
)
def get_organization(
    organization_id: UUID,
    user=Depends(get_current_user),
):
    get_organization_membership(
        organization_id,
        user.id,
    )

    response = (
        supabase.table("organizations")
        .select("*")
        .eq("id", str(organization_id))
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    return response.data[0]


from uuid import UUID

from fastapi import Depends, HTTPException, status
from pydantic import BaseModel, Field


class UploadAuditCreate(BaseModel):
    video_title: str = Field(min_length=1, max_length=100)
    youtube_video_id: str = Field(pattern=r"^[A-Za-z0-9_-]{11}$")


@router.post(
    "/{organization_id}/uploads",
    status_code=status.HTTP_201_CREATED,
)
def record_upload(
    organization_id: UUID,
    payload: UploadAuditCreate,
    user=Depends(get_current_user),
):
    get_organization_membership(organization_id, user.id)

    response = (
        supabase.table("organization_audit_logs")
        .insert(
            {
                "organization_id": str(organization_id),
                "actor_user_id": str(user.id),
                "actor_email": user.email,
                "action": "video.uploaded",
                "details": {
                    "video_title": payload.video_title,
                    "youtube_video_id": payload.youtube_video_id,
                },
            }
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record upload",
        )

    return response.data[0]
