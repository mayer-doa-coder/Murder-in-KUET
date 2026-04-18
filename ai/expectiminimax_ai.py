"""expectiminimax_ai.py - Expectiminimax AI Strategy Skeleton.

Purpose: Defines a clean, extensible structure for a probabilistic search AI
that extends minimax with chance nodes.
"""

from __future__ import annotations

import logging
from copy import deepcopy
from math import inf, isclose
from typing import Any, List, Sequence, Tuple

from ai.base_ai import BaseAI
from ai.minimax_ai import StrategicEvaluationMixin
from config.settings import AI_CONFIG, GAME_CONFIG, get_positive_int
from utils.helpers import safe_random_choice


logger = logging.getLogger(__name__)


class ExpectiminimaxAI(StrategicEvaluationMixin, BaseAI):
    """Skeleton AI prepared for expectiminimax search with chance nodes.

    Node types planned in the recursive search:
    - "max": this AI chooses an action.
    - "min": opponent chooses an action.
    - "chance": probabilistic game outcome branch.
    """

    def __init__(self, depth: int | None = None) -> None:
        """Initialize recursion depth budget for future expectiminimax logic."""
        if depth is None:
            depth = get_positive_int(
                AI_CONFIG,
                "EXPECTIMINIMAX_DEPTH",
                get_positive_int(GAME_CONFIG, "AI_DEPTH", 1),
            )
        if depth < 1:
            raise ValueError("depth must be >= 1")
        self.depth = depth

    def expectiminimax(self, state: Any, depth: int, node_type: str) -> float:
        """Evaluate a game state via recursive expectiminimax.

        Node semantics:
            - "max": this AI selects the action with maximum utility.
            - "min": opponent selects the action with minimum utility.
            - "chance": expected utility over probabilistic outcomes.

        Args:
            state (Any): Search state snapshot.
            depth (int): Remaining recursion depth (must be >= 0).
            node_type (str): One of "max", "min", or "chance".

        Returns:
            float: Utility estimate for the given state at this node.

        Raises:
            ValueError: If state is None, depth is negative, node_type is
                invalid, or probability values are invalid.
        """
        if state is None:
            raise ValueError("State cannot be None")

        if depth < 0:
            raise ValueError("depth cannot be negative")

        if node_type not in {"max", "min", "chance"}:
            raise ValueError("Invalid node_type")

        if depth == 0 or self._is_terminal_state(state):
            return self.evaluate(state)

        if node_type == "max":
            max_eval = -inf
            moves = self._get_possible_moves(state)

            if not moves:
                return self.evaluate(state)

            progressed = False
            for move in moves:
                new_state = self._simulate_state(state, move)
                if new_state is None:
                    continue
                progressed = True
                eval_score = self.expectiminimax(new_state, depth - 1, "chance")
                max_eval = max(max_eval, eval_score)

            if not progressed:
                return self.evaluate(state)
            return float(max_eval)

        if node_type == "chance":
            expected_value = 0.0
            outcomes = self._get_chance_outcomes(state)

            if not outcomes:
                return self.evaluate(state)

            probs = []
            for prob, _ in outcomes:
                if prob < 0 or prob > 1:
                    raise ValueError("Invalid probability value")
                probs.append(prob)

            total_prob = float(sum(probs))
            if total_prob <= 0:
                return self.evaluate(state)

            normalize = not isclose(total_prob, 1.0, rel_tol=1e-9, abs_tol=1e-9)

            for prob, next_state in outcomes:
                effective_prob = (prob / total_prob) if normalize else prob
                expected_value += effective_prob * self.expectiminimax(
                    next_state, depth - 1, "min"
                )

            return float(expected_value)

        # node_type == "min"
        min_eval = inf
        moves = self._get_possible_moves(state)

        if not moves:
            return self.evaluate(state)

        progressed = False
        for move in moves:
            new_state = self._simulate_state(state, move)
            if new_state is None:
                continue
            progressed = True
            eval_score = self.expectiminimax(new_state, depth - 1, "chance")
            min_eval = min(min_eval, eval_score)

        if not progressed:
            return self.evaluate(state)
        return float(min_eval)

    def evaluate(self, state: Any) -> float:
        """Delegate to the centralized strategic evaluation pipeline."""
        return super().evaluate(state)

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
        return [(1.0, state)]

    def _is_terminal_state(self, state: Any) -> bool:
        """Return whether a state should stop recursion."""
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
        """Return possible moves from any supported state object."""
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
        """Simulate one move with support for different state APIs."""
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

    def _get_chance_outcomes(self, state: Any) -> List[Tuple[float, Any]]:
        """Resolve chance outcomes from state API, then AI fallback."""
        method = getattr(state, "get_chance_outcomes", None)
        if callable(method):
            try:
                outcomes = method()
                if outcomes is not None:
                    return list(outcomes)
            except TypeError:
                suggestion = getattr(state, "_pending_suggestion", None)
                if suggestion is None:
                    suggestion = self.make_suggestion(state)
                outcomes = method(suggestion)
                if outcomes is not None:
                    return list(outcomes)

        return list(self.get_chance_outcomes(state))

    def _get_current_notebook(self, state: Any) -> Any | None:
        """Return current player's notebook if present."""
        players = getattr(state, "players", None)
        current_turn = getattr(state, "current_turn", None)
        if isinstance(players, list) and players and isinstance(current_turn, int):
            player = players[current_turn % len(players)]
            return getattr(player, "notebook", None)
        return None

    def _known_cards_count(self, state: Any) -> int:
        """Return known-card count from notebook or state fallback."""
        notebook = getattr(state, "notebook", None)
        if notebook is None:
            notebook = self._get_current_notebook(state)

        if notebook is not None:
            known = getattr(notebook, "known_cards", None)
            if isinstance(known, (set, list, tuple)):
                return len(known)

        known = getattr(state, "known_cards", None)
        if isinstance(known, (set, list, tuple)):
            return len(known)

        return 0

    def _as_set(self, value: Any) -> set[str] | None:
        """Convert list/tuple/set collections to set[str], else None."""
        if isinstance(value, set):
            return {str(v) for v in value}
        if isinstance(value, (list, tuple)):
            return {str(v) for v in value}
        return None

    def _resolve_suggestion_space(self, state: Any) -> tuple[set[str], set[str], set[str]]:
        """Resolve suspect/weapon/location possibility sets from state or notebook."""
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

        return suspects, weapons, locations

    def _resolve_current_location(self, state: Any) -> str | None:
        """Resolve current location from state-level or current player fields."""
        location = getattr(state, "current_location", None)
        if isinstance(location, str) and location.strip():
            return location

        players = getattr(state, "players", None)
        current_turn = getattr(state, "current_turn", None)
        if isinstance(players, list) and players and isinstance(current_turn, int):
            player = players[current_turn % len(players)]
            position = getattr(player, "position", None)
            if isinstance(position, str) and position.strip():
                return position

        return None

    def _simulate_suggestion_state(
        self,
        state: Any,
        suggestion: tuple[str, str, str],
    ) -> Any | None:
        """Return a suggestion-successor state without mutating input state."""
        simulator = getattr(state, "simulate_suggestion", None)
        if callable(simulator):
            try:
                return simulator(suggestion)
            except Exception:
                return None

        try:
            copied_state = deepcopy(state)
        except Exception:
            return None

        setattr(copied_state, "_pending_suggestion", suggestion)
        return copied_state

    def choose_move(self, state: Any, valid_moves: Sequence[str]) -> str | None:
        """Choose the best move using expectiminimax expected-value scoring.

        Args:
            state (Any): Current game/search state snapshot.
            valid_moves (Sequence[str]): Legal candidate moves from the engine.

        Returns:
            str | None: Highest-scoring move, or None when no legal moves exist.

        Raises:
            ValueError: If the input state is invalid.
        """
        if state is None:
            raise ValueError("Invalid state provided")

        if valid_moves is None:
            return None

        valid_moves = list(valid_moves)
        if not valid_moves:
            return None

        best_move: str | None = None
        best_score = -inf

        for move in valid_moves:
            new_state = self._simulate_state(state, move)
            if new_state is None:
                continue

            score = self.expectiminimax(new_state, self.depth, "chance")
            if getattr(self, "debug", False):
                logger.debug("Evaluating Move: %s, Score: %s", move, score)

            if score > best_score:
                best_score = score
                best_move = move

        if best_move is None:
            best_move = safe_random_choice(valid_moves)

        return best_move

    def make_suggestion(self, state: Any) -> tuple[str, str, str]:
        """Choose the best suggestion using expectiminimax expected-value search.

        The AI scores each (suspect, weapon) candidate at the current location
        by simulating the suggestion and evaluating the resulting state via a
        chance node in expectiminimax.

        Returns:
            tuple[str, str, str]: Best (suspect, weapon, location) suggestion.

        Raises:
            ValueError: If the state is invalid or no candidate suggestions exist.
        """
        if state is None:
            raise ValueError("State cannot be None")

        suspects, weapons, locations = self._resolve_suggestion_space(state)
        if not suspects or not weapons:
            raise ValueError("Invalid state: no possible suggestions")

        location = self._resolve_current_location(state)
        if (not isinstance(location, str) or not location.strip()) and locations:
            location = sorted(locations)[0]

        if not isinstance(location, str) or not location.strip():
            raise ValueError("Invalid state: missing current location")

        best: tuple[str, str, str] | None = None
        best_score = -inf

        for suspect in sorted(suspects):
            for weapon in sorted(weapons):
                suggestion = (suspect, weapon, location)
                new_state = self._simulate_suggestion_state(state, suggestion)
                if new_state is None:
                    continue

                score = self.expectiminimax(new_state, self.depth, "chance")
                if getattr(self, "debug", False):
                    logger.debug("Suggestion: %s, Score: %s", suggestion, score)

                if score > best_score:
                    best_score = score
                    best = suggestion

        if best is None:
            notebook = self._get_current_notebook(state)
            most_likely = getattr(notebook, "most_likely", None)
            if callable(most_likely):
                try:
                    likely_suspect, likely_weapon, _likely_location = most_likely()
                    if likely_suspect in suspects and likely_weapon in weapons:
                        return (likely_suspect, likely_weapon, location)
                except Exception:
                    pass

            return (sorted(suspects)[0], sorted(weapons)[0], location)

        return best

    def decide_accusation(self, state: Any) -> bool:
        """Decide whether to accuse using notebook probability confidence."""
        if state is None:
            raise ValueError("Invalid state")

        notebook = self._get_current_notebook(state)
        confidence_check = getattr(notebook, "confident_accusation", None)
        if callable(confidence_check):
            return bool(confidence_check())

        return False
