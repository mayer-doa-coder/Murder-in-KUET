"""
base_ai.py - AI Interface Module

Purpose: Base AI interface defining the contract for all AI implementations.
This module provides the abstract base class that all AI agents must inherit from.
"""


class BaseAI:
    """
    Contract every AI agent must fulfil.

    The agent is owned by an AIPlayer. It receives the full GameState on
    every call and returns structured decisions that the player executes.
    """

    def choose_move(self, game_state):
        """
        Choose a KUET location to move to.

        Args:
            game_state (GameState): Current game state.

        Returns:
            str: Name of the destination location, or None to stay put.
        """
        raise NotImplementedError

    def make_suggestion(self, game_state):
        """
        Suggest a (suspect, weapon, location) combination.
        Must be called after choose_move so position is up to date.

        Args:
            game_state (GameState): Current game state.

        Returns:
            dict: {'suspect': str, 'weapon': str, 'location': str}
        """
        raise NotImplementedError

    def make_accusation(self, game_state):
        """
        Optionally make a final accusation this turn.

        Args:
            game_state (GameState): Current game state.

        Returns:
            dict | None: {'suspect': str, 'weapon': str, 'location': str}
                         or None to skip accusing this turn.
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
