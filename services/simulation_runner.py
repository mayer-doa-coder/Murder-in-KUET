"""Simulation runner service for multi-game benchmarking."""

import logging
from collections import defaultdict
from typing import Any, Dict

from main import run_single_game


class SimulationRunner:
    """Run repeated automated games and aggregate AI performance metrics."""

    def __init__(self, config: dict[str, Any]):
        self.config = config

    def run(self, num_games: int) -> Dict[str, Any]:
        """Run multiple game simulations and collect metrics.

        Args:
            num_games: Number of games to execute.

        Returns:
            Dict[str, Any]: Structured simulation outputs and aggregated metrics.

        Raises:
            ValueError: If num_games is not greater than 0.
        """
        if num_games <= 0:
            raise ValueError("num_games must be greater than 0")

        results: list[dict[str, Any]] = []
        metrics: defaultdict[str, dict[str, float]] = defaultdict(
            lambda: {
                "wins": 0,
                "total_moves": 0,
                "decision_time": 0.0,
                "decisions": 0,
            }
        )

        base_seed = int(self.config.get("BASE_RANDOM_SEED", 2026))
        max_turns = int(self.config.get("MAX_TURNS", 250))
        max_players = int(self.config.get("MAX_PLAYERS", 3))

        no_winner_games = 0

        for i in range(num_games):
            logging.info("Starting simulation game %s", i + 1)

            result = run_single_game(
                seed=base_seed + i,
                max_turns=max_turns,
                max_players=max_players,
                verbose=(i == 0),
            )
            results.append(result)

            winner = result.get("winner")
            moves = int(result.get("moves", 0) or 0)

            if not winner:
                no_winner_games += 1
                logging.info("Game %s finished. Winner: None", i + 1)
                continue

            metrics[winner]["wins"] += 1
            metrics[winner]["total_moves"] += moves

            if "decision_time" in result and result.get("decision_time") is not None:
                metrics[winner]["decision_time"] += float(result.get("decision_time", 0.0) or 0.0)
                metrics[winner]["decisions"] += int(result.get("decisions", 1) or 1)

            logging.info("Game %s finished. Winner: %s", i + 1, winner)

        return {
            "results": results,
            "metrics": dict(metrics),
            "num_games": num_games,
            "no_winner_games": no_winner_games,
        }
