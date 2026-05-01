"""
suggestion.py - Suggestion Value Object

Purpose: Represents a Cluedo-style suggestion containing suspect, weapon,
and location with basic input validation.
"""

from models.validation import validate_card_field


class Suggestion:
    """Immutable-style value object for a single suggestion.

    Attributes:
        suspect (str): Suggested suspect name.
        weapon (str): Suggested weapon name.
        location (str): Suggested location name.
    """

    def __init__(self, suspect: str, weapon: str, location: str) -> None:
        """Create a validated suggestion.

        Args:
            suspect (str): Suggested suspect name.
            weapon (str): Suggested weapon name.
            location (str): Suggested location name.

        Raises:
            ValueError: If any field is empty or only whitespace.
            TypeError: If any field is not a string.
        """
        self.suspect = validate_card_field("suspect", suspect)
        self.weapon = validate_card_field("weapon", weapon)
        self.location = validate_card_field("location", location)

    def __repr__(self) -> str:
        """Return a readable debug representation."""
        return (
            f"Suggestion(Suspect={self.suspect}, "
            f"Weapon={self.weapon}, "
            f"Location={self.location})"
        )

    __str__ = __repr__
