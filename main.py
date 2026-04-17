"""Main entry point for Minimax AI integration and simulation checks."""

from ai.minimax_ai import GameState as MinimaxSearchState
from ai.minimax_ai import MinimaxAI
from engine.game_state import GameState
from engine.player import AIPlayer


def _run_minimax_ai_vs_ai_simulation() -> None:
    """Run a full Minimax-only simulation and validate integration behavior."""
    print("=" * 60)
    print("      Murder in KUET - Minimax AI Integration Test")
    print("=" * 60)

    game = GameState()

    # Assign Minimax AI to all test players (no human mixing).
    players = [
        AIPlayer("AI Player 1", MinimaxAI(depth=2)),
        AIPlayer("AI Player 2", MinimaxAI(depth=2)),
        AIPlayer("AI Player 3", MinimaxAI(depth=2)),
    ]

    for player in players:
        player.is_ai = True
        if player.ai_agent is None:
            raise ValueError(f"{player.name} missing ai_agent")
        game.add_player(player)

    game.setup_game()

    print("Players:", [p.name for p in game.players])
    print("All players AI:", all(p.is_ai and p.ai_agent is not None for p in game.players))

    # Edge case 1: no valid moves fallback should be safe.
    empty_move = players[0].ai_agent.choose_move(game, [])
    assert empty_move is None, "AI should return None when no valid moves exist"

    # Edge case 2: single remaining possibility in all categories should accuse.
    solved_state = MinimaxSearchState(
        players=[],
        current_player_index=0,
        notebook=None,
        possible_suspects={"Only Suspect"},
        possible_weapons={"Only Weapon"},
        possible_locations={"Only Location"},
        current_location="Only Location",
    )
    assert players[0].ai_agent.decide_accusation(solved_state) is True

    # Edge case 3: all eliminated safety should not crash.
    safety_game = GameState()
    safety_players = [
        AIPlayer("Safety A", MinimaxAI(depth=1)),
        AIPlayer("Safety B", MinimaxAI(depth=1)),
    ]
    for p in safety_players:
        safety_game.add_player(p)
        p.active = False
    assert safety_game.check_end_conditions() is True
    assert safety_game.game_over is True

    winner = game.run_game(max_turns=300, verbose=True)

    print("\n" + "=" * 60)
    if winner is not None:
        print(f"Winner: {winner.name}")
    else:
        print("Winner: None (turn cap reached)")
    print("Game Over:", game.game_over)
    print("Turns Played:", game.current_turn + 1)
    print("=" * 60)


def main() -> None:
    _run_minimax_ai_vs_ai_simulation()


if __name__ == "__main__":
    main()

