from __future__ import annotations

from datetime import date
import json
import os
from pathlib import Path
import tempfile
from dotenv import load_dotenv
import requests
import traceback
from azure.storage.queue import QueueClient
from azure.storage.blob import BlobClient, BlobServiceClient, generate_blob_sas, BlobSasPermissions, ContentSettings

import subprocess

_ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)

AZURE_CONNECTION_STRING = os.getenv("AZURE_CONNECTION_STRING", "")
AZURE_QUEUE_NAME = os.getenv("AZURE_QUEUE_NAME", "video-processing")
AZURE_UPLOADS_CONTAINER = os.getenv("BLOB_CONTAINER_UPLOADS", "uploads")
AZURE_PROCESSED_CONTAINER = os.getenv("BLOB_CONTAINER_PROCESSED", "processed")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
FFMPEG_PATH = os.getenv("FFMPEG_PATH", "ffmpeg")

blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
uploads_container_client = blob_service_client.get_container_client(AZURE_UPLOADS_CONTAINER)
processed_container_client = blob_service_client.get_container_client(AZURE_PROCESSED_CONTAINER)


def get_ordered_clips(job_data: dict) -> list[dict]:
    clips = [a for a in job_data["assets"] if a["kind"] == "clip"]
    clips.sort(key=lambda x: (x.get("sequence") is None, x.get("sequence", 10**9)))
    return clips

def get_latest_thumbnail(job_data: dict) -> dict | None:
    thumbnails = [a for a in job_data["assets"] if a["kind"] == "thumbnail"]
    return thumbnails[-1] if thumbnails else None

def download_blob_to_file(container_client, blob_name: str, download_path: Path) -> None:
    blob_client = container_client.get_blob_client(blob_name)
    with open(download_path, "wb") as download_file:
        download_file.write(blob_client.download_blob().readall())

def download_ordered_clips(job_id:str, job_data: dict, work_dir: Path, container_client):
    clips = get_ordered_clips(job_data)
    local_paths: list[Path] = []

    for clip in clips:
        filename = clip["filename"]
        blob_name = f"{job_id}/clip/{filename}" 
        local_path = work_dir / filename

        download_blob_to_file(container_client, blob_name, local_path)
        local_paths.append(local_path)
    
    return local_paths

def download_latest_thumbnail(job_id:str, job_data: dict, work_dir: Path, container_client) -> Path | None:
    thumbnail = get_latest_thumbnail(job_data)
    if not thumbnail:
        return None

    filename = thumbnail["filename"]
    blob_name = f"{job_id}/thumbnail/{filename}" 
    local_path = work_dir / filename

    download_blob_to_file(container_client, blob_name, local_path)
    
    return local_path

def write_concat_file(clip_paths: list[Path], concat_file: Path) -> None:
    lines = []
    for path in clip_paths:
        lines.append(f"file '{path.as_posix()}'")
    concat_file.write_text("\n".join(lines), encoding="utf-8")

def render_with_processing(clip_paths: list[Path], output_path: Path) -> None:
    concat_file = output_path.parent / "concat.txt"
    write_concat_file(clip_paths, concat_file)

    cmd = [
        FFMPEG_PATH,
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(concat_file),

        # example audio denoise filter
        "-af", "afftdn",

        # example encode settings
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "192k",

        str(output_path),
    ]

    subprocess.run(cmd, check=True)

def upload_blob_from_file(container_client, blob_name: str, file_path: Path, content_type: str) -> None:
    blob_client = container_client.get_blob_client(blob_name)
    with open(file_path, "rb") as data:
        blob_client.upload_blob(
            data,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )

def process_job(job_id: str, job_data: dict) -> Path:
    clips_data = get_ordered_clips(job_data)

    if not clips_data:
        raise ValueError("No clips found in job data")
    with tempfile.TemporaryDirectory(prefix=f"job_{job_id}_") as temp_dir:
        work_dir_path = Path(temp_dir)
        clip_paths = download_ordered_clips(job_id, job_data, work_dir_path, uploads_container_client)
        thumbnail_path = download_latest_thumbnail(job_id, job_data, work_dir_path, uploads_container_client)

        for path in clip_paths:
            print(f"Downloaded clip to {path}")

        if thumbnail_path:
            print(f"Downloaded thumbnail to {thumbnail_path}")
        
        out_path = work_dir_path / f"{job_id}_output.mp4"
        render_with_processing(clip_paths, out_path)

        print(f"Rendered output to {out_path}")

        persisted_out_path = Path.cwd() / f"{job_id}_output_persisted.mp4"
        persisted_out_path.write_bytes(out_path.read_bytes())

        return persisted_out_path


def main_once():
    if not AZURE_CONNECTION_STRING:
        print("Azure connection string is not set. Exiting.")
        return 1

    queue = QueueClient.from_connection_string(
        conn_str=AZURE_CONNECTION_STRING,
        queue_name=AZURE_QUEUE_NAME,
    )

    messages = queue.receive_messages(messages_per_page=1, visibility_timeout=300)
    message = next(messages, None)

    if not message:
        print("No messages in queue. Exiting.")
        return 0

    print("Received message:", message.content)

    try:
        message_json = json.loads(message.content)
        job_id = message_json.get("job_id")

        if not job_id:
            raise ValueError("Queue message missing job_id")

        job_response = requests.get(f"{API_BASE_URL}/jobs/{job_id}")
        job_response.raise_for_status()

        job_data = job_response.json()
        print(f"Processing job {job_id}: {job_data}")

        try:
            output_path = process_job(job_id, job_data)
            upload_blob_from_file(
                processed_container_client,
                f"{date.today().isoformat()}_{job_id}_{output_path.name}",
                output_path,
                content_type="video/mp4",
            )

            requests.patch(f"{API_BASE_URL}/jobs/{job_id}/status", json={"status": "rendered"})

            print(f"Job {job_id} processed successfully. Output saved to {output_path}")
        except Exception as e:
            print(f"Error processing job {job_id}: {e}")
            traceback.print_exc()
        # only delete if processing succeeds
        #queue.delete_message(message)
        #print("Message deleted after successful processing.")

    except Exception as e:
        print(f"Error processing message: {e}")
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main_once())