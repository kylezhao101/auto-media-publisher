from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional, Literal
import json

from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions, ContentSettings

from app.config import (
    AZURE_STORAGE_ACCOUNT_NAME, 
    AZURE_STORAGE_ACCOUNT_KEY,
    BLOB_CONTAINER_UPLOADS,
    BLOB_CONTAINER_JOBS,
    AZURE_BLOB_ENDPOINT,
    SAS_EXPIRY_MINUTES
)

AssetKind = Literal["clip", "thumbnail","sidecar"]

def _account_url(account_name:str) -> str:
    if AZURE_BLOB_ENDPOINT:
        return AZURE_BLOB_ENDPOINT
    return f"https://{account_name}.blob.core.windows.net"

@dataclass(frozen=True)
class BlobPath:
    container: str
    blob: str

class AzureStorageService:
    def __init__(self) -> None:
        if not AZURE_STORAGE_ACCOUNT_NAME or not AZURE_STORAGE_ACCOUNT_KEY:
            raise RuntimeError("Azure storage account name and key must be set in environment variables")

        self.account_name = AZURE_STORAGE_ACCOUNT_NAME
        self.account_key = AZURE_STORAGE_ACCOUNT_KEY
        self.client = BlobServiceClient(
            account_url=_account_url(self.account_name),
            credential=self.account_key
        )

    def uploads_path(self, job_id: str, asset_kind: AssetKind, filename: str) -> BlobPath:
        return BlobPath(container=BLOB_CONTAINER_UPLOADS, blob=f"{job_id}/{asset_kind}/{filename}")
    
    def jobs_path(self, job_id: str) -> BlobPath:
        return BlobPath(container=BLOB_CONTAINER_JOBS, blob=f"{job_id}/job.json")
        
    def upload_job_metadata(self, job_id: str, metadata: dict) -> None:
        path = self.jobs_path(job_id)
        blob_client = self.client.get_blob_client(container=path.container, blob=path.blob)
        blob_client.upload_blob(json.dumps(metadata), overwrite=True, content_settings=ContentSettings(content_type="application/json"))

    def download_job_metadata(self, job_id: str) -> Optional[dict]:
        path = self.jobs_path(job_id)
        blob_client = self.client.get_blob_client(container=path.container, blob=path.blob)
        try:
            downloader = blob_client.download_blob()
            raw = downloader.readall()
            return json.loads(raw.decode("utf-8"))
        except Exception as e:
            print(f"Error downloading job metadata for job {job_id}: {e}")
            return None

    def _blob_url(self, container: str, blob_name: str) -> str:
        return f"{_account_url(self.account_name)}/{container}/{blob_name}"
    
    def sas_put_url(self, path: BlobPath, content_type: Optional[str] = None) -> str:

        expiry = datetime.now(timezone.utc) + timedelta(minutes=SAS_EXPIRY_MINUTES)

        sas = generate_blob_sas(
            account_name=self.account_name,
            container_name=path.container,
            blob_name=path.blob,
            account_key=self.account_key,
            permission=BlobSasPermissions(write=True, create=True),
            expiry=expiry,
        )

        return f"{self._blob_url(path.container, path.blob)}?{sas}"

    def generate_upload_url(self, job_id: str, asset_kind: AssetKind, filename: str, content_type: Optional[str] = None) -> str:
        path = self.uploads_path(job_id, asset_kind, filename)
        return self.sas_put_url(path, content_type)
