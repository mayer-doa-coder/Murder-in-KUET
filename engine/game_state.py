"""
game_state.py - Current Game Status Module

Purpose: Manages and tracks the current state of the game.
This module maintains game status, player states, solution, and game progress.
"""

import random
from engine.cards import suspects, weapons, locations, create_deck
from engine.board import Board


class GameState:

    def __init__(self):
        self.players = []
        self.solution = None
        self.current_turn = 0
        self.deck = []
        self.game_over = False
        self.winner = None
        self.board = Board()
        # Set at the start of every turn so any agent can inspect it.
        self.last_dice_roll = None

    def setup_game(self):
        """
        Initialise a new game:
          1. Create the full shuffled deck.
          2. Pick one suspect, weapon, and location as the secret solution.
          3. Remove those three solution cards from the deck.
          4. Deal remaining cards evenly to all players (round-robin).
        """
        # 1. Create deck
        self.deck = create_deck()

        # 2. Choose solution cards
        self.solution = {
            "suspect": random.choice(suspects),
            "weapon": random.choice(weapons),
            "location": random.choice(locations),
        }

        # 3. Remove solution cards from the deck
        self.deck = [
            card for card in self.deck
            if card.name not in (
                self.solution["suspect"],
                self.solution["weapon"],
                self.solution["location"],
            )
        ]

        # 4. Distribute remaining cards evenly to players (round-robin)
        for i, card in enumerate(self.deck):
            self.players[i % len(self.players)].add_card(card)

    def add_player(self, player):
        """Add a player to the game."""
        self.players.append(player)

    def get_current_player(self):
        """Return the player whose turn it is."""
        return self.players[self.current_turn % len(self.players)]

    def next_turn(self):
        """Advance to the next active player's turn."""
        self.current_turn += 1
        # Skip eliminated players
        while not self.get_current_player().active:
            self.current_turn += 1

    def check_accusation(self, accusation):
        """
        Check a player's final accusation against the solution.

        Args:
            accusation (dict): Dict with 'suspect', 'weapon', 'location'.

        Returns:
            bool: True if accusation matches the solution exactly.
        """
        return (
            accusation["suspect"] == self.solution["suspect"]
            and accusation["weapon"] == self.solution["weapon"]
            and accusation["location"] == self.solution["location"]
        )

    def is_game_over(self):
        """Return True if the game has ended."""
        return self.game_over
