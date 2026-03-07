"""
player.py - Player Object Module

Purpose: Defines player objects and manages player-specific data.
This module handles player attributes, hand management, and player actions.
"""


class Player:

    def __init__(self, name, is_ai=False):
        self.name = name
        self.is_ai = is_ai
        self.cards = []       # cards dealt to this player
        self.position = None  # current location on the KUET board
        self.active = True    # set to False on a wrong accusation

    def add_card(self, card):
        """Add a card to the player's hand."""
        self.cards.append(card)

    def move(self, new_location):
        """Move the player to a new KUET location."""
        self.position = new_location

    def make_suggestion(self, suspect, weapon, location):
        """
        Suggest a suspect, weapon, and location.
        Returns a dict representing the suggestion.
        """
        return {
            "suspect": suspect,
            "weapon": weapon,
            "location": location,
            "by": self.name,
        }

    def make_accusation(self, suspect, weapon, location):
        """
        Make a final accusation to solve the murder.
        Returns a dict representing the accusation.
        A wrong accusation eliminates the player.
        """
        return {
            "suspect": suspect,
            "weapon": weapon,
            "location": location,
            "by": self.name,
            "final": True,
        }

    def show_card(self, suggestion):
        """
        Find and return one card in hand that matches the suggestion,
        to disprove it. Returns None if no matching card is held.
        """
        for card in self.cards:
            if card.name in (
                suggestion["suspect"],
                suggestion["weapon"],
                suggestion["location"],
            ):
                return card
        return None

    def take_turn(self, game_state):
        """
        Execute this player's turn.

        For AI players the agent drives every decision automatically.
        For human players this is a hook; the CLI / API layer calls the
        individual methods (move, make_suggestion, make_accusation) directly
        based on user input.

        Returns:
            dict | None: For AI players, a result dict with keys:
                           'move'        – location moved to
                           'suggestion'  – suggestion dict made this turn
                           'accusation'  – accusation dict or None
                         For human players, returns None (caller handles input).
        """
        if self.is_ai:
            move = self.ai_agent.choose_move(game_state)
            if move:
                self.move(move)

            suggestion = self.ai_agent.make_suggestion(game_state)
            accusation = self.ai_agent.make_accusation(game_state)

            return {
                "move": self.position,
                "suggestion": suggestion,
                "accusation": accusation,
            }

        # Human turn — handled externally by CLI/API
        return None

    def __repr__(self):
        kind = "AI" if self.is_ai else "Human"
        return f"Player({self.name}, {kind}, position={self.position})"


class AIPlayer(Player):
    """AI-controlled player. All decisions are delegated to ai_agent."""

    def __init__(self, name, ai_agent):
        super().__init__(name, is_ai=True)
        self.ai_agent = ai_agent

    def add_card(self, card):
        """
        Add a card to hand and immediately register it with the AI's
        knowledge base so it is excluded from solution candidates.
        """
        super().add_card(card)
        if hasattr(self.ai_agent, "knowledge_base"):
            self.ai_agent.knowledge_base.add_own_card(card.name)

    def decide_accusation(self, game_state):
        """Ask the agent whether to make a final accusation this turn."""
        return self.ai_agent.make_accusation(game_state)

    def __repr__(self):
        return f"AIPlayer({self.name}, agent={type(self.ai_agent).__name__}, position={self.position})"
