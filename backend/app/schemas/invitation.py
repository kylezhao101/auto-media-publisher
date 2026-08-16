from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr

InvitationRole = Literal[
    "admin",
    "publisher",
    "member",
]


class InvitationCreate(BaseModel):
    email: EmailStr
    role: InvitationRole


class InvitationResponse(BaseModel):
    id: UUID
    organization_id: UUID
    email: EmailStr
    role: InvitationRole
    invited_by: UUID
    created_at: str
    expires_at: str
    accepted_at: str | None = None


class InvitationDetailsResponse(BaseModel):
    organization_name: str
    email: EmailStr
    role: InvitationRole
    expires_at: str
