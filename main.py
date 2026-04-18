"""Main entry point for AI performance comparison simulations."""

import logging
import random
from time import perf_counter

from ai.expectiminimax_ai import ExpectiminimaxAI
from ai.minimax_ai import MinimaxAI
from ai.negamax_ai import NegamaxAI
from config.settings import AI_CONFIG, GAME_CONFIG, get_positive_int
from engine.game_state import GameState
from models.player import AIPlayer
from utils.logger import setup_logger


logger = logging.getLogger(__name__)


class InstrumentedAI:
    """Thin wrapper that tracks AI decision timing and counts per agent."""

    def __init__(self, agent, metrics: dict[str, dict[str, float]]) -> None:
        self._agent = agent
        self._metrics = metrics
        self._name = type(agent).__name__

    def _measure(self, method_name: str, *args, **kwargs):
        start_time = perf_counter()
        method = getattr(self._agent, method_name)
        result = method(*args, **kwargs)
        elapsed = perf_counter() - start_time

        self._metrics[self._name]["decision_time"] += elapsed
        self._metrics[self._name]["decisions"] += 1
        if method_name == "choose_move":
            self._metrics[self._name]["total_moves"] += 1

        return result

    def choose_move(self, state, valid_moves):
        return self._measure("choose_move", state, valid_moves)

    def make_suggestion(self, state):
        return self._measure("make_suggestion", state)

    def decide_accusation(self, state):
        return self._measure("decide_accusation", state)

    def update_from_clue(self, card) -> None:
        if hasattr(self._agent, "update_from_clue"):
            self._agent.update_from_clue(card)

    def handle_no_reveal(self, suggestion) -> None:
        if hasattr(self._agent, "handle_no_reveal"):
            self._agent.handle_no_reveal(suggestion)


def _create_metrics() -> dict[str, dict[str, float]]:
    """Create metrics structure for all AI variants."""
    return {
        "MinimaxAI": {
            "wins": 0,
            "total_moves": 0,
            "decision_time": 0.0,
            "decisions": 0,
        },
        "ExpectiminimaxAI": {
            "wins": 0,
            "total_moves": 0,
            "decision_time": 0.0,
            "decisions": 0,
        },
        "NegamaxAI": {
            "wins": 0,
            "total_moves": 0,
            "decision_time": 0.0,
            "decisions": 0,
        },
    }


def _create_comparison_players(
    metrics: dict[str, dict[str, float]],
    max_players: int,
) -> list[AIPlayer]:
    """Create fair mixed-agent lineup for comparison runs."""
    agents = [
        ("AI Player 1", MinimaxAI(depth=AI_CONFIG.get("MINIMAX_DEPTH"))),
        (
            "AI Player 2",
            ExpectiminimaxAI(depth=AI_CONFIG.get("EXPECTIMINIMAX_DEPTH")),
        ),
        ("AI Player 3", NegamaxAI(depth=AI_CONFIG.get("NEGAMAX_DEPTH"))),
    ]

    slots = min(max(1, max_players), len(agents))
    players = [
        AIPlayer(name, InstrumentedAI(agent, metrics))
        for name, agent in agents[:slots]
    ]

    for player in players:
        player.is_ai = True
        if player.ai_agent is None:
            logger.error("%s missing ai_agent", player.name)
            raise ValueError(f"{player.name} missing ai_agent")

    return players


def _run_ai_performance_comparison() -> None:
    """Run multi-game AI performance comparison with metrics reporting."""
    num_games = get_positive_int(GAME_CONFIG, "SIMULATION_RUNS", 10)
    max_turns = get_positive_int(GAME_CONFIG, "MAX_TURNS", 250)
    max_players = get_positive_int(GAME_CONFIG, "MAX_PLAYERS", 3)
    base_seed = get_positive_int(GAME_CONFIG, "BASE_RANDOM_SEED", 2026)
    metrics = _create_metrics()
    no_winner_games = 0
    game_runtime_seconds = 0.0

    logger.info("=" * 68)
    logger.info(" Murder in KUET - Minimax vs Expectiminimax vs Negamax Metrics")
    logger.info("=" * 68)

    for i in range(num_games):
        logger.info("=== Game %s ===", i + 1)

        # Deterministic per-game seed keeps runs reproducible while varied.
        random.seed(base_seed + i)

        game = GameState()
        players = _create_comparison_players(metrics, max_players=max_players)
        for player in players:
            game.add_player(player)
        game.setup_game()

        run_start = perf_counter()
        winner = game.run_game(max_turns=max_turns, verbose=(i == 0))
        game_runtime_seconds += perf_counter() - run_start

        if winner is None:
            no_winner_games += 1
            logger.warning("Winner: None (turn cap reached)")
        else:
            winner_name = type(winner.ai_agent._agent).__name__
            metrics[winner_name]["wins"] += 1
            logger.info("Winner: %s (%s)", winner.name, winner_name)

    logger.info("=" * 68)
    logger.info("Final Performance Summary")
    logger.info("=" * 68)

    for ai_name, data in metrics.items():
        avg_moves = data["total_moves"] / num_games
        avg_time = data["decision_time"] / max(data["decisions"], 1)
        win_rate = (data["wins"] / num_games) * 100.0

        logger.info("%s:", ai_name)
        logger.info("Wins: %s", int(data["wins"]))
        logger.info("Win Rate: %.1f%%", win_rate)
        logger.info("Average Moves: %.2f", avg_moves)
        logger.info("Average Decision Time: %.5f sec", avg_time)

    logger.info("No-Winner Games: %s", no_winner_games)
    logger.info("Average Game Runtime: %.4f sec", game_runtime_seconds / num_games)
    logger.info("=" * 68)


def main() -> None:
    setup_logger()
    _run_ai_performance_comparison()


if __name__ == "__main__":
    main()

