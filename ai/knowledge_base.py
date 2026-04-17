"""
knowledge_base.py - Deduction Notebook Module

Purpose: Manages the AI's knowledge and deduction tracking.
This module stores known facts, tracks eliminated possibilities, and performs logical deductions.
"""

from engine.cards import suspects, weapons, locations


class KnowledgeBase:

    def __init__(self):
        # Cards the AI has confirmed (own hand or shown by another player)
        self.known_cards = set()

        # Cards ruled out as the solution
        self.eliminated_cards = []

        # Remaining solution candidates per category
        self.possible_suspects = list(suspects)
        self.possible_weapons = list(weapons)
        self.possible_locations = list(locations)

    def add_own_card(self, card_name):
        """
        Register a card dealt to the AI's own hand.
        Own cards are immediately eliminated from solution candidates.
        """
        if card_name not in self.known_cards:
            self.known_cards.add(card_name)
            self.remove_possibility(card_name)

    def update_from_clue(self, card):
        """Register a revealed clue card into AI knowledge.

        Args:
            card: Revealed card object expected to expose `name`.

        Notes:
            - If `card` is None, this method safely returns without changes.
            - Known cards are stored in a set to avoid duplicates.
        """
        if card is None:
            return

        card_name = getattr(card, "name", None)
        if not isinstance(card_name, str) or not card_name.strip():
            return

        self.known_cards.add(card_name)
        self.remove_possibility(card_name)

    def remove_possibility(self, card_name):
        """
        Eliminate a card from the pool of possible solution candidates.

        Args:
            card_name (str): Name of the card to eliminate.
        """
        if card_name not in self.eliminated_cards:
            self.eliminated_cards.append(card_name)

        if card_name in self.possible_suspects:
            self.possible_suspects.remove(card_name)
        elif card_name in self.possible_weapons:
            self.possible_weapons.remove(card_name)
        elif card_name in self.possible_locations:
            self.possible_locations.remove(card_name)

    def is_solution_known(self):
        """
        Return True when exactly one candidate remains in every category.
        """
        return (
            len(self.possible_suspects) == 1
            and len(self.possible_weapons) == 1
            and len(self.possible_locations) == 1
        )

    def get_solution(self):
        """
        Return the deduced solution dict if known, otherwise None.
        """
        if self.is_solution_known():
            return {
                "suspect": self.possible_suspects[0],
                "weapon": self.possible_weapons[0],
                "location": self.possible_locations[0],
            }
        return None
