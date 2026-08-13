from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr

InviteRole = Literal["admin", "publisher", "member"]


class InvitationCreate(BaseModel):
    email: EmailStr
    role: InviteRole = "member"


class InvitationResponse(BaseModel):
    id: UUID
    organization_id: UUID
    email: EmailStr
    role: InviteRole
    invited_by: UUID
    created_at: str
    expires_at: str
    accepted_at: str | None = None
