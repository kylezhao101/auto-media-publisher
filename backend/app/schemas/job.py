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

class UpdateJobStatusRequest(BaseModel):
    status: str
    youtube_video_id: Optional[str] = None

class UploadInstruction(BaseModel):
    filename: str
    kind: AssetKind
    url: str 
    method: str = "PUT"
    headers: dict = Field(default_factory=dict)


class AddAssetsResponse(BaseModel):
    job_id: str
    uploads: List[UploadInstruction]


class SubmitJobResponse(BaseModel):
    job_id: str
    status: str
    queue_message: dict 

class JobProgress(BaseModel):
    rendering_progress: int = 0
    publishing_progress: int = 0

class JobStatusResponse(BaseModel):
    job_id: str
    created_at: Optional[str] = None
    status: str
    title: str
    description: str
    assets: List[UploadAsset]
    youtube_video_id: Optional[str] = None
    error: Optional[str] = None
    progress: Optional[JobProgress] = None


class UpdateJobProgressRequest(BaseModel):
    rendering_progress: Optional[int] = None
    publishing_progress : Optional[int] = None