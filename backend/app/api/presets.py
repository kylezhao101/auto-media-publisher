from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

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
from app.services.audit_log_service import (
    log_organization_action,
)

router = APIRouter()


def ensure_organization_exists(
    organization_id: UUID,
) -> None:
    response = (
        supabase.table("organizations")
        .select("id")
        .eq(
            "id",
            str(organization_id),
        )
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
        {
            "owner",
            "admin",
        },
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
            status_code=(status.HTTP_500_INTERNAL_SERVER_ERROR),
            detail="Failed to create preset",
        )

    preset = response.data[0]

    log_organization_action(
        organization_id=organization_id,
        actor_user_id=user.id,
        actor_email=user.email,
        action="preset.created",
        details={
            "preset_id": preset["id"],
            "preset_name": preset["name"],
        },
    )

    return preset


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
        .eq(
            "organization_id",
            str(organization_id),
        )
        .order(
            "created_at",
        )
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
        .eq(
            "id",
            str(preset_id),
        )
        .eq(
            "organization_id",
            str(organization_id),
        )
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
        {
            "owner",
            "admin",
        },
    )

    changes = payload.model_dump(
        exclude_unset=True,
    )

    if "name" in changes:
        changes["name"] = changes["name"].strip()

    if not changes:
        raise HTTPException(
            status_code=(status.HTTP_400_BAD_REQUEST),
            detail=("No fields provided to update"),
        )

    existing_response = (
        supabase.table("presets")
        .select("*")
        .eq(
            "id",
            str(preset_id),
        )
        .eq(
            "organization_id",
            str(organization_id),
        )
        .execute()
    )

    if not existing_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preset not found",
        )

    existing_preset = existing_response.data[0]

    response = (
        supabase.table("presets")
        .update(
            changes,
        )
        .eq(
            "id",
            str(preset_id),
        )
        .eq(
            "organization_id",
            str(organization_id),
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preset not found",
        )

    updated_preset = response.data[0]

    changed_fields = {}

    for field in changes:
        old_value = existing_preset.get(field)

        new_value = updated_preset.get(field)

        if old_value != new_value:
            changed_fields[field] = {
                "old": old_value,
                "new": new_value,
            }

    log_organization_action(
        organization_id=organization_id,
        actor_user_id=user.id,
        actor_email=user.email,
        action="preset.updated",
        details={
            "preset_id": str(preset_id),
            "preset_name": updated_preset["name"],
            "changes": changed_fields,
        },
    )

    return updated_preset


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
        {
            "owner",
            "admin",
        },
    )

    response = (
        supabase.table("presets")
        .delete()
        .eq(
            "id",
            str(preset_id),
        )
        .eq(
            "organization_id",
            str(organization_id),
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preset not found",
        )

    deleted_preset = response.data[0]

    log_organization_action(
        organization_id=organization_id,
        actor_user_id=user.id,
        actor_email=user.email,
        action="preset.deleted",
        details={
            "preset_id": str(preset_id),
            "preset_name": deleted_preset["name"],
        },
    )

    return None
