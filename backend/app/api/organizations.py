from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, status

from app.auth import get_current_user

from app.schemas.organization import OrganizationCreate, OrganizationResponse
from app.services.organization_service import get_organization_membership

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
