def get_member_email(
    user_id: str,
) -> str | None:
    try:
        response = supabase.auth.admin.get_user_by_id(user_id)

        return response.user.email
    except Exception:
        return None
