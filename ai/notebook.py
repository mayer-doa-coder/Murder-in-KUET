"""
notebook.py - Deduction Notebook System

Purpose: Tracks known cards and remaining possible solution cards for suspects,
weapons, and locations.
"""

from __future__ import annotations

from typing import Iterable, Optional, Tuple


class Notebook:
    """Deduction notebook used by players and AI agents.

    The notebook stores candidate solution sets for each category and a set of
    cards that are known not to be in the hidden solution.
    """

    def __init__(
        self,
        suspects: Iterable[str],
        weapons: Iterable[str],
        locations: Iterable[str],
    ) -> None:
        """Initialize notebook candidate sets.

        Args:
            suspects (Iterable[str]): All suspect card names.
            weapons (Iterable[str]): All weapon card names.
            locations (Iterable[str]): All location card names.
        """
        self.possible_suspects: set[str] = set(suspects)
        self.possible_weapons: set[str] = set(weapons)
        self.possible_locations: set[str] = set(locations)
        self.known_cards: set[str] = set()

    def eliminate(self, card: str) -> None:
        """Mark a card as known and remove it from candidate sets.

        Args:
            card (str): Card name to eliminate.

        Raises:
            ValueError: If card is empty or whitespace.
            TypeError: If card is not a string.
        """
        if not isinstance(card, str):
            raise TypeError("card must be a string")

        normalized = card.strip()
        if not normalized:
            raise ValueError("card cannot be empty")

        self.possible_suspects.discard(normalized)
        self.possible_weapons.discard(normalized)
        self.possible_locations.discard(normalized)
        self.known_cards.add(normalized)

    def is_solved(self) -> bool:
        """Return True when exactly one candidate remains in each category."""
        return (
            len(self.possible_suspects) == 1
            and len(self.possible_weapons) == 1
            and len(self.possible_locations) == 1
        )

    def get_solution(self) -> Optional[Tuple[str, str, str]]:
        """Return the deduced solution tuple if solved, otherwise None."""
        if not self.is_solved():
            return None

        suspect = next(iter(self.possible_suspects))
        weapon = next(iter(self.possible_weapons))
        location = next(iter(self.possible_locations))
        return (suspect, weapon, location)

    def __repr__(self) -> str:
        """Return a debug-friendly notebook view."""
        return (
            "Notebook(\n"
            f"  Suspects={self.possible_suspects},\n"
            f"  Weapons={self.possible_weapons},\n"
            f"  Locations={self.possible_locations},\n"
            f"  Known={self.known_cards}\n"
            ")"
        )
