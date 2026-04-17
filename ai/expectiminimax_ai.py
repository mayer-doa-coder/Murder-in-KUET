"""expectiminimax_ai.py - Expectiminimax AI Strategy Skeleton.

Purpose: Defines a clean, extensible structure for a probabilistic search AI
that extends minimax with chance nodes.
"""

from __future__ import annotations

import random
from typing import Any, List, Sequence, Tuple

from ai.base_ai import BaseAI


class ExpectiminimaxAI(BaseAI):
    """Skeleton AI prepared for expectiminimax search with chance nodes.

    Node types planned in the recursive search:
    - "max": this AI chooses an action.
    - "min": opponent chooses an action.
    - "chance": probabilistic game outcome branch.
    """

    def __init__(self, depth: int = 2) -> None:
        """Initialize recursion depth budget for future expectiminimax logic."""
        if depth < 1:
            raise ValueError("depth must be >= 1")
        self.depth = depth

    def expectiminimax(self, state: Any, depth: int, node_type: str) -> float:
        """Recursive expectiminimax algorithm placeholder.

        Args:
            state (Any): Search state snapshot.
            depth (int): Remaining recursion depth.
            node_type (str): One of "max", "min", or "chance".

        Returns:
            float: Utility value for the explored subtree.

        Raises:
            ValueError: If node_type is unsupported or depth is invalid.
            NotImplementedError: Until the recursive logic is implemented.
        """
        if depth < 0:
            raise ValueError("depth cannot be negative")

        if node_type not in {"max", "min", "chance"}:
            raise ValueError("node_type must be one of: max, min, chance")

        raise NotImplementedError("expectiminimax core is not implemented yet")

    def get_chance_outcomes(self, state: Any) -> List[Tuple[float, Any]]:
        """Return probabilistic branches for a chance node.

        Expected return format:
            [
                (0.4, state_if_card_revealed),
                (0.6, state_if_no_card_revealed),
            ]

        Args:
            state (Any): Current search state snapshot.

        Returns:
            List[Tuple[float, Any]]: (probability, next_state) pairs.

        Raises:
            NotImplementedError: Until probability modeling is implemented.
        """
        raise NotImplementedError("chance outcome modeling is not implemented yet")

    def choose_move(self, state: Any, valid_moves: Sequence[str]) -> str | None:
        """Choose a movement destination placeholder.

        Current behavior is a safe fallback for integration compatibility.
        Full expectiminimax move selection will be added later.
        """
        if valid_moves is None:
            raise ValueError("valid_moves cannot be None")

        options = list(valid_moves)
        if not options:
            return None

        return random.choice(options)

    def make_suggestion(self, state: Any) -> tuple[str, str, str]:
        """Choose a suggestion placeholder compatible with current engine state.

        Returns:
            tuple[str, str, str]: (suspect, weapon, location)

        Raises:
            ValueError: If the state does not expose required suggestion fields.
        """
        suspect_pool = getattr(state, "suspects", None)
        weapon_pool = getattr(state, "weapons", None)
        location = getattr(state, "current_location", None)

        if not suspect_pool or not weapon_pool:
            raise ValueError("Invalid state: missing suspects or weapons")

        if not isinstance(location, str) or not location.strip():
            players = getattr(state, "players", None)
            current_turn = getattr(state, "current_turn", None)
            if isinstance(players, list) and players and isinstance(current_turn, int):
                player = players[current_turn % len(players)]
                location = getattr(player, "position", None)

        if not isinstance(location, str) or not location.strip():
            raise ValueError("Invalid state: missing current location")

        return (random.choice(list(suspect_pool)), random.choice(list(weapon_pool)), location)

    def decide_accusation(self, state: Any) -> bool:
        """Decide whether to accuse using conservative solved-state gating.

        This remains intentionally simple until probability/risk scoring is
        integrated into expectiminimax terminal decisions.
        """
        if state is None:
            raise ValueError("Invalid state provided")

        players = getattr(state, "players", None)
        current_turn = getattr(state, "current_turn", None)
        if isinstance(players, list) and players and isinstance(current_turn, int):
            player = players[current_turn % len(players)]
            notebook = getattr(player, "notebook", None)
            if notebook is not None:
                suspects = getattr(notebook, "possible_suspects", set())
                weapons = getattr(notebook, "possible_weapons", set())
                locations = getattr(notebook, "possible_locations", set())
                return (
                    len(suspects) == 1
                    and len(weapons) == 1
                    and len(locations) == 1
                )

        suspects = getattr(state, "possible_suspects", None)
        weapons = getattr(state, "possible_weapons", None)
        locations = getattr(state, "possible_locations", None)
        if suspects is None or weapons is None or locations is None:
            return False

        return (
            len(suspects) == 1
            and len(weapons) == 1
            and len(locations) == 1
        )
