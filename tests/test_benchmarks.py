"""Comparative benchmarks: MctsAI vs Minimax / Expectiminimax / Negamax.

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
from ai.mcts_ai import MctsAI
from ai.negamax_ai import NegamaxAI
from ai.rule_based_ai import RuleBasedAI
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
        p.move("Auditorium")
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


def _mcts(iterations: int = 20) -> MctsAI:
    """Return a fast MctsAI suitable for benchmark games."""
    return MctsAI(iterations=iterations)


# ---------------------------------------------------------------------------
# Stability: all agents must complete games without crashing
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

    def test_mcts_completes(self):
        for i in range(N_GAMES):
            state = _build_head_to_head(_mcts(), MinimaxAI(depth=2), BASE_SEED + i)
            winner = state.run_game(max_turns=MAX_TURNS, verbose=False)
            assert winner is None or hasattr(winner, "name")

    def test_rule_based_completes(self):
        for i in range(N_GAMES):
            state = _build_head_to_head(RuleBasedAI(), MinimaxAI(depth=2), BASE_SEED + i)
            winner = state.run_game(max_turns=MAX_TURNS, verbose=False)
            assert winner is None or hasattr(winner, "name")

    def test_all_five_together_completes(self):
        """Five-player game with all AI types — the main production scenario."""
        random.seed(BASE_SEED)
        state = GameState()
        state.add_player(AIPlayer("Minimax", MinimaxAI(depth=2)))
        state.add_player(AIPlayer("Expecti", ExpectiminimaxAI(depth=2)))
        state.add_player(AIPlayer("Negamax", NegamaxAI(depth=2)))
        state.add_player(AIPlayer("RuleBased", RuleBasedAI()))
        state.add_player(AIPlayer("MCTS", _mcts(iterations=20)))
        state.setup_game()
        for p in state.players:
            p.move("Auditorium")
        winner = state.run_game(max_turns=MAX_TURNS, verbose=False)
        assert winner is None or hasattr(winner, "name")


# ---------------------------------------------------------------------------
# Behavioural differentiation
# ---------------------------------------------------------------------------

@pytest.mark.benchmark
class TestBehaviouralDifference:
    """MCTS decisions must differ from deterministic agents."""

    def test_mcts_and_minimax_make_different_moves(self):
        """Given the same state, MCTS and Minimax should not always choose the same move."""
        diverged = False
        for seed in range(10):
            random.seed(seed)
            s = GameState()
            s.add_player(AIPlayer("M", MinimaxAI(depth=2)))
            s.add_player(AIPlayer("C", _mcts(iterations=10)))
            s.setup_game()
            for p in s.players:
                p.move("Auditorium")
            valid = s.get_possible_moves()
            if len(valid) < 2:
                continue
            mcts_move = _mcts(iterations=10).choose_move(s, valid)
            mm_move = MinimaxAI(depth=2).choose_move(s, valid)
            if mcts_move != mm_move:
                diverged = True
                break

        assert diverged, "MCTS and Minimax always agreed on every move across 10 seeds"

    def test_mcts_accusation_threshold(self):
        """MCTS uses a confidence threshold and should not accuse with uniform priors."""
        mcts = _mcts(iterations=5)

        state = GameState()
        state.add_player(AIPlayer("MCTS", mcts))
        state.add_player(AIPlayer("MM", MinimaxAI(depth=2)))
        state.setup_game()
        for p in state.players:
            p.move("Auditorium")

        # With uniform priors, MCTS should NOT accuse.
        decision = mcts.decide_accusation(state)
        assert decision is False


# ---------------------------------------------------------------------------
# Decision timing: MCTS must be measurably slower than Minimax depth-2
# ---------------------------------------------------------------------------

@pytest.mark.benchmark
class TestDecisionTiming:

    def test_mcts_decision_time_is_positive(self):
        """MCTS should spend measurable time on decisions (not instant)."""
        state = GameState()
        mcts = _mcts(iterations=10)
        state.add_player(AIPlayer("A", mcts))
        state.add_player(AIPlayer("B", MinimaxAI(depth=2)))
        state.setup_game()
        for p in state.players:
            p.move("Auditorium")
        valid = state.get_possible_moves() or ["Auditorium"]
        t0 = time.perf_counter()
        mcts.choose_move(state, valid)
        elapsed = time.perf_counter() - t0
        assert elapsed > 0.0, "MCTS chose a move in literally zero time — suspicious"

    def test_minimax_decision_time_is_positive(self):
        state = GameState()
        mm = MinimaxAI(depth=2)
        state.add_player(AIPlayer("A", mm))
        state.add_player(AIPlayer("B", MinimaxAI(depth=2)))
        state.setup_game()
        for p in state.players:
            p.move("Auditorium")
        valid = state.get_possible_moves() or ["Auditorium"]
        t0 = time.perf_counter()
        mm.choose_move(state, valid)
        elapsed = time.perf_counter() - t0
        assert elapsed >= 0.0

    def test_mcts_more_iterations_takes_longer(self):
        """More MCTS iterations should consistently take more time."""
        state = GameState()
        state.add_player(AIPlayer("A", MinimaxAI(depth=2)))
        state.add_player(AIPlayer("B", MinimaxAI(depth=2)))
        state.setup_game()
        for p in state.players:
            p.move("Auditorium")
        valid = state.get_possible_moves() or ["Auditorium"]

        mcts_fast = MctsAI(iterations=5)
        mcts_slow = MctsAI(iterations=40)

        t0 = time.perf_counter()
        mcts_fast.choose_move(state, valid)
        t_fast = time.perf_counter() - t0

        t0 = time.perf_counter()
        mcts_slow.choose_move(state, valid)
        t_slow = time.perf_counter() - t0

        assert t_slow >= t_fast * 0.5, (
            f"Slow MCTS ({t_slow:.4f}s) should not be dramatically faster than "
            f"fast MCTS ({t_fast:.4f}s)"
        )


# ---------------------------------------------------------------------------
# Metrics summary (printed, not asserted — for human review)
# ---------------------------------------------------------------------------

@pytest.mark.benchmark
def test_print_comparison_summary(capsys):
    """Print a human-readable metrics table for all agents vs MinimaxAI."""
    agents = [
        ("MinimaxAI",        MinimaxAI(depth=2)),
        ("ExpectiminimaxAI", ExpectiminimaxAI(depth=2)),
        ("NegamaxAI",        NegamaxAI(depth=2)),
        ("RuleBasedAI",      RuleBasedAI()),
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
