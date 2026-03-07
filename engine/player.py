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

    def __repr__(self):
        kind = "AI" if self.is_ai else "Human"
        return f"Player({self.name}, {kind}, position={self.position})"


class AIPlayer(Player):
    # TODO: extend Player with ai_agent for automated decisions
    pass
