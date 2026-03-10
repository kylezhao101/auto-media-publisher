from fastapi import FastAPI
from app.api import jobs
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AutoMediaPublisher API")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

@app.get("/")
def health_check():
    return {"status": "ok"}

app.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)