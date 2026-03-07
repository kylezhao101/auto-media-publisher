from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional
from app.schemas.job import UploadAsset


@dataclass
class Job:
    job_id: str
    title: str
    description: str
    status: str = "created"  
    assets: List[UploadAsset] = field(default_factory=list)
    youtube_url: Optional[str] = None
    error: Optional[str] = None

JOBS: Dict[str, Job] = {}