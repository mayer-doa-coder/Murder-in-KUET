"""
player.py - Player Object Module

Purpose: Defines player objects and manages player-specific data.
This module handles player attributes, hand management, and player actions.
"""


class Player:
    """Represents a player in the game."""
    
    def __init__(self, name, player_id):
        """Initialize a player with name and ID."""
        self.name = name
        self.player_id = player_id
        self.hand = []
        self.position = None
