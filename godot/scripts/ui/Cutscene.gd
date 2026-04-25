extends Control

signal cutscene_finished
const SKIP_ACTION := "ui_skip_cutscene"

@onready var animation_player: AnimationPlayer = %AnimationPlayer
@onready var skip_button: Button = %SkipButton

func _ready() -> void:
	skip_button.pressed.connect(_finish_cutscene)
	animation_player.animation_finished.connect(_on_animation_finished)
	_play_mode_intro()

func _input(event: InputEvent) -> void:
	if _is_skip_event(event):
		_finish_cutscene()

func _is_skip_event(event: InputEvent) -> bool:
	if InputMap.has_action(SKIP_ACTION) and event.is_action_pressed(SKIP_ACTION):
		return true
	# Fallback keys so cutscene skip works even when custom action is not configured.
	if event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_cancel"):
		return true
	return false

func _play_mode_intro() -> void:
	var target_animation := "default"
	match GameSession.game_mode:
		"AI_VS_AI":
			target_animation = "ai_vs_ai_intro"
		"HUMAN_VS_AI":
			target_animation = "human_vs_ai_intro"
		"HUMAN_VS_HUMAN":
			target_animation = "human_vs_human_intro"

	if animation_player.has_animation(target_animation):
		animation_player.play(target_animation)
	else:
		# Fallback when animations are not authored yet.
		get_tree().create_timer(1.5).timeout.connect(_finish_cutscene)

func _on_animation_finished(_anim_name: StringName) -> void:
	_finish_cutscene()

func _finish_cutscene() -> void:
	if not is_inside_tree():
		return
	emit_signal("cutscene_finished")
	get_tree().change_scene_to_file("res://scenes/GameBoard.tscn")
