"""Main entry point for AI performance comparison simulations."""

import logging
import random
from time import perf_counter
from typing import Any

from ai.expectiminimax_ai import ExpectiminimaxAI
from ai.minimax_ai import MinimaxAI
from ai.negamax_ai import NegamaxAI
from config.settings import AI_CONFIG, GAME_CONFIG, get_positive_int
from engine.game_state import GameState
from models.player import AIPlayer
from utils.logger import setup_logger


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
                {
                    "wins": 0,
                    "total_moves": 0,
                    "decision_time": 0.0,
                    "decisions": 0,
                    "correct_accusations": 0,
                    "wrong_accusations": 0,
                    "total_turns": 0,
                    "suggestion_success": 0,
                    "suggestion_total": 0,
                },
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
        metric_bucket = self._metrics.setdefault(
            self._name,
            {
                "wins": 0,
                "total_moves": 0,
                "decision_time": 0.0,
                "decisions": 0,
                "correct_accusations": 0,
                "wrong_accusations": 0,
                "total_turns": 0,
                "suggestion_success": 0,
                "suggestion_total": 0,
            },
        )
        metric_bucket["suggestion_success"] += 1

        if hasattr(self._agent, "update_from_clue"):
            self._agent.update_from_clue(card)

    def handle_no_reveal(self, suggestion) -> None:
        if hasattr(self._agent, "handle_no_reveal"):
            self._agent.handle_no_reveal(suggestion)


def _create_metrics() -> dict[str, dict[str, float]]:
    """Create metrics structure for all AI variants."""
    return {
        "MinimaxAI": {
            "wins": 0,
            "total_moves": 0,
            "decision_time": 0.0,
            "decisions": 0,
            "correct_accusations": 0,
            "wrong_accusations": 0,
            "total_turns": 0,
            "suggestion_success": 0,
            "suggestion_total": 0,
        },
        "ExpectiminimaxAI": {
            "wins": 0,
            "total_moves": 0,
            "decision_time": 0.0,
            "decisions": 0,
            "correct_accusations": 0,
            "wrong_accusations": 0,
            "total_turns": 0,
            "suggestion_success": 0,
            "suggestion_total": 0,
        },
        "NegamaxAI": {
            "wins": 0,
            "total_moves": 0,
            "decision_time": 0.0,
            "decisions": 0,
            "correct_accusations": 0,
            "wrong_accusations": 0,
            "total_turns": 0,
            "suggestion_success": 0,
            "suggestion_total": 0,
        },
    }


def _create_comparison_players(
    metrics: dict[str, dict[str, float]],
    max_players: int,
) -> list[AIPlayer]:
    """Create fair mixed-agent lineup for comparison runs."""
    agents = [
        ("AI Player 1", MinimaxAI(depth=AI_CONFIG.get("MINIMAX_DEPTH"))),
        (
            "AI Player 2",
            ExpectiminimaxAI(depth=AI_CONFIG.get("EXPECTIMINIMAX_DEPTH")),
        ),
        ("AI Player 3", NegamaxAI(depth=AI_CONFIG.get("NEGAMAX_DEPTH"))),
    ]

    slots = min(max(1, max_players), len(agents))
    players = [
        AIPlayer(name, InstrumentedAI(agent, metrics))
        for name, agent in agents[:slots]
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
        sum(float(ai_data.get("total_moves", 0)) for ai_data in per_game_metrics.values())
    )
    total_turns = total_moves
    total_decision_time = float(
        sum(float(ai_data.get("decision_time", 0.0)) for ai_data in per_game_metrics.values())
    )
    total_decisions = int(
        sum(float(ai_data.get("decisions", 0)) for ai_data in per_game_metrics.values())
    )
    total_correct_accusations = 0
    total_wrong_accusations = 0
    total_suggestion_success = int(
        sum(float(ai_data.get("suggestion_success", 0)) for ai_data in per_game_metrics.values())
    )
    total_suggestion_total = int(
        sum(float(ai_data.get("suggestion_total", 0)) for ai_data in per_game_metrics.values())
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
            winner_name = type(wrapped_agent).__name__ if wrapped_agent is not None else winner.name
        winner_player = winner.name

        if winner_name in per_game_metrics:
            per_game_metrics[winner_name]["wins"] = 1
            winner_moves = int(per_game_metrics[winner_name]["total_moves"])
            winner_decision_time = float(per_game_metrics[winner_name]["decision_time"])
            winner_decisions = int(per_game_metrics[winner_name]["decisions"])

    active_players = [p for p in game.players if getattr(p, "active", False)]
    winner_by_correct_accusation = winner is not None and len(active_players) > 1

    for player in game.players:
        ai_name = _player_ai_name(player)
        if ai_name not in per_game_metrics:
            continue

        if not getattr(player, "active", False) and (winner is None or player is not winner):
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
        "moves": total_moves,
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


def _run_ai_performance_comparison() -> None:
    """Run multi-game AI performance comparison with metrics reporting."""
    num_games = get_positive_int(GAME_CONFIG, "SIMULATION_RUNS", 10)
    max_turns = get_positive_int(GAME_CONFIG, "MAX_TURNS", 250)
    max_players = get_positive_int(GAME_CONFIG, "MAX_PLAYERS", 3)
    base_seed = get_positive_int(GAME_CONFIG, "BASE_RANDOM_SEED", 2026)
    metrics = _create_metrics()
    no_winner_games = 0
    game_runtime_seconds = 0.0

    logger.info("=" * 68)
    logger.info(" Murder in KUET - Minimax vs Expectiminimax vs Negamax Metrics")
    logger.info("=" * 68)

    for i in range(num_games):
        logger.info("=== Game %s ===", i + 1)

        result = run_single_game(
            seed=base_seed + i,
            max_turns=max_turns,
            max_players=max_players,
            verbose=(i == 0),
        )
        game_runtime_seconds += float(result.get("runtime", 0.0))

        winner_name = result.get("winner")
        winner_player = result.get("winner_player")

        if not winner_name:
            no_winner_games += 1
            logger.warning("Winner: None (turn cap reached)")
        else:
            logger.info("Winner: %s (%s)", winner_player, winner_name)

        per_game_metrics = result.get("metrics", {})
        if isinstance(per_game_metrics, dict):
            for ai_name, ai_data in per_game_metrics.items():
                if ai_name not in metrics or not isinstance(ai_data, dict):
                    continue
                metrics[ai_name]["wins"] += float(ai_data.get("wins", 0))
                metrics[ai_name]["total_moves"] += float(ai_data.get("total_moves", 0))
                metrics[ai_name]["decision_time"] += float(ai_data.get("decision_time", 0.0))
                metrics[ai_name]["decisions"] += float(ai_data.get("decisions", 0))
                metrics[ai_name]["correct_accusations"] += float(ai_data.get("correct_accusations", 0))
                metrics[ai_name]["wrong_accusations"] += float(ai_data.get("wrong_accusations", 0))
                metrics[ai_name]["total_turns"] += float(ai_data.get("total_turns", 0))
                metrics[ai_name]["suggestion_success"] += float(ai_data.get("suggestion_success", 0))
                metrics[ai_name]["suggestion_total"] += float(ai_data.get("suggestion_total", 0))

    logger.info("=" * 68)
    logger.info("Final Performance Summary")
    logger.info("=" * 68)

    for ai_name, data in metrics.items():
        avg_moves = data["total_moves"] / num_games
        avg_time = data["decision_time"] / max(data["decisions"], 1)
        win_rate = (data["wins"] / num_games) * 100.0
        accusation_total = data["correct_accusations"] + data["wrong_accusations"]
        accusation_accuracy = (data["correct_accusations"] / max(accusation_total, 1)) * 100.0
        avg_turns_to_win = data["total_turns"] / max(data["wins"], 1)
        suggestion_efficiency = data["suggestion_success"] / max(data["suggestion_total"], 1)

        logger.info("%s:", ai_name)
        logger.info("Wins: %s", int(data["wins"]))
        logger.info("Win Rate: %.1f%%", win_rate)
        logger.info("Average Moves: %.2f", avg_moves)
        logger.info("Average Decision Time: %.5f sec", avg_time)
        logger.info("Correct Accusations: %s", int(data["correct_accusations"]))
        logger.info("Wrong Accusations: %s", int(data["wrong_accusations"]))
        logger.info("Accusation Accuracy: %.1f%%", accusation_accuracy)
        logger.info("Average Turns To Win: %.2f", avg_turns_to_win)
        logger.info("Suggestion Efficiency: %.3f", suggestion_efficiency)

    logger.info("No-Winner Games: %s", no_winner_games)
    logger.info("Average Game Runtime: %.4f sec", game_runtime_seconds / num_games)
    logger.info("=" * 68)


def main() -> None:
    setup_logger()
    _run_ai_performance_comparison()


if __name__ == "__main__":
    main()

