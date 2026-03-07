"""
random_ai.py - Baseline AI Module

Purpose: Implements a baseline AI that makes random decisions.
This module provides a simple AI for testing and comparison purposes.
"""

from ai.base_ai import BaseAI


class RandomAI(BaseAI):
    # TODO: randomly pick from remaining suspects/weapons/locations

    def make_suggestion(self, game_state):
        # TODO: return a random suggestion dict
        pass

    def make_accusation(self, game_state):
        # TODO: return a random accusation dict
        pass

    def choose_move(self, game_state):
        # TODO: return a random valid location
        pass
