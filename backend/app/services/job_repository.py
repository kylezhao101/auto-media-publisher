from typing import Optional

from app.services.azure_storage import StorageService

class JobRepository:
    def __init__(self) -> None:
        self.storage_service = StorageService()
    
    def create_job(self, job_id: str, metadata: dict) -> None:
        self.storage_service.upload_job_metadata(job_id, metadata)
    
    def get_job(self, job_id: str) -> Optional[dict]:
        return self.storage_service.download_job_metadata(job_id)
    
    def update_status(self, job_id: str, status: str) -> None:
        job = self.get_job(job_id)
        if not job:
            raise ValueError(f"Job with id {job_id} not found")
        job["status"] = status
        self.storage_service.upload_job_metadata(job_id, job)
    
    def save_job(self, job_id: str, job: dict) -> None:
        self.storage_service.upload_job_metadata(job_id, job)
    