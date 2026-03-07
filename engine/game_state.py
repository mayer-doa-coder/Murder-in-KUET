"""
game_state.py - Current Game Status Module

Purpose: Manages and tracks the current state of the game.
This module maintains game status, player states, solution, and game progress.
"""


class GameState:
    """Manages the current state of the game."""
    
    def __init__(self):
        """Initialize game state."""
        self.players = []
        self.current_turn = 0
        self.solution = None
        self.game_over = False
