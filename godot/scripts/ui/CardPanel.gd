extends Control

@onready var title_label: Label = %TitleLabel
@onready var card_grid: GridContainer = %CardGrid

func set_title(text: String) -> void:
	title_label.text = text

func clear_cards() -> void:
	for child in card_grid.get_children():
		child.queue_free()

func populate_cards(card_names: Array[String]) -> void:
	clear_cards()
	for card_name in card_names:
		var wrapper := VBoxContainer.new()
		wrapper.custom_minimum_size = Vector2(180, 96)

		var label := Label.new()
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.text = card_name

		wrapper.add_child(label)
		card_grid.add_child(wrapper)

func populate_entries(entries: Array[Dictionary]) -> void:
	clear_cards()
	for entry in entries:
		var display_name := str(entry.get("display_name", "Unknown"))
		var asset_path := str(entry.get("asset_path", ""))

		var wrapper := VBoxContainer.new()
		wrapper.custom_minimum_size = Vector2(180, 160)

		var image := TextureRect.new()
		image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		image.custom_minimum_size = Vector2(120, 100)
		var texture := _load_texture(asset_path)
		if texture != null:
			image.texture = texture

		var label := Label.new()
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.text = display_name

		wrapper.add_child(image)
		wrapper.add_child(label)
		card_grid.add_child(wrapper)

func _load_texture(path: String) -> Texture2D:
	if path.is_empty():
		return null
	var normalized := path.replace("\\", "/")
	if normalized.begins_with("res://"):
		return load(normalized) as Texture2D
	if normalized.begins_with("Assets/"):
		var local := "res://assets/%s" % normalized.trim_prefix("Assets/")
		return load(local) as Texture2D
	return load(normalized) as Texture2D
