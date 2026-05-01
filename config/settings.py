"""Centralized runtime configuration for Murder in KUET.

Keep all tunable constants in this module to avoid hardcoded values
throughout the gameplay and AI orchestration code.
"""

from __future__ import annotations

GAME_CONFIG = {
    "MAX_PLAYERS": 5,  # raised to include MctsAI in every comparison run
    "AI_DEPTH": 2,  # Legacy fallback depth; prefer AI_CONFIG keys per agent type
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
    # Early stopping: skip remaining moves once a candidate exceeds this win-ratio.
    # Set to 1.0 (or False below) to disable.  Range (0, 1].
    "MONTE_CARLO_EARLY_STOP_THRESHOLD": 0.9,
    # Toggle early stopping on/off without changing the threshold.
    "MONTE_CARLO_EARLY_STOP_ENABLED": True,
    # Adaptive simulation count: scale sims down when the move branching factor
    # is high so total rollout work stays bounded.
    "MONTE_CARLO_ADAPTIVE_SIMS_ENABLED": True,
    # Hard lower bound on simulations regardless of adaptive scaling.
    "MONTE_CARLO_MIN_SIMULATIONS": 5,
    # MCTS: iterations per choose_move call (tree depth × breadth budget).
    "MCTS_ITERATIONS": 50,
    # UCT exploration constant.  sqrt(2) ≈ 1.4142 is the theoretically
    # derived value for rewards normalised to [0, 1].
    "MCTS_EXPLORATION_CONSTANT": 1.4142135623730951,
    # Maximum rollout steps per simulation — guarantees termination.
    "MCTS_ROLLOUT_DEPTH": 50,
    # Minimum Bayesian confidence across all three categories to trigger accusation.
    "MCTS_ACCUSATION_THRESHOLD": 0.70,
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
