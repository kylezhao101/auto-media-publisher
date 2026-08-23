from uuid import UUID

from app.services.supabase_service import supabase


def log_organization_action(
    organization_id: UUID | str,
    actor_user_id: UUID | str | None,
    actor_email: str | None,
    action: str,
    details: dict | None = None,
) -> None:
    supabase.table("organization_audit_logs").insert(
        {
            "organization_id": str(organization_id),
            "actor_user_id": (str(actor_user_id) if actor_user_id else None),
            "actor_email": actor_email,
            "action": action,
            "details": details or {},
        }
    ).execute()
