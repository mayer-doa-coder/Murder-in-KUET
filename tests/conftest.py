"""Shared pytest fixtures for Murder-in-KUET test suite.

Centralises the game-state builder previously duplicated across test modules
so every test file can import a ready-made GameState without repeating setup.
"""

from __future__ import annotations

import random

import pytest

from engine.game_state import GameState
from ai.mcts_ai import MctsAI
from models.player import AIPlayer


# ---------------------------------------------------------------------------
# Core builder (callable, not a fixture — import and call directly when needed)
# ---------------------------------------------------------------------------

def build_game_state(
    n_players: int = 2,
    mcts_iterations: int = 4,
    start_location: str = "Auditorium",
    seed: int = 0,
) -> tuple[GameState, MctsAI]:
    """Return a fully-initialised (state, agent) pair ready for testing.

    All players are placed at *start_location* so every game starts from a
    known, reproducible board position.
    """
    random.seed(seed)
    state = GameState()
    agent = MctsAI(iterations=mcts_iterations)
    for i in range(n_players):
        ai = MctsAI(iterations=1)
        state.add_player(AIPlayer(f"P{i}", ai))
    state.setup_game()
    for p in state.players:
        p.move(start_location)
    return state, agent


# ---------------------------------------------------------------------------
# Pytest fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def game_state() -> GameState:
    """Fresh 2-player GameState, both players at Auditorium."""
    state, _ = build_game_state()
    return state


@pytest.fixture
def game_state_and_agent() -> tuple[GameState, MctsAI]:
    """2-player GameState paired with a low-iteration MCTS agent."""
    return build_game_state()


# ---------------------------------------------------------------------------
# Flask / API fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    """Flask test client with rate-limiting disabled."""
    from services.api import app

    app.config["TESTING"] = True
    app.config["RATELIMIT_ENABLED"] = False
    with app.test_client() as c:
        yield c


@pytest.fixture(autouse=False)
def clean_sessions():
    """Clear the in-memory session store before and after each API test."""
    from services.api import _sessions
    _sessions.clear()
    yield
    _sessions.clear()
