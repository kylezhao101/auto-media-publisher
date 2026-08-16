from typing import Literal
from uuid import UUID

from pydantic import BaseModel

OrganizationRole = Literal["owner", "admin", "publisher", "member"]


class MemberRoleUpdate(BaseModel):
    role: OrganizationRole


class MemberResponse(BaseModel):
    user_id: UUID
    email: str
    display_name: str | None = None
    avatar_url: str | None = None
    role: OrganizationRole
    created_at: str
