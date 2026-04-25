"""
api.py - Flask API bridge between the Python AI engine and the Godot frontend.

Exposes:
    POST /game/start   — create a new session with configured AI players
    POST /turn         — execute one AI turn (session mode or stateless mode)
    GET  /game/state   — inspect current state for a running session
    GET  /health       — liveness probe

Session mode (recommended):
    Godot calls /game/start once, stores the returned session_id, then calls
    /turn with that session_id for each turn.  The server holds the live
    GameState in memory between calls.

Stateless mode (portable):
    Godot passes the full serialized state in every /turn call along with
    the hidden _solution.  The server reconstructs, processes, and returns
    the updated state.  No session_id is needed.
"""

import logging
import uuid
from typing import Any

from flask import Flask, jsonify, request

from ai.expectiminimax_ai import ExpectiminimaxAI
from ai.mcts_ai import MctsAI
from ai.minimax_ai import MinimaxAI
from ai.monte_carlo_ai import MonteCarloAI
from ai.negamax_ai import NegamaxAI
from ai.random_ai import RandomAI
from ai.rule_based_ai import RuleBasedAI
from engine.game_state import GameState
from models.player import AIPlayer

# ── AI registry ───────────────────────────────────────────────────────────────
# Maps the string name Godot sends to the concrete AI class.  Extend this dict
# when new AI types are added to the engine.

AI_REGISTRY: dict[str, type] = {
    "MinimaxAI": MinimaxAI,
    "ExpectiminimaxAI": ExpectiminimaxAI,
    "NegamaxAI": NegamaxAI,
    "MonteCarloAI": MonteCarloAI,
    "MctsAI": MctsAI,
    "RandomAI": RandomAI,
    "RuleBasedAI": RuleBasedAI,
}

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── Flask application ─────────────────────────────────────────────────────────

app = Flask(__name__)

# ── In-memory session store ───────────────────────────────────────────────────
# Maps session_id (str UUID) → {"state": GameState}
# The solution is part of the live GameState object (state.solution) and is
# never sent to clients in any response.

_sessions: dict[str, dict[str, Any]] = {}

# ── Validation constants ──────────────────────────────────────────────────────

_REQUIRED_SOLUTION_KEYS = {"suspect", "weapon", "location"}
_MIN_PLAYERS = 2
_MAX_PLAYERS = 5


# ── Serialization helpers ─────────────────────────────────────────────────────


def _serialize_suggestion(suggestion) -> list[str] | None:
    """Convert a Suggestion object to a [suspect, weapon, location] list."""
    if suggestion is None:
        return None
    return [suggestion.suspect, suggestion.weapon, suggestion.location]


def _serialize_accusation(accusation) -> dict[str, str] | None:
    """Convert an Accusation object to a plain dict."""
    if accusation is None:
        return None
    return {
        "suspect": accusation.suspect,
        "weapon": accusation.weapon,
        "location": accusation.location,
    }


def _serialize_dice(dice_roll) -> dict[str, int] | None:
    if dice_roll is None:
        return None
    return {"die1": dice_roll.die1, "die2": dice_roll.die2, "total": dice_roll.total}


# ── Core processing ───────────────────────────────────────────────────────────


def process_turn(state: GameState) -> dict[str, Any]:
    """Execute one complete AI turn and return a structured result dictionary.

    Calls ``state.run_turn()`` which internally handles:
      - Dice roll and movement (``ai_agent.choose_move``)
      - Suggestion and clue revelation (``ai_agent.make_suggestion``)
      - Bayesian notebook updates
      - Accusation decision (``ai_agent.decide_accusation``)
      - Turn rotation (``state.next_turn()``)

    Args:
        state: Live GameState with the current AI player ready to act.

    Returns:
        dict with keys:
            move        (str | None)         — destination the AI moved to
            suggestion  (list[str] | None)   — [suspect, weapon, location]
            accusation  (dict | None)        — {suspect, weapon, location} or null
            state       (dict)               — full serialized updated state
    """
    current_player = state.get_current_player()
    player_name = current_player.name if current_player else "unknown"
    logger.info("Processing turn for player: %s", player_name)

    result = state.run_turn()

    move: str | None = None
    suggestion: list[str] | None = None
    accusation: dict[str, str] | None = None

    if result is not None:
        move = result.get("move")
        suggestion = _serialize_suggestion(result.get("suggestion"))
        accusation = _serialize_accusation(result.get("accusation"))

    logger.info(
        "Turn complete — player=%s | move=%s | suggestion=%s | accusation=%s",
        player_name,
        move,
        suggestion,
        accusation,
    )

    return {
        "move": move,
        "suggestion": suggestion,
        "accusation": accusation,
        "state": state.to_dict(),
    }


# ── Input validation helpers ──────────────────────────────────────────────────


def _validate_json_body() -> tuple[dict | None, Any]:
    """Parse and validate the request body as JSON.

    Returns:
        (body, error_response) — exactly one of them is None.
    """
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        logger.warning("Non-dict JSON body on %s", request.path)
        return None, (jsonify({"error": "Request body must be a JSON object"}), 400)
    return body, None


def _validate_player_configs(players_cfg: Any) -> str | None:
    """Return an error message string if the player config list is invalid."""
    if not isinstance(players_cfg, list):
        return "players must be a JSON array"
    if len(players_cfg) < _MIN_PLAYERS:
        return f"players must contain at least {_MIN_PLAYERS} entries"
    if len(players_cfg) > _MAX_PLAYERS:
        return f"players must contain at most {_MAX_PLAYERS} entries"
    for i, cfg in enumerate(players_cfg):
        if not isinstance(cfg, dict):
            return f"players[{i}] must be a JSON object"
        if not isinstance(cfg.get("name"), str) or not cfg["name"].strip():
            return f"players[{i}].name must be a non-empty string"
        ai_type = cfg.get("ai_type", "RandomAI")
        if ai_type not in AI_REGISTRY:
            valid = sorted(AI_REGISTRY)
            return f"players[{i}].ai_type '{ai_type}' is unknown. Valid: {valid}"
    return None


def _validate_solution(solution: Any) -> str | None:
    """Return an error message string if the solution dict is malformed."""
    if not isinstance(solution, dict):
        return "'_solution' must be a JSON object"
    missing = _REQUIRED_SOLUTION_KEYS - solution.keys()
    if missing:
        return f"'_solution' is missing keys: {sorted(missing)}"
    for key in _REQUIRED_SOLUTION_KEYS:
        if not isinstance(solution[key], str) or not solution[key].strip():
            return f"'_solution.{key}' must be a non-empty string"
    return None


# ── Routes ────────────────────────────────────────────────────────────────────


@app.route("/health", methods=["GET"])
def health():
    """Liveness probe — always returns 200 while the server is up."""
    return jsonify({"status": "ok", "sessions": len(_sessions)}), 200


@app.route("/game/start", methods=["POST"])
def game_start():
    """Create a new game session with the specified AI players.

    Request body (JSON):
    {
        "players": [
            {"name": "Alice", "ai_type": "MinimaxAI"},
            {"name": "Bob",   "ai_type": "MctsAI"},
            {"name": "Carol", "ai_type": "MonteCarloAI"}
        ]
    }

    Response (200):
    {
        "session_id": "<uuid>",
        "state": { ...GameState.to_dict()... }
    }

    Error responses: 400 for invalid input.
    """
    body, err = _validate_json_body()
    if err:
        return err

    players_cfg = body.get("players")
    validation_error = _validate_player_configs(players_cfg)
    if validation_error:
        logger.warning("/game/start validation failed: %s", validation_error)
        return jsonify({"error": validation_error}), 400

    state = GameState()
    for cfg in players_cfg:
        ai_type = cfg.get("ai_type", "RandomAI")
        agent = AI_REGISTRY[ai_type]()
        player = AIPlayer(cfg["name"].strip(), agent)
        state.add_player(player)

    state.setup_game()

    session_id = str(uuid.uuid4())
    _sessions[session_id] = {"state": state}

    logger.info(
        "Session created: %s | players=%s",
        session_id,
        [p.name for p in state.players],
    )

    return jsonify({"session_id": session_id, "state": state.to_dict()}), 200


@app.route("/turn", methods=["POST"])
def turn():
    """Execute one AI turn.

    Supports two modes determined by the request body:

    ── Session mode ────────────────────────────────────────────────────────────
    The server holds the live GameState.  Godot supplies only the session_id.

    Request body:
    {
        "session_id": "<uuid>"
    }

    ── Stateless mode ──────────────────────────────────────────────────────────
    Godot sends the full serialized state each request.  The server
    reconstructs the state, processes the turn, and returns the updated state.

    Request body:
    {
        "state": { ...GameState.to_dict() output... },
        "_solution": {
            "suspect":  "<name>",
            "weapon":   "<name>",
            "location": "<name>"
        }
    }

    ── Response (both modes, 200) ───────────────────────────────────────────────
    {
        "move":       "<location>" | null,
        "suggestion": ["<suspect>", "<weapon>", "<location>"] | null,
        "accusation": {"suspect": "...", "weapon": "...", "location": "..."} | null,
        "game_over":  false,
        "winner":     null | "<player name>",
        "state":      { ...GameState.to_dict()... }
    }

    Error responses: 400 (bad input), 404 (session not found), 500 (engine fault).
    """
    body, err = _validate_json_body()
    if err:
        return err

    logger.info("POST /turn — keys=%s", sorted(body.keys()))

    # ── Session mode ──────────────────────────────────────────────────────────
    if "session_id" in body:
        session_id = body["session_id"]
        if not isinstance(session_id, str) or not session_id.strip():
            return jsonify({"error": "session_id must be a non-empty string"}), 400

        session = _sessions.get(session_id.strip())
        if session is None:
            logger.warning("Session not found: %s", session_id)
            return jsonify({"error": f"Session '{session_id}' not found. Call /game/start first."}), 404

        state: GameState = session["state"]

        if state.game_over:
            winner_name = state.winner.name if state.winner else None
            logger.info("Session %s already over — winner=%s", session_id, winner_name)
            return jsonify({
                "move": None,
                "suggestion": None,
                "accusation": None,
                "game_over": True,
                "winner": winner_name,
                "state": state.to_dict(),
            }), 200

        try:
            response = process_turn(state)
        except Exception as exc:
            logger.exception("Turn processing failed for session %s", session_id)
            return jsonify({"error": f"Turn processing failed: {exc}"}), 500

        response["game_over"] = state.game_over
        response["winner"] = state.winner.name if state.winner else None
        return jsonify(response), 200

    # ── Stateless mode ────────────────────────────────────────────────────────
    state_data = body.get("state")
    if not isinstance(state_data, dict):
        return jsonify({
            "error": "Provide either 'session_id' (session mode) or 'state' + '_solution' (stateless mode)"
        }), 400

    solution = body.get("_solution")
    solution_error = _validate_solution(solution)
    if solution_error:
        logger.warning("/turn stateless validation failed: %s", solution_error)
        return jsonify({"error": solution_error}), 400

    # Inject solution so from_dict can restore accusation resolution.
    state_data["_solution"] = solution

    try:
        state = GameState.from_dict(state_data, ai_registry=AI_REGISTRY)
    except (KeyError, ValueError, TypeError) as exc:
        logger.exception("State reconstruction failed")
        return jsonify({"error": f"Invalid state data: {exc}"}), 400

    if state.game_over:
        winner_name = state.winner.name if state.winner else None
        return jsonify({
            "move": None,
            "suggestion": None,
            "accusation": None,
            "game_over": True,
            "winner": winner_name,
            "state": state.to_dict(),
        }), 200

    try:
        response = process_turn(state)
    except Exception as exc:
        logger.exception("Turn processing failed (stateless mode)")
        return jsonify({"error": f"Turn processing failed: {exc}"}), 500

    response["game_over"] = state.game_over
    response["winner"] = state.winner.name if state.winner else None
    return jsonify(response), 200


@app.route("/game/state", methods=["GET"])
def game_state_endpoint():
    """Return the current serialized state for a session (read-only).

    Query parameter: ?session_id=<uuid>

    Response (200):
    {
        "state": { ...GameState.to_dict()... }
    }

    Error responses: 400 (missing param), 404 (session not found).
    """
    session_id = request.args.get("session_id", "").strip()
    if not session_id:
        return jsonify({"error": "session_id query parameter is required"}), 400

    session = _sessions.get(session_id)
    if session is None:
        return jsonify({"error": f"Session '{session_id}' not found"}), 404

    return jsonify({"state": session["state"].to_dict()}), 200


# ── Global error handlers ─────────────────────────────────────────────────────


@app.errorhandler(404)
def not_found(_exc):
    logger.warning("404: %s %s", request.method, request.path)
    return jsonify({"error": f"Endpoint '{request.path}' not found"}), 404


@app.errorhandler(405)
def method_not_allowed(_exc):
    return jsonify({"error": f"Method '{request.method}' not allowed on '{request.path}'"}), 405


@app.errorhandler(500)
def internal_error(_exc):
    logger.exception("Unhandled 500 on %s %s", request.method, request.path)
    return jsonify({"error": "Internal server error"}), 500


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info("Starting Murder-in-KUET API on http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=False)
