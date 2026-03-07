"""
knowledge_base.py - Deduction Notebook Module

Purpose: Manages the AI's knowledge and deduction tracking.
This module stores known facts, tracks eliminated possibilities, and performs logical deductions.
"""


class KnowledgeBase:
    # TODO: track known_cards and eliminated_cards for deduction

    def update_from_clue(self, suggestion, player_who_showed, card_shown=None):
        # TODO: update knowledge when a card is shown during a suggestion
        pass

    def remove_possibility(self, card_name):
        # TODO: eliminate a card from possible solution candidates
        pass
