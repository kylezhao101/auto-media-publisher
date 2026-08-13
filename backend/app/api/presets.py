from uuid import UUID

from fastapi import APIRouter, HTTPException, status, Depends

from app.auth import get_current_user

from app.schemas.preset import (
    PresetCreate,
    PresetResponse,
    PresetUpdate,
)
from app.services.organization_service import (
    get_organization_membership,
    require_organization_role,
)
from app.services.supabase_service import supabase

router = APIRouter()


def ensure_organization_exists(organization_id: UUID) -> None:
    response = (
        supabase.table("organizations")
        .select("id")
        .eq("id", str(organization_id))
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )


@router.post(
    "",
    response_model=PresetResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_preset(
    organization_id: UUID,
    payload: PresetCreate,
    user=Depends(get_current_user),
):
    require_organization_role(
        organization_id,
        user.id,
        {"owner", "admin"},
    )

    response = (
        supabase.table("presets")
        .insert(
            {
                "organization_id": str(organization_id),
                "name": payload.name.strip(),
                "title_template": payload.title_template,
                "description_template": payload.description_template,
                "visibility": payload.visibility,
            }
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create preset",
        )

    return response.data[0]


@router.get(
    "",
    response_model=list[PresetResponse],
)
def list_presets(
    organization_id: UUID,
    user=Depends(get_current_user),
):
    get_organization_membership(
        organization_id,
        user.id,
    )

    response = (
        supabase.table("presets")
        .select("*")
        .eq("organization_id", str(organization_id))
        .order("created_at")
        .execute()
    )

    return response.data


@router.get(
    "/{preset_id}",
    response_model=PresetResponse,
)
def get_preset(
    organization_id: UUID,
    preset_id: UUID,
    user=Depends(get_current_user),
):
    get_organization_membership(
        organization_id,
        user.id,
    )

    response = (
        supabase.table("presets")
        .select("*")
        .eq("id", str(preset_id))
        .eq("organization_id", str(organization_id))
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preset not found",
        )

    return response.data[0]


@router.patch(
    "/{preset_id}",
    response_model=PresetResponse,
)
def update_preset(
    organization_id: UUID,
    preset_id: UUID,
    payload: PresetUpdate,
    user=Depends(get_current_user),
):
    require_organization_role(
        organization_id,
        user.id,
        {"owner", "admin"},
    )

    changes = payload.model_dump(exclude_unset=True)

    if "name" in changes:
        changes["name"] = changes["name"].strip()

    if not changes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update",
        )

    response = (
        supabase.table("presets")
        .update(changes)
        .eq("id", str(preset_id))
        .eq("organization_id", str(organization_id))
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preset not found",
        )

    return response.data[0]


@router.delete(
    "/{preset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_preset(
    organization_id: UUID,
    preset_id: UUID,
    user=Depends(get_current_user),
):
    require_organization_role(
        organization_id,
        user.id,
        {"owner", "admin"},
    )

    response = (
        supabase.table("presets")
        .delete()
        .eq("id", str(preset_id))
        .eq("organization_id", str(organization_id))
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preset not found",
        )

    return None
