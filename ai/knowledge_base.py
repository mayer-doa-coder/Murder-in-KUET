"""
knowledge_base.py - Deduction Notebook Module

Purpose: Manages the AI's knowledge and deduction tracking.
This module stores known facts, tracks eliminated possibilities, and performs logical deductions.
"""

from engine.cards import suspects, weapons, locations


class KnowledgeBase:
    """Manages AI's knowledge and logical deductions for Murder in KUET."""
    
    def __init__(self):
        """Initialize knowledge base with tracking lists."""
        # Cards the AI has seen (in hand or shown by others)
        self.known_cards = []
        
        # Cards eliminated from being the solution
        self.eliminated_cards = []
        
        # Track all possible cards in each category
        self.possible_suspects = set(suspects)
        self.possible_weapons = set(weapons)
        self.possible_locations = set(locations)
        
        # Track which players might have which cards
        self.player_card_tracking = {}
    
    def add_card_to_hand(self, card_name):
        """
        Add a card to AI's known cards (cards in AI's hand).
        These cards are automatically eliminated from the solution.
        
        Args:
            card_name (str): Name of the card in AI's hand.
        """
        if card_name not in self.known_cards:
            self.known_cards.append(card_name)
            self.remove_possibility(card_name)
    
    def update_from_clue(self, suggestion, player_who_showed, card_shown=None):
        """
        Update knowledge base based on a suggestion/clue during gameplay.
        
        Args:
            suggestion (dict): Dictionary with 'suspect', 'weapon', 'location' keys.
            player_who_showed (str): Name of player who showed a card (None if no one showed).
            card_shown (str): Specific card shown (None if not shown to this AI).
        """
        if card_shown:
            # AI directly saw this card - eliminate it from solution
            if card_shown not in self.known_cards:
                self.known_cards.append(card_shown)
                self.remove_possibility(card_shown)
            
            # Track which player has this card
            if player_who_showed:
                if player_who_showed not in self.player_card_tracking:
                    self.player_card_tracking[player_who_showed] = []
                if card_shown not in self.player_card_tracking[player_who_showed]:
                    self.player_card_tracking[player_who_showed].append(card_shown)
        
        elif player_who_showed is None:
            # No one showed a card - these cards are more likely in the solution
            # But we can't eliminate them yet unless we're certain
            pass
        
        else:
            # Someone showed a card but AI didn't see it
            # Track that this player has one of the suggested cards
            if player_who_showed not in self.player_card_tracking:
                self.player_card_tracking[player_who_showed] = []
    
    def remove_possibility(self, card_name):
        """
        Remove a card from possible solutions.
        Once a card is seen, it cannot be part of the murder solution.
        
        Args:
            card_name (str): Name of the card to eliminate.
        """
        if card_name not in self.eliminated_cards:
            self.eliminated_cards.append(card_name)
        
        # Remove from possible solution sets
        if card_name in self.possible_suspects:
            self.possible_suspects.remove(card_name)
        elif card_name in self.possible_weapons:
            self.possible_weapons.remove(card_name)
        elif card_name in self.possible_locations:
            self.possible_locations.remove(card_name)
    
    def get_possible_solution(self):
        """
        Get the most likely solution based on current knowledge.
        
        Returns:
            dict: Dictionary with 'suspect', 'weapon', 'location' or None if uncertain.
        """
        # If only one option remains in each category, we have the solution
        if (len(self.possible_suspects) == 1 and 
            len(self.possible_weapons) == 1 and 
            len(self.possible_locations) == 1):
            return {
                'suspect': list(self.possible_suspects)[0],
                'weapon': list(self.possible_weapons)[0],
                'location': list(self.possible_locations)[0]
            }
        
        return None
    
    def get_best_guess(self):
        """
        Get the best guess even if not certain.
        Returns the remaining possibilities.
        
        Returns:
            dict: Dictionary with lists of possible suspects, weapons, locations.
        """
        return {
            'possible_suspects': list(self.possible_suspects),
            'possible_weapons': list(self.possible_weapons),
            'possible_locations': list(self.possible_locations)
        }
    
    def is_solution_known(self):
        """
        Check if the AI has deduced the complete solution.
        
        Returns:
            bool: True if solution is known with certainty.
        """
        return (len(self.possible_suspects) == 1 and 
                len(self.possible_weapons) == 1 and 
                len(self.possible_locations) == 1)
    
    def get_suggestion_value(self, suspect, weapon, location):
        """
        Evaluate how valuable a suggestion would be for gathering information.
        
        Args:
            suspect (str): Suspect to suggest.
            weapon (str): Weapon to suggest.
            location (str): Location to suggest.
        
        Returns:
            int: Value score (higher is better for information gathering).
        """
        value = 0
        
        # Prioritize cards we haven't eliminated yet
        if suspect in self.possible_suspects:
            value += 3
        if weapon in self.possible_weapons:
            value += 3
        if location in self.possible_locations:
            value += 3
        
        return value
