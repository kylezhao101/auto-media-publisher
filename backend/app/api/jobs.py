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
from app.services.azure_storage_service import AzureStorageService
from app.services.azure_queue_service import AzureQueueService
from app.services.job_repository import JobRepository

router = APIRouter()
storage_service = AzureStorageService()
job_repository = JobRepository()
queue_service = AzureQueueService()

if queue_service.is_available:
    queue_service.ensure_queue_exists()

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

    job_repository.create_job(job_id, job.__dict__)
    job = job_repository.get_job(job_id)

    if req.assets:
        if job:
            job_repository.update_status(job_id, "uploading")

    return CreateJobResponse(job_id=job_id, status=job_repository.get_job(job_id)["status"])

# TODO: protect endpoint with auth
@router.post("/{job_id}/assets", response_model=AddAssetsResponse)
def add_assets(job_id: str, req: AddAssetsRequest):
    job = job_repository.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    existing = {(asset["kind"], asset["filename"]) for asset in job["assets"]}
    for asset in req.assets:
        key = (asset.kind, asset.filename)
        if key not in existing:
            job["assets"].append(asset.__dict__)
            existing.add(key)

    job_repository.update_status(job_id, "uploading")

    upload_instructions = []
    for a in req.assets:
        upload_instructions.append(
            UploadInstruction(
                filename=a.filename,
                kind=a.kind,
                url=storage_service.generate_upload_url(job_id, a.kind, a.filename, a.content_type),
                method="PUT",
                headers={"Content-Type": a.content_type or "application/octet-stream", "x-ms-blob-type": "BlockBlob"},
            )   
        )

    job_repository.save_job(job_id, job)
    
    return AddAssetsResponse(job_id=job_id, uploads=upload_instructions)


@router.post("/{job_id}/complete", response_model=CompleteJobResponse)
def complete_job(job_id: str):
    job = job_repository.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    clip_count = sum(1 for a in job["assets"] if a["kind"] == "clip")
    if clip_count == 0:
        raise HTTPException(status_code=400, detail="Job must include at least one clip")

    assets = job["assets"]
    if any(a["sequence"] is not None for a in assets):
        clips = sorted(
            [a for a in assets if a["kind"] == "clip"],
            key=lambda x: (x["sequence"] if x["sequence"] is not None else 10**9, x["filename"]),
        )
    else:
        clips = [a for a in assets if a["kind"] == "clip"]

    thumbs = [a for a in assets if a["kind"] == "thumbnail"]
    thumbnail = thumbs[0] if thumbs else None

    queue_message = {
        "job_id": job["job_id"],
        "title": job["title"],
        "description": job["description"],
        "clips": [{"filename": c["filename"], "sequence": c["sequence"]} for c in clips],
        "thumbnail": {"filename": thumbnail["filename"]} if thumbnail else None,
    }

    job_repository.update_status(job_id, "queued")
    job = job_repository.get_job(job_id)

    if queue_service.is_available:
        queue_service.enqueue_message_as_json(queue_message)
    else:
        raise HTTPException(status_code=503, detail="Azure queue service is not available, cannot process job at this time")

    
    return CompleteJobResponse(job_id=job_id, status=job["status"], queue_message=queue_message)


@router.get("/{job_id}", response_model=JobStatusResponse)
def get_job(job_id: str):
    job = job_repository.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(
        job_id=job["job_id"],
        status=job["status"],
        title=job["title"],
        description=job["description"],
        assets=job["assets"],
        youtube_url=job["youtube_url"],
        error=job["error"],
    )