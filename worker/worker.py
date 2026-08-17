from __future__ import annotations

import json
import sys
from pathlib import Path
from dotenv import load_dotenv

import signal

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env", override=True)

from render import render
from youtube import (
    upload_video,
    list_playlists,
    get_channel,
)
from logger import setup_logger

logger = setup_logger()

ffmpeg_process = None


def shutdown(*args):
    global ffmpeg_process

    if ffmpeg_process:
        ffmpeg_process.kill()

    sys.exit(1)


signal.signal(signal.SIGTERM, shutdown)
signal.signal(signal.SIGINT, shutdown)


def emit(msg: dict):
    print(json.dumps(msg), flush=True)


def main():
    stage = "startup"

    try:
        job = json.loads(sys.stdin.read())

        youtube_auth = job.get(
            "youtube_auth",
            {
                "type": "local",
            },
        )

        mode = job.get("mode", "render-and-upload")
        logger.info(f"Worker started mode={mode}")
        stage = f"mode:{mode}"

        if mode == "get-channel":
            channel = get_channel()
            print(
                json.dumps(channel),
                flush=True,
            )
            return

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

            logger.info(f"Render started clips={len(clip_paths)} output={output_path}")
            stage = "rendering"
            render(
                clip_paths,
                output_path,
                encoder=encoder,
                performance_mode=performance_mode,
                on_progress=lambda p: emit({"stage": "rendering", "percent": p}),
            )
            emit({"stage": "rendering", "percent": 100})
            logger.info("Render completed")

        elif mode == "upload-existing":
            if not output_path.exists():
                raise RuntimeError(f"Existing render not found: {output_path}")

        else:
            raise RuntimeError(f"Unknown job mode: {mode}")

        emit({"stage": "uploading", "percent": 0})

        logger.info(
            f"Upload started title={title} visibility={visibility} playlists={len(playlist_ids)}"
        )
        stage = "uploading"
        video_id = upload_video(
            output_path,
            title,
            description,
            thumbnail_path,
            visibility=visibility,
            playlist_ids=playlist_ids,
            youtube_auth=youtube_auth,
            on_progress=lambda p: emit({"stage": "uploading", "percent": p}),
        )
        logger.info(f"Upload completed video_id={video_id}")

        emit({"stage": "done", "video_id": video_id, "output_path": str(output_path)})

        # Do not delete by default. This lets failed uploads be retried without re-rendering.
        # output_path.unlink(missing_ok=True)
    except Exception:
        logger.exception(f"Worker failed during {stage}")
        raise


if __name__ == "__main__":
    try:
        main()
    except Exception:
        logger.exception("Worker failed")
        raise
