"""Main entry point for AI comparison simulations."""

from ai.minimax_ai import GameState as MinimaxSearchState
from ai.expectiminimax_ai import ExpectiminimaxAI
from ai.minimax_ai import MinimaxAI
from engine.game_state import GameState
from engine.player import AIPlayer


def _create_comparison_players(depth: int = 2) -> list[AIPlayer]:
    """Create a fair mixed-agent lineup for comparison runs."""
    players = [
        AIPlayer("AI Player 1", MinimaxAI(depth=depth)),
        AIPlayer("AI Player 2", ExpectiminimaxAI(depth=depth)),
        AIPlayer("AI Player 3", MinimaxAI(depth=depth)),
    ]

    for player in players:
        player.is_ai = True
        if player.ai_agent is None:
            raise ValueError(f"{player.name} missing ai_agent")

    return players


def _run_ai_comparison_simulation() -> None:
    """Run mixed Minimax vs Expectiminimax integration and comparison tests."""
    print("=" * 60)
    print("   Murder in KUET - Minimax vs Expectiminimax Comparison")
    print("=" * 60)

    # Primary visible run with detailed logs.
    game = GameState()
    players = _create_comparison_players(depth=2)
    for player in players:
        game.add_player(player)

    game.setup_game()

    print("Players:", [f"{p.name}:{type(p.ai_agent).__name__}" for p in game.players])
    print("All players AI:", all(p.is_ai and p.ai_agent is not None for p in game.players))

    # Edge case 1: no valid moves fallback should be safe for all agents.
    empty_move = players[0].ai_agent.choose_move(game, [])
    assert empty_move is None, "AI should return None when no valid moves exist"
    empty_move_expecti = players[1].ai_agent.choose_move(game, [])
    assert empty_move_expecti is None, "Expectiminimax should return None when no valid moves exist"

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
    assert players[1].ai_agent.decide_accusation(solved_state) is True

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

    winner = game.run_game(max_turns=250, verbose=True)

    # Batch comparison observation across multiple simulations.
    comparison_runs = 8
    wins_by_agent: dict[str, int] = {}
    for _ in range(comparison_runs):
        sim_game = GameState()
        sim_players = _create_comparison_players(depth=2)
        for p in sim_players:
            sim_game.add_player(p)
        sim_game.setup_game()

        sim_winner = sim_game.run_game(max_turns=250, verbose=False)
        if sim_winner is None:
            wins_by_agent["NoWinner"] = wins_by_agent.get("NoWinner", 0) + 1
        else:
            agent_name = type(sim_winner.ai_agent).__name__
            wins_by_agent[agent_name] = wins_by_agent.get(agent_name, 0) + 1

    print("\n" + "=" * 60)
    if winner is not None:
        print(f"Winner: {winner.name} ({type(winner.ai_agent).__name__})")
    else:
        print("Winner: None (turn cap reached)")
    print("Game Over:", game.game_over)
    print("Current Turn Index:", game.current_turn)
    print("Comparison Wins:", wins_by_agent)
    print("=" * 60)


def main() -> None:
    _run_ai_comparison_simulation()


if __name__ == "__main__":
    main()

