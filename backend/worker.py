from __future__ import annotations

import time
import traceback
from pathlib import Path
from typing import Any, Dict, Optional

from app.store.local_queue import dequeue, enqueue #local only
from app.store.memory import JOBS #local only

#POLL_INTERVAL_SECONDS = 1.0
MAX_RETRIES = 3

def _job_dir(job_id: str) -> Path:
    return Path("data") / job_id

def _find_clip_paths(job_id: str, message: Dict[str, any]) -> list[Path]:
    clips = message.get("clips") or []
    paths: list[Path] = []
    for clip in clips:
        filename = clip["filename"]
        paths.append(_job_dir(job_id) / "clip" / filename)
    return paths

def _placeholder_process(job_id: str, message: Dict[str, any]) -> Path:
    clip_paths = _find_clip_paths(job_id, message)
    if not clip_paths:
        raise RuntimeError("No clips found in queue message")
    
    processed_dir = _job_dir(job_id) / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)
    out_path = processed_dir / "output.bin"

    with out_path.open("wb") as out:
        for p in clip_paths:
            if not p.exists():
                raise FileNotFoundError(f"Missing clip file: {p}")
            out.write(p.read_bytes())

    return out_path

def process_message(message: Dict[str, any]) -> None:
    job_id = message.get("job_id")
    if not job_id:
        raise RuntimeError("queue message missing job_id")

    job = JOBS.get(job_id)
    if not job:
        raise RuntimeError(f"Job not found for job_id: {job_id}")
    
    job.status = "processing"
    job.error = None

    #placeholder for actual processing logic - here we just concatenate the clip files
    out_path = _placeholder_process(job_id, message)

    job.status = "done"
    print(f"Job {job_id} processed successfully, output at: {out_path}")

def handle_failure(message: Dict[str, any], exception: Exception) -> int:
    job_id = message.get("job_id", "unknown")
    attemp = int(message.get("attempt", 0))
    print(f"Error processing job {job_id} on attempt {attemp}: {exception}")
    traceback.print_exc()

    #local only
    if attemp < MAX_RETRIES:
        print(f"Re-enqueueing job {job_id} for retry (attempt {attemp + 1})")
        message["attempt"] = attemp + 1
        enqueue(message)
        return 1
    else:
        print(f"Job {job_id} failed after {MAX_RETRIES} attempts, marking as failed")
        job = JOBS.get(job_id)
        if job:
            job.status = "failed"
            job.error = f"{type(exception).__name__}: {str(exception)}"
        return 2

def main_once() -> None:
    message: Optional[Dict[str, Any]] = dequeue() #local only

    if not message:
        print("No messages in queue, sleeping...")
        return 0
    try:
        process_message(message)
        return 0
    except Exception as e:
        return handle_failure(message, e)

if __name__ == "__main__":
    raise SystemExit(main_once())
4