"""
knowledge_base.py - Deduction Notebook Module

Purpose: Manages the AI's knowledge and deduction tracking.
This module stores known facts, tracks eliminated possibilities, and performs logical deductions.
"""

from engine.cards import locations, suspects, weapons


class KnowledgeBase:
    def __init__(self):
        # Cards the AI has confirmed (own hand or shown by another player)
        self.known_cards = set()

        # Cards ruled out as the solution
        self.eliminated_cards: set = set()

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
        self.eliminated_cards.add(card_name)

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

    # ------------------------------------------------------------------
    # BayesianNotebook-compatible API
    # These aliases and stubs make KnowledgeBase interchangeable with
    # BayesianNotebook wherever only the deduction interface is used.
    # ------------------------------------------------------------------

    def is_solved(self) -> bool:
        """Alias for is_solution_known() — matches BayesianNotebook API."""
        return self.is_solution_known()

    def eliminate(self, card_name: str) -> None:
        """Eliminate a card — matches BayesianNotebook.eliminate() API.

        Args:
            card_name: Name of the card to remove from solution candidates.
        """
        if not isinstance(card_name, str) or not card_name.strip():
            raise ValueError("card_name must be a non-empty string")
        normalized = card_name.strip()
        # Silently skip cards already eliminated (mirrors BayesianNotebook behavior)
        if normalized in self.known_cards:
            return
        self.add_own_card(normalized)

    def update_reveal(self, card_name: str) -> None:
        """Alias for eliminate() — matches BayesianNotebook.update_reveal() API."""
        self.eliminate(card_name)

    def update_no_reveal(
        self,
        suspect: str,
        weapon: str,
        location: str,
        boost: float = 2.0,
    ) -> None:
        """No-op stub — KnowledgeBase has no probability model to boost.

        Provided so KnowledgeBase is drop-in compatible with BayesianNotebook
        in code paths that call update_no_reveal().
        """
        # Deterministic KB has no probability distributions to update.

    def most_likely(self) -> tuple:
        """Return the first remaining candidate in each category.

        Returns:
            tuple[str, str, str]: (suspect, weapon, location)

        Raises:
            ValueError: If any category has no remaining candidates.
        """
        if not self.possible_suspects:
            raise ValueError("No possible suspects remaining")
        if not self.possible_weapons:
            raise ValueError("No possible weapons remaining")
        if not self.possible_locations:
            raise ValueError("No possible locations remaining")
        return (
            self.possible_suspects[0],
            self.possible_weapons[0],
            self.possible_locations[0],
        )

    def confident_accusation(self, threshold: float = 0.8) -> bool:
        """Return True when exactly one candidate remains in every category.

        KnowledgeBase has no probability model, so confidence is binary:
        either we know the answer (all sets have size 1) or we don't.
        The threshold parameter is accepted for API compatibility but ignored.
        """
        return self.is_solution_known()

    def get_solution(self):
        """Return (suspect, weapon, location) tuple when solved, else None.

        NOTE: Returns a tuple (not a dict) to match BayesianNotebook.get_solution().
        """
        if self.is_solution_known():
            return (
                self.possible_suspects[0],
                self.possible_weapons[0],
                self.possible_locations[0],
            )
        return None
