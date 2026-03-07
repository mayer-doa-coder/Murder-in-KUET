"""
player.py - Player Object Module

Purpose: Defines player objects and manages player-specific data.
This module handles player attributes, hand management, and player actions.
"""


class Player:
    # TODO: player with name, is_ai flag, cards hand, position

    def add_card(self, card):
        # TODO: add card to hand
        pass

    def move(self, new_location):
        # TODO: update player position
        pass

    def make_suggestion(self, suspect, weapon, location):
        # TODO: return suggestion dict
        pass

    def make_accusation(self, suspect, weapon, location):
        # TODO: return final accusation dict
        pass


class AIPlayer(Player):
    # TODO: extend Player with ai_agent for automated decisions
    pass
