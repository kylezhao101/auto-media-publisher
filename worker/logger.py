from __future__ import annotations

import logging
import os
from pathlib import Path
from logging.handlers import RotatingFileHandler

from app_paths import get_logs_dir


def setup_logger(name: str = "worker") -> logging.Logger:
    log_dir = get_logs_dir()

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
