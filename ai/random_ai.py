"""
random_ai.py - Baseline AI Module

Purpose: Implements a baseline AI that makes random decisions.
This module provides a simple AI for testing and comparison purposes.
"""

import random
from ai.base_ai import BaseAI


class RandomAI(BaseAI):
    """AI that makes random choices - baseline implementation."""
    
    def __init__(self, player):
        """Initialize Random AI."""
        super().__init__(player)
    
    def make_suggestion(self, game_state):
        """Make a random suggestion."""
        # TODO: Implement random suggestion logic
        pass
    
    def make_accusation(self, game_state):
        """Make a random accusation."""
        # TODO: Implement random accusation logic
        pass
    
    def choose_move(self, game_state):
        """Choose a random valid move."""
        # TODO: Implement random move selection
        pass
