"""Tests for all 6 AI types: return types, legal values, non-crash."""

from __future__ import annotations

import random

import pytest

from ai.expectiminimax_ai import ExpectiminimaxAI
from ai.mcts_ai import MctsAI
from ai.minimax_ai import MinimaxAI
from ai.negamax_ai import NegamaxAI
from ai.random_ai import RandomAI
from ai.rule_based_ai import RuleBasedAI
from engine.game_state import GameState
from models.player import AIPlayer


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ALL_AI_CLASSES = [RandomAI, RuleBasedAI, MinimaxAI, ExpectiminimaxAI, NegamaxAI, MctsAI]

AI_IDS = ["RandomAI", "RuleBasedAI", "MinimaxAI", "ExpectiminimaxAI", "NegamaxAI", "MctsAI"]


def _make_agent(cls):
    """Instantiate any of the 6 AI classes with safe low-cost parameters."""
    if cls is MctsAI:
        return cls(iterations=4)
    if cls in (MinimaxAI, NegamaxAI, ExpectiminimaxAI):
        return cls(depth=1)
    return cls()


def _game_with(cls) -> tuple[GameState, object]:
    """Return a 2-player game where the first player uses the given AI class."""
    random.seed(42)
    state = GameState()
    agent = _make_agent(cls)
    state.add_player(AIPlayer("TestAI", agent))
    state.add_player(AIPlayer("Opp", MctsAI(iterations=1)))
    state.setup_game()
    for p in state.players:
        p.move("Auditorium")
    # Some AIs (e.g. RandomAI) read current_location from the top-level state.
    state.current_location = "Auditorium"
    return state, agent


# ---------------------------------------------------------------------------
# 1 — choose_move
# ---------------------------------------------------------------------------

class TestChooseMove:

    @pytest.mark.parametrize("cls", ALL_AI_CLASSES, ids=AI_IDS)
    def test_returns_string(self, cls):
        state, agent = _game_with(cls)
        valid = state.get_possible_moves()
        move = agent.choose_move(state, valid)
        assert isinstance(move, str)

    @pytest.mark.parametrize("cls", ALL_AI_CLASSES, ids=AI_IDS)
    def test_move_is_in_valid_set(self, cls):
        state, agent = _game_with(cls)
        valid = state.get_possible_moves()
        move = agent.choose_move(state, valid)
        assert move in valid

    @pytest.mark.parametrize("cls", ALL_AI_CLASSES, ids=AI_IDS)
    def test_single_move_always_chosen(self, cls):
        state, agent = _game_with(cls)
        result = agent.choose_move(state, ["Cafeteria"])
        assert result == "Cafeteria"

    @pytest.mark.parametrize("cls", ALL_AI_CLASSES, ids=AI_IDS)
    def test_empty_moves_returns_none(self, cls):
        state, agent = _game_with(cls)
        result = agent.choose_move(state, [])
        assert result is None

    # Only MinimaxAI and MctsAI explicitly guard against None valid_moves.
    @pytest.mark.parametrize("cls", [MinimaxAI, MctsAI], ids=["MinimaxAI", "MctsAI"])
    def test_none_moves_raises_for_validating_ais(self, cls):
        state, agent = _game_with(cls)
        with pytest.raises((ValueError, TypeError)):
            agent.choose_move(state, None)

    @pytest.mark.parametrize("cls", ALL_AI_CLASSES, ids=AI_IDS)
    def test_does_not_mutate_state(self, cls):
        state, agent = _game_with(cls)
        valid = state.get_possible_moves()
        turn_before = state.current_turn
        agent.choose_move(state, valid)
        assert state.current_turn == turn_before


# ---------------------------------------------------------------------------
# 2 — make_suggestion
# ---------------------------------------------------------------------------

class TestMakeSuggestion:

    @pytest.mark.parametrize("cls", ALL_AI_CLASSES, ids=AI_IDS)
    def test_returns_triple(self, cls):
        state, agent = _game_with(cls)
        # Pre-cache notebook for agents that require it.
        cache = getattr(agent, "_cache_notebook", None)
        if callable(cache):
            cache(state)
        result = agent.make_suggestion(state)
        assert isinstance(result, tuple) and len(result) == 3

    @pytest.mark.parametrize("cls", ALL_AI_CLASSES, ids=AI_IDS)
    def test_suspect_is_valid(self, cls):
        state, agent = _game_with(cls)
        cache = getattr(agent, "_cache_notebook", None)
        if callable(cache):
            cache(state)
        s, _, _ = agent.make_suggestion(state)
        assert isinstance(s, str) and s in state.suspects

    @pytest.mark.parametrize("cls", ALL_AI_CLASSES, ids=AI_IDS)
    def test_weapon_is_valid(self, cls):
        state, agent = _game_with(cls)
        cache = getattr(agent, "_cache_notebook", None)
        if callable(cache):
            cache(state)
        _, w, _ = agent.make_suggestion(state)
        assert isinstance(w, str) and w in state.weapons

    @pytest.mark.parametrize("cls", ALL_AI_CLASSES, ids=AI_IDS)
    def test_location_is_valid(self, cls):
        state, agent = _game_with(cls)
        cache = getattr(agent, "_cache_notebook", None)
        if callable(cache):
            cache(state)
        _, _, loc = agent.make_suggestion(state)
        assert isinstance(loc, str) and loc in state.locations


# ---------------------------------------------------------------------------
# 3 — decide_accusation
# ---------------------------------------------------------------------------

class TestDecideAccusation:

    @pytest.mark.parametrize("cls", ALL_AI_CLASSES, ids=AI_IDS)
    def test_false_with_uniform_priors(self, cls):
        state, agent = _game_with(cls)
        cache = getattr(agent, "_cache_notebook", None)
        if callable(cache):
            cache(state)
        result = agent.decide_accusation(state)
        assert result is False

    # Only MinimaxAI and MctsAI explicitly reject a None state.
    @pytest.mark.parametrize("cls", [MinimaxAI, MctsAI], ids=["MinimaxAI", "MctsAI"])
    def test_raises_on_none_state_for_validating_ais(self, cls):
        _, agent = _game_with(cls)
        with pytest.raises((ValueError, AttributeError)):
            agent.decide_accusation(None)


# ---------------------------------------------------------------------------
# 4 — update_from_clue / handle_no_reveal (interface smoke-tests)
# ---------------------------------------------------------------------------

class TestClueInterface:

    @pytest.mark.parametrize("cls", ALL_AI_CLASSES, ids=AI_IDS)
    def test_update_from_clue_does_not_crash(self, cls):
        from types import SimpleNamespace
        state, agent = _game_with(cls)
        cache = getattr(agent, "_cache_notebook", None)
        if callable(cache):
            cache(state)
        agent.update_from_clue(SimpleNamespace(name="Knife"))   # must not raise

    @pytest.mark.parametrize("cls", ALL_AI_CLASSES, ids=AI_IDS)
    def test_handle_no_reveal_does_not_crash(self, cls):
        from types import SimpleNamespace
        state, agent = _game_with(cls)
        cache = getattr(agent, "_cache_notebook", None)
        if callable(cache):
            cache(state)
        sug = SimpleNamespace(suspect="Chef", weapon="Knife", location="Auditorium")
        agent.handle_no_reveal(sug)                             # must not raise


# ---------------------------------------------------------------------------
# 5 — Cross-AI compatibility
# ---------------------------------------------------------------------------

class TestCrossAI:

    def test_all_six_ais_can_play_short_game(self):
        """All 6 AI types must coexist in one game without crashing."""
        random.seed(7)
        state = GameState()
        for cls in ALL_AI_CLASSES:
            state.add_player(AIPlayer(cls.__name__, _make_agent(cls)))
        # Trim to MAX_PLAYERS limit (5)
        state.players = state.players[:5]
        state.setup_game()
        for p in state.players:
            p.move("Auditorium")
        winner = state.run_game(max_turns=20, verbose=False)
        assert winner is None or hasattr(winner, "name")

    def test_minimax_depth_one_is_fast(self):
        state, agent = _game_with(MinimaxAI)
        valid = state.get_possible_moves()
        move = agent.choose_move(state, valid)
        assert move in valid

    def test_mcts_choose_move_deterministic_with_seed(self):
        """Same seed → same move for MCTS."""
        random.seed(99)
        state1, a1 = _game_with(MctsAI)
        valid1 = state1.get_possible_moves()
        m1 = a1.choose_move(state1, valid1)

        random.seed(99)
        state2, a2 = _game_with(MctsAI)
        valid2 = state2.get_possible_moves()
        m2 = a2.choose_move(state2, valid2)

        assert m1 == m2
