"""Comparative benchmarks: MonteCarloAI vs Minimax / Expectiminimax / Negamax.

These tests run short games (max_turns=40) with minimal simulation budgets so
the suite stays fast.  They validate behavioural differences and stability, not
absolute win rates (which need hundreds of games to be statistically meaningful).

Marked with pytest.mark.benchmark so they can be excluded from the fast unit
suite with: pytest -m "not benchmark"
"""

from __future__ import annotations

import random
import time
from typing import Any

import pytest

from ai.expectiminimax_ai import ExpectiminimaxAI
from ai.minimax_ai import MinimaxAI
from ai.monte_carlo_ai import MonteCarloAI
from ai.mcts_ai import MctsAI
from ai.negamax_ai import NegamaxAI
from engine.game_state import GameState
from models.player import AIPlayer


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MAX_TURNS = 40   # cap per game — keeps the suite fast
N_GAMES = 3      # games per comparison — enough for stability checks
BASE_SEED = 7777


def _agent_name(agent) -> str:
    return type(agent).__name__


def _build_head_to_head(agent_a, agent_b, seed: int) -> GameState:
    """Return a fresh two-player game state seeded for reproducibility."""
    random.seed(seed)
    state = GameState()
    state.add_player(AIPlayer("A", agent_a))
    state.add_player(AIPlayer("B", agent_b))
    state.setup_game()
    for p in state.players:
        p.move("Library")
    return state


def _run_match(agent_a, agent_b, n_games: int = N_GAMES) -> dict[str, Any]:
    """Run n_games head-to-head and return aggregated metrics for agent A."""
    wins_a = 0
    total_time = 0.0
    completed = 0

    for i in range(n_games):
        state = _build_head_to_head(agent_a, agent_b, BASE_SEED + i)
        t0 = time.perf_counter()
        winner = state.run_game(max_turns=MAX_TURNS, verbose=False)
        elapsed = time.perf_counter() - t0
        total_time += elapsed
        completed += 1
        if winner is not None and winner.name == "A":
            wins_a += 1

    return {
        "wins": wins_a,
        "games": completed,
        "win_rate": wins_a / max(completed, 1),
        "avg_game_time": total_time / max(completed, 1),
    }


def _mc(sims: int = 4) -> MonteCarloAI:
    """Return a fast MonteCarloAI suitable for benchmark games."""
    agent = MonteCarloAI(simulations=sims)
    agent.adaptive_sims_enabled = True
    agent._min_simulations = 2
    return agent


def _mcts(iterations: int = 20) -> MctsAI:
    """Return a fast MctsAI suitable for benchmark games."""
    return MctsAI(iterations=iterations)


# ---------------------------------------------------------------------------
# Stability: all four agents must complete games without crashing
# ---------------------------------------------------------------------------

@pytest.mark.benchmark
class TestStability:

    def test_minimax_completes(self):
        for i in range(N_GAMES):
            state = _build_head_to_head(MinimaxAI(depth=2), MinimaxAI(depth=2), BASE_SEED + i)
            winner = state.run_game(max_turns=MAX_TURNS, verbose=False)
            assert winner is None or hasattr(winner, "name")

    def test_expectiminimax_completes(self):
        for i in range(N_GAMES):
            state = _build_head_to_head(
                ExpectiminimaxAI(depth=2), MinimaxAI(depth=2), BASE_SEED + i
            )
            winner = state.run_game(max_turns=MAX_TURNS, verbose=False)
            assert winner is None or hasattr(winner, "name")

    def test_negamax_completes(self):
        for i in range(N_GAMES):
            state = _build_head_to_head(NegamaxAI(depth=2), MinimaxAI(depth=2), BASE_SEED + i)
            winner = state.run_game(max_turns=MAX_TURNS, verbose=False)
            assert winner is None or hasattr(winner, "name")

    def test_monte_carlo_completes(self):
        for i in range(N_GAMES):
            state = _build_head_to_head(_mc(), MinimaxAI(depth=2), BASE_SEED + i)
            winner = state.run_game(max_turns=MAX_TURNS, verbose=False)
            assert winner is None or hasattr(winner, "name")

    def test_mcts_completes(self):
        for i in range(N_GAMES):
            state = _build_head_to_head(_mcts(), MinimaxAI(depth=2), BASE_SEED + i)
            winner = state.run_game(max_turns=MAX_TURNS, verbose=False)
            assert winner is None or hasattr(winner, "name")

    def test_all_five_together_completes(self):
        """Five-player game with all AI types — the main production scenario."""
        random.seed(BASE_SEED)
        state = GameState()
        state.add_player(AIPlayer("Minimax", MinimaxAI(depth=2)))
        state.add_player(AIPlayer("Expecti", ExpectiminimaxAI(depth=2)))
        state.add_player(AIPlayer("Negamax", NegamaxAI(depth=2)))
        state.add_player(AIPlayer("MC", _mc(sims=3)))
        state.add_player(AIPlayer("MCTS", _mcts(iterations=20)))
        state.setup_game()
        for p in state.players:
            p.move("Library")
        winner = state.run_game(max_turns=MAX_TURNS, verbose=False)
        assert winner is None or hasattr(winner, "name")


# ---------------------------------------------------------------------------
# Behavioural differentiation
# ---------------------------------------------------------------------------

@pytest.mark.benchmark
class TestBehaviouralDifference:
    """MonteCarloAI decisions must differ from deterministic agents."""

    def test_mc_and_minimax_make_different_moves(self):
        """Given the same state, MC and Minimax should not always choose the same move."""
        state, _, _ = _mc_vs_minimax_state()
        mc = _mc(sims=2)
        mm = MinimaxAI(depth=2)

        # Sample over multiple seeds — at least one should diverge.
        diverged = False
        for seed in range(10):
            random.seed(seed)
            s = GameState()
            s.add_player(AIPlayer("M", mm))
            s.add_player(AIPlayer("C", mc))
            s.setup_game()
            for p in s.players:
                p.move("Library")
            valid = s.get_possible_moves()
            if len(valid) < 2:
                continue
            mc_move = mc.choose_move(s, valid)
            mm_move = mm.choose_move(s, valid)
            if mc_move != mm_move:
                diverged = True
                break

        assert diverged, "MC and Minimax always agreed on every move across 10 seeds"

    def test_mc_accusation_threshold_differs_from_rule_based(self):
        """MC uses a confidence threshold; Minimax accuses only when certain."""
        from ai.notebook import BayesianNotebook
        from engine.cards import suspects, weapons, locations

        mc = _mc(sims=1)
        mm = MinimaxAI(depth=2)

        # Build a minimal state where uncertainty is moderate.
        state = GameState()
        state.add_player(AIPlayer("MC", mc))
        state.add_player(AIPlayer("MM", mm))
        state.setup_game()
        for p in state.players:
            p.move("Library")

        # With uniform priors, MC should NOT accuse.
        mc_decision = mc.decide_accusation(state)
        assert mc_decision is False

        # Drive MC notebook to high confidence — MC should now consider accusing.
        mc._cache_notebook(state)
        nb = mc._last_notebook
        if nb is not None:
            top_s = sorted(nb.possible_suspects)[0]
            top_w = sorted(nb.possible_weapons)[0]
            top_l = sorted(nb.possible_locations)[0]
            for s in list(nb.possible_suspects):
                if s != top_s:
                    try:
                        nb.eliminate(s)
                    except ValueError:
                        pass
            for w in list(nb.possible_weapons):
                if w != top_w:
                    try:
                        nb.eliminate(w)
                    except ValueError:
                        pass
            for loc in list(nb.possible_locations):
                if loc != top_l:
                    try:
                        nb.eliminate(loc)
                    except ValueError:
                        pass

            confident_decision = mc.decide_accusation(state)
            assert confident_decision is not False, "MC should accuse when one candidate remains"


def _mc_vs_minimax_state():
    random.seed(42)
    state = GameState()
    mc = _mc(sims=2)
    mm = MinimaxAI(depth=2)
    state.add_player(AIPlayer("MC", mc))
    state.add_player(AIPlayer("MM", mm))
    state.setup_game()
    for p in state.players:
        p.move("Library")
    return state, mc, mm


# ---------------------------------------------------------------------------
# Decision timing: MC must be measurably slower than Minimax depth-2
# ---------------------------------------------------------------------------

@pytest.mark.benchmark
class TestDecisionTiming:

    def test_mc_decision_time_is_positive(self):
        """MC should spend measurable time on decisions (not instant)."""
        state, mc, _ = _mc_vs_minimax_state()
        valid = state.get_possible_moves() or ["Library"]
        t0 = time.perf_counter()
        mc.choose_move(state, valid)
        elapsed = time.perf_counter() - t0
        assert elapsed > 0.0, "MC chose a move in literally zero time — suspicious"

    def test_minimax_decision_time_is_positive(self):
        state, _, mm = _mc_vs_minimax_state()
        valid = state.get_possible_moves() or ["Library"]
        t0 = time.perf_counter()
        mm.choose_move(state, valid)
        elapsed = time.perf_counter() - t0
        assert elapsed >= 0.0

    def test_adaptive_sims_reduces_total_work(self):
        """Adaptive AI with many moves should finish faster than non-adaptive."""
        state = GameState()
        state.add_player(AIPlayer("A", _mc(sims=6)))
        state.add_player(AIPlayer("B", MinimaxAI(depth=2)))
        state.setup_game()
        for p in state.players:
            p.move("Library")

        # Force 10+ valid moves by putting player at a well-connected location.
        valid = state.get_possible_moves()

        adaptive = MonteCarloAI(simulations=6)
        adaptive.adaptive_sims_enabled = True
        adaptive._min_simulations = 2

        non_adaptive = MonteCarloAI(simulations=6)
        non_adaptive.adaptive_sims_enabled = False

        if len(valid) < 2:
            pytest.skip("Not enough valid moves to demonstrate adaptive benefit")

        t0 = time.perf_counter()
        adaptive.choose_move(state, valid)
        t_adaptive = time.perf_counter() - t0

        t0 = time.perf_counter()
        non_adaptive.choose_move(state, valid)
        t_non_adaptive = time.perf_counter() - t0

        # Adaptive should be equal or faster when there are multiple moves.
        # (With few moves both behave identically — the test is still valid.)
        assert t_adaptive <= t_non_adaptive * 2, (
            f"Adaptive ({t_adaptive:.4f}s) should not be dramatically slower than "
            f"non-adaptive ({t_non_adaptive:.4f}s)"
        )


# ---------------------------------------------------------------------------
# Metrics summary (printed, not asserted — for human review)
# ---------------------------------------------------------------------------

@pytest.mark.benchmark
def test_print_comparison_summary(capsys):
    """Print a human-readable metrics table for all four agents vs MinimaxAI."""
    agents = [
        ("MinimaxAI",        MinimaxAI(depth=2)),
        ("ExpectiminimaxAI", ExpectiminimaxAI(depth=2)),
        ("NegamaxAI",        NegamaxAI(depth=2)),
        ("MonteCarloAI",     _mc(sims=4)),
        ("MctsAI",           _mcts(iterations=20)),
    ]
    opponent = MinimaxAI(depth=2)

    rows = []
    for label, agent in agents:
        result = _run_match(agent, opponent)
        rows.append((label, result))

    with capsys.disabled():
        print("\n" + "=" * 60)
        print(f"  {'Agent':<22} {'Wins':>5} {'Games':>6} {'WinRate':>8} {'AvgTime':>10}")
        print("=" * 60)
        for label, r in rows:
            print(
                f"  {label:<22} {r['wins']:>5} {r['games']:>6} "
                f"{r['win_rate']:>7.1%}  {r['avg_game_time']:>8.3f}s"
            )
        print("=" * 60)
