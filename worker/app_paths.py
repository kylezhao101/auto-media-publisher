from __future__ import annotations

import os
import sys
from pathlib import Path

APP_NAME = "AutoMediaPublisher"


def get_app_data_dir() -> Path:
    override = os.getenv("AMP_APP_DATA_DIR")

    if override:
        app_data = Path(override)
    elif sys.platform == "darwin":
        app_data = Path.home() / "Library" / "Application Support" / APP_NAME
    elif sys.platform == "win32":
        roaming = os.getenv("APPDATA")

        if roaming:
            app_data = Path(roaming) / APP_NAME
        else:
            app_data = Path.home() / "AppData" / "Roaming" / APP_NAME
    else:
        config_home = os.getenv("XDG_CONFIG_HOME")

        if config_home:
            app_data = Path(config_home) / APP_NAME
        else:
            app_data = Path.home() / ".config" / APP_NAME

    app_data.mkdir(parents=True, exist_ok=True)
    return app_data


def get_credentials_path() -> Path:
    return get_app_data_dir() / "gcp-credentials.json"


def get_google_token_path() -> Path:
    return get_app_data_dir() / "google-token.json"


def get_logs_dir() -> Path:
    log_dir = get_app_data_dir() / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir
