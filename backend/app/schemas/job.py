from __future__ import annotations

from pydantic import BaseModel, Field
from typing import List, Literal, Optional


AssetKind = Literal["clip", "thumbnail"]


class UploadAsset(BaseModel):
    kind: AssetKind = "clip"
    filename: str
    content_type: Optional[str] = None 
    size_bytes: Optional[int] = None
    sequence: Optional[int] = None


class CreateJobRequest(BaseModel):
    title: str
    description: str = ""
    assets: List[UploadAsset] = Field(default_factory=list)


class CreateJobResponse(BaseModel):
    job_id: str
    status: str


class AddAssetsRequest(BaseModel):
    assets: List[UploadAsset]


class UploadInstruction(BaseModel):
    filename: str
    kind: AssetKind
    url: str 
    method: str = "PUT"
    headers: dict = Field(default_factory=dict)


class AddAssetsResponse(BaseModel):
    job_id: str
    uploads: List[UploadInstruction]


class CompleteJobResponse(BaseModel):
    job_id: str
    status: str
    queue_message: dict 


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    title: str
    description: str
    assets: List[UploadAsset]
    youtube_url: Optional[str] = None
    error: Optional[str] = None