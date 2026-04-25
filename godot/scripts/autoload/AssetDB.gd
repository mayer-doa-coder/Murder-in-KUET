extends Node

@export var aliases_path: String = "res://data/card_aliases.json"

var aliases: Dictionary = {}

func _ready() -> void:
	aliases = _load_json(aliases_path)

func map_to_backend(category: String, display_name: String) -> String:
	if not aliases.has(category):
		return display_name
	var category_map: Dictionary = aliases[category]
	return str(category_map.get(display_name, display_name))

func map_to_display(category: String, backend_name: String) -> String:
	if not aliases.has(category):
		return backend_name
	var category_map: Dictionary = aliases[category]
	for display_name: String in category_map.keys():
		if str(category_map[display_name]) == backend_name:
			return display_name
	return backend_name

func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed as Dictionary if typeof(parsed) == TYPE_DICTIONARY else {}
