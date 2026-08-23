from uuid import UUID

from fastapi import APIRouter, Depends, Query
from app.auth import get_current_user

from app.services.organization_service import get_organization_membership

from app.services.supabase_service import supabase

router = APIRouter()


@router.get("")
def list_audit_logs(
    organization_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
):
    get_organization_membership(organization_id, user.id)

    response = (
        supabase.table("organization_audit_logs")
        .select(
            "id, "
            "organization_id, "
            "actor_user_id, "
            "actor_email, "
            "action, "
            "details, "
            "created_at"
        )
        .eq(
            "organization_id",
            str(organization_id),
        )
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return response.data
