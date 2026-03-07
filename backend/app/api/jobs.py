from __future__ import annotations

import uuid
from fastapi import APIRouter, HTTPException, Request
from pathlib import Path
from app.schemas.job import (
    AddAssetsRequest,
    AddAssetsResponse,
    CompleteJobResponse,
    CreateJobRequest,
    CreateJobResponse,
    JobStatusResponse,
    UploadInstruction,
)
from app.store.memory import JOBS, Job
from app.store.local_queue import enqueue
from app.services.azure_storage import StorageService

router = APIRouter()
storage_service = StorageService()

def _upload_to_storage_service(job_id: str, kind: str, filename: str, content_type: str | None) -> str:
        return storage_service.sas_put_url(
        path=storage_service.uploads_path(job_id, kind, filename),
        content_type=content_type,
    )

# For local devevelopment testing
@router.put("/dev-upload/{job_id}/{kind}/{filename}")
async def dev_upload(job_id: str, kind: str, filename: str, request: Request):
    if kind not in ("clip", "thumbnail"):
        raise HTTPException(status_code=400, detail="invalid kind (must be clip or thumbnail)")

    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    body = await request.body()

    if not body:
        raise HTTPException(status_code=400, detail="Empty Upload Body")
    
    # Save to local disk
    base = Path("data") / job_id / kind
    base.mkdir(parents=True, exist_ok=True)
    path = base / filename
    path.write_bytes(body)

    for a in job.assets:
        if a.kind == kind and a.filename == filename:
            a.size_bytes = len(body)
            break

    return {"status": "uploaded", "bytes": len(body), "path": str(path)}

# TODO: protect endpoint with auth
@router.post("", response_model=CreateJobResponse)
def create_job(req: CreateJobRequest):
    job_id = str(uuid.uuid4())
    job = Job(
        job_id=job_id,
        title=req.title,
        description=req.description,
        status="created",
        assets=req.assets,
    )
    JOBS[job_id] = job

    if req.assets:
        job.status = "uploading"

    return CreateJobResponse(job_id=job_id, status=job.status)

# TODO: protect endpoint with auth
@router.post("/{job_id}/assets", response_model=AddAssetsResponse)
def add_assets(job_id: str, req: AddAssetsRequest):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    existing = {(asset.kind, asset.filename) for asset in job.assets}
    for asset in req.assets:
        key = (asset.kind, asset.filename)
        if key not in existing:
            job.assets.append(asset)
            existing.add(key)

    job.status = "uploading"

    upload_instructions = []
    for a in req.assets:
        upload_instructions.append(
            UploadInstruction(
                filename=a.filename,
                kind=a.kind,
                url=_upload_to_storage_service(job_id, a.kind, a.filename, a.content_type),
                method="PUT",
                headers={"Content-Type": a.content_type or "application/octet-stream"},
            )
        )

    return AddAssetsResponse(job_id=job_id, upload=upload_instructions)


@router.post("/{job_id}/complete", response_model=CompleteJobResponse)
def complete_job(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    clip_count = sum(1 for a in job.assets if a.kind == "clip")
    if clip_count == 0:
        raise HTTPException(status_code=400, detail="Job must include at least one clip")

    assets = job.assets
    if any(a.sequence is not None for a in assets):
        clips = sorted(
            [a for a in assets if a.kind == "clip"],
            key=lambda x: (x.sequence if x.sequence is not None else 10**9, x.filename),
        )
    else:
        clips = [a for a in assets if a.kind == "clip"]

    thumbs = [a for a in assets if a.kind == "thumbnail"]
    thumbnail = thumbs[0] if thumbs else None

    queue_message = {
        "job_id": job.job_id,
        "title": job.title,
        "description": job.description,
        "clips": [{"filename": c.filename, "sequence": c.sequence} for c in clips],
        "thumbnail": {"filename": thumbnail.filename} if thumbnail else None,
    }

    job.status = "queued"
    enqueue(queue_message)
    return CompleteJobResponse(job_id=job_id, status=job.status, queue_message=queue_message)


@router.get("/{job_id}", response_model=JobStatusResponse)
def get_job(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        title=job.title,
        description=job.description,
        assets=job.assets,
        youtube_url=job.youtube_url,
        error=job.error,
    )