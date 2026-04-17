"""negamax_ai.py - Negamax AI Strategy Skeleton.

Purpose: Defines a clean, extensible structure for a Negamax-based AI agent
that will later support alpha-beta pruning and high-performance search.
"""

import random

from ai.base_ai import BaseAI
from math import inf
from typing import Any, Sequence


class NegamaxAI(BaseAI):
    """Negamax AI skeleton compatible with the existing AI interface."""

    def __init__(self, depth: int = 2):
        """Store search depth for future recursive Negamax logic."""
        self.depth = depth

    def negamax(self, state: Any, depth: int, alpha: float, beta: float) -> float:
        """Evaluate a state via Negamax with alpha-beta pruning.

        Args:
            state: Current game state.
            depth: Remaining search depth (must be >= 0).
            alpha: Lower bound on achievable score.
            beta: Upper bound on achievable score.

        Returns:
            float: Utility estimate for this state.

        Raises:
            ValueError: If state is None, depth is negative, or alpha > beta.
        """
        if state is None:
            raise ValueError("State cannot be None")

        if depth < 0:
            raise ValueError("depth cannot be negative")

        if alpha > beta:
            raise ValueError("alpha must be <= beta")

        if depth == 0 or self._is_terminal_state(state):
            return self.evaluate(state)

        best = -inf
        moves = self._get_possible_moves(state)

        if not moves:
            return self.evaluate(state)

        progressed = False
        for move in moves:
            new_state = self._simulate_state(state, move)
            if new_state is None:
                continue

            progressed = True
            score = -self.negamax(new_state, depth - 1, -beta, -alpha)
            best = max(best, score)
            alpha = max(alpha, score)

            if alpha >= beta:
                break

        if not progressed:
            return self.evaluate(state)

        return float(best)

    def evaluate(self, state: Any) -> float:
        """Return a lightweight heuristic score for a given state.

        This evaluator keeps the Negamax core runnable and consistent with the
        existing AI architecture until richer scoring is added.
        """
        if state is None:
            raise ValueError("State cannot be None")

        suspects = self._as_set(getattr(state, "possible_suspects", None))
        weapons = self._as_set(getattr(state, "possible_weapons", None))
        locations = self._as_set(getattr(state, "possible_locations", None))

        if suspects is None or weapons is None or locations is None:
            notebook = self._get_current_notebook(state)
            if notebook is not None:
                suspects = self._as_set(getattr(notebook, "possible_suspects", set()))
                weapons = self._as_set(getattr(notebook, "possible_weapons", set()))
                locations = self._as_set(getattr(notebook, "possible_locations", set()))

        if suspects is None:
            suspects = set(getattr(state, "suspects", []))
        if weapons is None:
            weapons = set(getattr(state, "weapons", []))
        if locations is None:
            locations = set(getattr(state, "locations", []))

        if not suspects or not weapons or not locations:
            return -100.0

        if len(suspects) == 1 and len(weapons) == 1 and len(locations) == 1:
            return 100.0

        score = 0.0
        score += (10 - len(suspects)) * 3
        score += (10 - len(weapons)) * 3
        score += (10 - len(locations)) * 3

        score -= abs(len(suspects) - len(weapons))
        score -= abs(len(suspects) - len(locations))
        score -= abs(len(weapons) - len(locations))

        return float(score)

    def _is_terminal_state(self, state: Any) -> bool:
        """Return whether search should stop at this state."""
        if hasattr(state, "is_terminal") and callable(state.is_terminal):
            return bool(state.is_terminal())

        if bool(getattr(state, "game_over", False)):
            return True

        notebook = self._get_current_notebook(state)
        if notebook is not None and hasattr(notebook, "is_solved"):
            solved = notebook.is_solved
            if callable(solved):
                return bool(solved())

        suspects = self._as_set(getattr(state, "possible_suspects", None))
        weapons = self._as_set(getattr(state, "possible_weapons", None))
        locations = self._as_set(getattr(state, "possible_locations", None))
        if suspects is not None and weapons is not None and locations is not None:
            return len(suspects) == 1 and len(weapons) == 1 and len(locations) == 1

        return False

    def _get_possible_moves(self, state: Any) -> list[str]:
        """Get possible moves from search state or engine state."""
        if hasattr(state, "get_possible_moves") and callable(state.get_possible_moves):
            return list(state.get_possible_moves())

        position = getattr(state, "current_location", None)
        players = getattr(state, "players", None)
        current_turn = getattr(state, "current_turn", None)
        if (not isinstance(position, str) or not position.strip()) and isinstance(players, list) and players and isinstance(current_turn, int):
            current_player = players[current_turn % len(players)]
            position = getattr(current_player, "position", None)

        board = getattr(state, "board", None)
        if board is None:
            return []

        if isinstance(position, str) and position.strip() and hasattr(board, "get_valid_moves"):
            return list(board.get_valid_moves(position, steps=12))

        if hasattr(board, "get_all_locations"):
            return list(board.get_all_locations())

        return []

    def _simulate_state(self, state: Any, move: str) -> Any | None:
        """Simulate a successor state for a move without mutating input state."""
        simulator = None
        if hasattr(state, "simulate") and callable(state.simulate):
            simulator = state.simulate
        elif hasattr(state, "simulate_move") and callable(state.simulate_move):
            simulator = state.simulate_move

        if simulator is None:
            return None

        try:
            return simulator(move)
        except Exception:
            return None

    def _get_current_notebook(self, state: Any) -> Any | None:
        """Return the current player's notebook when available."""
        players = getattr(state, "players", None)
        current_turn = getattr(state, "current_turn", None)
        if isinstance(players, list) and players and isinstance(current_turn, int):
            player = players[current_turn % len(players)]
            return getattr(player, "notebook", None)
        return None

    def _as_set(self, value: Any) -> set[str] | None:
        """Convert set/list/tuple collections to set[str], else None."""
        if isinstance(value, set):
            return {str(v) for v in value}
        if isinstance(value, (list, tuple)):
            return {str(v) for v in value}
        return None

    def choose_move(self, state: Any, valid_moves: Sequence[str] | None) -> str | None:
        """Select the highest-scoring movement using Negamax + alpha-beta.

        Args:
            state: Current game/search state.
            valid_moves: Legal move options for this turn.

        Returns:
            str | None: Best legal move, or None when no legal move exists.

        Raises:
            ValueError: If state is None.
        """
        if state is None:
            raise ValueError("State cannot be None")

        if not valid_moves:
            return None

        valid_moves = list(valid_moves)

        working_state = state
        if not (
            hasattr(working_state, "simulate") and callable(getattr(working_state, "simulate"))
        ) and not (
            hasattr(working_state, "simulate_move")
            and callable(getattr(working_state, "simulate_move"))
        ):
            try:
                from ai.minimax_ai import GameState as MinimaxSearchState

                working_state = MinimaxSearchState.from_engine_state(
                    state,
                    valid_moves=valid_moves,
                )
            except Exception:
                working_state = state

        best_move: str | None = None
        best_score = -inf

        for move in valid_moves:
            new_state = self._simulate_state(working_state, move)
            if new_state is None:
                continue

            score = -self.negamax(new_state, self.depth, float("-inf"), float("inf"))
            if getattr(self, "debug", False):
                print(f"Move: {move}, Score: {score}")

            if score > best_score:
                best_score = score
                best_move = move

        if best_move is None:
            best_move = random.choice(valid_moves)

        return best_move

    def make_suggestion(self, state: Any) -> tuple[str, str, str]:
        """Select the best suggestion using Negamax + alpha-beta scoring.

        Args:
            state: Current game/search state.

        Returns:
            tuple[str, str, str]: (suspect, weapon, location) suggestion.

        Raises:
            ValueError: If state is None or has no suggestion options.
        """
        if state is None:
            raise ValueError("State cannot be None")

        working_state = state
        if not hasattr(working_state, "simulate_suggestion") or not callable(
            getattr(working_state, "simulate_suggestion")
        ):
            try:
                from ai.minimax_ai import GameState as MinimaxSearchState

                working_state = MinimaxSearchState.from_engine_state(state)
            except Exception:
                working_state = state

        suspects = self._as_set(getattr(working_state, "possible_suspects", None))
        weapons = self._as_set(getattr(working_state, "possible_weapons", None))

        if suspects is None:
            suspects = set(getattr(working_state, "suspects", []))
        if weapons is None:
            weapons = set(getattr(working_state, "weapons", []))

        if not suspects or not weapons:
            raise ValueError("Invalid state: no suggestion options")

        location = getattr(working_state, "current_location", None)
        if not isinstance(location, str) or not location.strip():
            notebook = self._get_current_notebook(working_state)
            if notebook is not None:
                locations = self._as_set(getattr(notebook, "possible_locations", set()))
                if locations:
                    location = sorted(locations)[0]

        if not isinstance(location, str) or not location.strip():
            players = getattr(working_state, "players", None)
            current_turn = getattr(working_state, "current_turn", None)
            if isinstance(players, list) and players and isinstance(current_turn, int):
                position = getattr(players[current_turn % len(players)], "position", None)
                if isinstance(position, str) and position.strip():
                    location = position

        if not isinstance(location, str) or not location.strip():
            possible_locations = self._as_set(getattr(working_state, "possible_locations", None))
            if possible_locations:
                location = sorted(possible_locations)[0]

        if not isinstance(location, str) or not location.strip():
            raise ValueError("Invalid state: missing current location")

        best: tuple[str, str, str] | None = None
        best_score = -inf

        simulator = getattr(working_state, "simulate_suggestion", None)
        for suspect in sorted(suspects):
            for weapon in sorted(weapons):
                suggestion = (suspect, weapon, location)

                if not callable(simulator):
                    continue

                try:
                    new_state = simulator(suggestion)
                except Exception:
                    continue

                score = -self.negamax(new_state, self.depth, float("-inf"), float("inf"))
                if getattr(self, "debug", False):
                    print(f"Suggestion: {suggestion}, Score: {score}")

                if score > best_score:
                    best_score = score
                    best = suggestion

        if best is None:
            best = (
                random.choice(list(suspects)),
                random.choice(list(weapons)),
                location,
            )

        return best

    def decide_accusation(self, state: Any) -> bool:
        """Decide whether to make a final accusation.

        This placeholder will later use certainty/risk-aware Negamax logic.
        """
        pass
