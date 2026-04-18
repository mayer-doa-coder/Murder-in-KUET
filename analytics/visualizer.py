"""Visualization module for simulation analytics."""

from __future__ import annotations

import logging
from typing import Any


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
        """Placeholder for win-rate visualization.

        Plotting implementation is intentionally deferred to future iterations.
        """
        pass
