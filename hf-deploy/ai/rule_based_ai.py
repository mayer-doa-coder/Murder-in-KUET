"""
rule_based_ai.py - Rule-Based AI Module

Purpose: Implements a deterministic rule-based AI that uses logical
deduction from the Bayesian notebook to make informed decisions without
any search tree.  Acts as a strong baseline above RandomAI.
"""

import logging
from typing import Any, Sequence

from ai.base_ai import BaseAI
from config.settings import AI_CONFIG
from utils.helpers import safe_random_choice

logger = logging.getLogger(__name__)


class RuleBasedAI(BaseAI):
    """Deterministic rule-based AI driven entirely by notebook deduction.

    Strategy:
      - Move toward the location with the highest notebook probability.
      - Always suggest the most probable (suspect, weapon) pair.
      - Accuse as soon as exactly one candidate remains in every category.
    """

    def __init__(self) -> None:
        self._last_notebook: Any | None = None

    # ------------------------------------------------------------------
    # BaseAI interface
    # ------------------------------------------------------------------

    def choose_move(self, state: Any, valid_moves: Sequence[str]) -> str | None:
        """Move to the reachable room with the highest location probability.

        Falls back to a random legal move when the notebook has no location
        probabilities or no valid moves exist.
        """
        if valid_moves is None:
            raise ValueError("valid_moves cannot be None")

        valid_moves = list(valid_moves)
        if not valid_moves:
            return None

        self._cache_notebook(state)
        notebook = self._last_notebook

        if notebook is not None:
            l_probs = getattr(notebook, "locations", {})
            if l_probs:
                ranked = sorted(
                    valid_moves,
                    key=lambda loc: l_probs.get(loc, 0.0),
                    reverse=True,
                )
                logger.debug("RuleBased chose move: %s", ranked[0])
                return ranked[0]

        chosen = safe_random_choice(valid_moves)
        logger.debug("RuleBased random move fallback: %s", chosen)
        return chosen

    def make_suggestion(self, state: Any) -> tuple[str, str, str]:
        """Suggest the most probable (suspect, weapon) at the current location.

        Uses notebook probability rankings.  Falls back to sorted lists when
        the notebook is absent.
        """
        self._cache_notebook(state)
        notebook = self._last_notebook

        nb_suspects = getattr(notebook, "possible_suspects", None) if notebook else None
        nb_weapons = getattr(notebook, "possible_weapons", None) if notebook else None
        suspects_pool = sorted(nb_suspects or getattr(state, "suspects", []))
        weapons_pool = sorted(nb_weapons or getattr(state, "weapons", []))

        if not suspects_pool or not weapons_pool:
            raise ValueError("Empty suggestion space")

        if notebook is not None:
            s_probs = getattr(notebook, "suspects", {})
            w_probs = getattr(notebook, "weapons", {})
            best_s = max(suspects_pool, key=lambda s: s_probs.get(s, 0.0))
            best_w = max(weapons_pool, key=lambda w: w_probs.get(w, 0.0))
        else:
            best_s = suspects_pool[0]
            best_w = weapons_pool[0]

        location = self._resolve_location(state)
        if not location:
            raise ValueError("No valid location for suggestion")

        logger.debug("RuleBased suggestion: (%s, %s, %s)", best_s, best_w, location)
        return (best_s, best_w, location)

    def decide_accusation(self, state: Any) -> bool | tuple[str, str, str]:
        """Accuse when Bayesian confidence exceeds the configured threshold.

        Uses the same probabilistic trigger as other search AIs so all agents
        compete on information quality rather than different certainty criteria.
        Returns the most-likely (suspect, weapon, location) tuple when confident.
        """
        self._cache_notebook(state)
        notebook = self._last_notebook
        if notebook is None:
            return False

        threshold = float(AI_CONFIG.get("RULE_BASED_ACCUSATION_THRESHOLD", 0.70))
        confidence_check = getattr(notebook, "confident_accusation", None)
        if callable(confidence_check) and confidence_check(threshold):
            most_likely = getattr(notebook, "most_likely", None)
            if callable(most_likely):
                try:
                    result = most_likely()
                    logger.debug("RuleBased accusing: %s", result)
                    return result
                except Exception:
                    pass

        return False

    def update_from_clue(self, card: Any) -> None:
        """Eliminate a revealed card from the notebook."""
        if card is None or self._last_notebook is None:
            return
        name = getattr(card, "name", None)
        if not (isinstance(name, str) and name.strip()):
            return
        known = getattr(self._last_notebook, "known_cards", None)
        if isinstance(known, set) and name in known:
            return
        if hasattr(self._last_notebook, "eliminate"):
            try:
                self._last_notebook.eliminate(name)
            except Exception:
                pass

    def handle_no_reveal(self, suggestion: Any) -> None:
        """Boost suggested cards when no opponent can disprove the suggestion."""
        if self._last_notebook is None or suggestion is None:
            return
        suspect = getattr(suggestion, "suspect", None)
        weapon = getattr(suggestion, "weapon", None)
        location = getattr(suggestion, "location", None)
        update_fn = getattr(self._last_notebook, "update_no_reveal", None)
        if callable(update_fn) and all(isinstance(v, str) for v in (suspect, weapon, location)):
            try:
                update_fn(suspect, weapon, location)
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _cache_notebook(self, state: Any) -> None:
        """Cache current player's notebook from engine state."""
        try:
            players = getattr(state, "players", None)
            current_turn = getattr(state, "current_turn", None)
            if isinstance(players, list) and players and isinstance(current_turn, int):
                player = players[current_turn % len(players)]
                self._last_notebook = getattr(player, "notebook", None)
                return
        except Exception:
            pass
        self._last_notebook = None

    def _resolve_location(self, state: Any) -> str | None:
        """Return current player's position from engine state."""
        players = getattr(state, "players", None)
        current_turn = getattr(state, "current_turn", None)
        if isinstance(players, list) and players and isinstance(current_turn, int):
            player = players[current_turn % len(players)]
            loc = getattr(player, "position", None)
            if isinstance(loc, str) and loc.strip():
                return loc
        loc = getattr(state, "current_location", None)
        if isinstance(loc, str) and loc.strip():
            return loc
        return None
