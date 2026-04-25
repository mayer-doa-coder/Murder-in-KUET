extends Node

signal request_started(endpoint: String)
signal request_failed(endpoint: String, code: int, reason: String)
signal game_started(payload: Dictionary)
signal turn_processed(payload: Dictionary)
signal state_received(payload: Dictionary)

@export var base_url: String = "http://127.0.0.1:5000"

@onready var _http: HTTPRequest = HTTPRequest.new()
var _in_flight_endpoint: String = ""

func _ready() -> void:
	add_child(_http)
	_http.timeout = 15.0
	_http.request_completed.connect(_on_request_completed)

func start_game(players: Array[Dictionary]) -> void:
	var body := {"players": players}
	_send_json("/game/start", body)

func run_turn(session_id: String) -> void:
	var body := {"session_id": session_id}
	_send_json("/turn", body)

func fetch_state(session_id: String) -> void:
	if _in_flight_endpoint != "":
		emit_signal("request_failed", "/game/state", ERR_BUSY, "Another request is currently in progress")
		return
	var url := "%s/game/state?session_id=%s" % [base_url, session_id]
	_in_flight_endpoint = "/game/state"
	emit_signal("request_started", "/game/state")
	var err := _http.request(url, PackedStringArray(), HTTPClient.METHOD_GET)
	if err != OK:
		_in_flight_endpoint = ""
		emit_signal("request_failed", "/game/state", err, "Failed to dispatch HTTP request")

func _send_json(endpoint: String, payload: Dictionary) -> void:
	if _in_flight_endpoint != "":
		emit_signal("request_failed", endpoint, ERR_BUSY, "Another request is currently in progress")
		return
	var url := "%s%s" % [base_url, endpoint]
	var headers := PackedStringArray(["Content-Type: application/json"])
	_in_flight_endpoint = endpoint
	emit_signal("request_started", endpoint)
	var err := _http.request(url, headers, HTTPClient.METHOD_POST, JSON.stringify(payload))
	if err != OK:
		_in_flight_endpoint = ""
		emit_signal("request_failed", endpoint, err, "Failed to dispatch HTTP request")

func _on_request_completed(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	var endpoint: String = _in_flight_endpoint if _in_flight_endpoint != "" else "unknown"
	_in_flight_endpoint = ""
	var raw: String = body.get_string_from_utf8()
	var parsed: Variant = JSON.parse_string(raw)
	if typeof(parsed) != TYPE_DICTIONARY:
		emit_signal("request_failed", endpoint, response_code, "Invalid JSON payload")
		return

	var payload := parsed as Dictionary
	if response_code >= 400:
		emit_signal("request_failed", endpoint, response_code, str(payload.get("error", "Unknown error")))
		return

	if payload.has("session_id"):
		emit_signal("game_started", payload)
		return

	if payload.has("move") and payload.has("state"):
		emit_signal("turn_processed", payload)
		return

	if payload.has("state"):
		emit_signal("state_received", payload)
