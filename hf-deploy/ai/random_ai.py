"""
random_ai.py - Baseline AI Module

Purpose: Implements a baseline AI that makes random decisions.
This module provides a simple AI for testing and as a baseline for smarter agents.
"""

import logging
from types import SimpleNamespace

from ai.base_ai import BaseAI
from utils.helpers import safe_random_choice

logger = logging.getLogger(__name__)


class RandomAI(BaseAI):
    """
    Simplest possible AI: every decision is made at random.
    Useful as a baseline and for smoke-testing the game loop.
    """

    # After this many turns without a solution, make a random accusation anyway
    ACCUSATION_PATIENCE = 15

    def __init__(self):
        self.turn_count = 0

    def choose_move(self, game_state, valid_moves):
        """
        Move to a random room from the pre-computed reachable set.

        The engine has already applied the dice roll and corridor weights to
        produce valid_moves (which may also include a secret passage option).
        RandomAI picks uniformly at random.

        In Cluedo it is legal to roll a number too low to reach any adjacent
        room — in that case the player stays put and may still suggest in their
        current room.  Returning None signals "stay in current room".

        Returns:
            str | None: A randomly chosen reachable room, or None to stay put.
        """
        return safe_random_choice(valid_moves)

    def make_suggestion(self, state) -> tuple[str, str, str]:
        """Return a random suggestion tuple from the current game state.

        The suspect and weapon are sampled uniformly from state-provided pools.
        The location is fixed to state.current_location because Cluedo-style
        suggestions must name the room the current player is in.

        Args:
            state: State object exposing `suspects`, `weapons`, and
                `current_location`.

        Returns:
            tuple[str, str, str]: (suspect, weapon, location)

        Raises:
            ValueError: If suspects/weapons are empty or location is invalid.
        """
        suspect_pool = getattr(state, "suspects", None)
        weapon_pool = getattr(state, "weapons", None)
        location = getattr(state, "current_location", None)

        if (
            not suspect_pool
            or not weapon_pool
            or not isinstance(location, str)
            or not location.strip()
        ):
            raise ValueError("Invalid game state for suggestion")

        suspect = safe_random_choice(suspect_pool)
        weapon = safe_random_choice(weapon_pool)
        if suspect is None or weapon is None:
            raise ValueError("Invalid game state for suggestion")
        return (suspect, weapon, location)

    def decide_accusation(self, state) -> bool:
        """Return True once accusation patience is reached.

        RandomAI does not reason about confidence. It waits for a fixed number
        of turns, then always opts into accusation.
        """
        self.turn_count += 1
        return self.turn_count >= self.ACCUSATION_PATIENCE

    def update_knowledge(self, suggestion, player_who_showed, card_shown=None):
        """
        RandomAI ignores all evidence — decisions are always random.
        """
        pass

    def update_from_clue(self, card) -> None:
        """Consume a revealed clue card.

        RandomAI intentionally ignores evidence to stay a pure baseline.
        """
        pass

    def handle_no_reveal(self, suggestion) -> None:
        """Consume a no-reveal signal from the suggestion phase.

        RandomAI intentionally ignores this deduction signal.
        """
        pass


if __name__ == "__main__":
    state = SimpleNamespace(
        suspects=["Professor Karim", "Student Rahim"],
        weapons=["Knife", "Sleeping Pills"],
        current_location="Auditorium",
    )
    ai = RandomAI()
    suggestion = ai.make_suggestion(state)
    logger.info("Suggestion: %s", suggestion)
