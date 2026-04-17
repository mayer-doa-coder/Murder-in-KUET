"""
clue_reveal.py - Clue Revelation System

Purpose: Resolve a suggestion by asking other players in turn order to reveal
one matching card when possible.
"""

from __future__ import annotations

import random
from typing import Any, Optional, Sequence, Tuple


def reveal_clue(
    suggestion: Any,
    players: Sequence[Any],
    current_index: int,
) -> Tuple[Optional[object], Optional[object]]:
    """Reveal one clue card from the next eligible player in turn order.

    The search starts from the next player after `current_index` and wraps
    around the table using modulo arithmetic until it returns to the current
    player. The first player in that order who can disprove the suggestion
    reveals exactly one random matching card.

    Args:
        suggestion: A suggestion-like object with attributes
            `suspect`, `weapon`, and `location`.
        players (Sequence[Any]): Ordered list of players. Each player must have
            a `cards` iterable where each card has a `name` attribute.
        current_index (int): Index of the player who made the suggestion.

    Returns:
        tuple[Optional[object], Optional[object]]:
            - (player, revealed_card) if a matching card is revealed.
            - (None, None) if nobody can reveal a matching card.

    Raises:
        ValueError: If players are empty, current_index is invalid, or
            suggestion is invalid.
    """
    if not players:
        raise ValueError("players list cannot be empty")

    if current_index < 0 or current_index >= len(players):
        raise ValueError("current_index is out of range")

    required_fields = ("suspect", "weapon", "location")
    if suggestion is None or any(not hasattr(suggestion, field) for field in required_fields):
        raise ValueError("Invalid suggestion")

    suspect = getattr(suggestion, "suspect")
    weapon = getattr(suggestion, "weapon")
    location = getattr(suggestion, "location")

    if any(not isinstance(value, str) or not value.strip() for value in (suspect, weapon, location)):
        raise ValueError("Invalid suggestion")

    targets = {suspect, weapon, location}
    total_players = len(players)

    for offset in range(1, total_players):
        idx = (current_index + offset) % total_players
        player = players[idx]
        hand = getattr(player, "cards", None)
        if hand is None:
            continue

        matching_cards = [card for card in hand if getattr(card, "name", None) in targets]
        if matching_cards:
            revealed_card = random.choice(matching_cards)
            return (player, revealed_card)

    return (None, None)
