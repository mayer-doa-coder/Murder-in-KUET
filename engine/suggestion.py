"""
suggestion.py - Suggestion Value Object

Purpose: Represents a Cluedo-style suggestion containing suspect, weapon,
and location with basic input validation.
"""


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
        self.suspect = self._validate_field("suspect", suspect)
        self.weapon = self._validate_field("weapon", weapon)
        self.location = self._validate_field("location", location)

    @staticmethod
    def _validate_field(field_name: str, value: str) -> str:
        """Validate and normalize a suggestion field.

        Args:
            field_name (str): Field label used in error messages.
            value (str): Raw input value.

        Returns:
            str: Trimmed non-empty string.

        Raises:
            ValueError: If the input is empty after trimming.
            TypeError: If the input is not a string.
        """
        if not isinstance(value, str):
            raise TypeError(f"{field_name} must be a string")

        normalized = value.strip()
        if not normalized:
            raise ValueError(f"{field_name} cannot be empty")

        return normalized

    def __repr__(self) -> str:
        """Return a readable debug representation."""
        return (
            f"Suggestion(Suspect={self.suspect}, "
            f"Weapon={self.weapon}, "
            f"Location={self.location})"
        )

    __str__ = __repr__
