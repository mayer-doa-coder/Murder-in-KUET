"""Streamlit dashboard for AI performance analytics."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd
import streamlit as st


def _build_table(metrics: dict[str, dict[str, Any]]) -> pd.DataFrame:
    """Build comparative metrics table from raw AI metrics."""
    rows: list[dict[str, Any]] = []

    for ai_name, data in metrics.items():
        wins = float(data.get("wins", 0) or 0)
        total_moves = float(data.get("total_moves", data.get("moves", 0)) or 0)
        games_played = float(data.get("games_played", 0) or 0)
        decision_time = float(data.get("decision_time", 0) or 0)
        decisions = float(data.get("decisions", 0) or 0)

        rows.append(
            {
                "AI": ai_name,
                "Wins": int(wins),
                "Games Played": int(games_played),
                "Total Moves": total_moves,
                "Decision Time (s)": decision_time,
                "Decisions": int(decisions),
                "Avg Moves": total_moves / max(wins, 1.0),
                "Avg Decision Time (s)": decision_time / max(decisions, 1.0),
                "Win Rate (%)": (wins / max(games_played, 1.0)) * 100.0,
            }
        )

    return pd.DataFrame(rows)


def _load_metrics() -> dict[str, dict[str, Any]]:
    """Load metrics from session state or fallback to logs/metrics.json."""
    from_session = st.session_state.get("metrics", {})
    if isinstance(from_session, dict) and from_session:
        return from_session

    metrics_path = Path("logs/metrics.json")
    if metrics_path.exists():
        try:
            with metrics_path.open("r", encoding="utf-8") as handle:
                loaded = json.load(handle)
                if isinstance(loaded, dict):
                    return loaded
        except (json.JSONDecodeError, OSError):
            st.error("Failed to parse logs/metrics.json. The file may be corrupt.")

    return {}


def main() -> None:
    """Render streamlit dashboard UI."""
    st.set_page_config(page_title="AI Performance Dashboard", layout="wide")
    st.title("AI Performance Dashboard")

    metrics = _load_metrics()
    if not metrics:
        st.warning(
            "No metrics found. Populate st.session_state['metrics'] or logs/metrics.json."
        )
        return

    table = _build_table(metrics)
    ranking = sorted(
        metrics, key=lambda ai: float(metrics[ai].get("wins", 0) or 0), reverse=True
    )

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Win Rates")
        win_data = pd.DataFrame(
            {
                "Wins": {
                    ai: float(data.get("wins", 0) or 0) for ai, data in metrics.items()
                }
            }
        )
        st.bar_chart(win_data)

    with col2:
        st.subheader("Average Decision Time (s)")
        decision_data = pd.DataFrame(
            {
                "Avg Decision Time": {
                    ai: float(data.get("decision_time", 0) or 0)
                    / max(float(data.get("decisions", 0) or 0), 1.0)
                    for ai, data in metrics.items()
                }
            }
        )
        st.bar_chart(decision_data)

    st.subheader("Average Moves To Win")
    move_data = pd.DataFrame(
        {
            "Avg Moves": {
                ai: float(data.get("total_moves", data.get("moves", 0)) or 0)
                / max(float(data.get("wins", 0) or 0), 1.0)
                for ai, data in metrics.items()
            }
        }
    )
    st.bar_chart(move_data)

    st.subheader("Comparative Table")
    st.dataframe(table, use_container_width=True)

    st.subheader("Ranking")
    for index, ai_name in enumerate(ranking, 1):
        st.write(f"{index}. {ai_name}")


if __name__ == "__main__":
    main()
