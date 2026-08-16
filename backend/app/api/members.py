from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import get_current_user
from app.schemas.member import MemberResponse, MemberRoleUpdate
from app.services.organization_service import (
    get_organization_membership,
    require_organization_role,
)
from app.services.supabase_service import supabase
from backend.app.api.helpers.member_response import build_member_response

router = APIRouter()


@router.get(
    "",
    response_model=list[MemberResponse],
)
def list_members(
    organization_id: UUID,
    user=Depends(get_current_user),
):
    get_organization_membership(
        organization_id,
        user.id,
    )

    response = (
        supabase.table("organization_members")
        .select("user_id, role, created_at")
        .eq(
            "organization_id",
            str(organization_id),
        )
        .order("created_at")
        .execute()
    )

    return [build_member_response(membership) for membership in response.data]


@router.patch(
    "/{member_user_id}",
    response_model=MemberResponse,
)
def update_member_role(
    organization_id: UUID,
    member_user_id: UUID,
    payload: MemberRoleUpdate,
    user=Depends(get_current_user),
):
    current_membership = require_organization_role(
        organization_id,
        user.id,
        {"owner", "admin"},
    )

    target_membership = get_organization_membership(
        organization_id,
        member_user_id,
    )

    current_role = current_membership["role"]
    target_role = target_membership["role"]

    if target_role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The organization owner role cannot be modified here",
        )

    if payload.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ownership must be transferred separately",
        )

    if current_role == "admin":
        if target_role == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot modify other admins",
            )

        if payload.role == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the owner can create admins",
            )

    response = (
        supabase.table("organization_members")
        .update(
            {
                "role": payload.role,
            }
        )
        .eq("organization_id", str(organization_id))
        .eq("user_id", str(member_user_id))
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    return build_member_response(response.data[0])


@router.delete(
    "/{member_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_member(
    organization_id: UUID,
    member_user_id: UUID,
    user=Depends(get_current_user),
):
    current_membership = require_organization_role(
        organization_id,
        user.id,
        {"owner", "admin"},
    )

    target_membership = get_organization_membership(
        organization_id,
        member_user_id,
    )

    current_role = current_membership["role"]
    target_role = target_membership["role"]

    if target_role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The organization owner cannot be removed",
        )

    if current_role == "admin" and target_role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins cannot remove other admins",
        )

    response = (
        supabase.table("organization_members")
        .delete()
        .eq("organization_id", str(organization_id))
        .eq("user_id", str(member_user_id))
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    return None


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
)
def leave_organization(
    organization_id: UUID,
    user=Depends(get_current_user),
):
    membership = get_organization_membership(
        organization_id,
        user.id,
    )

    if membership["role"] == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The organization owner cannot leave the organization",
        )

    response = (
        supabase.table("organization_members")
        .delete()
        .eq(
            "organization_id",
            str(organization_id),
        )
        .eq(
            "user_id",
            str(user.id),
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found",
        )

    return None
