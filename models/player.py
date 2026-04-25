"""
player.py - Player Object Module

Purpose: Defines player objects and manages player-specific data.
This module handles player attributes and lightweight player interfaces.
"""

from ai.notebook import Notebook
from engine.cards import locations, suspects, weapons
from models.accusation import Accusation
from models.suggestion import Suggestion


class Player:
    def __init__(self, name: str, is_ai: bool = False):
        self.name = name
        self.is_ai = is_ai
        self.ai_agent = None
        self.cards = []  # cards dealt to this player
        self.position = None  # current location on the KUET board
        self.active = True  # set to False on a wrong accusation
        self.notebook = Notebook(suspects, weapons, locations)

    def add_card(self, card):
        """Add a card to the player's hand and eliminate it from the notebook.

        Cards held in hand cannot be the solution, so their probability is set
        to zero immediately.  This is the foundational Bayesian prior: I know
        with certainty that my own cards are not in the envelope.
        """
        self.cards.append(card)
        if self.notebook is not None:
            try:
                self.notebook.eliminate(card.name)
            except (ValueError, TypeError):
                pass

    def move(self, new_location):
        """Move the player to a new KUET location (raw setter).

        This bypasses validation intentionally.  In Cluedo a player can be
        FORCED to a room when another player names them in a suggestion
        ("I suggest it was Rahim, in the Library") — that teleportation ignores
        dice rolls and normal movement range.  Use try_move() for ordinary
        turn-based movement where the dice roll limits how far a player can go.
        """
        self.position = new_location

    def try_move(self, new_location, valid_moves):
        """Attempt to move to new_location only if it is within the dice budget.

        Called during a normal turn after the engine has computed valid_moves
        via BFS on the board graph using that turn's dice roll.  The agent
        picks a destination; this method enforces that the pick is legal.

        In Cluedo a player may also choose to STAY in their current room
        (pass None from choose_move) and suggest there again without moving.
        That case is handled by not calling try_move at all — None from the
        agent simply means "I'm staying put".

        Args:
            new_location (str): Destination the agent wants to move to.
            valid_moves (list[str]): Locations reachable this turn given the
                                     dice roll (pre-computed by the engine).

        Returns:
            bool: True if the move was legal and executed; False otherwise.
        """
        if new_location in valid_moves:
            self.move(new_location)
            return True
        return False

    def make_suggestion(self, suspect: str, weapon: str, location: str) -> Suggestion:
        """Create a pure suggestion object for this turn.

        This method does not mutate game state. It only validates inputs
        and returns a new Suggestion instance that can be consumed by
        reveal, AI-reasoning, and game-loop systems.

        Args:
            suspect (str): Suggested suspect name.
            weapon (str): Suggested weapon name.
            location (str): Suggested location name.

        Returns:
            Suggestion: A validated suggestion object.
        """
        return Suggestion(suspect=suspect, weapon=weapon, location=location)

    def make_accusation(self, suspect: str, weapon: str, location: str) -> Accusation:
        """Create and return a final accusation object.

        This method is intentionally pure and does not check correctness
        against the hidden solution.

        Args:
            suspect (str): Accused suspect name.
            weapon (str): Accused weapon name.
            location (str): Accused location name.

        Returns:
            Accusation: A validated accusation object.
        """
        return Accusation(suspect=suspect, weapon=weapon, location=location)

    def show_card(self, suggestion):
        """
        Find and return one card in hand that matches the suggestion,
        to disprove it. Returns None if no matching card is held.
        """
        if hasattr(suggestion, "suspect"):
            suspect = suggestion.suspect
            weapon = suggestion.weapon
            location = suggestion.location
        else:
            suspect = suggestion["suspect"]
            weapon = suggestion["weapon"]
            location = suggestion["location"]

        from utils.helpers import safe_random_choice

        matching = [
            card for card in self.cards if card.name in (suspect, weapon, location)
        ]
        return safe_random_choice(matching)

    def take_turn(self, state):
        """Return the AI agent for the game loop to execute decisions.

        Player objects do not execute game rules or AI logic directly.
        """
        if not self.active:
            return None

        if self.is_ai and not self.ai_agent:
            raise ValueError("AI agent not assigned")

        if self.is_ai and self.ai_agent:
            return self.ai_agent

        return None

    def __repr__(self):
        return f"Player({self.name}, AI={self.is_ai}, Active={self.active})"


class AIPlayer(Player):
    """AI-controlled player. All decisions are delegated to ai_agent."""

    def __init__(self, name, ai_agent):
        super().__init__(name, is_ai=True)
        self.ai_agent = ai_agent

    def add_card(self, card):
        """Add a card to hand and register it with any legacy knowledge base."""
        super().add_card(card)  # Player.add_card already eliminates from notebook
        if hasattr(self.ai_agent, "knowledge_base"):
            self.ai_agent.knowledge_base.add_own_card(card.name)

    def decide_accusation(self, game_state):
        """Ask the agent whether to make a final accusation this turn."""
        return self.ai_agent.decide_accusation(game_state)

    def __repr__(self):
        return f"AIPlayer({self.name}, agent={type(self.ai_agent).__name__}, position={self.position})"
