from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    invitations,
    members,
    organizations,
    presets,
    youtube,
)

app = FastAPI(title="AutoMediaPublisher API")


origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://auto-media-publisher.vercel.app",
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {
        "status": "ok",
    }


app.include_router(
    organizations.router,
    prefix="/organizations",
    tags=["Organizations"],
)


app.include_router(
    presets.router,
    prefix="/organizations/{organization_id}/presets",
    tags=["Presets"],
)


app.include_router(
    members.router,
    prefix="/organizations/{organization_id}/members",
    tags=["Members"],
)


app.include_router(
    invitations.organization_router,
    prefix="/organizations/{organization_id}/invitations",
    tags=["Invitations"],
)


app.include_router(
    invitations.invitation_router,
    prefix="/invitations",
    tags=["Invitations"],
)


app.include_router(
    youtube.organization_router,
    prefix="/organizations/{organization_id}/youtube",
    tags=["YouTube"],
)


app.include_router(
    youtube.oauth_router,
    prefix="/youtube",
    tags=["YouTube OAuth"],
)
