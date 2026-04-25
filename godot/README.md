# Godot Frontend Blueprint

This scaffold provides scene and script stubs for:
- Main menu
- Mode selection
- Mode-specific cutscene
- Board + HUD + turn log
- End game screen

## Autoloads
- `GameSession.gd`
- `ApiClient.gd`
- `AssetDB.gd`

## Important Note
The Python API endpoint `/game/start` currently creates `AIPlayer` only. Human modes in this frontend are scaffolded and marked with TODOs until backend support is added for explicit human-turn actions.
