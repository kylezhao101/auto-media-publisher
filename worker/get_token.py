import os
import json
from pathlib import Path
from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow

_ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)

YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
]

GOOGLE_CREDENTIALS_JSON = os.getenv("GOOGLE_CREDENTIALS_JSON", "")

if not GOOGLE_CREDENTIALS_JSON:
    raise RuntimeError("GOOGLE_CREDENTIALS_JSON is not set")

client_config = json.loads(GOOGLE_CREDENTIALS_JSON)

flow = InstalledAppFlow.from_client_config(
    client_config,
    scopes=YOUTUBE_SCOPES,
)

creds = flow.run_local_server(port=0)

with open("google_token.json", "w", encoding="utf-8") as token:
    token.write(creds.to_json())

print("Token saved to google_token.json")