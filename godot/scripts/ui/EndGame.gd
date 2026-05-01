extends Control

@onready var winner_label: Label = %WinnerLabel
@onready var back_button: Button = %BackToMenuButton

func _ready() -> void:
	back_button.pressed.connect(_on_back_pressed)
	var cached_winner := str(GameSession.state_cache.get("winner", ""))
	if not cached_winner.is_empty():
		set_winner(cached_winner)

func set_winner(winner_name: String) -> void:
	winner_label.text = "Winner: %s" % winner_name

func _on_back_pressed() -> void:
	GameSession.reset_session()
	get_tree().change_scene_to_file("res://scenes/MainMenu.tscn")
