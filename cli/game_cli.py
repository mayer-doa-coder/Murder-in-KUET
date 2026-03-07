"""
game_cli.py - Command Line Interface Module

Purpose: Provides a command-line interface for playing the game.
This module handles user input/output and displays the game through the terminal.
"""


class GameCLI:
    """Command-line interface for the Murder in KUET game."""
    
    def __init__(self, game_state):
        """Initialize CLI with game state."""
        self.game_state = game_state
    
    def start(self):
        """Start the CLI game loop."""
        print("Welcome to Murder in KUET!")
        pass
    
    def display_menu(self):
        """Display the main game menu."""
        pass
    
    def get_player_input(self):
        """Get and validate player input."""
        pass
