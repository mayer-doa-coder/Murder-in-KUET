"""Main entry point for AI performance comparison simulations."""

import json
import logging
from pathlib import Path
from typing import Any

from config.settings import GAME_CONFIG, get_positive_int
from services.game_runner import (
    InstrumentedAI,  # noqa: F401 — re-exported for backward compatibility
    _blank_metrics,
    _create_comparison_players,
    _create_metrics,
    run_single_game,
)
from utils.logger import setup_logger

logger = logging.getLogger(__name__)


def _save_metrics_json(
    metrics: dict[str, Any], path: str = "logs/metrics.json"
) -> None:
    """Persist aggregated AI metrics to JSON so the dashboard can load them."""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=4)
    logger.info("Metrics saved to %s", target)


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
    logger.info(
        " Murder in KUET - Minimax vs Expectiminimax vs Negamax vs MonteCarlo vs MCTS Metrics"
    )
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
                metrics[ai_name]["games_played"] += float(
                    ai_data.get("games_played", 1)
                )
                metrics[ai_name]["total_moves"] += float(ai_data.get("total_moves", 0))
                metrics[ai_name]["decision_time"] += float(
                    ai_data.get("decision_time", 0.0)
                )
                metrics[ai_name]["decisions"] += float(ai_data.get("decisions", 0))
                metrics[ai_name]["correct_accusations"] += float(
                    ai_data.get("correct_accusations", 0)
                )
                metrics[ai_name]["wrong_accusations"] += float(
                    ai_data.get("wrong_accusations", 0)
                )
                metrics[ai_name]["total_turns"] += float(ai_data.get("total_turns", 0))
                metrics[ai_name]["suggestion_success"] += float(
                    ai_data.get("suggestion_success", 0)
                )
                metrics[ai_name]["suggestion_total"] += float(
                    ai_data.get("suggestion_total", 0)
                )

    logger.info("=" * 68)
    logger.info("Final Performance Summary")
    logger.info("=" * 68)

    for ai_name, data in metrics.items():
        avg_moves = data["total_moves"] / num_games
        avg_time = data["decision_time"] / max(data["decisions"], 1)
        win_rate = (data["wins"] / num_games) * 100.0
        accusation_total = data["correct_accusations"] + data["wrong_accusations"]
        accusation_accuracy = (
            data["correct_accusations"] / max(accusation_total, 1)
        ) * 100.0
        avg_turns_to_win = data["total_turns"] / max(data["wins"], 1)
        suggestion_efficiency = data["suggestion_success"] / max(
            data["suggestion_total"], 1
        )

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

    _save_metrics_json(metrics)


def main() -> None:
    setup_logger()
    _run_ai_performance_comparison()


if __name__ == "__main__":
    main()
