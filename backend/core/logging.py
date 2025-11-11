"""Logging utilities for Chronoface."""
from __future__ import annotations

import sys
from typing import Any, Dict

from loguru import logger

_LOG_CONFIGURED = False


def configure_logging(level: str = "INFO") -> None:
    """Configure loguru for the app."""

    global _LOG_CONFIGURED
    if _LOG_CONFIGURED:
        return

    logger.remove()
    def format_with_optional_phase(record):
        phase = record["extra"].get("phase", "")
        phase_str = f"{phase:<11} | " if phase else ""
        return (
            "{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | "
            f"{phase_str}"
            "{message}\n"
        )

    logger.add(
        sys.stdout,
        level=level,
        colorize=False,
        backtrace=False,
        diagnose=False,
        format=format_with_optional_phase,
    )
    _LOG_CONFIGURED = True


def with_phase(**extra: Dict[str, Any]):
    """Return a logger bound with additional context."""

    return logger.bind(**extra)
