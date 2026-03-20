from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)

AZURE_STORAGE_ACCOUNT_NAME = os.getenv("AZURE_STORAGE_ACCOUNT_NAME", "")
AZURE_STORAGE_ACCOUNT_KEY = os.getenv("AZURE_STORAGE_ACCOUNT_KEY", "")

BLOB_CONTAINER_UPLOADS = os.getenv("BLOB_CONTAINER_UPLOADS", "uploads")
BLOB_CONTAINER_PROCESSED = os.getenv("BLOB_CONTAINER_PROCESSED", "processed")
BLOB_CONTAINER_JOBS = os.getenv("BLOB_CONTAINER_JOBS", "jobs")

SAS_EXPIRY_MINUTES = int(os.getenv("SAS_EXPIRY_MINUTES", "60"))
AZURE_BLOB_ENDPOINT = os.getenv("AZURE_BLOB_ENDPOINT", "").rstrip("/")

AZURE_QUEUE_NAME = os.getenv("AZURE_QUEUE_NAME", "video_processing")

AZURE_CONNECTION_STRING = os.getenv("AZURE_CONNECTION_STRING", "").strip()