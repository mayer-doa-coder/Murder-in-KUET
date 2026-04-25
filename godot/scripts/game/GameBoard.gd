extends Node2D

@onready var board_sprite: Sprite2D = %BoardBackground
@onready var room_anchors: Node2D = %RoomAnchors
@onready var tokens_layer: Node2D = %PlayerTokens
@onready var hud: Control = %HUD
@onready var turn_log: RichTextLabel = %TurnLog
@onready var card_panel: Control = %CardPanel

var room_positions: Dictionary = {}
var token_nodes: Dictionary = {}
var _player_colors: Dictionary = {}
var _turn_in_flight: bool = false
var _palette: Array[Color] = [
	Color("#e4572e"),
	Color("#4d9de0"),
	Color("#17bebb"),
	Color("#ffc914"),
	Color("#9c89b8"),
]

func _ready() -> void:
	_assign_board_texture()
	_load_room_positions()
	_connect_signals()
	if hud.has_method("set_ai_mode"):
		hud.call("set_ai_mode", true)
	if card_panel.has_method("set_title"):
		card_panel.call("set_title", "Latest Suggestion")
	_start_match()

func _assign_board_texture() -> void:
	var texture := load("res://assets/board.png") as Texture2D
	if texture != null:
		board_sprite.texture = texture

func _load_room_positions() -> void:
	var path: String = "res://data/board_layout.json"
	if not FileAccess.file_exists(path):
		return
	var file: FileAccess = FileAccess.open(path, FileAccess.READ)
	if file == null:
		return
	var data = JSON.parse_string(file.get_as_text())
	if typeof(data) == TYPE_DICTIONARY:
		room_positions = data

func _connect_signals() -> void:
	if not ApiClient.game_started.is_connected(_on_game_started):
		ApiClient.game_started.connect(_on_game_started)
	if not ApiClient.turn_processed.is_connected(_on_turn_processed):
		ApiClient.turn_processed.connect(_on_turn_processed)
	if not ApiClient.request_failed.is_connected(_on_request_failed):
		ApiClient.request_failed.connect(_on_request_failed)
	if not GameSession.game_ended.is_connected(_on_game_ended):
		GameSession.game_ended.connect(_on_game_ended)

func _start_match() -> void:
	var players: Array = GameSession.players_config.duplicate(true)
	if players.is_empty():
		players = [
			{"name": "MctsAI", "ai_type": "MctsAI"},
			{"name": "ExpectiminimaxAI", "ai_type": "ExpectiminimaxAI"},
			{"name": "RuleBasedAI", "ai_type": "RuleBasedAI"},
			{"name": "MonteCarloAI", "ai_type": "MonteCarloAI"},
		]
		GameSession.set_players(players)
	turn_log.clear()
	turn_log.append_text("Starting AI vs AI match...\n")
	hud.call("set_status", "Starting match...")
	ApiClient.start_game(GameSession.players_config)

func _on_game_started(payload: Dictionary) -> void:
	var sid := str(payload.get("session_id", ""))
	var state: Dictionary = payload.get("state", {}) as Dictionary
	if sid.is_empty() or state.is_empty():
		_on_request_failed("/game/start", ERR_INVALID_DATA, "Missing session_id or state")
		return
	GameSession.set_session(sid, state)
	_render_state(state)
	_process_next_turn_if_needed(state)

func _on_turn_processed(payload: Dictionary) -> void:
	_turn_in_flight = false
	var old_state: Dictionary = GameSession.state_cache.duplicate(true)
	var state: Dictionary = payload.get("state", {}) as Dictionary
	if state.is_empty():
		_on_request_failed("/turn", ERR_INVALID_DATA, "Backend returned empty state")
		return
	GameSession.update_state(state)
	_append_turn_log(payload, _get_current_player(old_state))
	_render_last_action_cards(payload, state)
	_render_state(state)
	_process_next_turn_if_needed(state)

func _process_next_turn_if_needed(state: Dictionary) -> void:
	if _turn_in_flight:
		return
	if bool(state.get("game_over", false)):
		hud.call("set_status", "Game over")
		return
	var current_player := _get_current_player(state)
	if current_player.is_empty():
		_on_request_failed("/turn", ERR_INVALID_DATA, "Unable to resolve current player")
		return
	if current_player.get("is_ai", true):
		_turn_in_flight = true
		hud.call("set_status", "Thinking: %s" % str(current_player.get("name", "AI")))
		ApiClient.run_turn(GameSession.session_id)
	else:
		_on_request_failed("/turn", ERR_UNAVAILABLE, "Human turn reached in AI-only mode")

func _render_state(state: Dictionary) -> void:
	_spawn_or_update_tokens(state.get("players", []))
	var current_player := _get_current_player(state)
	var player_name := str(current_player.get("name", "Unknown"))
	hud.call(
		"set_status",
		"Turn %s | Current: %s" % [str(state.get("current_turn", 0)), player_name]
	)

func _spawn_or_update_tokens(players: Array) -> void:
	var room_index: Dictionary = {}
	for player_data in players:
		if typeof(player_data) != TYPE_DICTIONARY:
			continue
		var p := player_data as Dictionary
		var player_name := str(p.get("name", "Player"))
		var room := str(p.get("position", ""))
		if not token_nodes.has(player_name):
			var sprite := Sprite2D.new()
			sprite.texture = _build_token_texture(_resolve_player_color(player_name))
			sprite.z_index = 10
			tokens_layer.add_child(sprite)
			token_nodes[player_name] = sprite
		if room_positions.has(room):
			var coord := room_positions[room] as Array
			if coord.size() == 2:
				var seat_idx := int(room_index.get(room, 0))
				room_index[room] = seat_idx + 1
				var world_pos := _room_coord_to_world(coord)
				(token_nodes[player_name] as Sprite2D).position = world_pos + _seat_offset(seat_idx)

func _get_current_player(state: Dictionary) -> Dictionary:
	var players: Array = state.get("players", []) as Array
	if players.is_empty():
		return {}
	var index := int(state.get("current_turn", 0)) % players.size()
	if typeof(players[index]) != TYPE_DICTIONARY:
		return {}
	return players[index] as Dictionary

func _append_turn_log(payload: Dictionary, actor: Dictionary) -> void:
	var actor_name := str(actor.get("name", "Unknown"))
	var move = payload.get("move", null)
	var suggestion = payload.get("suggestion", null)
	var accusation = payload.get("accusation", null)
	turn_log.append_text("[%s]\n" % actor_name)
	turn_log.append_text("Move -> %s\n" % str(move))
	turn_log.append_text("Suggestion -> %s\n" % str(suggestion))
	turn_log.append_text("Accusation -> %s\n\n" % str(accusation))
	turn_log.scroll_to_line(turn_log.get_line_count())

func _on_request_failed(endpoint: String, code: int, reason: String) -> void:
	_turn_in_flight = false
	hud.call("set_status", "Error: %s" % reason)
	turn_log.append_text("[ERROR] %s (%s): %s\n" % [endpoint, str(code), reason])

func _on_game_ended(_winner_name: String) -> void:
	var end_scene := load("res://scenes/EndGame.tscn")
	if end_scene == null:
		return
	var tree := get_tree()
	if tree == null:
		return
	var err := tree.change_scene_to_packed(end_scene)
	if err != OK:
		_on_request_failed("/scene/endgame", err, "Failed to open EndGame scene")

func _render_last_action_cards(payload: Dictionary, state: Dictionary) -> void:
	var suggestion = payload.get("suggestion", null)
	var accusation = payload.get("accusation", null)
	var entries: Array[Dictionary] = []
	var title := "Latest Suggestion"

	if suggestion is Array and (suggestion as Array).size() == 3:
		entries = _build_entries_from_triplet(
			state,
			suggestion as Array,
			["suspects", "weapons", "locations"]
		)
	elif accusation is Dictionary:
		title = "Latest Accusation"
		var acc: Dictionary = accusation as Dictionary
		var normalized := [
			acc.get("suspect", ""),
			acc.get("weapon", ""),
			acc.get("location", ""),
		]
		entries = _build_entries_from_triplet(
			state,
			normalized,
			["suspects", "weapons", "locations"]
		)

	if card_panel.has_method("set_title"):
		card_panel.call("set_title", title)
	if card_panel.has_method("populate_entries"):
		card_panel.call("populate_entries", entries)

func _build_entries_from_triplet(
	state: Dictionary,
	names_triplet: Array,
	categories: Array
) -> Array[Dictionary]:
	var manifest := state.get("asset_manifest", {}) as Dictionary
	var entries: Array[Dictionary] = []
	for i in range(min(names_triplet.size(), categories.size())):
		var backend_name := str(names_triplet[i])
		var category := str(categories[i])
		var category_map := manifest.get(category, {}) as Dictionary
		var detail := category_map.get(backend_name, {}) as Dictionary
		var display_name := str(detail.get("display_name", backend_name))
		var asset_path := str(detail.get("asset_path", ""))
		entries.append(
			{
				"display_name": display_name,
				"asset_path": asset_path,
			}
		)
	return entries

func _resolve_player_color(player_name: String) -> Color:
	if _player_colors.has(player_name):
		return _player_colors[player_name]
	var index := _player_colors.size() % _palette.size()
	var color := _palette[index]
	_player_colors[player_name] = color
	return color

func _build_token_texture(color: Color) -> Texture2D:
	var size := 28
	var image := Image.create(size, size, false, Image.FORMAT_RGBA8)
	image.fill(Color(0, 0, 0, 0))
	var center := Vector2(size / 2.0, size / 2.0)
	var radius := 10.0
	var outline_radius := 12.0
	for y in range(size):
		for x in range(size):
			var pos := Vector2(float(x), float(y))
			var distance := pos.distance_to(center)
			if distance <= outline_radius and distance > radius:
				image.set_pixel(x, y, Color.BLACK)
			elif distance <= radius:
				image.set_pixel(x, y, color)
	return ImageTexture.create_from_image(image)

func _room_coord_to_world(coord: Array) -> Vector2:
	var p := Vector2(float(coord[0]), float(coord[1]))
	var texture := board_sprite.texture
	if texture == null:
		return p

	# board_layout.json stores board-image pixel coordinates (entry cells).
	var tex_size := texture.get_size()
	if p.x >= 0.0 and p.y >= 0.0 and p.x <= tex_size.x and p.y <= tex_size.y:
		var scale_xy := board_sprite.scale
		var local := Vector2(
			(p.x - tex_size.x / 2.0) * scale_xy.x,
			(p.y - tex_size.y / 2.0) * scale_xy.y
		)
		return board_sprite.to_global(local)

	# Backward compatibility for absolute-world coordinate files.
	return p

func _seat_offset(index: int) -> Vector2:
	var offsets := [
		Vector2(0, 0),
		Vector2(16, 0),
		Vector2(-16, 0),
		Vector2(0, 16),
		Vector2(0, -16),
	]
	return offsets[index] if index < offsets.size() else Vector2(8 * index, 0)
