"""
random_ai.py - Baseline AI Module

Purpose: Implements a baseline AI that makes random decisions.
This module provides a simple AI for testing and as a baseline for smarter agents.
"""

import random
from ai.base_ai import BaseAI
from engine.cards import suspects, weapons, locations


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
        if not valid_moves:
            return None  # dice too low to exit — stay and suggest here
        return random.choice(valid_moves)

    def make_suggestion(self, game_state):
        """
        Suggest a random suspect, weapon, and the current player's location.

        Returns:
            dict: {'suspect': str, 'weapon': str, 'location': str}
        """
        current_player = game_state.get_current_player()
        # Suggest from the location the AI just moved to
        location = current_player.position or random.choice(locations)

        return {
            "suspect": random.choice(suspects),
            "weapon": random.choice(weapons),
            "location": location,
        }

    def make_accusation(self, game_state):
        """
        Make a random final accusation after ACCUSATION_PATIENCE turns.
        Before that, return None (don't accuse yet).

        Returns:
            dict | None
        """
        self.turn_count += 1
        if self.turn_count < self.ACCUSATION_PATIENCE:
            return None

        return {
            "suspect": random.choice(suspects),
            "weapon": random.choice(weapons),
            "location": random.choice(locations),
        }

    def update_knowledge(self, suggestion, player_who_showed, card_shown=None):
        """
        RandomAI ignores all evidence — decisions are always random.
        """
        pass
