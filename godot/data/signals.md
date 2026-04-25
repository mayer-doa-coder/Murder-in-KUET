# Signal Contract

## Autoload Signals

### `GameSession.gd`
- `mode_changed(mode: String)`
- `session_started(session_id: String)`
- `state_updated(state: Dictionary)`
- `game_ended(winner_name: String)`

### `ApiClient.gd`
- `request_started(endpoint: String)`
- `request_failed(endpoint: String, code: int, reason: String)`
- `game_started(payload: Dictionary)`
- `turn_processed(payload: Dictionary)`
- `state_received(payload: Dictionary)`

## Scene Signals

### `ModeSelect.gd`
- `mode_confirmed(mode: String, players: Array[Dictionary])`

### `Cutscene.gd`
- `cutscene_finished`

### `HUD.gd`
- `end_turn_requested`
- `suggestion_submitted(suspect: String, weapon: String)`
- `accusation_submitted(suspect: String, weapon: String, location: String)`

### `TurnController.gd`
- `turn_started(player_name: String)`
- `turn_finished(player_name: String, result: Dictionary)`

## Turn Flow Event Sequence (AI vs AI)
1. `ModeSelect` emits `mode_confirmed`
2. `Cutscene` emits `cutscene_finished`
3. `GameBoard` calls `ApiClient.start_game`
4. `ApiClient` emits `game_started`
5. `GameSession` emits `session_started`
6. `GameBoard` triggers `ApiClient.run_turn`
7. `ApiClient` emits `turn_processed`
8. `GameSession` emits `state_updated`
9. On terminal state, `GameSession` emits `game_ended`
