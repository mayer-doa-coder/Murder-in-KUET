"""Centralized logging configuration for Murder in KUET."""

from __future__ import annotations

import logging
from pathlib import Path

# Resolve the project root (two levels up from utils/) so logs always land
# in the project's own logs/ directory regardless of the working directory.
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
LOG_FILE_PATH = _PROJECT_ROOT / "logs" / "game.log"
LOG_FORMAT = "%(asctime)s - %(levelname)s - %(name)s - %(message)s"


def setup_logger(level: int = logging.INFO) -> None:
    """Configure root logging once for file + console output."""
    log_dir = LOG_FILE_PATH.parent
    log_dir.mkdir(parents=True, exist_ok=True)

    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    if root_logger.handlers:
        return

    formatter = logging.Formatter(LOG_FORMAT)

    file_handler = logging.FileHandler(LOG_FILE_PATH, encoding="utf-8")
    file_handler.setLevel(level)
    file_handler.setFormatter(formatter)

    stream_handler = logging.StreamHandler()
    stream_handler.setLevel(level)
    stream_handler.setFormatter(formatter)

    root_logger.addHandler(file_handler)
    root_logger.addHandler(stream_handler)
