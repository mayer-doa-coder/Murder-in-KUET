extends Control

signal end_turn_requested
signal suggestion_submitted(suspect: String, weapon: String)
signal accusation_submitted(suspect: String, weapon: String, location: String)

@onready var status_label: Label = %StatusLabel
@onready var end_turn_button: Button = %EndTurnButton
@onready var suggest_button: Button = %SuggestButton
@onready var accuse_button: Button = %AccuseButton

func _ready() -> void:
	end_turn_button.pressed.connect(func(): emit_signal("end_turn_requested"))
	suggest_button.pressed.connect(_on_suggest_pressed)
	accuse_button.pressed.connect(_on_accuse_pressed)
	set_ai_mode(true)

func set_status(text: String) -> void:
	status_label.text = text

func set_ai_mode(enabled: bool) -> void:
	suggest_button.visible = not enabled
	accuse_button.visible = not enabled
	end_turn_button.visible = not enabled

func _on_suggest_pressed() -> void:
	# TODO: Replace placeholders with popup inputs.
	emit_signal("suggestion_submitted", "Chef", "Knife")

func _on_accuse_pressed() -> void:
	# TODO: Replace placeholders with popup inputs.
	emit_signal("accusation_submitted", "Chef", "Knife", "Auditorium")
