"""
base_ai.py - AI Interface Module

Purpose: Base AI interface defining the contract for all AI implementations.
This module provides the abstract base class that all AI players must inherit from.
"""


class BaseAI:
    # TODO: abstract interface that all AI agents must implement

    def make_suggestion(self, game_state):
        # TODO: return a suggestion dict
        raise NotImplementedError

    def make_accusation(self, game_state):
        # TODO: return an accusation dict or None
        raise NotImplementedError

    def choose_move(self, game_state):
        # TODO: return the chosen location name
        raise NotImplementedError
