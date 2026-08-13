from uuid import UUID
from pydantic import BaseModel, Field


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    created_at: str
