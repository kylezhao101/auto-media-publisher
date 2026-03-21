from __future__ import annotations

PROGRESS: dict[str, int] = {}

def set_progress(job_id: str, percent: int) -> None:
    PROGRESS[job_id] = percent

def get_progress(job_id: str) -> int:
    return PROGRESS.get(job_id, 0)

def clear_progress(job_id: str) -> None:
    PROGRESS.pop(job_id, None)