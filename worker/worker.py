from __future__ import annotations

import json
import sys
from pathlib import Path
from dotenv import load_dotenv

import signal

ffmpeg_process = None


def shutdown(*args):
    global ffmpeg_process

    if ffmpeg_process:
        ffmpeg_process.kill()

    sys.exit(1)


signal.signal(signal.SIGTERM, shutdown)
signal.signal(signal.SIGINT, shutdown)

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env", override=True)

from render import render
from youtube import upload_video, list_playlists


def emit(msg: dict):
    print(json.dumps(msg), flush=True)


def main():
    job = json.loads(sys.stdin.read())

    mode = job.get("mode", "render-and-upload")

    if mode == "list-playlists":
        playlists = list_playlists()
        print(json.dumps(playlists), flush=True)
        return

    encoder = job.get("encoder", "gpu")
    performance_mode = job.get("performance_mode", "balanced")

    clip_paths = [Path(p) for p in job.get("clips", [])]
    thumbnail_path = Path(job["thumbnail"]) if job.get("thumbnail") else None
    title = job["title"]
    description = job.get("description", "")
    output_path = Path(job["output_path"])

    visibility = job.get("visibility", "private")
    playlist_ids = job.get("playlist_ids", [])

    if mode == "render-and-upload":
        if not clip_paths:
            raise RuntimeError("No clips provided for render-and-upload mode")

        emit({"stage": "rendering", "percent": 0})
        render(
            clip_paths,
            output_path,
            encoder=encoder,
            performance_mode=performance_mode,
            on_progress=lambda p: emit({"stage": "rendering", "percent": p}),
        )
        emit({"stage": "rendering", "percent": 100})

    elif mode == "upload-existing":
        if not output_path.exists():
            raise RuntimeError(f"Existing render not found: {output_path}")

    else:
        raise RuntimeError(f"Unknown job mode: {mode}")

    emit({"stage": "uploading", "percent": 0})
    video_id = upload_video(
        output_path,
        title,
        description,
        thumbnail_path,
        visibility=visibility,
        playlist_ids=playlist_ids,
        on_progress=lambda p: emit({"stage": "uploading", "percent": p}),
    )

    emit({"stage": "done", "video_id": video_id, "output_path": str(output_path)})

    # Do not delete by default. This lets failed uploads be retried without re-rendering.
    # output_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
