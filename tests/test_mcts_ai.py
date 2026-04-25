"""Tests for full MCTS AI: node structure, four phases, and integration."""

from __future__ import annotations

import math
import random
from types import SimpleNamespace
from typing import Any

import pytest

from ai.mcts_ai import MCTSNode, MctsAI
from engine.game_state import GameState
from models.player import AIPlayer


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _build_state(n_players: int = 2, iterations: int = 4) -> tuple[GameState, MctsAI]:
    random.seed(0)
    state = GameState()
    agent = MctsAI(iterations=iterations)
    for i in range(n_players):
        ai = MctsAI(iterations=1)
        state.add_player(AIPlayer(f"P{i}", ai))
    state.setup_game()
    for p in state.players:
        p.move("Auditorium")
    return state, agent


def _fresh_node(state: GameState | None = None) -> MCTSNode:
    if state is None:
        state, _ = _build_state()
    return MCTSNode(state=state)


# ---------------------------------------------------------------------------
# Part 1 — MCTSNode structure
# ---------------------------------------------------------------------------


class TestMCTSNode:

    def test_initial_visits_zero(self):
        node = _fresh_node()
        assert node.visits == 0

    def test_initial_wins_zero(self):
        node = _fresh_node()
        assert node.wins == 0.0

    def test_win_rate_zero_when_unvisited(self):
        node = _fresh_node()
        assert node.win_rate == 0.0

    def test_win_rate_after_update(self):
        node = _fresh_node()
        node.update(1.0)
        node.update(0.0)
        assert node.win_rate == pytest.approx(0.5)

    def test_update_increments_visits(self):
        node = _fresh_node()
        node.update(1.0)
        node.update(1.0)
        assert node.visits == 2

    def test_update_accumulates_wins(self):
        node = _fresh_node()
        node.update(1.0)
        node.update(0.0)
        node.update(1.0)
        assert node.wins == pytest.approx(2.0)

    def test_parent_none_for_root(self):
        node = _fresh_node()
        assert node.parent is None

    def test_move_none_for_root(self):
        node = _fresh_node()
        assert node.move is None

    def test_children_empty_initially(self):
        node = _fresh_node()
        assert node.children == []

    def test_untried_moves_non_empty(self):
        node = _fresh_node()
        assert len(node.untried_moves) > 0

    def test_is_fully_expanded_false_initially(self):
        node = _fresh_node()
        assert not node.is_fully_expanded()

    def test_is_fully_expanded_true_when_all_tried(self):
        node = _fresh_node()
        node.untried_moves.clear()
        assert node.is_fully_expanded()

    def test_add_child_creates_child(self):
        node = _fresh_node()
        state, _ = _build_state()
        child = node.add_child("Auditorium", state)
        assert child in node.children
        assert child.move == "Auditorium"
        assert child.parent is node

    def test_add_child_removes_from_untried(self):
        node = _fresh_node()
        move = node.untried_moves[0]
        state, _ = _build_state()
        node.add_child(move, state)
        assert move not in node.untried_moves

    def test_most_visited_child_returns_most_visited(self):
        node = _fresh_node()
        state, _ = _build_state()
        c1 = node.add_child("Auditorium", state)
        c2 = node.add_child("Lab", state)
        c1.visits = 5
        c2.visits = 10
        assert node.most_visited_child() is c2

    def test_most_visited_child_raises_on_no_children(self):
        node = _fresh_node()
        with pytest.raises(ValueError):
            node.most_visited_child()

    def test_is_terminal_false_in_active_game(self):
        node = _fresh_node()
        assert not node.is_terminal()

    def test_is_terminal_true_when_game_over(self):
        state, _ = _build_state()
        state.game_over = True
        node = MCTSNode(state=state)
        assert node.is_terminal()

    def test_repr_contains_move(self):
        state, _ = _build_state()
        child = MCTSNode(state=state, move="Cafeteria")
        assert "Cafeteria" in repr(child)


# ---------------------------------------------------------------------------
# Part 2 — UCT formula (Selection phase)
# ---------------------------------------------------------------------------


class TestUCTValue:

    def test_unvisited_node_returns_inf(self):
        node = _fresh_node()
        assert node.uct_value(parent_visits=10, exploration_constant=math.sqrt(2)) == float("inf")

    def test_exploitation_component(self):
        node = _fresh_node()
        node.visits = 4
        node.wins = 2.0
        # With C=0, UCT reduces to win_rate alone.
        assert node.uct_value(parent_visits=10, exploration_constant=0.0) == pytest.approx(0.5)

    def test_exploration_grows_with_parent_visits(self):
        node = _fresh_node()
        node.visits = 4
        node.wins = 0.0
        low = node.uct_value(parent_visits=10, exploration_constant=1.0)
        high = node.uct_value(parent_visits=100, exploration_constant=1.0)
        assert high > low

    def test_exploration_shrinks_with_more_own_visits(self):
        state, _ = _build_state()
        few = MCTSNode(state=state)
        many = MCTSNode(state=state)
        few.visits = 2
        few.wins = 1.0
        many.visits = 20
        many.wins = 10.0
        # Same win rate, same parent, but many-visits node has smaller bonus.
        uct_few = few.uct_value(parent_visits=50, exploration_constant=1.0)
        uct_many = many.uct_value(parent_visits=50, exploration_constant=1.0)
        assert uct_few > uct_many

    def test_best_child_selects_highest_uct(self):
        node = _fresh_node()
        state, _ = _build_state()
        c1 = node.add_child("Auditorium", state)
        c2 = node.add_child("Lab", state)
        node.visits = 10
        c1.visits = 2
        c1.wins = 2.0   # win_rate=1.0, bonus = C*sqrt(ln10/2)
        c2.visits = 8
        c2.wins = 0.0   # win_rate=0.0, bonus = C*sqrt(ln10/8)
        # c1 has higher win_rate AND more exploration bonus → must win
        assert node.best_child(math.sqrt(2)) is c1

    def test_best_child_raises_on_no_children(self):
        node = _fresh_node()
        with pytest.raises(ValueError):
            node.best_child(math.sqrt(2))


# ---------------------------------------------------------------------------
# Part 3 — MCTS phases via MctsAI
# ---------------------------------------------------------------------------


class TestMCTSPhases:

    def test_select_returns_unexpanded_root(self):
        state, agent = _build_state(iterations=1)
        root = MCTSNode(state=state)
        selected = agent._select(root)
        # Root has untried moves → selected immediately.
        assert selected is root

    def test_select_descends_when_fully_expanded(self):
        state, agent = _build_state(iterations=1)
        root = MCTSNode(state=state)
        child_state = agent._clone_state(state)
        child = root.add_child("Auditorium", child_state)
        root.untried_moves.clear()  # force fully-expanded
        root.visits = 10
        child.visits = 1
        child.wins = 1.0
        selected = agent._select(root)
        # Root is fully expanded + non-terminal → must descend to child.
        assert selected is child

    def test_expand_adds_exactly_one_child(self):
        state, agent = _build_state(iterations=1)
        root = MCTSNode(state=state)
        before = len(root.children)
        agent._expand(root)
        assert len(root.children) == before + 1

    def test_expand_removes_move_from_untried(self):
        state, agent = _build_state(iterations=1)
        root = MCTSNode(state=state)
        before_untried = len(root.untried_moves)
        agent._expand(root)
        assert len(root.untried_moves) == before_untried - 1

    def test_expand_child_has_correct_parent(self):
        state, agent = _build_state(iterations=1)
        root = MCTSNode(state=state)
        child = agent._expand(root)
        assert child.parent is root

    def test_expand_does_not_mutate_original_state(self):
        state, agent = _build_state(iterations=1)
        root = MCTSNode(state=state)
        original_turn = state.current_turn
        original_pos = state.players[0].position
        agent._expand(root)
        assert state.current_turn == original_turn
        assert state.players[0].position == original_pos

    def test_simulate_returns_float_in_unit_interval(self):
        state, agent = _build_state(iterations=1)
        reward = agent._simulate(state, our_player_idx=0)
        assert 0.0 <= reward <= 1.0

    def test_simulate_does_not_mutate_state(self):
        state, agent = _build_state(iterations=1)
        turn_before = state.current_turn
        pos_before = state.players[0].position
        agent._simulate(state, our_player_idx=0)
        assert state.current_turn == turn_before
        assert state.players[0].position == pos_before

    def test_backpropagate_updates_all_ancestors(self):
        state, agent = _build_state(iterations=1)
        root = MCTSNode(state=state)
        child_state = agent._clone_state(state)
        child = root.add_child("Auditorium", child_state)
        grandchild_state = agent._clone_state(child_state)
        grandchild = child.add_child("Lab", grandchild_state)

        agent._backpropagate(grandchild, reward=1.0)

        assert grandchild.visits == 1
        assert child.visits == 1
        assert root.visits == 1
        assert grandchild.wins == pytest.approx(1.0)
        assert child.wins == pytest.approx(1.0)
        assert root.wins == pytest.approx(1.0)

    def test_backpropagate_zero_reward(self):
        state, agent = _build_state(iterations=1)
        root = MCTSNode(state=state)
        agent._backpropagate(root, reward=0.0)
        assert root.visits == 1
        assert root.wins == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# Part 4 — Tree growth validation
# ---------------------------------------------------------------------------


class TestTreeGrowth:

    def test_root_visits_equals_iterations(self):
        state, agent = _build_state(iterations=10)
        root = agent._run_mcts(state, our_player_idx=0)
        assert root.visits == 10

    def test_more_iterations_produce_more_children(self):
        state1, _ = _build_state()
        state2, _ = _build_state()

        agent_few = MctsAI(iterations=4)
        agent_many = MctsAI(iterations=20)

        random.seed(1)
        root_few = agent_few._run_mcts(state1, our_player_idx=0)
        random.seed(1)
        root_many = agent_many._run_mcts(state2, our_player_idx=0)

        assert len(root_many.children) >= len(root_few.children)

    def test_all_root_children_visited_at_least_once(self):
        state, agent = _build_state(iterations=30)
        root = agent._run_mcts(state, our_player_idx=0)
        for child in root.children:
            assert child.visits >= 1

    def test_child_visits_sum_to_root_minus_root_own_expansion(self):
        """Total descendant visits ≤ root visits (root itself is also counted)."""
        state, agent = _build_state(iterations=15)
        root = agent._run_mcts(state, our_player_idx=0)
        child_visits = sum(c.visits for c in root.children)
        # root.visits counts the root's own updates; child visits ≤ root visits.
        assert child_visits <= root.visits

    def test_chosen_move_is_valid(self):
        state, agent = _build_state(iterations=8)
        valid = state.get_possible_moves()
        chosen = agent.choose_move(state, valid)
        assert chosen in valid or chosen is None


# ---------------------------------------------------------------------------
# Part 5 — BaseAI interface
# ---------------------------------------------------------------------------


class TestMctsAIInterface:

    def test_choose_move_returns_string(self):
        state, agent = _build_state(iterations=5)
        valid = state.get_possible_moves()
        move = agent.choose_move(state, valid)
        assert isinstance(move, str)

    def test_choose_move_returns_valid_move(self):
        state, agent = _build_state(iterations=5)
        valid = state.get_possible_moves()
        move = agent.choose_move(state, valid)
        assert move in valid

    def test_choose_move_raises_on_none_valid_moves(self):
        state, agent = _build_state(iterations=1)
        with pytest.raises(ValueError):
            agent.choose_move(state, None)

    def test_choose_move_returns_none_on_empty_moves(self):
        state, agent = _build_state(iterations=1)
        result = agent.choose_move(state, [])
        assert result is None

    def test_choose_move_single_move(self):
        state, agent = _build_state(iterations=3)
        result = agent.choose_move(state, ["Auditorium"])
        assert result == "Auditorium"

    def test_choose_move_does_not_mutate_state(self):
        state, agent = _build_state(iterations=4)
        valid = state.get_possible_moves()
        turn_before = state.current_turn
        agent.choose_move(state, valid)
        assert state.current_turn == turn_before

    def test_make_suggestion_returns_triple(self):
        state, agent = _build_state(iterations=1)
        agent._cache_notebook(state)
        s, w, loc = agent.make_suggestion(state)
        assert isinstance(s, str) and s
        assert isinstance(w, str) and w
        assert isinstance(loc, str) and loc

    def test_make_suggestion_location_is_player_position(self):
        state, agent = _build_state(iterations=1)
        player = state.players[0]
        player.move("Cafeteria")
        state.current_location = "Cafeteria"
        _, _, loc = agent.make_suggestion(state)
        assert loc == "Cafeteria"

    def test_make_suggestion_suspect_valid(self):
        state, agent = _build_state(iterations=1)
        s, _, _ = agent.make_suggestion(state)
        assert s in state.suspects

    def test_make_suggestion_weapon_valid(self):
        state, agent = _build_state(iterations=1)
        _, w, _ = agent.make_suggestion(state)
        assert w in state.weapons

    def test_decide_accusation_false_with_uniform_priors(self):
        state, agent = _build_state(iterations=1)
        result = agent.decide_accusation(state)
        assert result is False

    def test_decide_accusation_raises_on_none(self):
        agent = MctsAI(iterations=1)
        with pytest.raises(ValueError):
            agent.decide_accusation(None)

    def test_decide_accusation_returns_tuple_when_confident(self):
        state, agent = _build_state(iterations=1)
        agent._cache_notebook(state)
        nb = agent._last_notebook
        if nb is None:
            pytest.skip("No notebook")
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
        result = agent.decide_accusation(state)
        assert isinstance(result, tuple) and len(result) == 3

    def test_update_from_clue_eliminates_card(self):
        state, agent = _build_state(iterations=1)
        agent._cache_notebook(state)
        nb = agent._last_notebook
        if nb is None:
            pytest.skip("No notebook")
        remaining = sorted(nb.possible_suspects)
        if len(remaining) < 2:
            pytest.skip("Not enough suspects")
        target = remaining[1]
        agent.update_from_clue(SimpleNamespace(name=target))
        assert nb.suspects.get(target, 0.0) == 0.0

    def test_handle_no_reveal_boosts_notebook(self):
        state, agent = _build_state(iterations=1)
        agent._cache_notebook(state)
        nb = agent._last_notebook
        if nb is None:
            pytest.skip("No notebook")
        top_s = sorted(nb.possible_suspects)[0]
        top_w = sorted(nb.possible_weapons)[0]
        top_l = sorted(nb.possible_locations)[0]
        before = nb.suspects[top_s]
        sug = SimpleNamespace(suspect=top_s, weapon=top_w, location=top_l)
        agent.handle_no_reveal(sug)
        assert nb.suspects[top_s] > before or nb.weapons[top_w] > before


# ---------------------------------------------------------------------------
# Part 6 — Integration / stability
# ---------------------------------------------------------------------------


class TestIntegration:

    def test_full_game_completes_without_error(self):
        random.seed(77)
        state = GameState()
        for i in range(2):
            state.add_player(AIPlayer(f"P{i}", MctsAI(iterations=5)))
        state.setup_game()
        for p in state.players:
            p.move("Auditorium")
        winner = state.run_game(max_turns=30, verbose=False)
        assert winner is None or hasattr(winner, "name")

    def test_mcts_and_minimax_coexist(self):
        """MCTS and Minimax can play in the same game without error."""
        from ai.minimax_ai import MinimaxAI
        random.seed(55)
        state = GameState()
        state.add_player(AIPlayer("MCTS", MctsAI(iterations=4)))
        state.add_player(AIPlayer("MM", MinimaxAI(depth=2)))
        state.setup_game()
        for p in state.players:
            p.move("Auditorium")
        winner = state.run_game(max_turns=30, verbose=False)
        assert winner is None or hasattr(winner, "name")

    def test_repeated_games_no_state_leakage(self):
        """Running multiple games with the same agent object must not crash."""
        agent = MctsAI(iterations=3)
        for seed in range(3):
            random.seed(seed)
            state = GameState()
            state.add_player(AIPlayer("MCTS", agent))
            state.add_player(AIPlayer("Opp", MctsAI(iterations=1)))
            state.setup_game()
            for p in state.players:
                p.move("Auditorium")
            state.run_game(max_turns=20, verbose=False)
            # If _last_notebook leaked from the previous game, subsequent calls
            # would either crash or produce wrong decisions.  No exception = pass.

    def test_different_iterations_produce_trees_of_different_sizes(self):
        state1, _ = _build_state()
        state2, _ = _build_state()

        small = MctsAI(iterations=3)
        large = MctsAI(iterations=20)

        random.seed(0)
        root_small = small._run_mcts(state1, 0)
        random.seed(0)
        root_large = large._run_mcts(state2, 0)

        assert root_large.visits > root_small.visits

