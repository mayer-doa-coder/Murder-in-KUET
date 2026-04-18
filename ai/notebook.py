"""Bayesian notebook for probability-based Cluedo deductions."""

from __future__ import annotations

from typing import Iterable, Optional, Tuple


class BayesianNotebook:
    """Probability-based notebook used by players and AI agents.

    This notebook represents suspects, weapons, and locations as probability
    distributions and keeps compatibility fields used by existing AI modules.
    """

    def __init__(
        self,
        suspects: Iterable[str],
        weapons: Iterable[str],
        locations: Iterable[str],
    ) -> None:
        """Initialize notebook with uniform probabilities.

        Args:
            suspects (Iterable[str]): All suspect card names.
            weapons (Iterable[str]): All weapon card names.
            locations (Iterable[str]): All location card names.

        Raises:
            ValueError: If any input list is empty or has duplicates.
            TypeError: If any card name is not a string.
        """
        suspect_names = self._validate_cards(suspects, "suspects")
        weapon_names = self._validate_cards(weapons, "weapons")
        location_names = self._validate_cards(locations, "locations")

        self.suspects: dict[str, float] = self._uniform_distribution(suspect_names)
        self.weapons: dict[str, float] = self._uniform_distribution(weapon_names)
        self.locations: dict[str, float] = self._uniform_distribution(location_names)

        # Compatibility fields used throughout existing engine and AI code.
        self.possible_suspects: set[str] = set(suspect_names)
        self.possible_weapons: set[str] = set(weapon_names)
        self.possible_locations: set[str] = set(location_names)
        self.known_cards: set[str] = set()

    def _validate_cards(self, cards: Iterable[str], label: str) -> list[str]:
        """Validate card names and return a normalized list."""
        normalized_cards: list[str] = []
        seen: set[str] = set()

        for item in cards:
            if not isinstance(item, str):
                raise TypeError(f"{label} entries must be strings")

            normalized = item.strip()
            if not normalized:
                raise ValueError(f"{label} entries cannot be empty")

            if normalized in seen:
                raise ValueError(f"Duplicate {label} detected")

            normalized_cards.append(normalized)
            seen.add(normalized)

        if not normalized_cards:
            raise ValueError("Input lists cannot be empty")

        return normalized_cards

    def _uniform_distribution(self, values: list[str]) -> dict[str, float]:
        """Return a normalized uniform probability distribution."""
        base_probability = 1.0 / float(len(values))
        return {value: base_probability for value in values}

    def normalize(self, category: dict[str, float]) -> None:
        """Normalize a probability distribution so values sum to 1.0.

        Args:
            category (dict[str, float]): Probability dictionary to normalize.

        Raises:
            TypeError: If category is not a dictionary.
        """
        if not isinstance(category, dict):
            raise TypeError("category must be a dictionary")

        total = sum(category.values())
        if total == 0.0:
            return

        for key in category:
            category[key] = category[key] / total

        assert abs(sum(category.values()) - 1.0) < 1e-6

    def eliminate(self, card: str) -> None:
        """Eliminate a card by setting its probability to 0 and normalizing."""
        if not isinstance(card, str):
            raise TypeError("card must be a string")

        normalized = card.strip()
        if not normalized:
            raise ValueError("card cannot be empty")

        found = False
        updated = False
        if normalized in self.suspects:
            found = True
            if self.suspects[normalized] != 0.0:
                self.suspects[normalized] = 0.0
                self.normalize(self.suspects)
                updated = True
            self.possible_suspects.discard(normalized)

        if normalized in self.weapons:
            found = True
            if self.weapons[normalized] != 0.0:
                self.weapons[normalized] = 0.0
                self.normalize(self.weapons)
                updated = True
            self.possible_weapons.discard(normalized)

        if normalized in self.locations:
            found = True
            if self.locations[normalized] != 0.0:
                self.locations[normalized] = 0.0
                self.normalize(self.locations)
                updated = True
            self.possible_locations.discard(normalized)

        if not found:
            raise ValueError(f"Card '{normalized}' not found in any category")

        self.known_cards.add(normalized)

    def update_no_reveal(
        self,
        suspect: str,
        weapon: str,
        location: str,
        increment: float = 0.2,
    ) -> None:
        """Increase suggestion-card likelihood when no player reveals a card."""
        if not isinstance(suspect, str) or not suspect.strip():
            raise TypeError("suspect must be a non-empty string")
        if not isinstance(weapon, str) or not weapon.strip():
            raise TypeError("weapon must be a non-empty string")
        if not isinstance(location, str) or not location.strip():
            raise TypeError("location must be a non-empty string")
        if not isinstance(increment, (int, float)):
            raise TypeError("increment must be numeric")
        if increment <= 0.0:
            raise ValueError("increment must be greater than 0")

        suspect_name = suspect.strip()
        weapon_name = weapon.strip()
        location_name = location.strip()

        if suspect_name not in self.suspects:
            raise ValueError("Invalid suspect")
        if weapon_name not in self.weapons:
            raise ValueError("Invalid weapon")
        if location_name not in self.locations:
            raise ValueError("Invalid location")

        # Do not resurrect cards already confirmed as not in the solution.
        if suspect_name not in self.known_cards and self.suspects[suspect_name] > 0.0:
            self.suspects[suspect_name] += float(increment)
        if weapon_name not in self.known_cards and self.weapons[weapon_name] > 0.0:
            self.weapons[weapon_name] += float(increment)
        if location_name not in self.known_cards and self.locations[location_name] > 0.0:
            self.locations[location_name] += float(increment)

        self.normalize(self.suspects)
        self.normalize(self.weapons)
        self.normalize(self.locations)

    def update_reveal(self, card: str) -> None:
        """Update probabilities when a card is revealed."""
        self.eliminate(card)

    def is_solved(self) -> bool:
        """Return True when one candidate remains in each category."""
        return (
            len(self.possible_suspects) == 1
            and len(self.possible_weapons) == 1
            and len(self.possible_locations) == 1
        )

    def get_solution(self) -> Optional[Tuple[str, str, str]]:
        """Return deduced solution tuple when solved, otherwise None."""
        if not self.is_solved():
            return None

        suspect = next(iter(self.possible_suspects))
        weapon = next(iter(self.possible_weapons))
        location = next(iter(self.possible_locations))
        return (suspect, weapon, location)

    def display(self) -> None:
        """Pretty-print probability distributions for debugging."""
        print("\n--- Suspects ---")
        for card, probability in self.suspects.items():
            print(f"{card}: {probability:.3f}")

        print("\n--- Weapons ---")
        for card, probability in self.weapons.items():
            print(f"{card}: {probability:.3f}")

        print("\n--- Locations ---")
        for card, probability in self.locations.items():
            print(f"{card}: {probability:.3f}")

    def __repr__(self) -> str:
        """Return a debug-friendly notebook view."""
        return (
            "BayesianNotebook(\n"
            f"  Suspects={self.suspects},\n"
            f"  Weapons={self.weapons},\n"
            f"  Locations={self.locations},\n"
            f"  Known={self.known_cards}\n"
            ")"
        )


# Backward-compatible alias used by current player/game wiring.
Notebook = BayesianNotebook

