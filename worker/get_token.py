from pathlib import Path
import json
import os

from google_auth_oauthlib.flow import InstalledAppFlow

APP_DATA = Path(os.getenv("APPDATA")) / "AutoMediaPublisher"

GCP_CREDENTIALS_PATH = APP_DATA / "gcp-credentials.json"
GOOGLE_TOKEN_PATH = APP_DATA / "google-token.json"

YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]


def create_token():
    if not GCP_CREDENTIALS_PATH.exists():
        raise RuntimeError(f"Missing credentials file: {GCP_CREDENTIALS_PATH}")

    client_config = json.loads(GCP_CREDENTIALS_PATH.read_text(encoding="utf-8"))

    flow = InstalledAppFlow.from_client_config(
        client_config,
        scopes=YOUTUBE_SCOPES,
    )

    creds = flow.run_local_server(port=0)

    GOOGLE_TOKEN_PATH.write_text(
        creds.to_json(),
        encoding="utf-8",
    )

    return True


if __name__ == "__main__":
    create_token()
