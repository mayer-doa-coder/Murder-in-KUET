extends Node

signal mode_changed(mode: String)
signal session_started(session_id: String)
signal state_updated(state: Dictionary)
signal game_ended(winner_name: String)

var game_mode: String = "AI_VS_AI"
var session_id: String = ""
var state_cache: Dictionary = {}
var players_config: Array[Dictionary] = []

func set_mode(new_mode: String) -> void:
	game_mode = new_mode
	emit_signal("mode_changed", game_mode)

func set_players(config: Array[Dictionary]) -> void:
	players_config = config.duplicate(true)

func set_session(id: String, initial_state: Dictionary) -> void:
	session_id = id
	state_cache = initial_state.duplicate(true)
	emit_signal("session_started", session_id)
	emit_signal("state_updated", state_cache)

func update_state(new_state: Dictionary) -> void:
	state_cache = new_state.duplicate(true)
	emit_signal("state_updated", state_cache)
	if state_cache.get("game_over", false):
		emit_signal("game_ended", str(state_cache.get("winner", "")))

func reset_session() -> void:
	session_id = ""
	state_cache.clear()
	players_config.clear()
