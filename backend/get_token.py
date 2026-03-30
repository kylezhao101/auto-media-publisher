import os
import pickle
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]

GOOGLE_CREDENTIALS_PATH = os.getenv("GOOGLE_CREDENTIALS_PATH", "")

flow = InstalledAppFlow.from_client_secrets_file(
    r"C:\Users\kylez\projects\auto-media-publisher\gcp-credentials.json", 
    SCOPES
)

creds = flow.run_local_server(port=0)

with open("google_token.json", "wb") as token:
    pickle.dump(creds, token)

print("Token saved to google_token.json")