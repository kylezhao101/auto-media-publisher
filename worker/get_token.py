from __future__ import annotations

import json

from google_auth_oauthlib.flow import InstalledAppFlow

from app_paths import get_credentials_path, get_google_token_path

YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]


def create_token() -> bool:
    credentials_path = get_credentials_path()
    token_path = get_google_token_path()

    if not credentials_path.exists():
        raise RuntimeError(f"Missing credentials file: {credentials_path}")

    try:
        client_config = json.loads(credentials_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise RuntimeError(
            f"Credentials file is not valid JSON: {credentials_path}"
        ) from error

    flow = InstalledAppFlow.from_client_config(
        client_config,
        scopes=YOUTUBE_SCOPES,
    )

    credentials = flow.run_local_server(
        host="127.0.0.1",
        port=0,
        open_browser=True,
        success_message=(
            "YouTube authorization completed. " "You can close this browser window."
        ),
    )

    token_path.write_text(
        credentials.to_json(),
        encoding="utf-8",
    )

    return True


if __name__ == "__main__":
    create_token()
