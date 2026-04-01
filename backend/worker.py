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
from azure.storage.blob import BlobServiceClient, ContentSettings

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.http import MediaFileUpload

import subprocess
import re

_ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)

AZURE_CONNECTION_STRING = os.getenv("AZURE_CONNECTION_STRING", "")
AZURE_QUEUE_NAME = os.getenv("AZURE_QUEUE_NAME", "video-processing")
AZURE_UPLOADS_CONTAINER = os.getenv("BLOB_CONTAINER_UPLOADS", "uploads")
AZURE_PROCESSED_CONTAINER = os.getenv("BLOB_CONTAINER_PROCESSED", "processed")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
FFMPEG_PATH = os.getenv("FFMPEG_PATH", "ffmpeg")
PUBLISHER_SERVICE_API_KEY = os.getenv("API_KEY", "")
FFPROBE_PATH = os.getenv("FFPROBE_PATH", "ffprobe")

blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
uploads_container_client = blob_service_client.get_container_client(AZURE_UPLOADS_CONTAINER)
processed_container_client = blob_service_client.get_container_client(AZURE_PROCESSED_CONTAINER)

GOOGLE_CREDENTIALS_JSON = os.getenv("GOOGLE_CREDENTIALS_JSON", "")
GOOGLE_TOKEN_JSON = os.getenv("GOOGLE_TOKEN_JSON", "")

YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"]

YOUTUBE_CHANNEL_ID = os.getenv("FCNABC_CHANNEL_ID", "")

def get_youtube_client():
    creds = None
    if GOOGLE_TOKEN_JSON:
        token_info = json.loads(GOOGLE_TOKEN_JSON)
        creds = Credentials.from_authorized_user_info(token_info, YOUTUBE_SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not GOOGLE_CREDENTIALS_JSON:
                raise RuntimeError("GOOGLE_CREDENTIALS_JSON is not set")

            with tempfile.NamedTemporaryFile(
                mode="w",
                suffix=".json",
                delete=False,
                encoding="utf-8",
            ) as temp_creds_file:
                temp_creds_file.write(GOOGLE_CREDENTIALS_JSON)
                temp_creds_path = temp_creds_file.name

            try:
                flow = InstalledAppFlow.from_client_secrets_file(
                    temp_creds_path,
                    YOUTUBE_SCOPES,
                )
                creds = flow.run_local_server(port=0)
            finally:
                Path(temp_creds_path).unlink(missing_ok=True)

    return build("youtube", "v3", credentials=creds)

def upload_to_youtube(video_path: Path, title: str, description: str = "", job_id: str = "", thumbnail_path: Path | None = None) -> str:
    youtube_client = get_youtube_client()

    body = {
        "snippet": {
            "title": title,
            "description": description,
        },
        "status": {
            "privacyStatus": "private",
            "selfDeclaredMadeForKids": False,
        }
    }

    media = MediaFileUpload(str(video_path), mimetype="video/mp4", resumable=True, chunksize=5 * 1024 * 1024)
    request = youtube_client.videos().insert(part="snippet,status", body=body, media_body=media)

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"Upload progress for job {job_id}: {int(status.progress() * 100)}%")
            if job_id:
                api_patch(f"/jobs/{job_id}/progress", json={"publishing_progress": int(status.progress() * 100), "status": "publishing"})

    video_id = response.get("id")
    print(f"Upload complete for job {job_id}. Video ID: {video_id}")

    if thumbnail_path and video_id:
        suffix = thumbnail_path.suffix.lower()
        mime_types = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
        mime_type = mime_types.get(suffix, "image/jpeg")

        try:
            youtube_client.thumbnails().set(
                videoId=video_id,
                media_body=MediaFileUpload(str(thumbnail_path), mimetype=mime_type)
            ).execute()
            print(f"Thumbnail uploaded for job {job_id}.")
        except Exception as e:
            print(f"Failed to upload thumbnail for job {job_id}: {e}")
    else:
        print(f"Skipping thumbnail — path: {thumbnail_path}, video_id: {video_id}")

    return video_id


def api_header():
    return {"X-API-Key": PUBLISHER_SERVICE_API_KEY}

def api_patch(path: str, json: dict) -> requests.Response:
    url = f"{API_BASE_URL}{path}"
    print(f"PATCH {url} {json}")
    response = requests.patch(url, json=json, headers=api_header())
    print(f"PATCH {url} -> {response.status_code} {response.text}")
    return response

def get_ordered_clips(job_data: dict) -> list[dict]:
    clips = [a for a in job_data["assets"] if a["kind"] == "clip"]
    clips.sort(key=lambda x: (x.get("sequence") is None, x.get("sequence", 10**9)))
    return clips

def get_latest_thumbnail(job_data: dict) -> dict | None:
    thumbnails = [a for a in job_data["assets"] if a["kind"] == "thumbnail"]
    return thumbnails[-1] if thumbnails else None

def download_blob_to_file(container_client, blob_name: str, download_path: Path) -> None:
    blob_client = container_client.get_blob_client(blob_name)

    properties = blob_client.get_blob_properties()
    total_size = properties.size

    downloaded = 0
    last_reported = -1

    stream = blob_client.download_blob()

    with open(download_path, "wb") as download_file:
        for chunk in stream.chunks():
            download_file.write(chunk)

            downloaded += len(chunk)
            percent = int((downloaded / total_size) * 100)

            if percent >= last_reported + 5:
                print(
                    f"Downloading {blob_name}: {percent}% "
                    f"({downloaded / 1024 / 1024:.1f} MB / {total_size / 1024 / 1024:.1f} MB)"
                )
                last_reported = percent

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

def get_total_duration(clip_paths: list[Path]) -> float:
    total = 0.0
    for path in clip_paths:
        result = subprocess.run(
            [FFPROBE_PATH, "-v", "error",
             "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True
        )
        try:
            total += float(result.stdout.strip())
        except ValueError:
            pass
    return total

def render_with_processing(clip_paths: list[Path], output_path: Path, job_id: str) -> None:
    concat_file = output_path.parent / "concat.txt"
    write_concat_file(clip_paths, concat_file)

    total_duration = get_total_duration(clip_paths)

    cmd = [
        FFMPEG_PATH,
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(concat_file),
        "-map", "0:v:0",
        "-map", "0:a:0",
        "-af", "highpass=f=80,afftdn,lowpass=f=8000",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "192k",
        str(output_path),
    ]

    process = subprocess.Popen(cmd, stderr=subprocess.PIPE, universal_newlines=True)

    last_reported = -1

    for line in process.stderr:
        print(line, end="", flush=True)
        if total_duration > 0:
            match = re.search(r"time=(\d+):(\d+):(\d+\.\d+)", line)
            if match:
                h, m, s = match.groups()
                elapsed = int(h) * 3600 + int(m) * 60 + float(s)
                percent = min(int((elapsed / total_duration) * 100), 99)
                if percent >= last_reported + 5:
                    api_patch(f"/jobs/{job_id}/progress", json={"rendering_progress": percent})
                    last_reported = percent

    process.wait()

    if process.returncode != 0:
        raise subprocess.CalledProcessError(process.returncode, cmd)
    concat_file = output_path.parent / "concat.txt"
    write_concat_file(clip_paths, concat_file)

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
    
    persisted_out_path = Path.cwd() / f"{job_id}_output_persisted.mp4"
    persisted_thumbnail_path = next(Path.cwd().glob(f"{job_id}_thumbnail.*"), None)

    if persisted_out_path.exists():
        print(f"Rendered output already exists for job {job_id}, skipping render.")
        return persisted_out_path, persisted_thumbnail_path

    persisted_clip_paths = []
    for clip in clips_data:
        persisted_clip_path = Path.cwd() / f"{job_id}_clip_{clip['filename']}"
        if persisted_clip_path.exists():
            print(f"Clip already downloaded: {persisted_clip_path}")
            persisted_clip_paths.append(persisted_clip_path)

    persisted_thumbnail_path = next(Path.cwd().glob(f"{job_id}_thumbnail.*"), None)
    if persisted_thumbnail_path:
        print(f"Thumbnail already downloaded: {persisted_thumbnail_path}")

    clips_already_downloaded = len(persisted_clip_paths) == len(clips_data)
    thumbnail_already_downloaded = persisted_thumbnail_path is not None

    with tempfile.TemporaryDirectory(prefix=f"job_{job_id}_") as temp_dir:
        work_dir_path = Path(temp_dir)

        if clips_already_downloaded:
            clip_paths = persisted_clip_paths
        else:
            clip_paths = download_ordered_clips(job_id, job_data, work_dir_path, uploads_container_client)

            persisted_clip_paths = []
            for clip_path in clip_paths:
                dest = Path.cwd() / f"{job_id}_clip_{clip_path.name}"
                dest.write_bytes(clip_path.read_bytes())
                persisted_clip_paths.append(dest)
                print(f"Persisted clip to {dest}")
            clip_paths = persisted_clip_paths

        if thumbnail_already_downloaded:
            thumbnail_path = persisted_thumbnail_path
        else:
            thumbnail_path = download_latest_thumbnail(job_id, job_data, work_dir_path, uploads_container_client)
            if thumbnail_path:
                suffix = thumbnail_path.suffix
                persisted_thumbnail_path = Path.cwd() / f"{job_id}_thumbnail{suffix}"
                persisted_thumbnail_path.write_bytes(thumbnail_path.read_bytes())
                thumbnail_path = persisted_thumbnail_path
                print(f"Persisted thumbnail to {thumbnail_path}")

        out_path = work_dir_path / f"{job_id}_output.mp4"

        try:
            render_with_processing(clip_paths, out_path, job_id)
        except subprocess.CalledProcessError as e:
            print(f"Error during rendering job {job_id}: {e}")
            api_patch(f"/jobs/{job_id}/status", json={"status": "failed"})
            raise

        persisted_out_path = Path.cwd() / f"{job_id}_output_persisted.mp4"
        persisted_out_path.write_bytes(out_path.read_bytes())

        return persisted_out_path, thumbnail_path
    
    clips_data = get_ordered_clips(job_data)

    if not clips_data:
        raise ValueError("No clips found in job data")
    
    persisted_out_path = Path.cwd() / f"{job_id}_output_persisted.mp4"
    persisted_thumbnail_path = next(Path.cwd().glob(f"{job_id}_thumbnail.*"), None)

    if persisted_out_path.exists():
        print(f"Rendered output already exists for job {job_id}, skipping render.")
        return persisted_out_path, persisted_thumbnail_path
    
    persisted_clip_paths = []
    for clip in clips_data:
        persisted_clip_path = Path.cwd() / f"{job_id}_clip_{clip['filename']}"
        if persisted_clip_path.exists():
            print(f"Clip already downloaded: {persisted_clip_path}")
            persisted_clip_paths.append(persisted_clip_path)

    persisted_thumbnail_path = next(Path.cwd().glob(f"{job_id}_thumbnail.*"), None)
    if persisted_thumbnail_path:
        print(f"Thumbnail already downloaded: {persisted_thumbnail_path}")

    clips_already_downloaded = len(persisted_clip_paths) == len(clips_data)
    thumbnail_already_downloaded = persisted_thumbnail_path is not None

    with tempfile.TemporaryDirectory(prefix=f"job_{job_id}_") as temp_dir:
        work_dir_path = Path(temp_dir)
        clip_paths = download_ordered_clips(job_id, job_data, work_dir_path, uploads_container_client)
        thumbnail_path = download_latest_thumbnail(job_id, job_data, work_dir_path, uploads_container_client)

        for path in clip_paths:
            print(f"Downloaded clip to {path}")

        if thumbnail_path:
            print(f"Downloaded thumbnail to {thumbnail_path}")
        
        out_path = work_dir_path / f"{job_id}_output.mp4"

        try:
            render_with_processing(clip_paths, out_path, job_id)
        except subprocess.CalledProcessError as e:
            print(f"Error during rendering job {job_id}: {e}")

            update_status_response = api_patch(f"/jobs/{job_id}/status", json={"status": "failed"})
            if update_status_response.status_code != 200:
                print(f"Failed to update job status for job {job_id}: {update_status_response.status_code} - {update_status_response.text}")

            raise

        print(f"Rendered output to {out_path}")

        persisted_out_path = Path.cwd() / f"{job_id}_output_persisted.mp4"
        persisted_out_path.write_bytes(out_path.read_bytes())

        persisted_thumbnail_path = None
        if thumbnail_path:
            suffix = thumbnail_path.suffix
            persisted_thumbnail_path = Path.cwd() / f"{job_id}_thumbnail{suffix}"
            persisted_thumbnail_path.write_bytes(thumbnail_path.read_bytes())

        return persisted_out_path, persisted_thumbnail_path


def main_once():
    if not AZURE_CONNECTION_STRING:
        print("Azure connection string is not set. Exiting.")
        return 1

    queue = QueueClient.from_connection_string(
        conn_str=AZURE_CONNECTION_STRING,
        queue_name=AZURE_QUEUE_NAME,
    )

    messages = queue.receive_messages(messages_per_page=1, visibility_timeout=10)
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

        job_response = requests.get(f"{API_BASE_URL}/jobs/{job_id}", headers=api_header())
        job_response.raise_for_status()

        job_data = job_response.json()
        print(f"Processing job {job_id}: {job_data}")

        try:
            try:
                output_path = None
                thumbnail_path = None
                output_path, thumbnail_path = process_job(job_id, job_data)
            except Exception as e:
                print(f"Error processing job {job_id}: {e}")
                api_patch(f"/jobs/{job_id}/status", json={"status": "failed"})
                raise

            upload_blob_from_file(
                processed_container_client,
                f"{date.today().isoformat()}_{job_id}_{output_path.name}",
                output_path,
                content_type="video/mp4",
            )

            api_patch(f"/jobs/{job_id}/status", json={"status": "rendered"})

            job_title = job_data.get("title", f"Video {job_id}")
            job_description = job_data.get("description", "")

            youtube_video_id = upload_to_youtube(output_path, job_title, job_description, job_id, thumbnail_path)

            api_patch(f"/jobs/{job_id}/status", json={"youtube_video_id": youtube_video_id, "status": "published"})

            queue.delete_message(message)
            print("Message deleted after successful processing.")

            if output_path and output_path.exists():
                output_path.unlink()
            if thumbnail_path and thumbnail_path.exists():
                thumbnail_path.unlink()

            for clip in job_data.get("assets", []):
                if clip["kind"] == "clip":
                    p = Path.cwd() / f"{job_id}_clip_{clip['filename']}"
                    if p.exists():
                        p.unlink()
        
        except Exception as e:
            print(f"Error processing job {job_id}: {e}")
            traceback.print_exc()

    except Exception as e:
        print(f"Error processing message: {e}")
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main_once())