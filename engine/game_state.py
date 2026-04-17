"""
game_state.py - Current Game Status Module

Purpose: Manages and tracks the current state of the game.
This module maintains game status, player states, solution, and game progress.
"""

import random
from engine.cards import suspects, weapons, locations, create_deck
from engine.board import Board
from engine.clue_reveal import reveal_clue


class GameState:

    def __init__(self):
        self.players = []
        self.solution = None
        self.current_turn = 0
        self.deck = []
        self.game_over = False
        self.winner = None
        self.board = Board()
        self.suspects = list(suspects)
        self.weapons = list(weapons)
        self.locations = list(locations)
        self.current_location = None
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

    def process_suggestion(self, player, suggestion, current_index=None, verbose=True):
        """Resolve a suggestion inside the game loop.

        Flow:
          1. Log the active player's suggestion.
          2. Ask opponents in circular turn order to reveal a matching card.
          3. Update current player's notebook when a card is revealed.
          4. Update AI clue knowledge or no-reveal handling hooks.

        Args:
            player: The player who made the suggestion.
            suggestion: Suggestion object with suspect/weapon/location attrs.
            current_index (int | None): Optional player index override.

        Returns:
            tuple: (revealer, card) where either may be None.
        """
        if current_index is None:
            current_index = self.players.index(player)

        if verbose:
            print(f"{player.name} suggests: {suggestion}")
        revealer, card = reveal_clue(suggestion, self.players, current_index)

        if card is not None:
            if verbose and revealer is not None:
                print(f"{revealer.name} revealed a card!")
            player.notebook.eliminate(card.name)

            if player.is_ai and hasattr(player.ai_agent, "update_from_clue"):
                player.ai_agent.update_from_clue(card)
        else:
            if verbose:
                print("No one could reveal a clue!")
            if player.is_ai and hasattr(player.ai_agent, "handle_no_reveal"):
                player.ai_agent.handle_no_reveal(suggestion)

        return (revealer, card)
