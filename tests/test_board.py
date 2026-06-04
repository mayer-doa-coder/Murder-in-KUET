"""Tests for Board: get_valid_moves, passages, pathfinding, costs."""

from __future__ import annotations

import pytest

from engine.board import Board


ALL_LOCATIONS = [
    "Auditorium",
    "Student Welfare Center",
    "Amar Ekushey Hall",
    "Cafeteria",
    "Central Field",
    "IT Park",
    "Begum Rokeya Hall",
    "Lotus Pond",
    "Pocket Gate",
]


@pytest.fixture
def board() -> Board:
    return Board()


# ---------------------------------------------------------------------------
# 1 — Graph structure
# ---------------------------------------------------------------------------

class TestStructure:

    def test_all_nine_locations_present(self, board):
        assert set(board.get_all_locations()) == set(ALL_LOCATIONS)

    def test_connected_neighbors(self, board):
        assert "Lotus Pond" in board.get_neighbors("Auditorium")
        assert "Student Welfare Center" in board.get_neighbors("Auditorium")

    def test_is_connected_direct_edge(self, board):
        assert board.is_connected("Auditorium", "Lotus Pond") is True

    def test_is_connected_no_direct_edge(self, board):
        assert board.is_connected("Auditorium", "Pocket Gate") is False

    def test_isolated_node_has_no_neighbors_in_passages(self, board):
        # Central Field has no passage; passages dict should not list it.
        assert board.get_passage_destination("Central Field") is None


# ---------------------------------------------------------------------------
# 2 — get_valid_moves
# ---------------------------------------------------------------------------

class TestGetValidMoves:

    def test_zero_steps_returns_empty(self, board):
        assert board.get_valid_moves("Auditorium", steps=0) == []

    def test_excludes_starting_room(self, board):
        moves = board.get_valid_moves("Auditorium", steps=4)
        assert "Auditorium" not in moves

    def test_adjacent_room_reachable_with_exact_steps(self, board):
        # Auditorium → Lotus Pond costs 2 squares.
        moves = board.get_valid_moves("Auditorium", steps=2)
        assert "Lotus Pond" in moves

    def test_room_too_far_not_returned(self, board):
        # Student Welfare Center costs 4 from Auditorium; budget of 2 is insufficient.
        moves = board.get_valid_moves("Auditorium", steps=2)
        assert "Student Welfare Center" not in moves

    def test_multiple_rooms_with_larger_budget(self, board):
        # With 4 steps, both Lotus Pond (2) and SWC (4) should be reachable.
        moves = board.get_valid_moves("Auditorium", steps=4)
        assert "Lotus Pond" in moves
        assert "Student Welfare Center" in moves

    def test_unknown_start_returns_empty(self, board):
        assert board.get_valid_moves("NoSuchRoom", steps=10) == []

    def test_central_field_pocket_gate_within_two_steps(self, board):
        # Central Field → Pocket Gate costs exactly 2.
        moves = board.get_valid_moves("Central Field", steps=2)
        assert "Pocket Gate" in moves


# ---------------------------------------------------------------------------
# 3 — Secret passages
# ---------------------------------------------------------------------------

class TestPassages:

    def test_auditorium_passage_to_pocket_gate(self, board):
        assert board.get_passage_destination("Auditorium") == "Pocket Gate"

    def test_pocket_gate_passage_to_auditorium(self, board):
        assert board.get_passage_destination("Pocket Gate") == "Auditorium"

    def test_lotus_pond_passage_to_begum_rokeya(self, board):
        assert board.get_passage_destination("Lotus Pond") == "Begum Rokeya Hall"

    def test_begum_rokeya_passage_to_lotus_pond(self, board):
        assert board.get_passage_destination("Begum Rokeya Hall") == "Lotus Pond"

    def test_passage_from_non_passage_room_is_none(self, board):
        assert board.get_passage_destination("Cafeteria") is None


# ---------------------------------------------------------------------------
# 4 — Shortest paths and costs
# ---------------------------------------------------------------------------

class TestPathfinding:

    def test_shortest_path_exists(self, board):
        path = board.shortest_path("Auditorium", "Pocket Gate")
        assert path[0] == "Auditorium"
        assert path[-1] == "Pocket Gate"

    def test_shortest_path_cost_same_room_is_zero(self, board):
        assert board.get_shortest_path_cost("Auditorium", "Auditorium") == 0

    def test_shortest_path_cost_direct_edge(self, board):
        # Auditorium → Lotus Pond has weight 2.
        assert board.get_shortest_path_cost("Auditorium", "Lotus Pond") == 2

    def test_shortest_path_cost_unknown_room_returns_sentinel(self, board):
        assert board.get_shortest_path_cost("Auditorium", "NoRoom") == 999
