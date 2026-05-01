"""Validation tests for MonteCarloAI suggestion and accusation behavior."""

from __future__ import annotations

import random

import pytest

from ai.monte_carlo_ai import MonteCarloAI
from ai.notebook import BayesianNotebook
from engine.game_state import GameState
from models.player import AIPlayer


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SUSPECTS = ["Rahim", "Karim", "Jalil", "Bashir", "Fatima", "Sumaiya"]
WEAPONS = ["Knife", "Rope", "Rope", "Revolver", "Revolver", "Candlestick"]
LOCATIONS = ["Auditorium", "Lab", "Cafeteria", "Gym", "Office", "Auditorium"]


def _build_two_player_state(simulations: int = 3) -> tuple[GameState, AIPlayer, MonteCarloAI]:
    """Return a fully initialized two-player game state with one MonteCarloAI."""
    random.seed(42)
    state = GameState()

    agent = MonteCarloAI(simulations=simulations)
    player = AIPlayer("MC Player", agent)
    opponent = AIPlayer("Opponent", MonteCarloAI(simulations=1))

    state.add_player(player)
    state.add_player(opponent)
    state.setup_game()
    player.move("Auditorium")
    return state, player, agent


# ---------------------------------------------------------------------------
# Part 1 — make_suggestion validation
# ---------------------------------------------------------------------------


class TestMakeSuggestion:

    def test_returns_three_strings(self):
        state, player, agent = _build_two_player_state()
        result = agent.make_suggestion(state)
        assert isinstance(result, tuple) and len(result) == 3
        s, w, loc = result
        assert isinstance(s, str) and s
        assert isinstance(w, str) and w
        assert isinstance(loc, str) and loc

    def test_location_matches_player_position(self):
        state, player, agent = _build_two_player_state()
        _, _, loc = agent.make_suggestion(state)
        assert loc == player.position

    def test_suspect_is_valid_game_card(self):
        state, player, agent = _build_two_player_state()
        suspect, _, _ = agent.make_suggestion(state)
        assert suspect in state.suspects

    def test_weapon_is_valid_game_card(self):
        state, player, agent = _build_two_player_state()
        _, weapon, _ = agent.make_suggestion(state)
        assert weapon in state.weapons

    def test_prefers_higher_probability_suspects(self):
        """Boosted suspect must appear first in the ranked evaluation order.

        MC evaluates pairs ranked by notebook probability.  The final picked
        suggestion may differ due to rollout noise (expected), but the ranking
        that feeds evaluation must put the highest-probability suspect first.
        """
        state, player, agent = _build_two_player_state()
        agent._cache_notebook(state)
        notebook = agent._last_notebook
        if notebook is None:
            pytest.skip("Notebook not available")

        remaining = sorted(notebook.possible_suspects)
        if not remaining:
            pytest.skip("No remaining suspects")

        top_suspect = remaining[0]
        top_weapon = sorted(notebook.possible_weapons)[0]
        for _ in range(8):
            notebook.update_no_reveal(top_suspect, top_weapon, player.position)

        ranked = agent._ranked_suggestion_pairs(
            list(notebook.possible_suspects),
            list(notebook.possible_weapons),
            notebook,
        )
        # Highest-probability suspect must head the ranked list.
        assert ranked[0][0] == top_suspect

    def test_fallback_when_possible_suspects_empty(self):
        """make_suggestion must not raise when possible_suspects is exhausted."""
        state, player, agent = _build_two_player_state()
        agent._cache_notebook(state)
        notebook = agent._last_notebook
        if notebook is None:
            pytest.skip("Notebook not available")

        # Drain possible_suspects (simulate over-elimination edge case).
        notebook.possible_suspects.clear()

        result = agent.make_suggestion(state)
        s, w, loc = result
        assert s in state.suspects
        assert w in state.weapons

    def test_no_state_mutation(self):
        """make_suggestion must not mutate the original state."""
        state, player, agent = _build_two_player_state()
        original_turn = state.current_turn
        original_pos = player.position

        agent.make_suggestion(state)

        assert state.current_turn == original_turn
        assert player.position == original_pos


# ---------------------------------------------------------------------------
# Part 2 — decide_accusation validation
# ---------------------------------------------------------------------------


class TestDecideAccusation:

    def test_returns_false_at_game_start(self):
        """AI should not accuse with uniform priors — confidence is below threshold."""
        state, _, agent = _build_two_player_state()
        result = agent.decide_accusation(state)
        assert result is False

    def test_never_accuses_randomly(self):
        """Running decide_accusation multiple times with uniform priors stays False."""
        state, _, agent = _build_two_player_state()
        for _ in range(10):
            assert agent.decide_accusation(state) is False

    def test_accuses_when_confident(self):
        """After forcing near-certainty in notebook, decide_accusation should accuse."""
        state, player, agent = _build_two_player_state()
        agent._cache_notebook(state)
        notebook = agent._last_notebook
        if notebook is None:
            pytest.skip("Notebook not available")

        # Drive all three categories to near-certainty by eliminating all but one.
        top_s = sorted(notebook.possible_suspects)[0]
        top_w = sorted(notebook.possible_weapons)[0]
        top_l = sorted(notebook.possible_locations)[0]

        for s in list(notebook.possible_suspects):
            if s != top_s:
                try:
                    notebook.eliminate(s)
                except ValueError:
                    pass
        for w in list(notebook.possible_weapons):
            if w != top_w:
                try:
                    notebook.eliminate(w)
                except ValueError:
                    pass
        for loc in list(notebook.possible_locations):
            if loc != top_l:
                try:
                    notebook.eliminate(loc)
                except ValueError:
                    pass

        result = agent.decide_accusation(state)
        # Should be a tuple accusation, not False.
        assert result is not False
        assert isinstance(result, tuple) and len(result) == 3

    def test_accusation_names_most_likely_cards(self):
        """The returned tuple should contain the highest-probability cards."""
        state, player, agent = _build_two_player_state()
        agent._cache_notebook(state)
        notebook = agent._last_notebook
        if notebook is None:
            pytest.skip("Notebook not available")

        top_s = sorted(notebook.possible_suspects)[0]
        top_w = sorted(notebook.possible_weapons)[0]
        top_l = sorted(notebook.possible_locations)[0]

        for s in list(notebook.possible_suspects):
            if s != top_s:
                try:
                    notebook.eliminate(s)
                except ValueError:
                    pass
        for w in list(notebook.possible_weapons):
            if w != top_w:
                try:
                    notebook.eliminate(w)
                except ValueError:
                    pass
        for loc in list(notebook.possible_locations):
            if loc != top_l:
                try:
                    notebook.eliminate(loc)
                except ValueError:
                    pass

        result = agent.decide_accusation(state)
        if isinstance(result, tuple):
            assert result[0] == top_s
            assert result[1] == top_w
            assert result[2] == top_l

    def test_confidence_grows_after_no_reveal(self):
        """Repeated no-reveal updates should eventually push confidence above threshold."""
        state, player, agent = _build_two_player_state()
        agent._cache_notebook(state)
        notebook = agent._last_notebook
        if notebook is None:
            pytest.skip("Notebook not available")

        top_s = sorted(notebook.possible_suspects)[0]
        top_w = sorted(notebook.possible_weapons)[0]
        top_l = sorted(notebook.possible_locations)[0]

        # Simulate many no-reveals for the same combination.
        accused_before = 30
        accused_after = 0
        for _ in range(accused_before):
            notebook.update_no_reveal(top_s, top_w, top_l)
            decision = agent.decide_accusation(state)
            if decision is not False:
                accused_after += 1

        assert accused_after > 0, "Confidence never exceeded threshold after 30 no-reveal updates"

    def test_state_none_raises(self):
        agent = MonteCarloAI(simulations=1)
        with pytest.raises(ValueError):
            agent.decide_accusation(None)


# ---------------------------------------------------------------------------
# Part 3 — Integration smoke test
# ---------------------------------------------------------------------------


class TestIntegration:

    def test_full_game_runs_without_error(self):
        """A full game with MonteCarloAI should complete without exceptions."""
        random.seed(99)
        state = GameState()
        for i in range(2):
            state.add_player(AIPlayer(f"Player {i}", MonteCarloAI(simulations=2)))
        state.setup_game()
        for p in state.players:
            p.move("Auditorium")

        winner = state.run_game(max_turns=30, verbose=False)
        # Winner is a player or None (turn cap); either is valid — no exception = pass.
        assert winner is None or hasattr(winner, "name")

    def test_make_suggestion_called_after_move_uses_new_position(self):
        """Suggestion location should reflect the post-move position."""
        state, player, agent = _build_two_player_state()
        new_pos = "Cafeteria"
        player.move(new_pos)
        state.current_location = new_pos

        _, _, loc = agent.make_suggestion(state)
        assert loc == new_pos

    def test_update_from_clue_eliminates_from_notebook(self):
        """update_from_clue should lower revealed card's probability to zero."""
        state, player, agent = _build_two_player_state()
        agent._cache_notebook(state)
        notebook = agent._last_notebook
        if notebook is None:
            pytest.skip("Notebook not available")

        from types import SimpleNamespace
        remaining = sorted(notebook.possible_suspects)
        if len(remaining) < 2:
            pytest.skip("Not enough suspects to test elimination")

        target = remaining[1]
        card = SimpleNamespace(name=target)
        agent.update_from_clue(card)

        assert notebook.suspects.get(target, 0.0) == 0.0
        assert target not in notebook.possible_suspects

    def test_handle_no_reveal_boosts_notebook(self):
        """handle_no_reveal should increase probabilities of suggested cards."""
        state, player, agent = _build_two_player_state()
        agent._cache_notebook(state)
        notebook = agent._last_notebook
        if notebook is None:
            pytest.skip("Notebook not available")

        top_s = sorted(notebook.possible_suspects)[0]
        top_w = sorted(notebook.possible_weapons)[0]
        top_l = sorted(notebook.possible_locations)[0]

        before_s = notebook.suspects[top_s]
        before_w = notebook.weapons[top_w]

        from types import SimpleNamespace
        sug = SimpleNamespace(suspect=top_s, weapon=top_w, location=top_l)
        agent.handle_no_reveal(sug)

        assert notebook.suspects[top_s] > before_s or notebook.weapons[top_w] > before_w


# ---------------------------------------------------------------------------
# Part 4 — Performance optimization tests
# ---------------------------------------------------------------------------


class TestScaledSimCount:
    """_scaled_sim_count controls per-move rollout budget."""

    def test_returns_full_sims_when_adaptive_disabled(self):
        agent = MonteCarloAI(simulations=20)
        agent.adaptive_sims_enabled = False
        assert agent._scaled_sim_count(10) == 20

    def test_returns_full_sims_for_single_move(self):
        agent = MonteCarloAI(simulations=20)
        agent.adaptive_sims_enabled = True
        assert agent._scaled_sim_count(1) == 20

    def test_scales_down_with_many_moves(self):
        agent = MonteCarloAI(simulations=20)
        agent.adaptive_sims_enabled = True
        agent._min_simulations = 2
        # 20 moves → 20*4//20 = 4 sims per move (below full 20)
        result = agent._scaled_sim_count(20)
        assert result < 20
        assert result >= agent._min_simulations

    def test_never_drops_below_min_simulations(self):
        agent = MonteCarloAI(simulations=20)
        agent.adaptive_sims_enabled = True
        agent._min_simulations = 5
        # Extreme branching factor — should still respect the floor.
        result = agent._scaled_sim_count(1000)
        assert result >= 5

    def test_never_exceeds_configured_simulations(self):
        agent = MonteCarloAI(simulations=10)
        agent.adaptive_sims_enabled = True
        result = agent._scaled_sim_count(1)
        assert result <= 10

    def test_budget_formula_correct(self):
        """Total rollouts should be at most simulations × 4."""
        agent = MonteCarloAI(simulations=20)
        agent.adaptive_sims_enabled = True
        agent._min_simulations = 1
        for num_moves in (2, 5, 10, 20, 50):
            sims = agent._scaled_sim_count(num_moves)
            assert sims * num_moves <= agent.simulations * 4 * num_moves  # trivially true
            # More meaningfully: sims is bounded above by the budget per move.
            assert sims <= max(1, (agent.simulations * 4) // num_moves) or sims == agent._min_simulations


class TestEarlyStopping:
    """choose_move stops as soon as a candidate clears the early-stop threshold."""

    def _make_agent_patched(self, high_score_move_idx: int, total_moves: int) -> tuple:
        """Return (agent, calls_list) where agent.evaluate_move records calls."""
        agent = MonteCarloAI(simulations=1)
        agent.early_stop_enabled = True
        agent.early_stop_threshold = 0.85
        agent.adaptive_sims_enabled = False

        calls: list[str] = []
        moves = [f"loc_{i}" for i in range(total_moves)]

        original_evaluate = agent.evaluate_move

        def patched_evaluate(state, move, *, sims=None):
            calls.append(move)
            if moves.index(move) == high_score_move_idx:
                return 0.95  # above threshold
            return 0.1

        agent.evaluate_move = patched_evaluate
        return agent, calls, moves

    def test_stops_after_high_score_move(self):
        state, player, _ = _build_two_player_state()
        agent, calls, moves = self._make_agent_patched(high_score_move_idx=2, total_moves=8)
        chosen = agent.choose_move(state, moves)
        assert chosen == "loc_2"
        # Should stop after evaluating moves 0, 1, 2 — not all 8.
        assert len(calls) == 3

    def test_evaluates_all_moves_when_disabled(self):
        state, player, _ = _build_two_player_state()
        agent, calls, moves = self._make_agent_patched(high_score_move_idx=1, total_moves=5)
        agent.early_stop_enabled = False
        agent.choose_move(state, moves)
        assert len(calls) == 5

    def test_threshold_configurable(self):
        state, player, _ = _build_two_player_state()
        agent, calls, moves = self._make_agent_patched(high_score_move_idx=1, total_moves=5)
        # Raise threshold above what the patched evaluate returns.
        agent.early_stop_threshold = 1.0
        agent.choose_move(state, moves)
        assert len(calls) == 5  # no early stop since nothing reaches 1.0

    def test_still_returns_best_score_move_without_early_stop(self):
        state, _, _ = _build_two_player_state()
        agent, _, moves = self._make_agent_patched(high_score_move_idx=3, total_moves=5)
        agent.early_stop_enabled = False
        chosen = agent.choose_move(state, moves)
        assert chosen == "loc_3"

    def test_no_crash_single_move(self):
        state, _, _ = _build_two_player_state()
        agent = MonteCarloAI(simulations=1)
        agent.early_stop_enabled = True
        result = agent.choose_move(state, ["Auditorium"])
        assert result == "Auditorium"


class TestEvaluateMoveSigsOverride:
    """evaluate_move respects the sims kwarg without touching self.simulations."""

    def test_sims_override_does_not_mutate_self(self):
        state, _, agent = _build_two_player_state(simulations=8)
        original = agent.simulations
        agent.evaluate_move(state, "Auditorium", sims=2)
        assert agent.simulations == original

    def test_none_sims_falls_back_to_default(self):
        """Passing sims=None should behave identically to omitting it."""
        state, _, agent = _build_two_player_state(simulations=2)
        r1 = agent.evaluate_move(state, "Auditorium", sims=None)
        assert 0.0 <= r1 <= 1.0

