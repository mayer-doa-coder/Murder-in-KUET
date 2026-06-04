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
    "MINIMAX_MAX_TREE_SUSPECT_CANDIDATES": 3,
    "MINIMAX_MAX_TREE_WEAPON_CANDIDATES": 3,
    "EXPECTIMINIMAX_DEPTH": 2,
    "NEGAMAX_DEPTH": 2,
    # MCTS: iterations per choose_move call (tree depth × breadth budget).
    "MCTS_ITERATIONS": 50,
    # UCT exploration constant.  sqrt(2) ≈ 1.4142 is the theoretically
    # derived value for rewards normalised to [0, 1].
    "MCTS_EXPLORATION_CONSTANT": 1.4142135623730951,
    # Maximum rollout steps per simulation — guarantees termination.
    "MCTS_ROLLOUT_DEPTH": 50,
    # Minimum Bayesian confidence across all three categories to trigger accusation.
    # Unified threshold so all AIs compete on information quality, not threshold gaps.
    "MCTS_ACCUSATION_THRESHOLD":           0.70,
    "MINIMAX_ACCUSATION_THRESHOLD":        0.70,
    "EXPECTIMINIMAX_ACCUSATION_THRESHOLD": 0.70,
    "NEGAMAX_ACCUSATION_THRESHOLD":        0.70,
    "RULE_BASED_ACCUSATION_THRESHOLD":     0.70,
}


EVAL_CONFIG = {
    # Information-gain scorer: maps remaining uncertainty to a score.
    "INFO_GAIN_WEIGHT":    2.0,   # multiplier applied to (max_score - uncertainty)
    "INFO_GAIN_MAX_SCORE": 30.0,  # theoretical score when uncertainty is zero

    # Certainty scorer: rewards categories already narrowed to one candidate.
    "CERTAINTY_REWARD":        10.0,  # per fully-solved category (1 candidate)
    "CERTAINTY_PARTIAL_BONUS":  5.0,  # per nearly-solved category (2 candidates)

    # Risk scorer: penalises states with a very large solution space.
    "RISK_PENALTY":    20.0,  # subtracted when remaining combinations exceed threshold
    "RISK_THRESHOLD":  10,    # product of |suspects|×|weapons|×|locations| threshold

    # Opponent scorer (Phase 3.1): penalises opponent high-certainty states.
    "OPPONENT_CERTAINTY_PENALTY": 1.0,
}


def get_config(key: str, default=None):
    """Return a GAME_CONFIG value with optional fallback."""
    return GAME_CONFIG.get(key, default)


def get_ai_config(key: str, default=None):
    """Return an AI_CONFIG value with optional fallback."""
    return AI_CONFIG.get(key, default)


def get_eval_config(key: str, default=None):
    """Return an EVAL_CONFIG value with optional fallback."""
    return EVAL_CONFIG.get(key, default)


def get_positive_int(config_dict: dict, key: str, default: int) -> int:
    """Read and validate a strictly positive integer configuration value."""
    value = config_dict.get(key, default)
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default
