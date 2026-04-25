"""
game_runner.py - Single-game execution service.

Extracted from main.py so that services.simulation_runner can import
run_single_game without creating a circular dependency on the top-level
entry point.
"""

import logging
import random
from time import perf_counter
from typing import Any

from ai.expectiminimax_ai import ExpectiminimaxAI
from ai.mcts_ai import MctsAI
from ai.minimax_ai import MinimaxAI
from ai.monte_carlo_ai import MonteCarloAI
from ai.negamax_ai import NegamaxAI
from config.settings import AI_CONFIG, GAME_CONFIG, get_positive_int
from engine.game_state import GameState
from models.player import AIPlayer

logger = logging.getLogger(__name__)


class InstrumentedAI:
    """Thin wrapper that tracks AI decision timing and counts per agent."""

    def __init__(self, agent, metrics: dict[str, dict[str, float]]) -> None:
        self._agent = agent
        self._metrics = metrics
        self._name = type(agent).__name__

    def _measure(self, method_name: str, *args, **kwargs):
        start_time = perf_counter()
        method = getattr(self._agent, method_name)

        try:
            return method(*args, **kwargs)
        except Exception as exc:
            logger.error("%s decision failed in %s: %s", self._name, method_name, exc)
            raise
        finally:
            elapsed = perf_counter() - start_time
            metric_bucket = self._metrics.setdefault(
                self._name,
                _blank_metrics(),
            )
            metric_bucket["decision_time"] += elapsed
            metric_bucket["decisions"] += 1
            if method_name == "choose_move":
                metric_bucket["total_moves"] += 1
            if method_name == "make_suggestion":
                metric_bucket["suggestion_total"] += 1

            logger.debug("%s %s decision time: %.6fs", self._name, method_name, elapsed)

    def choose_move(self, state, valid_moves):
        return self._measure("choose_move", state, valid_moves)

    def make_suggestion(self, state):
        return self._measure("make_suggestion", state)

    def decide_accusation(self, state):
        return self._measure("decide_accusation", state)

    def update_from_clue(self, card) -> None:
        """Called when this AI's suggestion caused someone to reveal a card."""
        metric_bucket = self._metrics.setdefault(self._name, _blank_metrics())
        metric_bucket["suggestion_success"] += 1
        if hasattr(self._agent, "update_from_clue"):
            self._agent.update_from_clue(card)

    def handle_no_reveal(self, suggestion) -> None:
        if hasattr(self._agent, "handle_no_reveal"):
            self._agent.handle_no_reveal(suggestion)


def _blank_metrics() -> dict[str, float]:
    """Return a zeroed metrics bucket for one AI agent."""
    return {
        "wins": 0,
        "games_played": 0,
        "total_moves": 0,
        "decision_time": 0.0,
        "decisions": 0,
        "correct_accusations": 0,
        "wrong_accusations": 0,
        "total_turns": 0,
        "suggestion_success": 0,
        "suggestion_total": 0,
    }


def _create_metrics() -> dict[str, dict[str, float]]:
    """Create metrics structure for all AI variants."""
    return {
        "MinimaxAI": _blank_metrics(),
        "ExpectiminimaxAI": _blank_metrics(),
        "NegamaxAI": _blank_metrics(),
        "MonteCarloAI": _blank_metrics(),
        "MctsAI": _blank_metrics(),
    }


def _create_comparison_players(
    metrics: dict[str, dict[str, float]],
    max_players: int,
) -> list:
    """Create fair mixed-agent lineup for comparison runs."""
    agents = [
        ("AI Player 1", MinimaxAI(depth=AI_CONFIG.get("MINIMAX_DEPTH"))),
        (
            "AI Player 2",
            ExpectiminimaxAI(depth=AI_CONFIG.get("EXPECTIMINIMAX_DEPTH")),
        ),
        ("AI Player 3", NegamaxAI(depth=AI_CONFIG.get("NEGAMAX_DEPTH"))),
        (
            "AI Player 4",
            MonteCarloAI(simulations=AI_CONFIG.get("MONTE_CARLO_SIMULATIONS")),
        ),
        (
            "AI Player 5",
            MctsAI(
                iterations=AI_CONFIG.get("MCTS_ITERATIONS"),
                exploration_constant=AI_CONFIG.get("MCTS_EXPLORATION_CONSTANT"),
            ),
        ),
    ]

    slots = min(max(1, max_players), len(agents))
    players = [
        AIPlayer(name, InstrumentedAI(agent, metrics)) for name, agent in agents[:slots]
    ]

    for player in players:
        player.is_ai = True
        if player.ai_agent is None:
            logger.error("%s missing ai_agent", player.name)
            raise ValueError(f"{player.name} missing ai_agent")

    return players


def run_single_game(
    *,
    seed: int | None = None,
    max_turns: int | None = None,
    max_players: int | None = None,
    verbose: bool = False,
) -> dict[str, Any]:
    """Run one AI comparison game and return structured metrics.

    Returns a per-game summary suitable for simulation aggregation layers.
    """
    if max_turns is None:
        max_turns = get_positive_int(GAME_CONFIG, "MAX_TURNS", 250)

    if max_players is None:
        max_players = get_positive_int(GAME_CONFIG, "MAX_PLAYERS", 3)

    if seed is not None:
        random.seed(seed)

    game = GameState()
    per_game_metrics = _create_metrics()
    players = _create_comparison_players(per_game_metrics, max_players=max_players)
    random.shuffle(players)
    for player in players:
        game.add_player(player)
    game.setup_game()

    run_start = perf_counter()
    winner = game.run_game(max_turns=max_turns, verbose=verbose)
    runtime = perf_counter() - run_start

    winner_name: str | None = None
    winner_player: str | None = None
    winner_moves = 0
    winner_decision_time = 0.0
    winner_decisions = 0
    total_moves = int(
        sum(
            float(ai_data.get("total_moves", 0))
            for ai_data in per_game_metrics.values()
        )
    )
    total_turns = total_moves
    total_decision_time = float(
        sum(
            float(ai_data.get("decision_time", 0.0))
            for ai_data in per_game_metrics.values()
        )
    )
    total_decisions = int(
        sum(float(ai_data.get("decisions", 0)) for ai_data in per_game_metrics.values())
    )
    total_correct_accusations = 0
    total_wrong_accusations = 0
    total_suggestion_success = int(
        sum(
            float(ai_data.get("suggestion_success", 0))
            for ai_data in per_game_metrics.values()
        )
    )
    total_suggestion_total = int(
        sum(
            float(ai_data.get("suggestion_total", 0))
            for ai_data in per_game_metrics.values()
        )
    )

    def _player_ai_name(player_obj: Any) -> str | None:
        wrapped_agent = getattr(player_obj, "ai_agent", None)
        core_ai = getattr(wrapped_agent, "_agent", wrapped_agent)
        if core_ai is None:
            return None
        return type(core_ai).__name__

    if winner is not None:
        winner_name = _player_ai_name(winner)
        if winner_name is None:
            wrapped_agent = getattr(winner, "ai_agent", None)
            winner_name = (
                type(wrapped_agent).__name__
                if wrapped_agent is not None
                else winner.name
            )
        winner_player = winner.name

        if winner_name in per_game_metrics:
            per_game_metrics[winner_name]["wins"] = 1
            winner_moves = int(per_game_metrics[winner_name]["total_moves"])
            winner_decision_time = float(per_game_metrics[winner_name]["decision_time"])
            winner_decisions = int(per_game_metrics[winner_name]["decisions"])

    # Track games played per AI
    for ai_name in per_game_metrics:
        per_game_metrics[ai_name]["games_played"] = 1

    active_players = [p for p in game.players if getattr(p, "active", False)]
    winner_by_correct_accusation = winner is not None and len(active_players) > 1

    for player in game.players:
        ai_name = _player_ai_name(player)
        if ai_name not in per_game_metrics:
            continue

        if not getattr(player, "active", False) and (
            winner is None or player is not winner
        ):
            per_game_metrics[ai_name]["wrong_accusations"] += 1
            total_wrong_accusations += 1
            logger.debug("%s made wrong accusation", ai_name)

    if winner_name in per_game_metrics:
        per_game_metrics[winner_name]["total_turns"] += total_turns
        if winner_by_correct_accusation:
            per_game_metrics[winner_name]["correct_accusations"] += 1
            total_correct_accusations += 1
            logger.debug("%s made correct accusation", winner_name)

    logger.info("Game finished. Winner: %s", winner_name if winner_name else "None")

    return {
        "winner": winner_name,
        "winner_player": winner_player,
        "total_moves": total_moves,
        "winner_moves": winner_moves,
        "turns": total_turns,
        "decision_time": total_decision_time,
        "decisions": total_decisions,
        "winner_decision_time": winner_decision_time,
        "winner_decisions": winner_decisions,
        "correct_accusations": total_correct_accusations,
        "wrong_accusations": total_wrong_accusations,
        "suggestion_success": total_suggestion_success,
        "suggestion_total": total_suggestion_total,
        "runtime": runtime,
        "no_winner": winner is None,
        "metrics": per_game_metrics,
    }
