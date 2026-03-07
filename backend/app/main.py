from fastapi import FastAPI
from app.api import jobs

app = FastAPI(title="AutoMediaPublisher API")

@app.get("/")
def health_check():
    return {"status": "ok"}

app.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])