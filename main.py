"""
main.py - Main Entry Point

Purpose: Main entry point for the Murder in KUET game.
This module initializes the game and starts either CLI or API mode.
"""

import sys
from engine.game_state import GameState
from engine.board import Board
from engine.cards import CardDeck
from engine.turn_manager import TurnManager
from cli.game_cli import GameCLI


def main():
    """Main function to start the game."""
    print("=" * 50)
    print("    Murder in KUET")
    print("=" * 50)
    
    # Initialize game components
    board = Board()
    deck = CardDeck()
    game_state = GameState()
    
    # Start CLI mode
    cli = GameCLI(game_state)
    cli.start()


if __name__ == "__main__":
    main()
