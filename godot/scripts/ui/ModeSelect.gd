extends Control

signal mode_confirmed(mode: String, players: Array[Dictionary])

@onready var ai_vs_ai_button: Button = %AIVsAIButton
@onready var human_vs_ai_button: Button = %HumanVsAIButton
@onready var human_vs_human_button: Button = %HumanVsHumanButton
@onready var start_button: Button = %StartButton

var _selected_mode: String = "AI_VS_AI"

func _ready() -> void:
	ai_vs_ai_button.pressed.connect(func(): _set_mode("AI_VS_AI"))
	human_vs_ai_button.disabled = true
	human_vs_human_button.disabled = true
	start_button.pressed.connect(_on_start_pressed)
	_set_mode("AI_VS_AI")

func _set_mode(mode: String) -> void:
	_selected_mode = mode
	GameSession.set_mode(mode)

func _on_start_pressed() -> void:
	var players := _build_player_config(_selected_mode)
	GameSession.set_players(players)
	emit_signal("mode_confirmed", _selected_mode, players)
	get_tree().change_scene_to_file("res://scenes/Cutscene.tscn")

func _build_player_config(mode: String) -> Array[Dictionary]:
	match mode:
		"AI_VS_AI":
			return [
				{"name": "MctsAI", "ai_type": "MctsAI"},
				{"name": "ExpectiminimaxAI", "ai_type": "ExpectiminimaxAI"},
				{"name": "RuleBasedAI", "ai_type": "RuleBasedAI"},
				{"name": "MonteCarloAI", "ai_type": "MonteCarloAI"}
			]
		_:
			return _build_player_config("AI_VS_AI")
