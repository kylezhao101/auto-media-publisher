from __future__ import annotations

import json
import os
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

import time
import socket
import ssl
from http.client import HTTPException
from googleapiclient.errors import HttpError

APP_DATA = Path(os.getenv("APPDATA")) / "AutoMediaPublisher"

GCP_CREDENTIALS_PATH = APP_DATA / "gcp-credentials.json"
GOOGLE_TOKEN_PATH = APP_DATA / "google-token.json"

YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
]

RETRIABLE_EXCEPTIONS = (
    ConnectionAbortedError,
    ConnectionResetError,
    TimeoutError,
    OSError,
    socket.timeout,
    ssl.SSLError,
    HTTPException,
)

RETRIABLE_STATUS_CODES = [500, 502, 503, 504]


def get_youtube_client():
    if not GOOGLE_TOKEN_PATH.exists():
        raise RuntimeError(
            f"Google token not found. Please connect YouTube first: {GOOGLE_TOKEN_PATH}"
        )

    token_info = json.loads(GOOGLE_TOKEN_PATH.read_text(encoding="utf-8"))

    creds = Credentials.from_authorized_user_info(token_info, YOUTUBE_SCOPES)

    if creds.expired:
        if not creds.refresh_token:
            raise RuntimeError("No refresh token found. Please reconnect YouTube.")

        creds.refresh(Request())

        # Save refreshed access token back to AppData
        GOOGLE_TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")

    if not creds.valid:
        raise RuntimeError("Google credentials invalid after refresh")

    return build("youtube", "v3", credentials=creds)


def upload_with_retries(request, on_progress=None, max_retries=8):
    response = None
    error = None
    retry = 0

    while response is None:
        try:
            status, response = request.next_chunk()

            if status and on_progress:
                on_progress(int(status.progress() * 100))

        except HttpError as e:
            if e.resp.status in RETRIABLE_STATUS_CODES:
                error = e
            else:
                raise

        except RETRIABLE_EXCEPTIONS as e:
            error = e

        if error:
            if retry >= max_retries:
                raise error

            sleep_seconds = min(2**retry, 60)
            print(
                f'{{"stage":"warning","message":"Upload interrupted. Retrying in {sleep_seconds}s..."}}',
                flush=True,
            )
            time.sleep(sleep_seconds)
            retry += 1
            error = None

    return response


def upload_video(
    video_path: Path,
    title: str,
    description: str,
    thumbnail_path: Path | None = None,
    on_progress=None,
) -> str:
    youtube = get_youtube_client()

    body = {
        "snippet": {"title": title, "description": description},
        "status": {"privacyStatus": "private", "selfDeclaredMadeForKids": False},
    }

    media = MediaFileUpload(
        str(video_path),
        mimetype="video/mp4",
        resumable=True,
        chunksize=5 * 1024 * 1024,
    )
    request = youtube.videos().insert(
        part="snippet,status", body=body, media_body=media
    )

    response = upload_with_retries(request, on_progress=on_progress)

    video_id = response.get("id")

    if thumbnail_path and video_id:
        _upload_thumbnail(youtube, video_id, thumbnail_path)

    return video_id


def _upload_thumbnail(youtube, video_id: str, thumbnail_path: Path) -> None:
    suffix = thumbnail_path.suffix.lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}.get(
        suffix, "image/jpeg"
    )
    try:
        youtube.thumbnails().set(
            videoId=video_id,
            media_body=MediaFileUpload(str(thumbnail_path), mimetype=mime),
        ).execute()
    except Exception as e:
        # Non-fatal — video is uploaded, thumbnail just didn't apply
        print(
            json.dumps(
                {"stage": "warning", "message": f"Thumbnail upload failed: {e}"}
            ),
            flush=True,
        )
