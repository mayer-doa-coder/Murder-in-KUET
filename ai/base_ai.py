"""
base_ai.py - AI Interface Module

Purpose: Base AI interface defining the contract for all AI implementations.
This module provides the abstract base class that all AI players must inherit from.
"""

from abc import ABC, abstractmethod


class BaseAI(ABC):
    """Abstract base class for AI players."""
    
    def __init__(self, player):
        """Initialize AI with a player reference."""
        self.player = player
    
    @abstractmethod
    def make_suggestion(self, game_state):
        """Make a suggestion based on game state."""
        pass
    
    @abstractmethod
    def make_accusation(self, game_state):
        """Make an accusation to solve the case."""
        pass
    
    @abstractmethod
    def choose_move(self, game_state):
        """Choose next move."""
        pass
