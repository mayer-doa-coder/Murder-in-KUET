"""Visualization module for simulation analytics."""

from __future__ import annotations

import logging
from typing import Any

import matplotlib.pyplot as plt


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

    def _validate_metrics_structure(self) -> None:
        """Validate top-level metrics structure expected by analytics workflows."""
        for ai_name, ai_metrics in self.metrics.items():
            if not isinstance(ai_name, str) or not ai_name.strip():
                raise ValueError("metrics keys must be non-empty AI name strings")
            if not isinstance(ai_metrics, dict):
                raise ValueError("each AI metrics entry must be a dictionary")

    def prepare_win_rate_data(self) -> dict[str, float]:
        """Prepare normalized win-rate values per AI for future plotting.

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
            prepared[ai_name] = (wins / games_played * 100.0) if games_played > 0 else 0.0

        return prepared

    def plot_win_rate(self) -> None:
        """Plot a bar chart comparing win rates of all AI agents."""
        if not self.metrics:
            raise ValueError("Metrics data is empty")

        names: list[str] = []
        win_rates: list[float] = []

        total_games = sum(float(data.get("wins", 0) or 0) for data in self.metrics.values())
        if total_games == 0:
            raise ValueError("No games recorded. Cannot compute win rate.")

        for ai_name, data in self.metrics.items():
            wins = float(data.get("wins", 0) or 0)
            names.append(ai_name)
            win_rates.append(wins / total_games)

        plt.figure(figsize=(9, 5))
        plt.bar(names, win_rates, color="#3a7ca5")
        plt.title("Win Rate Comparison")
        plt.xlabel("AI Agents")
        plt.ylabel("Win Rate")
        plt.xticks(rotation=15)
        plt.tight_layout()
        plt.show()

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
        plt.show()

    def plot_moves(self) -> None:
        """Plot a bar chart comparing average moves required to win for each AI agent."""
        if not self.metrics:
            raise ValueError("Metrics data is empty")

        names: list[str] = []
        moves: list[float] = []

        for ai_name, data in self.metrics.items():
            total_moves = float(data.get("moves", data.get("total_moves", 0)) or 0)
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
        plt.show()

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
                float(self.metrics[ai].get("moves", self.metrics[ai].get("total_moves", 0)) or 0)
                / max(float(self.metrics[ai].get("wins", 0) or 0), 1.0)
            ),
        )

        best_accuracy_ai = max(
            self.metrics,
            key=lambda ai: float(self.metrics[ai].get("correct_accusations", 0) or 0),
        )

        insights = {
            "best_ai": best_ai,
            "fastest_ai": fastest_ai,
            "most_efficient_ai": most_efficient_ai,
            "best_accuracy_ai": best_accuracy_ai,
        }

        print("\n===== AI INSIGHTS =====")
        print(f"Best AI (Win Rate): {best_ai}")
        print(f"Fastest AI: {fastest_ai}")
        print(f"Most Efficient AI (Fewest Moves): {most_efficient_ai}")
        print(f"Most Accurate AI: {best_accuracy_ai}")

        return insights
