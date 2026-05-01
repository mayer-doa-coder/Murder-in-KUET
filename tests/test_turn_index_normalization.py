from ai.random_ai import RandomAI
from engine.game_state import GameState
from models.player import AIPlayer


def test_run_turn_normalizes_large_current_turn_index() -> None:
    state = GameState()
    state.add_player(AIPlayer("AI 1", RandomAI()))
    state.add_player(AIPlayer("AI 2", RandomAI()))
    state.setup_game()

    # Simulate a deserialized/advanced state where turn index drifted high.
    state.current_turn = 999

    result = state.run_turn()
    assert result is not None
