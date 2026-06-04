"""
base_ai.py - AI Interface Module

Purpose: Base AI interface defining the contract for all AI implementations.
This module provides the abstract base class that all AI agents must inherit from.
"""

from __future__ import annotations

from typing import Any, Sequence


class BaseAI:
    """
    Contract every AI agent must fulfil.

    The agent is owned by an AIPlayer. It receives the full GameState on
    every call and returns structured decisions that the player executes.
    """

    def choose_move(self, state: Any, valid_moves: Sequence[str]) -> str | None:
        """Select a movement destination from the legal move set.

        Args:
            state (Any): Current game-state snapshot.
            valid_moves (Sequence[str]): Legal move destinations for this turn.

        Returns:
            str | None: Selected destination, or None to remain in place.
        """
        raise NotImplementedError

    def make_suggestion(self, state: Any) -> tuple[str, str, str]:
        """Generate a suggestion as (suspect, weapon, location).

        Args:
            state: Game state view containing at least:
                   - suspects: list[str]
                   - weapons: list[str]
                   - current_location: str

        Returns:
            tuple[str, str, str]: The suggested suspect, weapon, and location.
        """
        raise NotImplementedError

    def decide_accusation(self, state: Any) -> bool:
        """Decide whether to make a final accusation this turn.

        Args:
            state (Any): Current game-state snapshot.

        Returns:
            bool | tuple[str, str, str]: False to skip accusation; True to accuse
            using the notebook's best guess; or a (suspect, weapon, location) tuple
            with an explicit accusation when the agent is certain of the solution.
        """
        raise NotImplementedError

    def update_knowledge(self, suggestion, player_who_showed, card_shown=None):
        """
        Receive new evidence after a suggestion resolves.

        Args:
            suggestion (dict): The suggestion that was made.
            player_who_showed (str | None): Player who showed a card, or None.
            card_shown (str | None): Card shown to this AI, or None.
        """
        # Agents without a knowledge base can ignore this.

    def update_from_clue(self, card) -> None:
        """Update AI state from a revealed card.

        Args:
            card: Revealed card object, or None.
        """
        # Default no-op for simple agents.

    def handle_no_reveal(self, suggestion) -> None:
        """Handle the case where no opponent can reveal any card.

        Args:
            suggestion: Suggestion object or equivalent representation.
        """
        # Default no-op for simple agents.
