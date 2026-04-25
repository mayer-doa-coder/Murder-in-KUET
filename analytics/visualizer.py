"""Visualization module for simulation analytics."""

from __future__ import annotations

import csv
import json
import logging
from pathlib import Path
from typing import Any

import matplotlib
import matplotlib.pyplot as plt
import pandas as pd


def _is_interactive_backend() -> bool:
    """Return True when matplotlib is running with an interactive (display) backend."""
    return matplotlib.get_backend().lower() not in ("agg", "pdf", "svg", "ps", "cairo")


class Visualizer:
    """Prepare simulation metrics for visualization and expose plotting hooks."""

    def __init__(self, metrics: dict[str, dict[str, Any]]) -> None:
        """Initialize Visualizer with aggregated simulation metrics.

        Args:
            metrics: Aggregated metrics keyed by AI strategy name.

        Raises:
            ValueError: If metrics are not a non-empty dictionary in the expected shape.
        """
        if not isinstance(metrics, dict):
            raise ValueError("metrics must be a dictionary")
        if not metrics:
            raise ValueError("metrics cannot be empty")

        self.metrics = metrics
        self._validate_metrics_structure()
        logging.info("Visualizer initialized")

    def _ensure_logs_dir(self) -> Path:
        """Ensure logs directory exists and return its path."""
        logs_dir = Path("logs")
        logs_dir.mkdir(parents=True, exist_ok=True)
        return logs_dir

    def _build_metrics_table(self) -> pd.DataFrame:
        """Build comparative metrics table for dashboards and exports."""
        rows: list[dict[str, Any]] = []

        for ai_name, data in self.metrics.items():
            wins = float(data.get("wins", 0) or 0)
            total_moves = float(data.get("total_moves", data.get("moves", 0)) or 0)
            decision_time = float(data.get("decision_time", 0) or 0)
            decisions = float(data.get("decisions", 0) or 0)
            games_played = float(data.get("games_played", 0) or 0)

            rows.append(
                {
                    "AI": ai_name,
                    "wins": int(wins),
                    "games_played": int(games_played),
                    "total_moves": total_moves,
                    "decision_time": decision_time,
                    "decisions": int(decisions),
                    "avg_moves": total_moves / max(wins, 1.0),
                    "avg_decision_time": decision_time / max(decisions, 1.0),
                    "win_rate_pct": (wins / max(games_played, 1.0)) * 100.0,
                }
            )

        return pd.DataFrame(rows)

    def get_ranking(self) -> list[str]:
        """Return AI names ranked by total wins (descending)."""
        return sorted(
            self.metrics,
            key=lambda ai: float(self.metrics[ai].get("wins", 0) or 0),
            reverse=True,
        )

    def _validate_metrics_structure(self) -> None:
        """Validate top-level metrics structure expected by analytics workflows."""
        for ai_name, ai_metrics in self.metrics.items():
            if not isinstance(ai_name, str) or not ai_name.strip():
                raise ValueError("metrics keys must be non-empty AI name strings")
            if not isinstance(ai_metrics, dict):
                raise ValueError("each AI metrics entry must be a dictionary")

    def prepare_win_rate_data(self) -> dict[str, float]:
        """Prepare win-rate percentage values per AI for future plotting.

        Uses pre-computed win_rate if present; otherwise computes
        wins / games_played * 100.

        Returns:
            dict[str, float]: Mapping of AI name to win-rate percentage.
        """
        prepared: dict[str, float] = {}

        for ai_name, ai_metrics in self.metrics.items():
            if "win_rate" in ai_metrics:
                prepared[ai_name] = float(ai_metrics["win_rate"])
                continue

            wins = float(ai_metrics.get("wins", 0.0) or 0.0)
            games_played = float(ai_metrics.get("games_played", 0.0) or 0.0)
            prepared[ai_name] = (
                (wins / games_played * 100.0) if games_played > 0 else 0.0
            )

        return prepared

    def plot_win_rate(self) -> None:
        """Plot a bar chart comparing win rates of all AI agents.

        Win rate = wins / games_played * 100.  Falls back to wins / total_wins
        when games_played is unavailable (older metric snapshots).
        """
        if not self.metrics:
            raise ValueError("Metrics data is empty")

        names: list[str] = []
        win_rates: list[float] = []

        total_games = sum(
            float(data.get("games_played", 0) or 0) for data in self.metrics.values()
        )
        # Fallback: use total wins as denominator when games_played is absent
        if total_games == 0:
            total_games = sum(
                float(data.get("wins", 0) or 0) for data in self.metrics.values()
            )
        if total_games == 0:
            raise ValueError("No games recorded. Cannot compute win rate.")

        for ai_name, data in self.metrics.items():
            wins = float(data.get("wins", 0) or 0)
            gp = float(data.get("games_played", 0) or 0)
            # Per-agent win rate: use games_played when available
            rate = (wins / gp * 100.0) if gp > 0 else (wins / total_games * 100.0)
            names.append(ai_name)
            win_rates.append(rate)

        plt.figure(figsize=(9, 5))
        plt.bar(names, win_rates, color="#3a7ca5")
        plt.title("Win Rate Comparison")
        plt.xlabel("AI Agents")
        plt.ylabel("Win Rate (%)")
        plt.xticks(rotation=15)
        plt.tight_layout()
        plt.savefig(self._ensure_logs_dir() / "win_rate.png", dpi=150)
        if _is_interactive_backend():
            plt.show()
        plt.close()

    def plot_decision_time(self) -> None:
        """Plot a bar chart comparing average decision time of all AI agents."""
        if not self.metrics:
            raise ValueError("Metrics data is empty")

        names: list[str] = []
        times: list[float] = []

        for ai_name, data in self.metrics.items():
            total_time = float(data.get("decision_time", 0) or 0)
            decisions = float(data.get("decisions", 0) or 0)
            avg_time = total_time / max(decisions, 1.0)

            names.append(ai_name)
            times.append(avg_time)

        plt.figure(figsize=(9, 5))
        plt.bar(names, times, color="#2a9d8f")
        plt.title("Decision Time Comparison")
        plt.xlabel("AI Agents")
        plt.ylabel("Average Decision Time (seconds)")
        plt.xticks(rotation=15)
        plt.tight_layout()
        plt.savefig(self._ensure_logs_dir() / "decision_time.png", dpi=150)
        if _is_interactive_backend():
            plt.show()
        plt.close()

    def plot_moves(self) -> None:
        """Plot a bar chart comparing average moves required to win for each AI agent."""
        if not self.metrics:
            raise ValueError("Metrics data is empty")

        names: list[str] = []
        moves: list[float] = []

        for ai_name, data in self.metrics.items():
            total_moves = float(data.get("total_moves", data.get("moves", 0)) or 0)
            wins = float(data.get("wins", 0) or 0)
            avg_moves = total_moves / max(wins, 1.0)

            names.append(ai_name)
            moves.append(avg_moves)

        plt.figure(figsize=(9, 5))
        plt.bar(names, moves, color="#e76f51")
        plt.title("Average Moves to Win")
        plt.xlabel("AI Agents")
        plt.ylabel("Moves (Lower is Better)")
        plt.xticks(rotation=15)
        plt.tight_layout()
        plt.savefig(self._ensure_logs_dir() / "moves.png", dpi=150)
        if _is_interactive_backend():
            plt.show()
        plt.close()

    def generate_insights(self) -> dict[str, str]:
        """Analyze metrics and print key insights about AI performance."""
        if not self.metrics:
            raise ValueError("Metrics data is empty")

        best_ai = max(
            self.metrics,
            key=lambda ai: float(self.metrics[ai].get("wins", 0) or 0),
        )

        fastest_ai = min(
            self.metrics,
            key=lambda ai: (
                float(self.metrics[ai].get("decision_time", 0) or 0)
                / max(float(self.metrics[ai].get("decisions", 0) or 0), 1.0)
            ),
        )

        most_efficient_ai = min(
            self.metrics,
            key=lambda ai: (
                float(
                    self.metrics[ai].get(
                        "total_moves", self.metrics[ai].get("moves", 0)
                    )
                    or 0
                )
                / max(float(self.metrics[ai].get("wins", 0) or 0), 1.0)
            ),
        )

        best_accuracy_ai = max(
            self.metrics,
            key=lambda ai: (
                float(self.metrics[ai].get("correct_accusations", 0) or 0)
                / max(
                    float(self.metrics[ai].get("correct_accusations", 0) or 0)
                    + float(self.metrics[ai].get("wrong_accusations", 0) or 0),
                    1.0,
                )
            ),
        )

        insights = {
            "best_ai": best_ai,
            "fastest_ai": fastest_ai,
            "most_efficient_ai": most_efficient_ai,
            "best_accuracy_ai": best_accuracy_ai,
        }

        logging.info("===== AI INSIGHTS =====")
        logging.info("Best AI (Win Rate): %s", best_ai)
        logging.info("Fastest AI: %s", fastest_ai)
        logging.info("Most Efficient AI (Fewest Moves): %s", most_efficient_ai)
        logging.info("Most Accurate AI: %s", best_accuracy_ai)

        return insights

    def show_dashboard(self) -> None:
        """Display AI performance metrics in a clean log format."""
        if not self.metrics:
            raise ValueError("Metrics data is empty")

        logging.info("===== AI PERFORMANCE DASHBOARD =====")

        for ai_name, data in self.metrics.items():
            wins = float(data.get("wins", 0) or 0)
            games_played = float(data.get("games_played", 0) or 0)
            total_moves = float(data.get("total_moves", data.get("moves", 0)) or 0)
            total_time = float(data.get("decision_time", 0) or 0)
            decisions = float(data.get("decisions", 0) or 0)

            win_rate = (wins / games_played * 100.0) if games_played > 0 else 0.0
            avg_moves = total_moves / max(wins, 1.0)
            avg_time = total_time / max(decisions, 1.0)

            logging.info(
                "%s | Wins: %d | Win Rate: %.1f%% | Avg Moves: %.2f | Avg Decision Time: %.5fs",
                ai_name,
                int(wins),
                win_rate,
                avg_moves,
                avg_time,
            )

        sorted_ai = self.get_ranking()

        logging.info("--- Ranking ---")
        for index, ai_name in enumerate(sorted_ai, 1):
            logging.info("%d. %s", index, ai_name)

        logging.info("----------------------------------")

    def show_table(self) -> pd.DataFrame:
        """Display comparative metrics table and return dataframe."""
        if not self.metrics:
            raise ValueError("Metrics data is empty")

        table = self._build_metrics_table()
        if table.empty:
            logging.info("Metrics Table: No metrics available")
        else:
            logging.info("=== Metrics Table ===\n%s", table.to_string(index=False))

        return table

    def export_csv(self, file_path: str = "logs/metrics.csv") -> Path:
        """Export key metrics into a CSV file — unified schema with SimulationRunner."""
        if not self.metrics:
            raise ValueError("Metrics data is empty")

        target = Path(file_path)
        target.parent.mkdir(parents=True, exist_ok=True)

        with target.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(
                [
                    "AI",
                    "Wins",
                    "Games Played",
                    "Total Moves",
                    "Decision Time",
                    "Decisions",
                    "Avg Moves",
                    "Avg Decision Time",
                    "Win Rate %",
                ]
            )

            for ai_name, data in self.metrics.items():
                wins = float(data.get("wins", 0) or 0)
                games_played = float(data.get("games_played", 0) or 0)
                total_moves = float(data.get("total_moves", data.get("moves", 0)) or 0)
                decision_time = float(data.get("decision_time", 0) or 0)
                decisions = float(data.get("decisions", 0) or 0)
                win_rate = (wins / games_played * 100.0) if games_played > 0 else 0.0

                writer.writerow(
                    [
                        ai_name,
                        int(wins),
                        int(games_played),
                        round(total_moves, 0),
                        round(decision_time, 6),
                        int(decisions),
                        round(total_moves / max(wins, 1.0), 2),
                        round(decision_time / max(decisions, 1.0), 6),
                        round(win_rate, 2),
                    ]
                )

        return target

    def export_json(self, file_path: str = "logs/metrics.json") -> Path:
        """Export raw metrics into a JSON file and return target path."""
        if not self.metrics:
            raise ValueError("Metrics data is empty")

        target = Path(file_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("w", encoding="utf-8") as handle:
            json.dump(self.metrics, handle, indent=4)

        return target
