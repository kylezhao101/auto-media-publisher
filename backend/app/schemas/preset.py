from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

Visibility = Literal["private", "unlisted", "public"]


class PresetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    title_template: str = ""
    description_template: str = ""
    visibility: Visibility = "unlisted"


class PresetUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    title_template: str | None = None
    description_template: str | None = None
    visibility: Visibility | None = None


class PresetResponse(BaseModel):
    id: UUID
    organization_id: UUID

    name: str
    title_template: str
    description_template: str
    visibility: Visibility

    created_at: str
    updated_at: str
