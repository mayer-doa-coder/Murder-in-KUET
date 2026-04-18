"""Reusable small helper functions shared across modules."""

from __future__ import annotations

import random
from collections.abc import Iterable
from typing import Any


def safe_random_choice(items: Iterable[Any] | None) -> Any | None:
    """Safely return one random element from an iterable.

    Args:
        items: Any iterable collection (list, set, tuple, generator, etc.).

    Returns:
        A random element, or None when the iterable is empty or missing.
    """
    if items is None:
        return None

    materialized = list(items)
    if not materialized:
        return None

    return random.choice(materialized)


def safe_max(items: Iterable[Any] | None, default: Any = None) -> Any:
    """Return max(items) when non-empty, otherwise default."""
    if items is None:
        return default

    materialized = list(items)
    if not materialized:
        return default

    return max(materialized)


def safe_min(items: Iterable[Any] | None, default: Any = None) -> Any:
    """Return min(items) when non-empty, otherwise default."""
    if items is None:
        return default

    materialized = list(items)
    if not materialized:
        return default

    return min(materialized)


def clamp(value: float, min_value: float, max_value: float) -> float:
    """Clamp a numeric value to the inclusive [min_value, max_value] range."""
    return max(min_value, min(value, max_value))
