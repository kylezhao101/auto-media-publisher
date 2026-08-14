from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)


# AZURE_KEY_VAULT_URL = os.getenv("AZURE_KEY_VAULT_URL", "").strip()


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()

    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")

    return value


# def get_azure_secret(vault_url: str, secret_name: str) -> str:
#     try:
#         client = SecretClient(
#             vault_url=vault_url,
#             credential=DefaultAzureCredential(),
#         )
#         secret = client.get_secret(secret_name)
#         print(f"Fetched secret successfully: {secret.name}")
#         return secret.value
#     except Exception as e:
#         print(f"Failed to fetch secret '{secret_name}': {e}")
#         raise


# def _get_env_or_azure_secret(
#     env_name: str,
#     *,
#     secret_name: str | None = None,
#     default: str = "",
# ) -> str:
#     value = os.getenv(env_name, "").strip()
#     if value:
#         print(f"Using env var for {env_name}")
#         return value

#     if AZURE_KEY_VAULT_URL and secret_name:
#         print(f"Env var {env_name} missing, trying Key Vault secret '{secret_name}'")
#         return get_azure_secret(AZURE_KEY_VAULT_URL, secret_name).strip()

#     print(f"Falling back to default for {env_name}")
#     return default


# AZURE_STORAGE_ACCOUNT_NAME = _get_env_or_azure_secret(
#     "AZURE_STORAGE_ACCOUNT_NAME",
#     secret_name="azure-storage-account-name",
# )

# AZURE_STORAGE_ACCOUNT_KEY = _get_env_or_azure_secret(
#     "AZURE_STORAGE_ACCOUNT_KEY",
#     secret_name="azure-storage-account-key",
# )

# AZURE_CONNECTION_STRING = _get_env_or_azure_secret(
#     "AZURE_CONNECTION_STRING",
#     secret_name="azure-connection-string",
# )

# BLOB_CONTAINER_UPLOADS = _get_env_or_azure_secret(
#     "BLOB_CONTAINER_UPLOADS",
#     secret_name="blob-container-uploads",
#     default="uploads",
# )

# BLOB_CONTAINER_PROCESSED = _get_env_or_azure_secret(
#     "BLOB_CONTAINER_PROCESSED",
#     secret_name="blob-container-processed",
#     default="processed",
# )

# BLOB_CONTAINER_JOBS = _get_env_or_azure_secret(
#     "BLOB_CONTAINER_JOBS",
#     secret_name="blob-container-jobs",
# )

# AZURE_BLOB_ENDPOINT = _get_env_or_azure_secret(
#     "AZURE_BLOB_ENDPOINT",
#     secret_name="azure-blob-endpoint",
# ).rstrip("/")

# AZURE_QUEUE_NAME = _get_env_or_azure_secret(
#     "AZURE_QUEUE_NAME",
#     secret_name="azure-queue-name",
#     default="video-processing",
# )

# SAS_EXPIRY_MINUTES = int(
#     _get_env_or_azure_secret(
#         "SAS_EXPIRY_MINUTES",
#         secret_name="sas-expiry-minutes",
#         default="60",
#     )
# )

# API_KEY = _get_env_or_azure_secret(
#     "API_KEY",
#     secret_name="api-key",
# )

SUPABASE_URL = require_env("SUPABASE_URL")
SUPABASE_KEY = require_env("SUPABASE_KEY")

GOOGLE_CLIENT_ID = require_env("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = require_env("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = require_env("GOOGLE_REDIRECT_URI")

YOUTUBE_TOKEN_ENCRYPTION_KEY = require_env("YOUTUBE_TOKEN_ENCRYPTION_KEY")

OAUTH_STATE_SECRET = require_env("OAUTH_STATE_SECRET")

FRONTEND_INVITE_URL = require_env("FRONTEND_INVITE_URL")
