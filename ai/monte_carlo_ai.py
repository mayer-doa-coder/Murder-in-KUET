"""
monte_carlo_ai.py - Monte Carlo Simulation AI

Purpose: Implements a Monte Carlo–based AI agent that evaluates candidate
moves AND suggestions by simulating realistic game rollouts (movement,
suggestion, reveal resolution, Bayesian updates) and measuring win ratios.
Accusations are triggered by a configurable probability threshold rather than
a hard "only one option remains" rule.

Architecture
------------
  MonteCarloAI(StrategicEvaluationMixin, BaseAI)
  │
  ├── simulate_random_game   – engine-based rollout with real reveal + Bayesian
  ├── evaluate_move          – win-ratio from a post-move state (N rollouts)
  ├── evaluate_suggestion    – win-ratio from a post-suggestion state (S rollouts)
  ├── choose_move            – picks the move with the highest win ratio
  ├── make_suggestion        – MC scoring of every suspect+weapon pair
  └── decide_accusation      – probabilistic threshold from notebook confidence

Design principles
-----------------
  - Original state is NEVER mutated.  Every rollout clones the engine state.
  - Rollouts use the live engine GameState (real player cards → real reveals).
  - Win = the player's notebook reaches is_solved() first.
  - _MAX_ROLLOUT_STEPS caps every rollout so the loop is always finite.
  - All thresholds and budgets are driven by AI_CONFIG — nothing is hardcoded.
"""

from __future__ import annotations

import logging
import random
from copy import deepcopy
from time import perf_counter
from typing import Any, Sequence

from ai.base_ai import BaseAI
from ai.minimax_ai import GameState as SearchState, StrategicEvaluationMixin
from config.settings import AI_CONFIG, get_positive_int
from engine.clue_reveal import reveal_clue
from models.suggestion import Suggestion
from utils.helpers import safe_random_choice


logger = logging.getLogger(__name__)

# Hard cap on rollout depth — guarantees termination even in degenerate states.
# 50 turns covers the vast majority of real Cluedo games.
_MAX_ROLLOUT_STEPS = 50


class MonteCarloAI(StrategicEvaluationMixin, BaseAI):
    """Monte Carlo AI that scores moves by simulating realistic game rollouts.

    Each move is evaluated by:
      1. Completing our player's full turn (move → suggest → reveal → update).
      2. Running `simulations` independent rollouts from the resulting state.
      3. Counting the fraction of rollouts where our player wins.

    The move with the highest win ratio is selected.
    """

    def __init__(self, simulations: int | None = None) -> None:
        """Initialise with configurable rollout budgets and accusation threshold.

        Args:
            simulations: Rollouts per candidate move (MONTE_CARLO_SIMULATIONS).
                         All other parameters are read from AI_CONFIG.
        """
        if simulations is None:
            simulations = get_positive_int(AI_CONFIG, "MONTE_CARLO_SIMULATIONS", 30)
        if simulations < 1:
            raise ValueError("simulations must be >= 1")
        self.simulations: int = simulations

        # Rollouts per suspect+weapon pair in make_suggestion().
        # Cheaper than move evaluation — suggestion space is larger.
        self.suggestion_sims: int = get_positive_int(
            AI_CONFIG, "MONTE_CARLO_SUGGESTION_SIMS", 5
        )

        # Maximum number of suspect+weapon pairs scored per make_suggestion call.
        # Pairs ranked by notebook probability; only the top-N are evaluated.
        self._max_suggestion_pairs: int = get_positive_int(
            AI_CONFIG, "MONTE_CARLO_MAX_SUGGESTION_PAIRS", 9
        )

        # Minimum per-category probability confidence required to accuse.
        # Read as float; clamped to [0.01, 0.99] to avoid extremes.
        raw_thresh = AI_CONFIG.get("MONTE_CARLO_ACCUSATION_THRESHOLD", 0.70)
        try:
            self.accusation_threshold: float = float(
                max(0.01, min(0.99, raw_thresh))
            )
        except (TypeError, ValueError):
            self.accusation_threshold = 0.70

        # Early stopping: stop evaluating remaining moves once a candidate
        # exceeds this win-ratio.  Configurable and togglable independently.
        raw_early_stop = AI_CONFIG.get("MONTE_CARLO_EARLY_STOP_THRESHOLD", 0.9)
        try:
            self.early_stop_threshold: float = float(
                max(0.0, min(1.0, raw_early_stop))
            )
        except (TypeError, ValueError):
            self.early_stop_threshold = 0.9
        self.early_stop_enabled: bool = bool(
            AI_CONFIG.get("MONTE_CARLO_EARLY_STOP_ENABLED", True)
        )

        # Adaptive simulations: scale per-move rollout count down when the
        # branching factor is large so total work stays bounded.
        self.adaptive_sims_enabled: bool = bool(
            AI_CONFIG.get("MONTE_CARLO_ADAPTIVE_SIMS_ENABLED", True)
        )
        self._min_simulations: int = get_positive_int(
            AI_CONFIG, "MONTE_CARLO_MIN_SIMULATIONS", 5
        )

        # Notebook reference kept in sync so update_from_clue / handle_no_reveal work.
        self._last_notebook: Any | None = None

    # ------------------------------------------------------------------
    # Core rollout engine
    # ------------------------------------------------------------------

    def simulate_random_game(
        self,
        state: Any,
        our_player_idx: int | None = None,
    ) -> float:
        """Run one realistic game rollout until termination.

        Each step simulates a full player turn:
          1. Random movement to a reachable room.
          2. Random suggestion drawn from remaining notebook candidates.
          3. reveal_clue() resolves who (if anyone) shows a card.
          4. Bayesian notebook updates applied correctly:
               - reveal  → only the suggesting player updates (private).
               - no reveal → all active players update (public information).
          5. Win check: if the current player's notebook is fully solved → win.

        The input state is NEVER mutated.  A fresh deep-copy is made at the
        start of every call.

        Args:
            state: Engine GameState snapshot (or deepcopy-able equivalent).
            our_player_idx: Index of the player we are rooting for.
                            Defaults to the current player in `state`.

        Returns:
            float: 1.0 if our player's notebook solves first, 0.0 otherwise.
        """
        # Isolate this rollout from the original and all other rollouts.
        sim = self._clone_engine_state(state)

        if not sim.players:
            return 0.0

        if our_player_idx is None:
            our_player_idx = sim.current_turn % len(sim.players)

        for _step in range(_MAX_ROLLOUT_STEPS):

            # --- Terminal: engine declared game over ---
            if sim.game_over:
                return self._outcome_from_game_over(sim, our_player_idx)

            # --- Terminal: only one (or zero) active players remain ---
            active = sim.get_active_players()
            if len(active) == 0:
                return 0.0
            if len(active) == 1:
                winner_idx = sim.players.index(active[0])
                return 1.0 if winner_idx == our_player_idx else 0.0

            # --- Resolve current player ---
            current_idx = sim.current_turn % len(sim.players)
            current_player = sim.players[current_idx]

            if not current_player.active:
                sim.next_turn()
                continue

            # --- Movement phase ---
            moves = sim.get_possible_moves()
            if moves:
                chosen_move = random.choice(moves)
                current_player.move(chosen_move)
                sim.current_location = current_player.position

            # --- Suggestion phase ---
            suggestion = self._build_random_suggestion(sim, current_player)
            if suggestion is not None:

                # --- Reveal phase ---
                try:
                    revealer, card = reveal_clue(
                        suggestion, sim.players, current_idx
                    )
                except Exception:
                    revealer, card = None, None

                # --- Bayesian notebook updates ---
                self._apply_reveal_updates(
                    sim, current_player, suggestion, card
                )

                # --- Win check: notebook fully determined? ---
                if self._is_notebook_solved(current_player):
                    return 1.0 if current_idx == our_player_idx else 0.0

            sim.next_turn()

        # Step cap hit — neither player won within the budget.
        return 0.0

    # ------------------------------------------------------------------
    # Move evaluation (win ratio)
    # ------------------------------------------------------------------

    def evaluate_move(self, state: Any, move: str, *, sims: int | None = None) -> float:
        """Estimate the win probability for one candidate move.

        Completes our player's full turn for this specific move (movement +
        suggestion + reveal + Bayesian update), then runs rollouts from the
        resulting state.  Returns the fraction of rollouts our player wins.

        Args:
            state: Current engine game state snapshot.
            move: Candidate destination to evaluate.
            sims: Rollout count override.  Defaults to ``self.simulations``
                  when None.  Callers (e.g. ``choose_move`` with adaptive
                  scaling) pass a reduced count to bound total work.

        Returns:
            float: Win ratio in [0.0, 1.0].  Returns 0.0 if the move cannot
                   be applied or an immediate loss is detected.
        """
        # Independent clone for this move — never touch the original.
        base = self._clone_engine_state(state)

        if not base.players:
            return 0.0

        our_idx = base.current_turn % len(base.players)
        our_player = base.players[our_idx]

        # --- Apply the candidate move ---
        possible_moves = base.get_possible_moves()
        if move in possible_moves:
            our_player.move(move)
            base.current_location = our_player.position

        # --- Complete our suggestion for this position ---
        suggestion = self._build_random_suggestion(base, our_player)
        if suggestion is not None:
            try:
                revealer, card = reveal_clue(suggestion, base.players, our_idx)
            except Exception:
                revealer, card = None, None

            self._apply_reveal_updates(base, our_player, suggestion, card)

            # Immediate win: we solved the mystery on this very move.
            if self._is_notebook_solved(our_player):
                return 1.0

        # Advance to the next player before branching into simulations.
        # Every simulation clones `base` internally so they are fully independent.
        base.next_turn()

        n = sims if (isinstance(sims, int) and sims >= 1) else self.simulations
        wins = sum(self.simulate_random_game(base, our_idx) for _ in range(n))
        return wins / n

    # ------------------------------------------------------------------
    # Suggestion evaluation (win ratio)
    # ------------------------------------------------------------------

    def evaluate_suggestion(
        self,
        state: Any,
        suspect: str,
        weapon: str,
        location: str,
    ) -> float:
        """Estimate the win probability of making one specific suggestion.

        Applies (suspect, weapon, location) to a cloned engine state —
        resolving the reveal with real player card data and updating the
        Bayesian notebook accordingly — then runs `self.suggestion_sims`
        independent rollouts from the resulting knowledge state.

        This mirrors evaluate_move() but operates on the suggestion dimension
        instead of the movement dimension.  The input state is never mutated.

        Args:
            state: Current engine game state snapshot (player already moved).
            suspect: Candidate suspect name.
            weapon: Candidate weapon name.
            location: Current player's position (Cluedo rule: suggest in
                      the room you occupy).

        Returns:
            float: Win ratio in [0.0, 1.0].  0.0 when suggestion is invalid.
        """
        base = self._clone_engine_state(state)

        if not base.players:
            return 0.0

        our_idx = base.current_turn % len(base.players)
        our_player = base.players[our_idx]

        # Build and resolve the candidate suggestion in the clone.
        try:
            sug = Suggestion(suspect=suspect, weapon=weapon, location=location)
        except Exception:
            return 0.0  # invalid combination (empty string, etc.)

        try:
            revealer, card = reveal_clue(sug, base.players, our_idx)
        except Exception:
            revealer, card = None, None

        self._apply_reveal_updates(base, our_player, sug, card)

        # Immediate win: this suggestion alone solved the mystery.
        if self._is_notebook_solved(our_player):
            return 1.0

        # Advance to next player so rollouts start fresh from opponent turns.
        base.next_turn()

        wins = sum(
            self.simulate_random_game(base, our_idx)
            for _ in range(self.suggestion_sims)
        )
        return wins / max(self.suggestion_sims, 1)

    # ------------------------------------------------------------------
    # BaseAI interface
    # ------------------------------------------------------------------

    def choose_move(self, state: Any, valid_moves: Sequence[str]) -> str | None:
        """Select the move with the highest Monte Carlo win ratio.

        Optimization layers applied in order:
          1. Adaptive simulation count  — fewer rollouts per move when the
             branching factor is large, keeping total work O(budget) not
             O(moves × simulations).
          2. Early stopping             — once a move exceeds
             ``early_stop_threshold``, skip the remaining candidates.
             This exploits the observation that a near-certain win rarely
             needs confirmation from further evaluation.

        Both layers are independently togglable via AI_CONFIG.

        Args:
            state: Current game state snapshot.
            valid_moves: Legal destinations for this turn (engine-computed).

        Returns:
            str | None: Best-scoring destination, or None when no moves exist.

        Raises:
            ValueError: If valid_moves is None.
        """
        if valid_moves is None:
            raise ValueError("valid_moves cannot be None")

        valid_moves = list(valid_moves)
        if not valid_moves:
            return None

        self._cache_notebook(state)

        num_moves = len(valid_moves)
        sims = self._scaled_sim_count(num_moves)

        t_start = perf_counter()
        best_move: str | None = None
        best_score = -1.0
        moves_evaluated = 0

        for i, move in enumerate(valid_moves):
            score = self.evaluate_move(state, move, sims=sims)
            moves_evaluated += 1
            logger.debug(
                "MC move %d/%d '%s' → win-ratio=%.4f (sims=%d)",
                i + 1, num_moves, move, score, sims,
            )
            if score > best_score:
                best_score = score
                best_move = move

            if (
                self.early_stop_enabled
                and score >= self.early_stop_threshold
            ):
                logger.debug(
                    "MC early-stop: '%s' score=%.4f ≥ threshold=%.2f "
                    "after %d/%d moves evaluated",
                    move, score, self.early_stop_threshold,
                    i + 1, num_moves,
                )
                break

        if best_move is None:
            best_move = safe_random_choice(valid_moves)

        elapsed = perf_counter() - t_start
        logger.debug(
            "MonteCarloAI chose '%s' score=%.4f sims=%d "
            "moves_evaluated=%d/%d early_stop=%s elapsed=%.4fs",
            best_move, best_score, sims,
            moves_evaluated, num_moves,
            moves_evaluated < num_moves,
            elapsed,
        )
        return best_move

    def make_suggestion(self, state: Any) -> tuple[str, str, str]:
        """Select the best suggestion by scoring candidate pairs with Monte Carlo.

        Algorithm
        ---------
        1. Extract the remaining suspect and weapon candidates from the Bayesian
           notebook (the possibility sets that have not yet been eliminated).
        2. Build all (suspect, weapon) pairs and rank them by combined notebook
           probability so the highest-probability candidates are evaluated first.
        3. Evaluate up to `self._max_suggestion_pairs` pairs using
           `evaluate_suggestion()` — each runs `self.suggestion_sims` rollouts.
        4. Return the pair whose rollouts produced the highest win ratio, at the
           player's current location (Cluedo rule: suggest in your current room).

        This is strictly more informed than `most_likely()` because simulation
        accounts for how opponents would respond to each suggestion — a high-
        probability suspect may still be a poor suggestion if revealing it gives
        opponents more information than it gives us.

        Args:
            state: Current game state snapshot (player has already moved).

        Returns:
            tuple[str, str, str]: (suspect, weapon, location)

        Raises:
            ValueError: If the possibility space is completely empty.
        """
        self._cache_notebook(state)
        notebook = self._last_notebook

        # --- Candidate pool from Bayesian notebook, with full-list fallback ---
        # possible_suspects/weapons are sets; an empty set (all eliminated) falls
        # back to the game's full list so a suggestion can always be formed.
        notebook_suspects = getattr(notebook, "possible_suspects", set()) if notebook else set()
        notebook_weapons = getattr(notebook, "possible_weapons", set()) if notebook else set()

        suspects = sorted(notebook_suspects or getattr(state, "suspects", []))
        weapons = sorted(notebook_weapons or getattr(state, "weapons", []))

        if not suspects or not weapons:
            raise ValueError("Empty suggestion space — cannot make suggestion")

        # --- Location: current player's position (never randomised) ---
        location = self._resolve_current_location(state)
        if not location:
            raise ValueError("No valid location for suggestion")

        # --- Rank pairs by notebook probability (best first) ---
        ranked_pairs = self._ranked_suggestion_pairs(suspects, weapons, notebook)
        pairs_to_eval = ranked_pairs[: self._max_suggestion_pairs]

        # --- Monte Carlo evaluation of each pair ---
        best: tuple[str, str, str] | None = None
        best_score = -1.0

        for suspect, weapon in pairs_to_eval:
            score = self.evaluate_suggestion(state, suspect, weapon, location)
            logger.debug(
                "MC suggestion (%s, %s, %s) → win-ratio=%.4f",
                suspect, weapon, location, score,
            )
            if score > best_score:
                best_score = score
                best = (suspect, weapon, location)

        if best is not None:
            logger.debug(
                "MC chose suggestion %s (win-ratio=%.4f, sims=%d)",
                best, best_score, self.suggestion_sims,
            )
            return best

        # --- Fallback: return the highest-probability pair directly ---
        return (ranked_pairs[0][0], ranked_pairs[0][1], location)

    def decide_accusation(self, state: Any) -> bool | tuple[str, str, str]:
        """Decide whether to accuse using a configurable probability threshold.

        Computes a combined confidence score from the Bayesian notebook —
        the minimum of the maximum probabilities across suspects, weapons, and
        locations.  If this confidence exceeds `self.accusation_threshold`, the
        AI makes an accusation with the most-likely (suspect, weapon, location).

        Why minimum of maxima?  All three categories must be confident
        simultaneously; a high suspect probability is useless if the weapon is
        still uncertain.  This is the most conservative interpretation of
        "readiness to accuse" and matches intuitive Cluedo strategy.

        When confident, the method returns a (suspect, weapon, location) tuple
        rather than True.  The game engine interprets a tuple directly as the
        accusation, giving us full control over which cards are named.

        The threshold is tunable via AI_CONFIG["MONTE_CARLO_ACCUSATION_THRESHOLD"]
        (default 0.70).  Lower → more aggressive accuser; higher → cautious.

        Args:
            state: Current game state snapshot.

        Returns:
            False                      – not confident enough to accuse.
            tuple[str, str, str]       – (suspect, weapon, location) accusation.

        Raises:
            ValueError: If state is None.
        """
        if state is None:
            raise ValueError("State cannot be None")

        self._cache_notebook(state)
        notebook = self._last_notebook

        if notebook is None:
            return False

        # --- Extract maximum probability per category ---
        try:
            s_max = max(getattr(notebook, "suspects", {}).values(), default=0.0)
            w_max = max(getattr(notebook, "weapons", {}).values(), default=0.0)
            l_max = max(getattr(notebook, "locations", {}).values(), default=0.0)
        except Exception:
            return False

        # Combined confidence = weakest link across all three categories.
        confidence = min(s_max, w_max, l_max)

        logger.debug(
            "MC accusation check: s=%.3f w=%.3f l=%.3f → confidence=%.3f "
            "(threshold=%.2f)",
            s_max, w_max, l_max, confidence, self.accusation_threshold,
        )

        if confidence < self.accusation_threshold:
            return False

        # --- Confident: return the best accusation as a named tuple ---
        # most_likely() works even when not fully solved (confidence > threshold
        # but multiple options remain).  get_solution() would return None in
        # that case, so we prefer most_likely() here.
        try:
            suspect, weapon, location = notebook.most_likely()
            logger.debug("MC accusing: (%s, %s, %s)", suspect, weapon, location)
            return (suspect, weapon, location)
        except Exception:
            # Last-resort: let the engine build the accusation from the notebook.
            return True

    def update_from_clue(self, card: Any) -> None:
        """Eliminate a revealed card from the real-game notebook.

        The engine already calls _apply_bayesian_notebook_updates() before
        this hook, so we guard against double-elimination via known_cards.

        Args:
            card: Revealed card object with a `.name` attribute.
        """
        if card is None or self._last_notebook is None:
            return

        name = getattr(card, "name", None)
        if not (isinstance(name, str) and name.strip()):
            return

        known = getattr(self._last_notebook, "known_cards", None)
        if isinstance(known, set) and name in known:
            return  # already eliminated by the engine's Bayesian pass

        if hasattr(self._last_notebook, "eliminate"):
            try:
                self._last_notebook.eliminate(name)
            except Exception:
                pass

    def handle_no_reveal(self, suggestion: Any) -> None:
        """Boost probability of suggested cards when no opponent disproves them.

        Delegates to BayesianNotebook.update_no_reveal() to apply the
        multiplicative likelihood-ratio boost.

        Args:
            suggestion: Suggestion object with .suspect / .weapon / .location.
        """
        if self._last_notebook is None or suggestion is None:
            return

        suspect = getattr(suggestion, "suspect", None)
        weapon = getattr(suggestion, "weapon", None)
        location = getattr(suggestion, "location", None)

        update_fn = getattr(self._last_notebook, "update_no_reveal", None)
        if callable(update_fn) and all(
            isinstance(v, str) for v in (suspect, weapon, location)
        ):
            try:
                update_fn(suspect, weapon, location)
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _scaled_sim_count(self, num_moves: int) -> int:
        """Return the per-move rollout count for this turn.

        When ``adaptive_sims_enabled`` is True the budget is distributed
        across moves so total rollouts stay close to
        ``simulations × 4`` regardless of branching factor:

            per_move = simulations × 4 // num_moves

        The result is clamped to [_min_simulations, simulations]:
          - _min_simulations  prevents the estimate from becoming too noisy.
          - simulations       caps it so we never exceed the configured max.

        When adaptive is disabled (or there is only one move) the full
        ``self.simulations`` count is returned unchanged.

        Args:
            num_moves: Number of candidate moves to evaluate this turn.

        Returns:
            int: Rollout count to use per move.
        """
        if not self.adaptive_sims_enabled or num_moves <= 1:
            return self.simulations
        per_move = (self.simulations * 4) // num_moves
        return max(self._min_simulations, min(self.simulations, per_move))

    def _clone_engine_state(self, state: Any) -> Any:
        """Return a fully independent copy of the game state.

        Prefers the state's own clone() method (engine GameState) because it
        is guaranteed to deep-copy all nested player objects and notebooks.
        Falls back to deepcopy for any other state type.

        Args:
            state: Engine GameState or any deepcopy-able state object.

        Returns:
            A fresh, independent copy of state.
        """
        clone_fn = getattr(state, "clone", None)
        if callable(clone_fn):
            return clone_fn()
        return deepcopy(state)

    def _cache_notebook(self, state: Any) -> None:
        """Cache the current player's notebook from an engine state.

        The cached reference is used by update_from_clue() and
        handle_no_reveal() which are called back by the game engine after
        each real-game suggestion is resolved.

        Falls back to the SearchState conversion path when engine attributes
        are absent.
        """
        try:
            players = getattr(state, "players", None)
            current_turn = getattr(state, "current_turn", None)
            if isinstance(players, list) and players and isinstance(current_turn, int):
                player = players[current_turn % len(players)]
                self._last_notebook = getattr(player, "notebook", None)
                return
        except Exception:
            pass

        # Fallback: extract via lightweight SearchState conversion.
        try:
            search_state = self._to_search_state(state)
            self._last_notebook = search_state.notebook
        except Exception:
            pass

    def _build_random_suggestion(
        self, sim_state: Any, current_player: Any
    ) -> Suggestion | None:
        """Construct a random but valid Suggestion for one rollout step.

        Picks uniformly from the current player's remaining notebook
        candidates.  The location is always the player's current position
        (Cluedo rule: you suggest only in the room you occupy).

        Returns None when the possibility space is exhausted or the player
        has no current position.
        """
        notebook = getattr(current_player, "notebook", None)

        if notebook is not None:
            suspects = list(getattr(notebook, "possible_suspects", []))
            weapons = list(getattr(notebook, "possible_weapons", []))
        else:
            suspects = list(getattr(sim_state, "suspects", []))
            weapons = list(getattr(sim_state, "weapons", []))

        location = getattr(current_player, "position", None)
        if not isinstance(location, str) or not location.strip():
            # Player has no position yet; pick any known location.
            all_locs = getattr(sim_state, "locations", [])
            location = safe_random_choice(list(all_locs))
            if location is None:
                return None

        if not suspects or not weapons:
            return None

        try:
            return Suggestion(
                suspect=random.choice(suspects),
                weapon=random.choice(weapons),
                location=location,
            )
        except Exception:
            return None

    def _apply_reveal_updates(
        self,
        sim_state: Any,
        current_player: Any,
        suggestion: Any,
        card: Any,
    ) -> None:
        """Apply Bayesian notebook updates after a suggestion is resolved.

        Reveal semantics mirror the real game:
          - Card revealed  → PRIVATE: only the suggesting player updates.
          - No card revealed → PUBLIC: all active players update.

        Args:
            sim_state: Cloned game state (contains the full player list).
            current_player: The player who made the suggestion.
            suggestion: Suggestion object with .suspect / .weapon / .location.
            card: Revealed card object (has .name) or None if no reveal.
        """
        if card is not None:
            # Private update: only the current player learns the card.
            notebook = getattr(current_player, "notebook", None)
            if notebook is not None:
                update_reveal = getattr(notebook, "update_reveal", None)
                if callable(update_reveal):
                    try:
                        update_reveal(card.name)
                    except Exception:
                        pass
        else:
            # Public update: all active players learn from the no-reveal signal.
            suspect = getattr(suggestion, "suspect", None)
            weapon = getattr(suggestion, "weapon", None)
            location = getattr(suggestion, "location", None)

            if not all(isinstance(v, str) for v in (suspect, weapon, location)):
                return

            for player in sim_state.players:
                if not getattr(player, "active", False):
                    continue
                notebook = getattr(player, "notebook", None)
                if notebook is None:
                    continue
                update_no_reveal = getattr(notebook, "update_no_reveal", None)
                if callable(update_no_reveal):
                    try:
                        update_no_reveal(suspect, weapon, location)
                    except Exception:
                        pass

    def _is_notebook_solved(self, player: Any) -> bool:
        """Return True when the player's notebook has narrowed to one solution.

        A solved notebook means every category (suspects, weapons, locations)
        has exactly one remaining candidate — the player can now accuse
        correctly.

        Args:
            player: Player object with a .notebook attribute.

        Returns:
            bool: True if notebook.is_solved() or all sets have size 1.
        """
        notebook = getattr(player, "notebook", None)
        if notebook is None:
            return False

        is_solved_fn = getattr(notebook, "is_solved", None)
        if callable(is_solved_fn):
            try:
                return bool(is_solved_fn())
            except Exception:
                return False

        # Fallback: check set sizes directly.
        s = getattr(notebook, "possible_suspects", set())
        w = getattr(notebook, "possible_weapons", set())
        loc = getattr(notebook, "possible_locations", set())
        return len(s) == 1 and len(w) == 1 and len(loc) == 1

    def _outcome_from_game_over(self, sim: Any, our_player_idx: int) -> float:
        """Translate an engine-declared game-over into a win/loss float.

        Args:
            sim: Cloned game state where game_over is True.
            our_player_idx: Index of the player we are tracking.

        Returns:
            float: 1.0 if sim.winner is our player, 0.0 otherwise.
        """
        winner = getattr(sim, "winner", None)
        if winner is None:
            return 0.0
        try:
            winner_idx = sim.players.index(winner)
            return 1.0 if winner_idx == our_player_idx else 0.0
        except (ValueError, AttributeError):
            return 0.0

    def _ranked_suggestion_pairs(
        self,
        suspects: list[str],
        weapons: list[str],
        notebook: Any,
    ) -> list[tuple[str, str]]:
        """Return all (suspect, weapon) pairs ranked by combined notebook probability.

        The ranking ensures that when we cap evaluation at `_max_suggestion_pairs`,
        we always evaluate the most informative combinations first — discarding
        only the lowest-probability, least-promising options.

        Args:
            suspects: Candidate suspect names (from possible_suspects).
            weapons: Candidate weapon names (from possible_weapons).
            notebook: BayesianNotebook or None (falls back to alphabetic order).

        Returns:
            list[tuple[str, str]]: All pairs sorted best-first.
        """
        all_pairs = [(s, w) for s in suspects for w in weapons]

        if notebook is None:
            return all_pairs

        s_probs = getattr(notebook, "suspects", {})
        w_probs = getattr(notebook, "weapons", {})

        return sorted(
            all_pairs,
            key=lambda sw: s_probs.get(sw[0], 0.0) + w_probs.get(sw[1], 0.0),
            reverse=True,
        )

    def _resolve_current_location(self, state: Any) -> str | None:
        """Return the current player's position from any supported state format.

        Tries engine state first (player.position), then SearchState
        (current_location attribute), then falls back to the first available
        location from the notebook or game locations list.

        Args:
            state: Engine GameState, SearchState, or any compatible object.

        Returns:
            str | None: Location name, or None when no position can be found.
        """
        # Engine GameState path: read directly from the current player object.
        players = getattr(state, "players", None)
        current_turn = getattr(state, "current_turn", None)
        if isinstance(players, list) and players and isinstance(current_turn, int):
            player = players[current_turn % len(players)]
            loc = getattr(player, "position", None)
            if isinstance(loc, str) and loc.strip():
                return loc

        # SearchState path: current_location attribute.
        loc = getattr(state, "current_location", None)
        if isinstance(loc, str) and loc.strip():
            return loc

        # Last resort: pick the first location from notebook or game list.
        notebook = self._last_notebook
        if notebook:
            possible = sorted(getattr(notebook, "possible_locations", []))
            if possible:
                return possible[0]

        all_locs = list(getattr(state, "locations", []))
        return safe_random_choice(all_locs)

    # ------------------------------------------------------------------
    # SearchState compatibility (used by StrategicEvaluationMixin helpers)
    # ------------------------------------------------------------------

    def _to_search_state(self, state: Any) -> SearchState:
        """Convert any state to a lightweight SearchState copy.

        Used by make_suggestion, decide_accusation, and the evaluation mixin.
        Deep-copies an existing SearchState; coerces engine states via
        SearchState.from_engine_state().
        """
        if isinstance(state, SearchState):
            return deepcopy(state)
        return SearchState.from_engine_state(state)

    def _apply_random_suggestion(self, state: SearchState) -> SearchState:
        """Apply one random suggestion to a SearchState (SearchState path only).

        Kept for backward compatibility and any future MCTS work that uses
        the lightweight SearchState rollout path.
        """
        suspects = list(state.possible_suspects)
        weapons = list(state.possible_weapons)
        locations = list(state.possible_locations)

        if not suspects or not weapons or not locations:
            return state

        try:
            return state.simulate_suggestion((
                random.choice(suspects),
                random.choice(weapons),
                random.choice(locations),
            ))
        except Exception:
            return state
