"""Configuration package for Murder in KUET."""

from config.settings import AI_CONFIG, GAME_CONFIG, get_ai_config, get_config, get_positive_int

__all__ = [
	"GAME_CONFIG",
	"AI_CONFIG",
	"get_config",
	"get_ai_config",
	"get_positive_int",
]
