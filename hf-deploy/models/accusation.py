"""
accusation.py - Final Accusation Module

Purpose: Represents and validates final accusations and provides utility logic
to compare an accusation with the hidden solution.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from models.validation import validate_card_field


class Accusation:
    """Value object for a player's final accusation.

    Attributes:
        suspect (str): Suspect name in the accusation.
        weapon (str): Weapon name in the accusation.
        location (str): Location name in the accusation.
    """

    def __init__(self, suspect: str, weapon: str, location: str) -> None:
        """Create a validated accusation.

        Args:
            suspect (str): Suspect name.
            weapon (str): Weapon name.
            location (str): Location name.

        Raises:
            TypeError: If any field is not a string.
            ValueError: If any field is empty after trimming.
        """
        self.suspect = validate_card_field("suspect", suspect)
        self.weapon = validate_card_field("weapon", weapon)
        self.location = validate_card_field("location", location)

    def __repr__(self) -> str:
        """Return a readable debug representation."""
        return (
            f"Accusation(Suspect={self.suspect}, "
            f"Weapon={self.weapon}, "
            f"Location={self.location})"
        )

    __str__ = __repr__


def check_accusation(accusation: Any, solution: Mapping[str, str]) -> bool:
    """Return True if an accusation exactly matches the hidden solution.

    Args:
        accusation (Any): Accusation-like object with attributes
            `suspect`, `weapon`, and `location`.
        solution (Mapping[str, str]): Solution mapping with keys
            `suspect`, `weapon`, and `location`.

    Returns:
        bool: True when all three fields match exactly; otherwise False.

    Raises:
        ValueError: If accusation or solution are invalid.
        TypeError: If solution is not a mapping.
    """
    if accusation is None:
        raise ValueError("Invalid accusation")

    if not isinstance(solution, Mapping):
        raise TypeError("solution must be a mapping")

    required_fields = ("suspect", "weapon", "location")
    if any(not hasattr(accusation, field) for field in required_fields):
        raise ValueError("Invalid accusation")

    if any(key not in solution for key in required_fields):
        raise ValueError("Invalid solution")

    return (
        accusation.suspect == solution["suspect"]
        and accusation.weapon == solution["weapon"]
        and accusation.location == solution["location"]
    )
