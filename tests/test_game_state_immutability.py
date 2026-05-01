"""Immutability checks for GameState simulation helpers."""

from engine.game_state import GameState
from models.player import AIPlayer
from ai.random_ai import RandomAI


def _build_state() -> GameState:
    state = GameState()
    player = AIPlayer("AI Player", RandomAI())
    opponent = AIPlayer("AI Opponent", RandomAI())
    state.add_player(player)
    state.add_player(opponent)
    state.setup_game()
    player.move("Auditorium")
    return state


def test_simulate_move_returns_new_state_instance() -> None:
    state = _build_state()
    old_state = state
    new_state = state.simulate_move("Student Welfare Center")

    assert old_state is not new_state
    assert old_state.current_player.position == "Auditorium"
    assert new_state.current_player.position == "Student Welfare Center"


def test_invalid_move_returns_clone_without_mutation() -> None:
    state = _build_state()
    old_state = state
    new_state = state.simulate_move("__INVALID__")

    assert old_state is not new_state
    assert old_state.current_player.position == "Auditorium"
    assert new_state.current_player.position == "Auditorium"
