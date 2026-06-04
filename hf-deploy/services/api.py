"""
api.py - Flask REST API for Murder in KUET.

Exposes:
    POST /game/start    — create a new session (AI + human players supported)
    POST /turn          — execute one turn; detects AI vs human automatically
    POST /human/turn    — submit human player's choices to advance their turn
    GET  /game/state    — inspect current state for a running session
    GET  /health        — liveness probe

Session mode (recommended):
    The client calls /game/start once, stores the returned session_id, then
    calls /turn for each turn.  The server holds the live GameState in memory.

    AI turn:  /turn executes immediately and returns the result.
    Human turn: /turn rolls dice, returns ``requires_human_input: true`` with
                valid_moves and card options.  The frontend presents choices to
                the player and then calls /human/turn with their selections.

Stateless mode (portable, AI-only):
    The client passes the full serialized state in every /turn call along with
    the hidden _solution.  No session_id is needed.
"""

import logging
import os as _os
import time
import uuid
from typing import Any

from flask import Flask, jsonify, request
from flask_cors import CORS

from ai.expectiminimax_ai import ExpectiminimaxAI
from ai.mcts_ai import MctsAI
from ai.minimax_ai import MinimaxAI
from ai.negamax_ai import NegamaxAI
from ai.random_ai import RandomAI
from ai.rule_based_ai import RuleBasedAI
from engine.game_state import GameState
from models.player import AIPlayer, HumanPlayer

# ── AI registry ───────────────────────────────────────────────────────────────
# Maps the string name Godot sends to the concrete AI class.  Extend this dict
# when new AI types are added to the engine.

AI_REGISTRY: dict[str, type] = {
    "MinimaxAI": MinimaxAI,
    "ExpectiminimaxAI": ExpectiminimaxAI,
    "NegamaxAI": NegamaxAI,
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

# Allow the Vercel frontend to call this API.
# Set ALLOWED_ORIGIN to your Vercel URL in the hosting platform's env vars.
_allowed_origin = _os.environ.get("ALLOWED_ORIGIN", "*")
CORS(app, origins=_allowed_origin)

# ── In-memory session store ───────────────────────────────────────────────────
# Maps session_id (str UUID) → {"state": GameState, "created_at": float}
# The solution is part of the live GameState object (state.solution) and is
# never sent to clients in any response.

_sessions: dict[str, dict[str, Any]] = {}

# Sessions older than this are eligible for cleanup.
_SESSION_TTL_SECONDS: int = 3600  # 1 hour


def _purge_expired_sessions() -> None:
    """Remove sessions that have been idle longer than _SESSION_TTL_SECONDS."""
    cutoff = time.monotonic() - _SESSION_TTL_SECONDS
    expired = [sid for sid, s in _sessions.items() if s.get("created_at", 0) < cutoff]
    for sid in expired:
        del _sessions[sid]
    if expired:
        logger.info("Purged %d expired session(s)", len(expired))

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
    """Return an error message string if the player config list is invalid.

    Each entry must have a non-empty ``name``.  AI players need a valid
    ``ai_type``; human players set ``is_human: true`` and omit ``ai_type``.
    """
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
        is_human = bool(cfg.get("is_human", False))
        if is_human:
            continue  # human players do not need an ai_type
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
    """Create a new game session with any mix of AI and human players.

    Request body (JSON):
    {
        "players": [
            {"name": "Alice",  "ai_type": "MinimaxAI"},
            {"name": "Bob",    "ai_type": "MctsAI"},
            {"name": "Charlie","is_human": true}
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
        name = cfg["name"].strip()
        if bool(cfg.get("is_human", False)):
            player = HumanPlayer(name)
        else:
            ai_type = cfg.get("ai_type", "RandomAI")
            agent = AI_REGISTRY[ai_type]()
            player = AIPlayer(name, agent)
        state.add_player(player)

    state.setup_game()

    _purge_expired_sessions()
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "state": state,
        "pending_human": None,
        "created_at": time.monotonic(),
    }

    human_count = sum(1 for p in state.players if not p.is_ai)
    logger.info(
        "Session created: %s | players=%s | human_players=%d",
        session_id,
        [p.name for p in state.players],
        human_count,
    )

    return jsonify({"session_id": session_id, "state": state.to_dict()}), 200


@app.route("/turn", methods=["POST"])
def turn():
    """Execute one turn, handling AI and human players automatically.

    Session mode: {"session_id": "<uuid>"}
      - AI turn: executes and returns full result.
      - Human turn: rolls dice, stores context, returns requires_human_input:true.
        Follow up with POST /human/turn to submit human choices.

    Stateless mode (AI-only):
      {"state": {...}, "_solution": {"suspect":"...","weapon":"...","location":"..."}}

    Error responses: 400 (bad input), 404 (session not found), 500 (engine fault).
    """
    body, err = _validate_json_body()
    if err:
        return err

    logger.info("POST /turn — keys=%s", sorted(body.keys()))

    # Session mode
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

        current_player = state.get_current_player()

        # Human turn: prepare context, store it, ask the frontend for input.
        # Guard: if a pending human turn already exists, reuse its dice so that
        # repeated calls (e.g. network retries) are idempotent and don't re-roll.
        if current_player is not None and not current_player.is_ai:
            if session.get("pending_human") is not None:
                pending = session["pending_human"]
                return jsonify({
                    "requires_human_input": True,
                    "player": current_player.name,
                    "dice": _serialize_dice(pending["dice"]),
                    "valid_moves": pending["valid_moves"],
                    "suspects": list(state.suspects),
                    "weapons": list(state.weapons),
                    "game_over": False,
                    "winner": None,
                    "state": state.to_dict(),
                }), 200

            context = state.get_human_turn_context()
            if not context:
                return jsonify({"error": "Could not prepare human turn context"}), 500

            session["pending_human"] = {
                "dice": context["dice"],
                "valid_moves": context["valid_moves"],
            }
            logger.info(
                "Human turn — session=%s player=%s dice=%d valid_moves=%s",
                session_id,
                context["player_name"],
                context["dice"].total,
                context["valid_moves"],
            )
            return jsonify({
                "requires_human_input": True,
                "player": context["player_name"],
                "dice": _serialize_dice(context["dice"]),
                "valid_moves": context["valid_moves"],
                "suspects": context["suspects"],
                "weapons": context["weapons"],
                "game_over": False,
                "winner": None,
                "state": state.to_dict(),
            }), 200

        # AI turn: execute normally.
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


@app.route("/human/turn", methods=["POST"])
def human_turn():
    """Submit a human player's choices to execute their pending turn.

    Must be called after /turn returned requires_human_input: true.

    Request body:
    {
        "session_id": "<uuid>",
        "move":    "<room_name>",     # null to stay in current room
        "suspect": "<suspect_name>",
        "weapon":  "<weapon_name>",
        "accuse":  false,             # true to make a final accusation
        "accusation": {               # required only when accuse is true
            "suspect":  "<name>",
            "weapon":   "<name>",
            "location": "<name>"
        }
    }

    Response (200):
    {
        "move":          "<location>" | null,
        "suggestion":    ["<suspect>", "<weapon>", "<location>"] | null,
        "revealer":      "<player_name>" | null,
        "revealed_card": "<card_name>" | null,
        "accusation":    {"suspect":"...","weapon":"...","location":"..."} | null,
        "dice":          {"die1": 3, "die2": 4, "total": 7},
        "game_over":     false,
        "winner":        null | "<player_name>",
        "state":         { ... }
    }

    Error responses: 400 (bad input / invalid move), 404 (session not found).
    """
    body, err = _validate_json_body()
    if err:
        return err

    session_id = body.get("session_id", "")
    if not isinstance(session_id, str) or not session_id.strip():
        return jsonify({"error": "session_id must be a non-empty string"}), 400

    session = _sessions.get(session_id.strip())
    if session is None:
        return jsonify({"error": f"Session '{session_id}' not found"}), 404

    state: GameState = session["state"]

    if state.game_over:
        winner_name = state.winner.name if state.winner else None
        return jsonify({
            "game_over": True,
            "winner": winner_name,
            "state": state.to_dict(),
        }), 200

    current_player = state.get_current_player()
    if current_player is None or current_player.is_ai:
        return jsonify({"error": "Current player is AI — use /turn instead"}), 400

    pending = session.get("pending_human")
    if pending is None:
        return jsonify({"error": "No pending human turn. Call /turn first to roll dice."}), 400

    move = body.get("move")
    suspect = body.get("suspect")
    weapon = body.get("weapon")
    accuse = bool(body.get("accuse", False))

    accusation_triple: tuple[str, str, str] | None = None
    if accuse:
        acc_data = body.get("accusation")
        if isinstance(acc_data, dict):
            s = acc_data.get("suspect", "")
            w = acc_data.get("weapon", "")
            loc = acc_data.get("location", "")
            if all(isinstance(x, str) and x.strip() for x in (s, w, loc)):
                accusation_triple = (s, w, loc)

    valid_moves: list[str] = pending["valid_moves"]
    if move is not None and move not in valid_moves:
        return jsonify({
            "error": f"Move '{move}' is not reachable this turn. Valid: {valid_moves}"
        }), 400

    if suspect is not None and suspect not in state.suspects:
        return jsonify({"error": f"'{suspect}' is not a valid suspect"}), 400
    if weapon is not None and weapon not in state.weapons:
        return jsonify({"error": f"'{weapon}' is not a valid weapon"}), 400

    dice_roll = pending["dice"]
    session["pending_human"] = None

    logger.info(
        "Human turn input — session=%s player=%s move=%s suspect=%s weapon=%s accuse=%s",
        session_id,
        current_player.name,
        move,
        suspect,
        weapon,
        accuse,
    )

    try:
        result = state.execute_human_turn(
            dice_roll=dice_roll,
            move=move,
            suspect=suspect,
            weapon=weapon,
            accuse=accuse,
            accusation_triple=accusation_triple,
        )
    except Exception as exc:
        logger.exception("Human turn execution failed for session %s", session_id)
        return jsonify({"error": f"Turn execution failed: {exc}"}), 500

    return jsonify({
        "move": result.get("move"),
        "suggestion": _serialize_suggestion(result.get("suggestion")),
        "revealer": result.get("revealer"),
        "revealed_card": result.get("revealed_card"),
        "accusation": _serialize_accusation(result.get("accusation")),
        "dice": _serialize_dice(result.get("dice")),
        "game_over": state.game_over,
        "winner": state.winner.name if state.winner else None,
        "state": state.to_dict(),
    }), 200


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
    import os
    port = int(os.environ.get("PORT", 5000))
    logger.info("Starting Murder-in-KUET API on http://0.0.0.0:%d", port)
    app.run(host="0.0.0.0", port=port, debug=False)
