"""
minimax_ai.py - Minimax AI Strategy

Purpose: Provides a production-ready minimax agent and a lightweight
search-state representation that supports simulation and evaluation.
"""

from __future__ import annotations

import random
from copy import deepcopy
from dataclasses import dataclass
from math import inf
from typing import Any, Sequence

from ai.base_ai import BaseAI


@dataclass
class GameState:
    """Lightweight immutable-style search state for minimax reasoning.

    This class is intentionally separate from engine.game_state.GameState and is
    used for simulation-only transitions. Instances are copied via deepcopy in
    all transition functions to avoid mutating source states.
    """

    players: list[Any]
    current_player_index: int
    notebook: Any
    possible_suspects: set[str]
    possible_weapons: set[str]
    possible_locations: set[str]
    current_location: str | None
    board: Any | None = None
    game_over: bool = False
    solution_determined: bool = False
    valid_moves_override: list[str] | None = None

    def __post_init__(self) -> None:
        """Validate core state fields for search safety."""
        if not isinstance(self.players, list):
            raise TypeError("players must be a list")

        if self.current_player_index < 0:
            raise ValueError("current_player_index must be non-negative")

        self.possible_suspects = set(self.possible_suspects)
        self.possible_weapons = set(self.possible_weapons)
        self.possible_locations = set(self.possible_locations)

    @classmethod
    def from_engine_state(
        cls,
        state: Any,
        valid_moves: Sequence[str] | None = None,
    ) -> "GameState":
        """Build a minimax state from the live engine game state.

        Args:
            state (Any): Engine-level game state.
            valid_moves (Sequence[str] | None): Optional move list to pin the
                simulation frontier to legal runtime moves.

        Returns:
            GameState: Search-ready copied state snapshot.
        """
        if state is None:
            raise ValueError("Invalid state: state is None")

        if hasattr(state, "players") and hasattr(state, "current_turn"):
            players = list(state.players)
            current_index = int(state.current_turn % len(players)) if players else 0

            current_player = None
            if players:
                current_player = players[current_index]

            notebook = getattr(current_player, "notebook", None)

            if notebook is not None:
                possible_suspects = set(getattr(notebook, "possible_suspects", set()))
                possible_weapons = set(getattr(notebook, "possible_weapons", set()))
                possible_locations = set(getattr(notebook, "possible_locations", set()))
            else:
                possible_suspects = set(getattr(state, "suspects", []))
                possible_weapons = set(getattr(state, "weapons", []))
                possible_locations = set(getattr(state, "locations", []))

            current_location = getattr(current_player, "position", None)
            if current_location is None:
                current_location = getattr(state, "current_location", None)

            solved = (
                len(possible_suspects) == 1
                and len(possible_weapons) == 1
                and len(possible_locations) == 1
            )

            return cls(
                players=players,
                current_player_index=current_index,
                notebook=notebook,
                possible_suspects=possible_suspects,
                possible_weapons=possible_weapons,
                possible_locations=possible_locations,
                current_location=current_location,
                board=getattr(state, "board", None),
                game_over=bool(getattr(state, "game_over", False)),
                solution_determined=solved,
                valid_moves_override=list(valid_moves) if valid_moves is not None else None,
            )

        raise ValueError("Invalid state: unsupported state object")

    def get_possible_moves(self) -> list[str]:
        """Return legal movement options for the current simulated player."""
        if self.valid_moves_override is not None:
            return list(self.valid_moves_override)

        if self.board is None:
            return []

        if self.current_location is None:
            if hasattr(self.board, "get_all_locations"):
                return list(self.board.get_all_locations())
            return []

        if hasattr(self.board, "get_neighbors"):
            return list(self.board.get_neighbors(self.current_location))

        if hasattr(self.board, "get_valid_moves"):
            # Large step budget approximates unrestricted single-ply move search.
            return list(self.board.get_valid_moves(self.current_location, steps=12))

        return []

    def simulate_move(self, move: str) -> "GameState":
        """Return a copied state after applying a movement action."""
        if not isinstance(move, str) or not move.strip():
            raise ValueError("Invalid move")

        new_state = deepcopy(self)
        new_state.current_location = move

        if new_state.players:
            new_state.current_player_index = (
                new_state.current_player_index + 1
            ) % len(new_state.players)

        return new_state

    def simulate_suggestion(self, suggestion: tuple[str, str, str]) -> "GameState":
        """Return a copied state after applying a simplified suggestion effect.

        The simulation is intentionally lightweight: it narrows each possibility
        set toward the suggested cards by removing one non-suggested candidate
        when possible.
        """
        if (
            not isinstance(suggestion, tuple)
            or len(suggestion) != 3
            or any(not isinstance(v, str) or not v.strip() for v in suggestion)
        ):
            raise ValueError("Invalid suggestion")

        suspect, weapon, location = suggestion
        new_state = deepcopy(self)

        _narrow_toward(new_state.possible_suspects, suspect)
        _narrow_toward(new_state.possible_weapons, weapon)
        _narrow_toward(new_state.possible_locations, location)

        new_state.solution_determined = (
            len(new_state.possible_suspects) == 1
            and len(new_state.possible_weapons) == 1
            and len(new_state.possible_locations) == 1
        )

        return new_state

    def is_terminal(self) -> bool:
        """Return True if the game is over or fully solved in this state."""
        return (
            self.game_over
            or self.solution_determined
            or (
                len(self.possible_suspects) == 1
                and len(self.possible_weapons) == 1
                and len(self.possible_locations) == 1
            )
        )

    def is_solution_known(self) -> bool:
        """Return True when each solution category has exactly one candidate."""
        return (
            len(self.possible_suspects) == 1
            and len(self.possible_weapons) == 1
            and len(self.possible_locations) == 1
        )


class MinimaxAI(BaseAI):
    """Search-based AI using fixed-depth minimax over a simulation state."""

    def __init__(self, depth: int = 2) -> None:
        """Create a minimax AI with bounded depth for performance safety."""
        if depth < 1:
            raise ValueError("depth must be >= 1")
        self.depth = min(depth, 3)

    def evaluate(self, state: GameState) -> float:
        """Return a numeric score indicating how favorable a state is.

        Scoring factors:
        1. Possibility-space reduction across suspect/weapon/location.
        2. Reward for known-card accumulation.
        3. Strong solved-state reward.
        4. Penalties for high uncertainty and unbalanced category progress.

        Raises:
            ValueError: If state is None or missing required attributes.
        """
        if state is None:
            raise ValueError("Invalid state")

        # Validate required state attributes for safe repeated evaluation calls.
        required_attrs = (
            "possible_suspects",
            "possible_weapons",
            "possible_locations",
            "current_location",
        )
        missing = [name for name in required_attrs if not hasattr(state, name)]
        if missing:
            raise ValueError(f"Invalid state: missing attributes {missing}")

        possible_suspects = _safe_str_set(getattr(state, "possible_suspects"), "possible_suspects")
        possible_weapons = _safe_str_set(getattr(state, "possible_weapons"), "possible_weapons")
        possible_locations = _safe_str_set(getattr(state, "possible_locations"), "possible_locations")

        # Mandatory edge-case handling: impossible/invalid inference sets.
        if not possible_suspects or not possible_weapons or not possible_locations:
            return -100.0

        is_solution_known = False
        if hasattr(state, "is_solution_known") and callable(state.is_solution_known):
            is_solution_known = bool(state.is_solution_known())
        else:
            is_solution_known = (
                len(possible_suspects) == 1
                and len(possible_weapons) == 1
                and len(possible_locations) == 1
            )

        if is_solution_known:
            return 100.0

        score = 0.0

        # 1) Reduce possibility space (critical).
        score += (10 - len(possible_suspects)) * 3
        score += (10 - len(possible_weapons)) * 3
        score += (10 - len(possible_locations)) * 3

        # 2) Reward knowledge gain.
        known_cards = _known_cards_count(getattr(state, "notebook", None), state)
        score += known_cards * 2

        # 3) Penalize large uncertainty.
        if len(possible_suspects) > 5:
            score -= 5
        if len(possible_weapons) > 5:
            score -= 5
        if len(possible_locations) > 5:
            score -= 5

        # 4) Balance categories so all dimensions are solved progressively.
        score -= abs(len(possible_suspects) - len(possible_weapons))
        score -= abs(len(possible_suspects) - len(possible_locations))
        score -= abs(len(possible_weapons) - len(possible_locations))

        # 5) Encourage current-room relevance for location inference.
        current_location = getattr(state, "current_location", None)
        if isinstance(current_location, str) and current_location in possible_locations:
            score += 2

        return float(score)

    def minimax(self, state: GameState, depth: int, maximizing: bool) -> float:
        """Evaluate a state via recursive minimax search.

        Args:
            state (GameState): Search state to evaluate.
            depth (int): Remaining depth budget. Must be >= 0.
            maximizing (bool): True for maximizing node, False for minimizing.

        Returns:
            float: Utility estimate for the input state.

        Raises:
            ValueError: If state is None or depth is negative.
        """
        if state is None:
            raise ValueError("State cannot be None")

        if depth < 0:
            raise ValueError("depth cannot be negative")

        if depth == 0 or state.is_terminal():
            return self.evaluate(state)

        moves = state.get_possible_moves()
        if not moves:
            return self.evaluate(state)

        if maximizing:
            max_eval = -inf
            progressed = False
            for move in moves:
                new_state = _simulate_state(state, move)
                if new_state is None:
                    continue
                progressed = True
                eval_score = self.minimax(new_state, depth - 1, False)
                max_eval = max(max_eval, eval_score)
            if not progressed:
                return self.evaluate(state)
            return float(max_eval)

        min_eval = inf
        progressed = False
        for move in moves:
            new_state = _simulate_state(state, move)
            if new_state is None:
                continue
            progressed = True
            eval_score = self.minimax(new_state, depth - 1, True)
            min_eval = min(min_eval, eval_score)
        if not progressed:
            return self.evaluate(state)
        return float(min_eval)

    def choose_move(self, state: Any, valid_moves: Sequence[str]) -> str | None:
        """Select the best move by scoring each candidate with minimax.

        Args:
            state (Any): Current state snapshot.
            valid_moves (Sequence[str]): Legal moves available this turn.

        Returns:
            str | None: Highest-scoring move, or None when no legal moves exist.
        """
        if valid_moves is None:
            raise ValueError("valid_moves cannot be None")

        valid_moves = list(valid_moves)
        if not valid_moves:
            return None

        search_state = self._coerce_state(state, valid_moves)

        best_move: str | None = None
        best_score = -inf

        for move in valid_moves:
            new_state = _simulate_state(search_state, move)
            if new_state is None:
                continue

            score = self.minimax(new_state, self.depth, False)
            if score > best_score:
                best_score = score
                best_move = move

        if best_move is None:
            best_move = random.choice(valid_moves)

        return best_move

    def make_suggestion(self, state: Any) -> tuple[str, str, str]:
        """Select the best suspect-weapon suggestion using minimax scoring.

        Args:
            state (Any): Current state snapshot.

        Returns:
            tuple[str, str, str]: Best (suspect, weapon, location) suggestion.

        Raises:
            ValueError: If suggestion possibility space is empty.
        """
        search_state = self._coerce_state(state)

        suspects = sorted(search_state.possible_suspects)
        weapons = sorted(search_state.possible_weapons)

        if not suspects or not weapons:
            raise ValueError("Invalid state: empty suggestion space")

        location = search_state.current_location
        if not isinstance(location, str) or not location.strip():
            if search_state.possible_locations:
                location = sorted(search_state.possible_locations)[0]
            else:
                raise ValueError("Invalid state: missing current location")

        best: tuple[str, str, str] | None = None
        best_score = -inf

        for suspect in suspects:
            for weapon in weapons:
                suggestion = (suspect, weapon, location)
                try:
                    new_state = search_state.simulate_suggestion(suggestion)
                except Exception:
                    continue

                score = self.minimax(new_state, self.depth, False)
                if score > best_score:
                    best_score = score
                    best = suggestion

        if best is None:
            return (
                random.choice(suspects),
                random.choice(weapons),
                location,
            )

        return best

    def decide_accusation(self, state: Any) -> bool:
        """Return True only when each possibility set is fully resolved."""
        search_state = self._coerce_state(state)
        return (
            len(search_state.possible_suspects) == 1
            and len(search_state.possible_weapons) == 1
            and len(search_state.possible_locations) == 1
        )

    def _coerce_state(
        self,
        state: Any,
        valid_moves: Sequence[str] | None = None,
    ) -> GameState:
        """Coerce external state into minimax GameState with validation."""
        if isinstance(state, GameState):
            coerced = deepcopy(state)
            if valid_moves is not None:
                coerced.valid_moves_override = list(valid_moves)
            return coerced

        return GameState.from_engine_state(state, valid_moves=valid_moves)


def _narrow_toward(possible_set: set[str], preferred_item: str) -> None:
    """Narrow one candidate set toward preferred_item in-place."""
    if not possible_set or len(possible_set) <= 1:
        return

    if preferred_item in possible_set:
        removable = sorted(v for v in possible_set if v != preferred_item)
        if removable:
            possible_set.remove(removable[0])


def _simulate_state(state: Any, move: str) -> Any | None:
    """Return simulated successor state for a move, or None if invalid.

    Supports both `simulate(move)` and `simulate_move(move)` state APIs.
    """
    simulator = None
    if hasattr(state, "simulate") and callable(state.simulate):
        simulator = state.simulate
    elif hasattr(state, "simulate_move") and callable(state.simulate_move):
        simulator = state.simulate_move

    if simulator is None:
        raise ValueError("State cannot be simulated: missing simulate method")

    try:
        return simulator(move)
    except Exception:
        return None


def _known_cards_count(notebook: Any, state: Any | None = None) -> int:
    """Return known-card count from notebook-like object or state fallback."""
    if notebook is not None:
        known = getattr(notebook, "known_cards", None)
        if isinstance(known, (set, list, tuple)):
            return len(known)

    if state is not None:
        known = getattr(state, "known_cards", None)
        if isinstance(known, (set, list, tuple)):
            return len(known)

    return 0


def _safe_str_set(value: Any, name: str) -> set[str]:
    """Validate set-like possibility collections and coerce to set[str]."""
    if isinstance(value, set):
        return {str(item) for item in value}

    if isinstance(value, (list, tuple)):
        return {str(item) for item in value}

    raise ValueError(f"Invalid state: {name} must be a set/list/tuple")


if __name__ == "__main__":
    from engine.game_state import GameState as EngineGameState
    from engine.player import AIPlayer

    # Example usage with engine state.
    engine_state = EngineGameState()
    ai = MinimaxAI(depth=2)
    player = AIPlayer("AI Player", ai)
    opponent = AIPlayer("AI Opponent", MinimaxAI(depth=1))

    engine_state.add_player(player)
    engine_state.add_player(opponent)
    engine_state.setup_game()

    player.move("Library")
    opponent.move("Academic Building")

    valid_moves = engine_state.board.get_valid_moves(player.position, steps=6)
    move = ai.choose_move(engine_state, valid_moves)
    suggestion = ai.make_suggestion(engine_state)
    accuse = ai.decide_accusation(engine_state)

    print("Move:", move)
    print("Suggestion:", suggestion)
    print("Accuse:", accuse)
