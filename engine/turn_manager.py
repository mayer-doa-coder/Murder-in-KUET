"""
turn_manager.py - Turn Order Module

Purpose: Manages turn order and turn-based game flow.
This module handles turn progression, turn validation, and turn-based actions.
"""


class TurnManager:
    """Manages turn order and turn progression."""
    
    def __init__(self, players):
        """Initialize turn manager with players."""
        self.players = players
        self.current_player_index = 0
    
    def next_turn(self):
        """Move to the next player's turn."""
        pass
