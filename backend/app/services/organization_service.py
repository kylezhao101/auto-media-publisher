from collections.abc import Iterable
from uuid import UUID

from fastapi import HTTPException, status

from app.services.supabase_service import supabase


def get_organization_membership(
    organization_id: UUID,
    user_id: UUID,
) -> dict:
    response = (
        supabase.table("organization_members")
        .select("organization_id, user_id, role")
        .eq("organization_id", str(organization_id))
        .eq("user_id", str(user_id))
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    return response.data[0]


def require_organization_role(
    organization_id: UUID,
    user_id: UUID,
    allowed_roles: Iterable[str],
) -> dict:
    membership = get_organization_membership(
        organization_id=organization_id,
        user_id=user_id,
    )

    if membership["role"] not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    return membership
