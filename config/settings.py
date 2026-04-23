"""Centralized runtime configuration for Murder in KUET.

Keep all tunable constants in this module to avoid hardcoded values
throughout the gameplay and AI orchestration code.
"""

from __future__ import annotations


GAME_CONFIG = {
    "MAX_PLAYERS": 4,  # raised to include MonteCarloAI in every comparison run
    "AI_DEPTH": 2,
    "SIMULATION_RUNS": 10,
    "MAX_TURNS": 250,
    "BASE_RANDOM_SEED": 2026,
}

AI_CONFIG = {
    "MINIMAX_DEPTH": 2,
    "EXPECTIMINIMAX_DEPTH": 2,
    "NEGAMAX_DEPTH": 2,
    # Monte Carlo move-evaluation budget (rollouts per move candidate).
    "MONTE_CARLO_SIMULATIONS": 30,
    # Monte Carlo suggestion-evaluation budget (rollouts per suspect+weapon pair).
    # Kept lower than MONTE_CARLO_SIMULATIONS to limit per-turn cost.
    "MONTE_CARLO_SUGGESTION_SIMS": 5,
    # Maximum number of suspect+weapon pairs to evaluate per make_suggestion call.
    # Pairs are ranked by notebook probability so only the best are evaluated.
    "MONTE_CARLO_MAX_SUGGESTION_PAIRS": 9,
    # Minimum combined probability confidence required to make a final accusation.
    # Range [0, 1]. Lower → more aggressive; higher → more conservative.
    "MONTE_CARLO_ACCUSATION_THRESHOLD": 0.70,
}


def get_config(key: str, default=None):
    """Return a GAME_CONFIG value with optional fallback."""
    return GAME_CONFIG.get(key, default)


def get_ai_config(key: str, default=None):
    """Return an AI_CONFIG value with optional fallback."""
    return AI_CONFIG.get(key, default)


def get_positive_int(config_dict: dict, key: str, default: int) -> int:
    """Read and validate a strictly positive integer configuration value."""
    value = config_dict.get(key, default)
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default
