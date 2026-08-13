import os

from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

import requests

from app.config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
)

YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]


def create_youtube_oauth_flow(
    code_verifier: str | None = None,
) -> Flow:
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }

    return Flow.from_client_config(
        client_config,
        scopes=YOUTUBE_SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI,
        code_verifier=code_verifier,
    )


def exchange_code_for_credentials(
    code: str,
    code_verifier: str,
):
    flow = create_youtube_oauth_flow(
        code_verifier=code_verifier,
    )

    flow.fetch_token(
        code=code,
    )

    return flow.credentials


def get_youtube_channel(credentials):
    youtube = build(
        "youtube",
        "v3",
        credentials=credentials,
    )

    response = (
        youtube.channels()
        .list(
            part="snippet",
            mine=True,
        )
        .execute()
    )

    if not response.get("items"):
        raise ValueError("No YouTube channel found")

    channel = response["items"][0]

    return {
        "channel_id": channel["id"],
        "channel_name": channel["snippet"]["title"],
    }


def revoke_google_token(token: str) -> None:
    response = requests.post(
        "https://oauth2.googleapis.com/revoke",
        params={"token": token},
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout=10,
    )

    if response.status_code == 200:
        return

    # Already expired/revoked is effectively disconnected for us.
    if response.status_code == 400:
        try:
            error = response.json().get("error")
        except ValueError:
            error = None

        if error == "invalid_token":
            return

    response.raise_for_status()
