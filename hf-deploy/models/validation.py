"""
validation.py - Shared field validation for game model value objects.

Provides a single _validate_field implementation used by both
Suggestion and Accusation to avoid code duplication.
"""

from __future__ import annotations


def validate_card_field(field_name: str, value: str) -> str:
    """Validate and normalize a card field value.

    Args:
        field_name (str): Field label used in error messages.
        value (str): Raw input value.

    Returns:
        str: Trimmed non-empty string.

    Raises:
        TypeError: If value is not a string.
        ValueError: If value is empty after trimming.
    """
    if not isinstance(value, str):
        raise TypeError(f"{field_name} must be a string")
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} cannot be empty")
    return normalized
