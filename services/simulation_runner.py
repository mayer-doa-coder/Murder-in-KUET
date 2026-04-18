"""Simulation runner service for multi-game benchmarking."""

import csv
import json
import logging
import random
from multiprocessing import Pool
from pathlib import Path
from typing import Any, Dict, List

from analytics.visualizer import Visualizer
from main import run_single_game


def _run_single_game_from_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Run a single game from a payload dictionary.

    This helper is top-level to remain picklable for multiprocessing.
    """
    return run_single_game(
        seed=payload.get("seed"),
        max_turns=payload.get("max_turns"),
        max_players=payload.get("max_players"),
        verbose=bool(payload.get("verbose", False)),
    )


class SimulationRunner:
    """Run repeated automated games and aggregate performance metrics."""

    def __init__(self, config: dict[str, Any]):
        self.config = config
        self.seed = self.config.get("SEED", None)
        if self.seed is not None:
            random.seed(int(self.seed))

    def _build_game_payloads(self, num_games: int) -> List[Dict[str, Any]]:
        """Create deterministic per-game payloads for sequential/parallel runs."""
        base_seed = int(self.config.get("BASE_RANDOM_SEED", 2026))
        if self.seed is not None:
            base_seed = int(self.seed)

        max_turns = int(self.config.get("MAX_TURNS", 250))
        max_players = int(self.config.get("MAX_PLAYERS", 3))

        return [
            {
                "seed": base_seed + i,
                "max_turns": max_turns,
                "max_players": max_players,
                "verbose": (i == 0),
            }
            for i in range(num_games)
        ]

    def _aggregate_results(self, results: List[Dict[str, Any]], num_games: int) -> Dict[str, Any]:
        """Aggregate per-game outputs into AI-level metrics and summary."""
        metrics = self._create_metrics()

        for result in results:
            winner = result.get("winner")
            moves = int(result.get("moves", 0) or 0)
            logging.info("Winner: %s, Moves: %s", winner, moves)

            per_game_metrics = result.get("metrics", {})
            if isinstance(per_game_metrics, dict) and per_game_metrics:
                for ai_name, data in per_game_metrics.items():
                    if ai_name not in metrics or not isinstance(data, dict):
                        continue
                    metrics[ai_name]["wins"] += float(data.get("wins", 0) or 0)
                    metrics[ai_name]["moves"] += float(data.get("total_moves", data.get("moves", 0)) or 0)
                    metrics[ai_name]["decision_time"] += float(data.get("decision_time", 0.0) or 0.0)
                    metrics[ai_name]["decisions"] += float(data.get("decisions", 0) or 0)
                    metrics[ai_name]["correct_accusations"] += float(data.get("correct_accusations", 0) or 0)
                    metrics[ai_name]["wrong_accusations"] += float(data.get("wrong_accusations", 0) or 0)
                    metrics[ai_name]["total_turns"] += float(data.get("total_turns", 0) or 0)
                    metrics[ai_name]["suggestion_success"] += float(data.get("suggestion_success", 0) or 0)
                    metrics[ai_name]["suggestion_total"] += float(data.get("suggestion_total", 0) or 0)
            else:
                # Fallback if per-AI breakdown is absent.
                if winner in metrics:
                    metrics[winner]["wins"] += 1
                    metrics[winner]["moves"] += moves
                    metrics[winner]["decision_time"] += float(result.get("decision_time", 0.0) or 0.0)
                    metrics[winner]["decisions"] += float(result.get("decisions", 0) or 0)
                    metrics[winner]["total_turns"] += float(result.get("turns", 0) or 0)
                    metrics[winner]["correct_accusations"] += float(result.get("correct_accusations", 0) or 0)
                    metrics[winner]["wrong_accusations"] += float(result.get("wrong_accusations", 0) or 0)
                    metrics[winner]["suggestion_success"] += float(result.get("suggestion_success", 0) or 0)
                    metrics[winner]["suggestion_total"] += float(result.get("suggestion_total", 0) or 0)

        summary: Dict[str, Dict[str, float]] = {}
        completed_games = len(results)
        for ai_name, data in metrics.items():
            wins = float(data["wins"])
            moves = float(data["moves"])
            total_time = float(data["decision_time"])
            decisions = float(data["decisions"])
            correct_accusations = float(data["correct_accusations"])
            wrong_accusations = float(data["wrong_accusations"])
            total_turns = float(data["total_turns"])
            suggestion_success = float(data["suggestion_success"])
            suggestion_total = float(data["suggestion_total"])
            accusation_total = correct_accusations + wrong_accusations

            summary[ai_name] = {
                "win_rate": (wins / max(completed_games, 1)) * 100.0,
                "move_efficiency": moves / max(wins, 1.0),
                "avg_decision_time": total_time / max(decisions, 1.0),
                "avg_turns_to_win": total_turns / max(wins, 1.0),
                "accusation_accuracy": (correct_accusations / max(accusation_total, 1.0)) * 100.0,
                "suggestion_efficiency": suggestion_success / max(suggestion_total, 1.0),
            }

        return {
            "results": results,
            "metrics": metrics,
            "summary": summary,
            "completed_games": completed_games,
            "failed_games": num_games - completed_games,
        }

    def _create_metrics(self) -> Dict[str, Dict[str, float]]:
        """Create metrics structure for all supported AI variants."""
        return {
            "MinimaxAI": {
                "wins": 0,
                "moves": 0,
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
                "moves": 0,
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
                "moves": 0,
                "decision_time": 0.0,
                "decisions": 0,
                "correct_accusations": 0,
                "wrong_accusations": 0,
                "total_turns": 0,
                "suggestion_success": 0,
                "suggestion_total": 0,
            },
        }

    def _extract_metrics(self, metrics_or_result: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
        """Return AI metrics dict from either raw metrics or full run output."""
        nested = metrics_or_result.get("metrics") if isinstance(metrics_or_result, dict) else None
        if isinstance(nested, dict):
            return nested
        if isinstance(metrics_or_result, dict):
            return metrics_or_result
        raise TypeError("metrics_or_result must be a dictionary")

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
        payloads = self._build_game_payloads(num_games)

        for i, payload in enumerate(payloads):
            logging.info("Running game %s", i + 1)

            try:
                result = _run_single_game_from_payload(payload)
            except Exception as exc:
                logging.error("Game %s failed: %s", i + 1, exc)
                continue

            results.append(result)
        return self._aggregate_results(results, num_games)

    def run_parallel(self, num_games: int) -> Dict[str, Any]:
        """Run simulations in parallel and return aggregated metrics."""
        if num_games <= 0:
            raise ValueError("num_games must be greater than 0")

        payloads = self._build_game_payloads(num_games)
        with Pool() as pool:
            results = pool.map(_run_single_game_from_payload, payloads)

        return self._aggregate_results(results, num_games)

    def generate_report(self, metrics: Dict[str, Any], num_games: int) -> None:
        """Generate and print final aggregated performance report."""
        if num_games <= 0:
            raise ValueError("num_games must be greater than 0")

        metric_rows = self._extract_metrics(metrics)

        for ai_name, data in metric_rows.items():
            wins = float(data.get("wins", 0))
            moves = float(data.get("moves", 0))
            total_time = float(data.get("decision_time", 0.0))
            decisions = float(data.get("decisions", 0))
            total_turns = float(data.get("total_turns", 0))
            correct_acc = float(data.get("correct_accusations", 0))
            wrong_acc = float(data.get("wrong_accusations", 0))
            suggestion_success = float(data.get("suggestion_success", 0))
            suggestion_total = float(data.get("suggestion_total", 0))

            win_rate = wins / num_games
            avg_moves = moves / max(wins, 1.0)
            avg_time = total_time / max(decisions, 1.0)
            avg_turns = total_turns / max(wins, 1.0)
            accusation_accuracy = correct_acc / max(correct_acc + wrong_acc, 1.0)
            suggestion_efficiency = suggestion_success / max(suggestion_total, 1.0)

            print(f"\n{ai_name}:")
            print(f"Win Rate: {win_rate:.2f}")
            print(f"Avg Moves: {avg_moves:.2f}")
            print(f"Avg Decision Time: {avg_time:.5f}s")
            print(f"Avg Turns To Win: {avg_turns:.2f}")
            print(f"Accusation Accuracy: {accusation_accuracy:.2f}")
            print(f"Suggestion Efficiency: {suggestion_efficiency:.2f}")

    def save_to_json(self, metrics: Dict[str, Any], file_path: str = "logs/simulation.json") -> None:
        """Save aggregated metrics to JSON."""
        target = Path(file_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("w", encoding="utf-8") as handle:
            json.dump(metrics, handle, indent=4)

    def save_to_csv(self, metrics: Dict[str, Any], file_path: str = "logs/simulation.csv") -> None:
        """Save aggregated metrics to CSV for graphing/reporting."""
        target = Path(file_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        metric_rows = self._extract_metrics(metrics)

        with target.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(
                [
                    "AI",
                    "Wins",
                    "Avg Moves",
                    "Avg Time",
                    "Avg Turns To Win",
                    "Accusation Accuracy",
                    "Suggestion Efficiency",
                ]
            )

            for ai_name, data in metric_rows.items():
                wins = float(data.get("wins", 0))
                avg_moves = float(data.get("moves", 0)) / max(wins, 1.0)
                avg_time = float(data.get("decision_time", 0.0)) / max(float(data.get("decisions", 0)), 1.0)
                avg_turns = float(data.get("total_turns", 0)) / max(wins, 1.0)
                correct_acc = float(data.get("correct_accusations", 0))
                wrong_acc = float(data.get("wrong_accusations", 0))
                accusation_accuracy = correct_acc / max(correct_acc + wrong_acc, 1.0)
                suggestion_success = float(data.get("suggestion_success", 0))
                suggestion_total = float(data.get("suggestion_total", 0))
                suggestion_efficiency = suggestion_success / max(suggestion_total, 1.0)

                writer.writerow(
                    [
                        ai_name,
                        int(wins),
                        round(avg_moves, 2),
                        round(avg_time, 5),
                        round(avg_turns, 2),
                        round(accusation_accuracy, 4),
                        round(suggestion_efficiency, 4),
                    ]
                )

    def run_visual_dashboard(self, metrics_or_result: Dict[str, Any]) -> Dict[str, str]:
        """Render CLI dashboard, visualization charts, and insight summary for AI metrics."""
        metric_rows = self._extract_metrics(metrics_or_result)
        visualizer = Visualizer(metric_rows)

        visualizer.show_dashboard()
        visualizer.plot_win_rate()
        visualizer.plot_decision_time()
        visualizer.plot_moves()
        return visualizer.generate_insights()
