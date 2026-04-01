from __future__ import annotations

PROGRESS: dict[str, dict[str, int]] = {}

def set_progress(job_id: str, rendering_progress: int = None, publishing_progress: int = None) -> None:
    if job_id not in PROGRESS:
        PROGRESS[job_id] = {}
    if rendering_progress is not None:
        PROGRESS[job_id]["rendering_progress"] = rendering_progress
    if publishing_progress is not None:
        PROGRESS[job_id]["publishing_progress"] = publishing_progress

def get_progress(job_id: str) -> dict[str, int]:
    return {
        "rendering_progress": PROGRESS.get(job_id, {}).get("rendering_progress", 0),
        "publishing_progress": PROGRESS.get(job_id, {}).get("publishing_progress", 0),
    }

def clear_progress(job_id: str) -> None:
    PROGRESS.pop(job_id, None)