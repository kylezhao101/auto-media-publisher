from __future__ import annotations
import asyncio
import asyncio
from datetime import datetime, timezone
import json
import uuid
from fastapi import APIRouter, HTTPException, Request

from fastapi.responses import StreamingResponse
from app.schemas.job import (
    AddAssetsRequest,
    AddAssetsResponse,
    CreateJobRequest,
    CreateJobResponse,
    JobStatusResponse,
    SubmitJobResponse,
    UpdateJobProgressRequest,
    UpdateJobStatusRequest,
    UploadInstruction,
)

from app.services.azure_storage_service import AzureStorageService
from app.services.azure_queue_service import AzureQueueService
from app.services.job_repository import JobRepository
from app.store.job_progress import set_progress, get_progress, clear_progress

router = APIRouter()
storage_service = AzureStorageService()
job_repository = JobRepository()
queue_service = AzureQueueService()

@router.post("", response_model=CreateJobResponse)
def create_job(req: CreateJobRequest):
    job_id = str(uuid.uuid4())
    job = {
        "job_id": job_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "title": req.title,
        "description": req.description,
        "status": "created",
        "assets": req.assets,
    }

    job_repository.create_job(job_id, job)
    job = job_repository.get_job(job_id)

    if req.assets:
        if job:
            job_repository.update_status(job_id, "uploading")

    return CreateJobResponse(job_id=job_id, status=job_repository.get_job(job_id)["status"])

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


@router.post("/{job_id}/submit", response_model=SubmitJobResponse)
def submit_job(job_id: str):
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

    if queue_service.is_available:
        queue_service.enqueue_message_as_json(queue_message)
    else:
        raise HTTPException(status_code=503, detail="Azure queue service is not available, cannot process job at this time")

    
    return SubmitJobResponse(job_id=job_id, status=job["status"], queue_message=queue_message)

@router.patch("/{job_id}/status", response_model=JobStatusResponse)
def patch_job(job_id: str, req: UpdateJobStatusRequest):
    job = job_repository.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_repository.update_status(job_id, req.status, req.youtube_video_id)
    job = job_repository.get_job(job_id)
    return JobStatusResponse(
        job_id=job["job_id"],
        status=job["status"],
        created_at=job.get("created_at"),
        title=job["title"],
        description=job["description"],
        assets=job["assets"],
        youtube_video_id=job.get("youtube_video_id"),
        error=job.get("error"),
    )
    

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
        youtube_video_id=job.get("youtube_video_id"),
        error=job.get("error"),
        created_at=job.get("created_at"),
        progress=get_progress(job["job_id"]), 
    )

@router.patch("/{job_id}/progress")
def update_progress(job_id: str, req: UpdateJobProgressRequest):
    job = job_repository.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    set_progress(job_id, req.rendering_progress, req.publishing_progress)
    return {"ok": True}

@router.get("/{job_id}/stream")
async def stream_progress(job_id: str):
    async def event_stream():
        while True:
            try:
                job = job_repository.get_job(job_id)
                if not job:
                    break

                progress = get_progress(job_id)
                status = job.get("status", "unknown")

                payload = {
                    "rendering_progress": progress.get("rendering_progress", 0),
                    "publishing_progress": progress.get("publishing_progress", 0),
                    "status": status,
                }

                yield f"data: {json.dumps(payload)}\n\n"

                if status in ("published", "failed"):
                    clear_progress(job_id)
                    break

                await asyncio.sleep(1)

            except Exception as e:
                print(f"SSE stream error for job {job_id}: {e}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                break

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no", 
            "Connection": "keep-alive",
        }
    )

@router.get("")
async def list_jobs():
    try:
        jobs = job_repository.get_all_jobs()
        return [
            {
                "job_id": job["job_id"],
                "status": job["status"],
                "title": job["title"],
                "created_at": job.get("created_at"),
                "description": job["description"],
                "assets": job["assets"],
                "youtube_video_id": job.get("youtube_video_id"),
                "error": job.get("error"),
                "progress": get_progress(job["job_id"]),
            }
            for job in jobs
        ]
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))