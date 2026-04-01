from typing import Optional

from app.services.azure_storage_service import AzureStorageService

class JobRepository:
    def __init__(self) -> None:
        self.storage_service = AzureStorageService()
    
    def create_job(self, job_id: str, metadata: dict) -> None:
        self.storage_service.upload_job_metadata(job_id, metadata)
    
    def get_job(self, job_id: str) -> Optional[dict]:
        return self.storage_service.download_job_metadata(job_id)
    
    def update_status(self, job_id: str, status: str, youtube_video_id: Optional[str] = None) -> None:
        job = self.get_job(job_id)
        if not job:
            raise ValueError(f"Job with id {job_id} not found")
        job["status"] = status
        if youtube_video_id is not None:
            job["youtube_video_id"] = youtube_video_id
        self.storage_service.upload_job_metadata(job_id, job)
    
    def save_job(self, job_id: str, job: dict) -> None:
        self.storage_service.upload_job_metadata(job_id, job)
    
    def get_all_jobs(self) -> list[dict]:
        jobs = self.storage_service.download_all_job_metadata()

        return sorted(jobs, key=lambda j: j.get("created_at", ""), reverse=True)