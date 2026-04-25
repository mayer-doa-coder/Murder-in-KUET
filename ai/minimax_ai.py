"""
minimax_ai.py - Minimax AI Strategy

Purpose: Provides a production-ready minimax agent and a lightweight
search-state representation that supports simulation and evaluation.
"""

from __future__ import annotations

import logging
from copy import deepcopy
from dataclasses import dataclass
from math import inf, log
from typing import Any, Sequence

from ai.base_ai import BaseAI
from config.settings import AI_CONFIG, GAME_CONFIG, get_positive_int
from utils.helpers import safe_random_choice


logger = logging.getLogger(__name__)


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


class StrategicEvaluationMixin:
    """Reusable strategic evaluation logic shared across search AIs.

    The evaluation is intentionally modular so each component can be replaced
    independently by future Bayesian or learning-based implementations.
    """

    def evaluate(self, state: Any) -> float:
        """Heuristic evaluation function.

        Combines multiple scoring strategies to assess
        the quality of the current game state.
        """
        if state is None:
            raise ValueError("State cannot be None")

        info_score = self.score_information_gain(state)
        certainty_score = self.score_certainty(state)
        risk_score = self.score_risk(state)
        opponent_score = self.score_opponent(state)

        logger.debug("Information Gain Score: %s", info_score)
        logger.debug("Certainty Score: %s", certainty_score)
        logger.debug("Risk Score: %s", risk_score)
        logger.debug("Opponent Score: %s", opponent_score)

        score = 0.0
        score += info_score
        score += certainty_score
        score += risk_score
        score += opponent_score
        return float(score)

    def score_information_gain(self, state: Any) -> float:
        """Reward lower remaining uncertainty in solution candidate sets.

        The function computes a compact uncertainty total from suspect, weapon,
        and location possibility pools, then maps lower uncertainty to a higher
        score using configurable constants.

        Returns:
            float: Information-gain score where higher values indicate more
            informative states.

        Raises:
            ValueError: If state is None.
        """
        if state is None:
            raise ValueError("State cannot be None")

        if not hasattr(state, "possible_suspects") or not hasattr(state, "possible_weapons") or not hasattr(state, "possible_locations"):
            return 0.0

        suspects = self._as_set(getattr(state, "possible_suspects", None))
        weapons = self._as_set(getattr(state, "possible_weapons", None))
        locations = self._as_set(getattr(state, "possible_locations", None))

        # Optional configurable constants for easy tuning.
        weight = 2.0
        max_score = 30.0
        use_entropy = bool(AI_CONFIG.get("USE_ENTROPY_EVAL", False))

        suspects_n = len(suspects or set())
        weapons_n = len(weapons or set())
        locations_n = len(locations or set())

        if use_entropy:
            total_entropy = (
                self._entropy(suspects_n)
                + self._entropy(weapons_n)
                + self._entropy(locations_n)
            )
            return float(-total_entropy * weight)

        total = float(suspects_n + weapons_n + locations_n)
        return float((max_score - total) * weight)

    def score_certainty(self, state: Any) -> float:
        """Reward states that are closer to a final accusation.

        Scoring logic:
        - +reward for each category (suspect/weapon/location) that is fully
          solved with exactly one remaining candidate.
        - Optional +partial_bonus for categories with at most two candidates.

        Returns:
            float: Certainty score where larger values mean higher confidence.

        Raises:
            ValueError: If state is None.
        """
        if state is None:
            raise ValueError("State cannot be None")

        if not hasattr(state, "possible_suspects") or not hasattr(state, "possible_weapons") or not hasattr(state, "possible_locations"):
            return 0.0

        suspects = self._as_set(getattr(state, "possible_suspects", None))
        weapons = self._as_set(getattr(state, "possible_weapons", None))
        locations = self._as_set(getattr(state, "possible_locations", None))

        # Optional configurable certainty rewards.
        reward = 10.0
        partial_bonus = 5.0

        score = 0.0
        for options in (suspects or set(), weapons or set(), locations or set()):
            if len(options) == 1:
                score += reward
            elif len(options) == 2:
                score += partial_bonus

        return float(score)

    def score_risk(self, state: Any) -> float:
        """Penalize high uncertainty to avoid premature decisions.

        Returns:
            float: Negative penalty when the remaining solution space is large,
            otherwise 0.0.

        Raises:
            ValueError: If state is None.
        """
        if state is None:
            raise ValueError("State cannot be None")

        if not hasattr(state, "possible_suspects") or not hasattr(state, "possible_weapons") or not hasattr(state, "possible_locations"):
            return 0.0

        suspects = self._as_set(getattr(state, "possible_suspects", None)) or set()
        weapons = self._as_set(getattr(state, "possible_weapons", None)) or set()
        locations = self._as_set(getattr(state, "possible_locations", None)) or set()

        remaining = len(suspects) * len(weapons) * len(locations)
        return -20.0 if remaining > 10 else 0.0

    def score_opponent(self, state: Any) -> float:
        """Penalize states where opponents appear to have card advantage.

        Opponent advantage is estimated as the total number of cards held by
        non-current players. More opponent cards means a more negative score.

        Returns:
            float: Negative opponent-advantage penalty, or 0.0 when unknown.

        Raises:
            ValueError: If state is None.
        """
        if state is None:
            raise ValueError("State cannot be None")

        players = getattr(state, "players", None)
        if not isinstance(players, list) or not players:
            return 0.0

        current_player = self._resolve_current_player(state)
        if current_player is None:
            return 0.0

        opponent_advantage = 0
        for player in players:
            if player is current_player:
                continue
            cards = getattr(player, "cards", None)
            if isinstance(cards, (list, tuple, set)) and cards:
                opponent_advantage += len(cards)

        return float(-opponent_advantage)

    def _resolve_current_player(self, state: Any) -> Any | None:
        """Resolve current player from supported state representations."""
        player = getattr(state, "current_player", None)
        if player is not None:
            return player

        players = getattr(state, "players", None)
        if not isinstance(players, list) or not players:
            return None

        current_turn = getattr(state, "current_turn", None)
        if isinstance(current_turn, int):
            return players[current_turn % len(players)]

        current_player_index = getattr(state, "current_player_index", None)
        if isinstance(current_player_index, int):
            return players[current_player_index % len(players)]

        return None

    def _entropy(self, n: int) -> float:
        """Return Shannon entropy of a uniform distribution over n elements.

        H(uniform(n)) = log(n).  Higher n → higher entropy → more uncertain.
        Returns 0.0 for n <= 1 (no uncertainty when at most one option).
        """
        return log(float(n)) if n > 1 else 0.0

    def _resolve_possibility_space(self, state: Any) -> tuple[set[str], set[str], set[str]]:
        """Resolve suspect/weapon/location candidate sets from supported states."""
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

    def _get_current_notebook(self, state: Any) -> Any | None:
        """Return current player's notebook if present, else None."""
        notebook = getattr(state, "notebook", None)
        if notebook is not None:
            return notebook

        players = getattr(state, "players", None)
        current_turn = getattr(state, "current_turn", None)
        if isinstance(players, list) and players and isinstance(current_turn, int):
            player = players[current_turn % len(players)]
            return getattr(player, "notebook", None)

        if isinstance(state, GameState):
            index = state.current_player_index
            if state.players and 0 <= index < len(state.players):
                player = state.players[index]
                return getattr(player, "notebook", None)

        return None

    def _known_cards_count_for_state(self, state: Any) -> int:
        """Return known-card count from notebook-like structures."""
        notebook = self._get_current_notebook(state)
        return _known_cards_count(notebook, state)

    def _notebook_certainty(self, player: Any) -> float | None:
        """Estimate certainty for a player's notebook in [0, 1]."""
        notebook = getattr(player, "notebook", None)
        if notebook is None:
            return None

        suspects = self._as_set(getattr(notebook, "possible_suspects", None))
        weapons = self._as_set(getattr(notebook, "possible_weapons", None))
        locations = self._as_set(getattr(notebook, "possible_locations", None))
        if suspects is None or weapons is None or locations is None:
            return None
        if not suspects or not weapons or not locations:
            return None

        # 1 means solved certainty, 0 means high uncertainty.
        denom = 30.0
        uncertainty = float(len(suspects) + len(weapons) + len(locations))
        certainty = max(0.0, min(1.0, 1.0 - ((uncertainty - 3.0) / denom)))
        return float(certainty)

    def _as_set(self, value: Any) -> set[str] | None:
        """Convert set/list/tuple collections to set[str], else None."""
        if isinstance(value, set):
            return {str(v) for v in value}
        if isinstance(value, (list, tuple)):
            return {str(v) for v in value}
        return None


class MinimaxAI(StrategicEvaluationMixin, BaseAI):
    """Search-based AI using fixed-depth minimax over a simulation state."""

    def __init__(self, depth: int | None = None) -> None:
        """Create a minimax AI with bounded depth for performance safety."""
        if depth is None:
            depth = get_positive_int(
                AI_CONFIG,
                "MINIMAX_DEPTH",
                get_positive_int(GAME_CONFIG, "AI_DEPTH", 1),
            )
        if depth < 1:
            raise ValueError("depth must be >= 1")
        self.depth = min(depth, 3)
        self._last_notebook: Any | None = None

    def evaluate(self, state: Any) -> float:
        """Delegate to the centralized strategic evaluation pipeline."""
        return super().evaluate(state)

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
            best_move = safe_random_choice(valid_moves)

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
            notebook = getattr(search_state, "notebook", None)
            most_likely = getattr(notebook, "most_likely", None)
            if callable(most_likely):
                try:
                    likely_suspect, likely_weapon, _likely_location = most_likely()
                    if likely_suspect in suspects and likely_weapon in weapons:
                        return (likely_suspect, likely_weapon, location)
                except Exception:
                    pass

            return (suspects[0], weapons[0], location)

        return best

    def decide_accusation(self, state: Any) -> bool:
        """Decide whether to accuse using notebook probability confidence."""
        if state is None:
            raise ValueError("Invalid state provided")

        search_state = self._coerce_state(state)
        notebook = getattr(search_state, "notebook", None)
        confidence_check = getattr(notebook, "confident_accusation", None)
        if callable(confidence_check):
            return bool(confidence_check())

        return False

    def _coerce_state(
        self,
        state: Any,
        valid_moves: Sequence[str] | None = None,
    ) -> GameState:
        """Coerce external state into minimax GameState with validation."""
        if isinstance(state, GameState):
            coerced = deepcopy(state)
            self._last_notebook = coerced.notebook
            if valid_moves is not None:
                coerced.valid_moves_override = list(valid_moves)
            return coerced

        coerced = GameState.from_engine_state(state, valid_moves=valid_moves)
        self._last_notebook = coerced.notebook
        return coerced

    def update_from_clue(self, card) -> None:
        """Consume revealed-card evidence by eliminating it from notebook.

        _apply_bayesian_notebook_updates already calls eliminate() for the
        suggesting player before this method is invoked.  The guard inside
        eliminate() (prob != 0 check) prevents a crash, but we skip the call
        entirely when the card is already known to avoid wasted work.
        """
        if card is None or self._last_notebook is None:
            return

        name = getattr(card, "name", None)
        if not (isinstance(name, str) and name.strip()):
            return

        known = getattr(self._last_notebook, "known_cards", None)
        if isinstance(known, set) and name in known:
            return  # already eliminated by _apply_bayesian_notebook_updates

        if hasattr(self._last_notebook, "eliminate"):
            self._last_notebook.eliminate(name)

    def handle_no_reveal(self, suggestion) -> None:
        """Apply conservative no-reveal inference to notebook candidate sets.

        If no opponent can disprove a suggestion, the suggested suspect/weapon/
        location become stronger candidates. We narrow each category set to the
        suggested card only when that card is still a current candidate.
        """
        if self._last_notebook is None or suggestion is None:
            return

        suspect = getattr(suggestion, "suspect", None)
        weapon = getattr(suggestion, "weapon", None)
        location = getattr(suggestion, "location", None)

        update_no_reveal = getattr(self._last_notebook, "update_no_reveal", None)
        if (
            callable(update_no_reveal)
            and isinstance(suspect, str)
            and isinstance(weapon, str)
            and isinstance(location, str)
        ):
            update_no_reveal(suspect, weapon, location)
            return

        suspect_set = getattr(self._last_notebook, "possible_suspects", None)
        weapon_set = getattr(self._last_notebook, "possible_weapons", None)
        location_set = getattr(self._last_notebook, "possible_locations", None)

        if isinstance(suspect_set, set) and isinstance(suspect, str) and suspect in suspect_set:
            suspect_set.intersection_update({suspect})

        if isinstance(weapon_set, set) and isinstance(weapon, str) and weapon in weapon_set:
            weapon_set.intersection_update({weapon})

        if isinstance(location_set, set) and isinstance(location, str) and location in location_set:
            location_set.intersection_update({location})


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
    from config.settings import AI_CONFIG
    from models.player import AIPlayer
    from utils.logger import setup_logger

    # Example usage with engine state.
    engine_state = EngineGameState()
    ai = MinimaxAI(depth=AI_CONFIG.get("MINIMAX_DEPTH"))
    player = AIPlayer("AI Player", ai)
    opponent = AIPlayer("AI Opponent", MinimaxAI(depth=AI_CONFIG.get("MINIMAX_DEPTH")))

    engine_state.add_player(player)
    engine_state.add_player(opponent)
    engine_state.setup_game()

    player.move("Auditorium")
    opponent.move("Student Welfare Center")

    valid_moves = engine_state.board.get_valid_moves(player.position, steps=6)
    move = ai.choose_move(engine_state, valid_moves)
    suggestion = ai.make_suggestion(engine_state)
    accuse = ai.decide_accusation(engine_state)

    setup_logger()
    logger.info("Move: %s", move)
    logger.info("Suggestion: %s", suggestion)
    logger.info("Accuse: %s", accuse)
