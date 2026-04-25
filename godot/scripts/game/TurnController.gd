extends Node

signal turn_started(player_name: String)
signal turn_finished(player_name: String, result: Dictionary)

func run_ai_turn(session_id: String) -> void:
	ApiClient.run_turn(session_id)

func submit_human_turn(_session_id: String, _action_payload: Dictionary) -> void:
	# TODO: implement after backend supports human action endpoint.
	pass
