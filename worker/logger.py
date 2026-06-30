from __future__ import annotations

import logging
import os
from pathlib import Path
from logging.handlers import RotatingFileHandler


def setup_logger(name: str = "worker") -> logging.Logger:
    default_app_data = Path(os.getenv("APPDATA", ".")) / "AutoMediaPublisher"

    app_data = Path(os.getenv("AMP_APP_DATA_DIR", str(default_app_data)))

    log_dir = app_data / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    logger.propagate = False

    if logger.handlers:
        return logger

    handler = RotatingFileHandler(
        log_dir / "worker.log",
        maxBytes=2 * 1024 * 1024,
        backupCount=3,
        encoding="utf-8",
    )

    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(handler)

    logger.info(
        "Logging initialized log_dir=%s",
        log_dir,
    )

    return logger
