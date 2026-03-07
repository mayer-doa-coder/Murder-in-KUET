"""
rule_based_ai.py - Smarter AI Module

Purpose: Implements a rule-based AI with logical deduction capabilities.
This module provides an intelligent AI that uses rules and heuristics to play strategically.
"""

from ai.base_ai import BaseAI


class RuleBasedAI(BaseAI):
    # TODO: use knowledge_base to make informed suggestions and deductions

    def make_suggestion(self, game_state):
        # TODO: suggest cards that haven't been eliminated yet
        pass

    def make_accusation(self, game_state):
        # TODO: accuse only when solution is certain
        pass

    def choose_move(self, game_state):
        # TODO: move toward most informative location
        pass
