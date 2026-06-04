"""Tests for all 5 Flask endpoints, session mode, stateless mode, TTL purge."""

from __future__ import annotations

import time
import uuid

import pytest

from services.api import app, _sessions, _purge_expired_sessions, _SESSION_TTL_SECONDS


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _clear_sessions():
    """Wipe the session store before/after every test for isolation."""
    _sessions.clear()
    yield
    _sessions.clear()


@pytest.fixture
def client():
    from services.api import limiter
    app.config["TESTING"] = True
    limiter.enabled = False
    with app.test_client() as c:
        yield c
    limiter.enabled = True


# ── Payload builders ──────────────────────────────────────────────────────────

def _start_payload(n: int = 2, ai_type: str = "RandomAI") -> dict:
    return {"players": [{"name": f"P{i}", "ai_type": ai_type} for i in range(n)]}


def _start_session(client) -> str:
    """Create a session and return its id."""
    rv = client.post("/game/start", json=_start_payload())
    assert rv.status_code == 200
    return rv.get_json()["session_id"]


# ---------------------------------------------------------------------------
# 1 — GET /health
# ---------------------------------------------------------------------------

class TestHealth:

    def test_returns_200(self, client):
        assert client.get("/health").status_code == 200

    def test_status_ok(self, client):
        data = client.get("/health").get_json()
        assert data["status"] == "ok"

    def test_shows_session_count(self, client):
        data = client.get("/health").get_json()
        assert "sessions" in data

    def test_session_count_increments_after_start(self, client):
        before = client.get("/health").get_json()["sessions"]
        _start_session(client)
        after = client.get("/health").get_json()["sessions"]
        assert after == before + 1


# ---------------------------------------------------------------------------
# 2 — POST /game/start
# ---------------------------------------------------------------------------

class TestGameStart:

    def test_valid_payload_returns_200(self, client):
        assert client.post("/game/start", json=_start_payload()).status_code == 200

    def test_response_contains_session_id(self, client):
        data = client.post("/game/start", json=_start_payload()).get_json()
        assert "session_id" in data

    def test_response_contains_state(self, client):
        data = client.post("/game/start", json=_start_payload()).get_json()
        assert "state" in data

    def test_with_human_player_accepted(self, client):
        payload = {"players": [
            {"name": "Alice", "ai_type": "RandomAI"},
            {"name": "Bob",   "is_human": True},
        ]}
        assert client.post("/game/start", json=payload).status_code == 200

    def test_too_few_players_returns_400(self, client):
        payload = {"players": [{"name": "Solo", "ai_type": "RandomAI"}]}
        assert client.post("/game/start", json=payload).status_code == 400

    def test_too_many_players_returns_400(self, client):
        payload = {"players": [{"name": f"P{i}", "ai_type": "RandomAI"} for i in range(6)]}
        assert client.post("/game/start", json=payload).status_code == 400

    def test_unknown_ai_type_returns_400(self, client):
        payload = {"players": [
            {"name": "A", "ai_type": "GhostAI"},
            {"name": "B", "ai_type": "RandomAI"},
        ]}
        rv = client.post("/game/start", json=payload)
        assert rv.status_code == 400

    def test_missing_name_returns_400(self, client):
        payload = {"players": [
            {"ai_type": "RandomAI"},
            {"name": "B", "ai_type": "RandomAI"},
        ]}
        assert client.post("/game/start", json=payload).status_code == 400

    def test_non_json_body_returns_400(self, client):
        rv = client.post("/game/start", data="not-json", content_type="text/plain")
        assert rv.status_code == 400

    def test_all_six_ai_types_accepted(self, client):
        for ai_type in ("RandomAI", "RuleBasedAI", "MinimaxAI",
                        "ExpectiminimaxAI", "NegamaxAI", "MctsAI"):
            payload = {"players": [
                {"name": "A", "ai_type": ai_type},
                {"name": "B", "ai_type": "RandomAI"},
            ]}
            rv = client.post("/game/start", json=payload)
            assert rv.status_code == 200, f"Failed for {ai_type}"


# ---------------------------------------------------------------------------
# 3 — POST /turn  (session mode)
# ---------------------------------------------------------------------------

class TestTurnSession:

    def test_ai_turn_returns_200(self, client):
        sid = _start_session(client)
        rv = client.post("/turn", json={"session_id": sid})
        assert rv.status_code == 200

    def test_ai_turn_response_has_move_key(self, client):
        sid = _start_session(client)
        data = client.post("/turn", json={"session_id": sid}).get_json()
        assert "move" in data

    def test_ai_turn_response_has_state(self, client):
        sid = _start_session(client)
        data = client.post("/turn", json={"session_id": sid}).get_json()
        assert "state" in data

    def test_missing_session_returns_404(self, client):
        rv = client.post("/turn", json={"session_id": str(uuid.uuid4())})
        assert rv.status_code == 404

    def test_empty_session_id_returns_400(self, client):
        rv = client.post("/turn", json={"session_id": ""})
        assert rv.status_code == 400

    def test_game_over_session_returns_200_with_flag(self, client):
        sid = _start_session(client)
        _sessions[sid]["state"].game_over = True
        rv = client.post("/turn", json={"session_id": sid})
        assert rv.status_code == 200
        assert rv.get_json()["game_over"] is True


# ---------------------------------------------------------------------------
# 4 — POST /turn  (stateless mode)
# ---------------------------------------------------------------------------

class TestTurnStateless:

    def _get_state_dict(self, client) -> dict:
        sid = _start_session(client)
        return _sessions[sid]["state"].to_dict()

    def _valid_solution(self, client, sid) -> dict:
        sol = _sessions[sid]["state"].solution
        return sol

    def test_stateless_ai_turn_returns_200(self, client):
        sid = _start_session(client)
        state_dict = _sessions[sid]["state"].to_dict()
        solution   = _sessions[sid]["state"].solution
        rv = client.post("/turn", json={"state": state_dict, "_solution": solution})
        assert rv.status_code == 200

    def test_stateless_missing_solution_returns_400(self, client):
        state_dict = self._get_state_dict(client)
        rv = client.post("/turn", json={"state": state_dict})
        assert rv.status_code == 400

    def test_stateless_bad_solution_keys_returns_400(self, client):
        sid = _start_session(client)
        state_dict = _sessions[sid]["state"].to_dict()
        rv = client.post("/turn", json={
            "state": state_dict,
            "_solution": {"suspect": "X"},  # missing weapon + location
        })
        assert rv.status_code == 400

    def test_stateless_no_state_or_session_returns_400(self, client):
        rv = client.post("/turn", json={"irrelevant": True})
        assert rv.status_code == 400


# ---------------------------------------------------------------------------
# 5 — GET /game/state
# ---------------------------------------------------------------------------

class TestGameStateEndpoint:

    def test_returns_200_for_valid_session(self, client):
        sid = _start_session(client)
        rv = client.get(f"/game/state?session_id={sid}")
        assert rv.status_code == 200

    def test_response_contains_state(self, client):
        sid = _start_session(client)
        data = client.get(f"/game/state?session_id={sid}").get_json()
        assert "state" in data

    def test_missing_session_returns_404(self, client):
        rv = client.get(f"/game/state?session_id={uuid.uuid4()}")
        assert rv.status_code == 404

    def test_missing_param_returns_400(self, client):
        rv = client.get("/game/state")
        assert rv.status_code == 400


# ---------------------------------------------------------------------------
# 6 — POST /human/turn
# ---------------------------------------------------------------------------

class TestHumanTurn:

    def test_no_pending_turn_returns_400(self, client):
        """Calling /human/turn without first calling /turn returns 400."""
        # Create a session with a human player.
        payload = {"players": [
            {"name": "Human", "is_human": True},
            {"name": "AI",    "ai_type": "RandomAI"},
        ]}
        sid = client.post("/game/start", json=payload).get_json()["session_id"]
        rv = client.post("/human/turn", json={"session_id": sid, "move": None})
        assert rv.status_code == 400

    def test_missing_session_returns_404(self, client):
        rv = client.post("/human/turn", json={
            "session_id": str(uuid.uuid4()),
            "move": None,
        })
        assert rv.status_code == 404

    def test_ai_only_session_returns_400(self, client):
        """Posting to /human/turn when current player is AI must return 400."""
        sid = _start_session(client)
        rv = client.post("/human/turn", json={"session_id": sid})
        assert rv.status_code == 400


# ---------------------------------------------------------------------------
# 7 — TTL purge
# ---------------------------------------------------------------------------

class TestTTLPurge:

    def test_purge_removes_expired_sessions(self, client):
        sid = _start_session(client)
        # Back-date the session's created_at past the TTL.
        _sessions[sid]["created_at"] = time.monotonic() - _SESSION_TTL_SECONDS - 1
        _purge_expired_sessions()
        assert sid not in _sessions

    def test_purge_keeps_fresh_sessions(self, client):
        sid = _start_session(client)
        _purge_expired_sessions()
        assert sid in _sessions

    def test_purge_selective(self, client):
        # Create two sessions; expire only the first one.
        sid1 = _start_session(client)
        sid2 = _start_session(client)
        _sessions[sid1]["created_at"] = time.monotonic() - _SESSION_TTL_SECONDS - 1
        _purge_expired_sessions()
        assert sid1 not in _sessions
        assert sid2 in _sessions


# ---------------------------------------------------------------------------
# 8 — Error handlers
# ---------------------------------------------------------------------------

class TestErrorHandlers:

    def test_unknown_endpoint_returns_404(self, client):
        rv = client.get("/no/such/route")
        assert rv.status_code == 404

    def test_wrong_method_returns_405(self, client):
        rv = client.get("/game/start")   # defined only for POST
        assert rv.status_code == 405
