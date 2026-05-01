"""
turn_manager.py - Turn Order Module

Purpose: Manages turn order and turn-based game flow.
Provides a thin helper that wraps the canonical next_turn logic
so other modules can delegate without importing GameState directly.
"""

import logging

logger = logging.getLogger(__name__)


class TurnManager:
    """Manages player turn rotation and active-player tracking."""

    def __init__(self, players: list) -> None:
        """Initialise with the ordered player list.

        Args:
            players: Ordered list of player objects.  Each must have an
                     ``active`` boolean attribute.
        """
        if not players:
            raise ValueError("TurnManager requires at least one player")
        self._players = players
        self._current_index: int = 0

    @property
    def current_player(self):
        """Return the player whose turn it currently is."""
        return self._players[self._current_index]

    @property
    def current_index(self) -> int:
        """Return the index of the current player."""
        return self._current_index

    def next_turn(self) -> bool:
        """Advance to the next active player.

        Skips eliminated (inactive) players.  Returns False when no active
        player can be found (all players eliminated).

        Returns:
            bool: True if a new active player was found, False otherwise.
        """
        total = len(self._players)
        for _ in range(total):
            self._current_index = (self._current_index + 1) % total
            if getattr(self._players[self._current_index], "active", False):
                logger.debug(
                    "Turn advanced to player %d: %s",
                    self._current_index,
                    self._players[self._current_index].name,
                )
                return True

        logger.warning("No active players remaining")
        return False

    def get_active_players(self) -> list:
        """Return a list of players that are still active."""
        return [p for p in self._players if getattr(p, "active", False)]

    def is_game_over(self) -> bool:
        """Return True when fewer than two players remain active."""
        return len(self.get_active_players()) <= 1
