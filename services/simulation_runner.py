"""Simulation runner service for multi-game benchmarking."""

import logging
from typing import Any, Dict, List

from main import run_single_game


class SimulationRunner:
    """Run repeated automated games and aggregate performance metrics."""

    def __init__(self, config: dict[str, Any]):
        self.config = config

    def _create_metrics(self) -> Dict[str, Dict[str, float]]:
        """Create metrics structure for all supported AI variants."""
        return {
            "MinimaxAI": {
                "wins": 0,
                "moves": 0,
                "decision_time": 0.0,
                "decisions": 0,
            },
            "ExpectiminimaxAI": {
                "wins": 0,
                "moves": 0,
                "decision_time": 0.0,
                "decisions": 0,
            },
            "NegamaxAI": {
                "wins": 0,
                "moves": 0,
                "decision_time": 0.0,
                "decisions": 0,
            },
        }

    def run(self, num_games: int) -> Dict[str, Any]:
        """Run multiple game simulations and collect aggregated metrics.

        Args:
            num_games: Number of games to execute.

        Returns:
            Dict[str, Any]: Per-game results and aggregated AI metrics.

        Raises:
            ValueError: If num_games is not greater than 0.
        """
        if num_games <= 0:
            raise ValueError("num_games must be greater than 0")

        results: List[Dict[str, Any]] = []
        metrics = self._create_metrics()

        base_seed = int(self.config.get("BASE_RANDOM_SEED", 2026))
        max_turns = int(self.config.get("MAX_TURNS", 250))
        max_players = int(self.config.get("MAX_PLAYERS", 3))

        for i in range(num_games):
            logging.info("Running game %s", i + 1)

            try:
                result = run_single_game(
                    seed=base_seed + i,
                    max_turns=max_turns,
                    max_players=max_players,
                    verbose=(i == 0),
                )
            except Exception as exc:
                logging.error("Game %s failed: %s", i + 1, exc)
                continue

            results.append(result)
            winner = result.get("winner")
            moves = int(result.get("moves", 0) or 0)
            logging.info("Winner: %s, Moves: %s", winner, moves)

            per_game_metrics = result.get("metrics", {})
            if isinstance(per_game_metrics, dict) and per_game_metrics:
                for ai_name, data in per_game_metrics.items():
                    if ai_name not in metrics or not isinstance(data, dict):
                        continue
                    metrics[ai_name]["moves"] += float(data.get("total_moves", data.get("moves", 0)) or 0)
                    metrics[ai_name]["decision_time"] += float(data.get("decision_time", 0.0) or 0.0)
                    metrics[ai_name]["decisions"] += float(data.get("decisions", 0) or 0)
            else:
                # Fallback if per-AI breakdown is absent.
                if winner in metrics:
                    metrics[winner]["moves"] += moves
                    metrics[winner]["decision_time"] += float(result.get("decision_time", 0.0) or 0.0)
                    metrics[winner]["decisions"] += float(result.get("decisions", 0) or 0)

            if not winner:
                continue

            if winner in metrics:
                metrics[winner]["wins"] += 1

        summary: Dict[str, Dict[str, float]] = {}
        completed_games = len(results)
        for ai_name, data in metrics.items():
            wins = float(data["wins"])
            moves = float(data["moves"])
            total_time = float(data["decision_time"])
            decisions = float(data["decisions"])

            summary[ai_name] = {
                "win_rate": (wins / max(completed_games, 1)) * 100.0,
                "move_efficiency": moves / max(wins, 1.0),
                "avg_decision_time": total_time / max(decisions, 1.0),
            }

        return {
            "results": results,
            "metrics": metrics,
            "summary": summary,
            "completed_games": completed_games,
            "failed_games": num_games - completed_games,
        }
