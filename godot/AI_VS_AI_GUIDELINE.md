# AI vs AI Godot Integration Guideline (Fail-Safe)

This guide is only for the **AI vs AI** flow with your current project.

It is written for the current repo state:
- Godot project root: `D:\Murder-in-KUET\godot`
- Backend root: `D:\Murder-in-KUET`
- Backend now returns `state.asset_manifest` from Python.

---

## 1. Scope Lock (Important)

For now, keep only this flow:
1. `MainMenu` -> `ModeSelect` -> `Cutscene` -> `GameBoard` -> `EndGame`
2. Start backend session with AI players
3. Run `/turn` repeatedly until `game_over = true`
4. Show winner and return to menu

Do not implement human input path yet.

---

## 2. Pre-Flight Checklist (Before opening Godot)

1. Backend dependencies installed:
```powershell
cd D:\Murder-in-KUET
pip install -r requirements.txt
```

2. Start backend API:
```powershell
cd D:\Murder-in-KUET
python -m flask --app services.api run
```

3. Confirm API is alive:
- Open `http://127.0.0.1:5000/health`
- Expect JSON: `{"status":"ok", ...}`

4. Verify required asset files exist exactly:
- `D:\Murder-in-KUET\Assets\Suspect\*.png`
- `D:\Murder-in-KUET\Assets\Weapon\*.png`
- `D:\Murder-in-KUET\Assets\Room\*.png`
- `D:\Murder-in-KUET\Assets\board.png`

If any mapped file is missing, backend serialization can fail.

---

## 3. Project Settings and Autoloads

Open `project.godot` in Godot and confirm:

1. Main scene:
- `res://scenes/MainMenu.tscn`

2. Autoloads (exact names):
- `GameSession` -> `res://scripts/autoload/GameSession.gd`
- `ApiClient` -> `res://scripts/autoload/ApiClient.gd`
- `AssetDB` -> `res://scripts/autoload/AssetDB.gd`

If any autoload name differs, `%GameSession`/`ApiClient` calls in scripts will break.

---

## 4. Scene-by-Scene, Node-by-Node Setup

## 4.1 `MainMenu.tscn`

Required node tree:
- `MainMenu` (`Control`, script: `MainMenu.gd`)
- `Background` (`TextureRect`)
- `MenuVBox` (`VBoxContainer`)
- `PlayButton` (`Button`, unique name)
- `SettingsButton` (`Button`, unique name)
- `QuitButton` (`Button`, unique name)

Required behavior:
- `PlayButton` changes scene to `res://scenes/ModeSelect.tscn`

No AI logic here.

---

## 4.2 `ModeSelect.tscn`

Required node tree:
- `ModeSelect` (`Control`, script: `ModeSelect.gd`)
- `Panel/VBox`
- `AIVsAIButton` (`Button`, unique name)
- `HumanVsAIButton` (`Button`, unique name)
- `HumanVsHumanButton` (`Button`, unique name)
- `StartButton` (`Button`, unique name)

AI-vs-AI hardening (recommended now):
1. Keep mode forced to AI vs AI.
2. Disable other mode buttons in `_ready()`.

This avoids accidental entry into unfinished human flows.

---

## 4.3 `Cutscene.tscn`

Required node tree:
- `Cutscene` (`Control`, script: `Cutscene.gd`)
- `TextureRect`
- `Narration` (`RichTextLabel`)
- `SkipButton` (`Button`, unique name)
- `AnimationPlayer` (unique name)

Required behavior:
- After animation or skip: change to `res://scenes/GameBoard.tscn`

Optional safety:
- Add Input Map action `ui_skip_cutscene` so skip hotkey path is clean.

---

## 4.4 `GameBoard.tscn` (Core for AI vs AI)

Required node tree:
- `GameBoard` (`Node2D`, script: `GameBoard.gd`)
- `BoardBackground` (`Sprite2D`, unique name)
- `RoomAnchors` (`Node2D`, unique name)
- `PlayerTokens` (`Node2D`, unique name)
- `UI` (`CanvasLayer`)
- `HUD` (instance of `HUD.tscn`, unique name)
- `TurnLogPanel`
- `TurnLog` (`RichTextLabel`, unique name)

Mandatory checks:
1. `BoardBackground` has a texture assigned.
2. `TurnLog` is visible and large enough.
3. `HUD` instance exists under `CanvasLayer`.
4. `board_layout.json` coordinates match your board image.

---

## 4.5 `HUD.tscn`

Required node tree:
- `HUD` (`Control`, script: `HUD.gd`)
- `BottomBar`
- `HBox`
- `StatusLabel` (`Label`, unique name)
- `SuggestButton` (`Button`, unique name)
- `AccuseButton` (`Button`, unique name)
- `EndTurnButton` (`Button`, unique name)

For AI-vs-AI only:
- You can keep buttons visible but disabled, or hide them.
- They are not used in the current AI loop.

---

## 4.6 `EndGame.tscn`

Required node tree:
- `EndGame` (`Control`, script: `EndGame.gd`)
- `Panel/VBox`
- `WinnerLabel` (`Label`, unique name)
- `BackToMenuButton` (`Button`, unique name)

Required behavior:
- `set_winner()` sets winner text.
- Back button calls `GameSession.reset_session()` and goes to MainMenu.

---

## 5. Script-by-Script Responsibilities

## 5.1 `scripts/autoload/ApiClient.gd`

Must do:
1. POST `/game/start` with players array.
2. POST `/turn` with `session_id`.
3. Emit:
- `game_started(payload)`
- `turn_processed(payload)`
- `request_failed(endpoint, code, reason)`

Keep:
- `base_url = "http://127.0.0.1:5000"` unless backend host changes.

---

## 5.2 `scripts/autoload/GameSession.gd`

Must store:
- `game_mode`
- `players_config`
- `session_id`
- `state_cache`

Must emit:
- `session_started`
- `state_updated`
- `game_ended`

This is your single runtime state source in Godot.

---

## 5.3 `scripts/ui/ModeSelect.gd`

For AI-only phase:
1. Keep `_build_player_config("AI_VS_AI")` valid AI list.
2. On start:
- `GameSession.set_players(players)`
- emit `mode_confirmed`
- change to `Cutscene.tscn`

Suggested AI config:
```gdscript
[
  {"name": "AI Alpha", "ai_type": "MctsAI"},
  {"name": "AI Beta", "ai_type": "MonteCarloAI"}
]
```

---

## 5.4 `scripts/game/GameBoard.gd` (Most important)

Must do in sequence:
1. `_ready()`
2. `_load_room_positions()`
3. `_connect_signals()`
4. `_start_match()` -> `ApiClient.start_game(...)`
5. On `game_started`: cache session + render + run next turn
6. On `turn_processed`: update session + append log + render + run next turn
7. Stop when `state.game_over == true`

Critical logic:
- `_process_next_turn_if_needed()` must call `ApiClient.run_turn(GameSession.session_id)` for AI player turns.

Do not block the main thread manually.

---

## 5.5 `scripts/ui/HUD.gd`

Current role in AI-vs-AI:
- Show status text via `set_status()`
- Emit signals (unused for now)

Safe option now:
- Disable Suggest/Accuse/EndTurn buttons in AI mode to prevent confusion.

---

## 5.6 `scripts/ui/Cutscene.gd`

Must:
1. Play correct animation for mode.
2. Fallback timer if animation missing.
3. Always route to `GameBoard.tscn`.

---

## 5.7 `scripts/ui/EndGame.gd`

Must:
1. Receive winner with `set_winner(winner_name)`.
2. Reset session on back.

---

## 5.8 `scripts/autoload/AssetDB.gd` + backend `asset_manifest`

You now have two mapping sources:
1. Godot alias map (`card_aliases.json`) via `AssetDB.gd`
2. Backend `state.asset_manifest` (authoritative backend lookup)

Recommendation for no-fail behavior:
1. Use backend `asset_manifest` whenever available.
2. Keep `AssetDB.map_to_display()` as fallback label mapping.

Backend manifest shape:
```json
{
  "suspects": {
    "Hashem Sir": {
      "display_name": "Chef",
      "asset_path": "Assets/Suspect/Chef.png"
    }
  }
}
```

---

## 6. Asset Path Strategy (Very Important)

Backend returns `asset_path` like `Assets/Suspect/Chef.png` relative to repo root, not `res://`.

To avoid runtime path failures in Godot, choose one approach and keep it consistent:

1. Recommended:
- Mirror assets inside Godot project, e.g. `res://assets/Suspect/...`
- Convert backend path at runtime:
  - `Assets/Suspect/Chef.png` -> `res://assets/Suspect/Chef.png`

2. Alternative:
- Read from absolute disk paths (less portable, harder for export builds).

For stable development and future export, use option 1.

---

## 7. AI vs AI End-to-End Test Procedure

1. Start backend API.
2. Run Godot project.
3. Click `Play`.
4. In Mode Select choose `AI vs AI`.
5. Click `Start`.
6. Let cutscene finish or skip.
7. Verify on GameBoard:
- Session starts
- Turn log updates every turn
- Tokens move according to room positions
- No request errors
8. Wait until winner screen appears.
9. Click `Back To Menu`.
10. Repeat once to ensure session reset works cleanly.

---

## 8. Common Failure Points and Fixes

1. `request_failed` with connection issue:
- Backend not running at `127.0.0.1:5000`

2. HTTP 500 on `/game/start`:
- Missing card asset file required by backend manifest

3. Tokens do not move:
- Room name mismatch between state and `board_layout.json`

4. Null-node errors with `%NodeName`:
- Unique node names changed in scene

5. Game never ends:
- Turn loop not calling `ApiClient.run_turn` after each state update

6. Wrong cards/images shown:
- `card_aliases.json` drifted from actual asset filenames

---

## 9. Minimum Done Definition (AI vs AI)

AI-vs-AI integration is complete when all are true:
1. Start flow works from MainMenu to GameBoard.
2. Backend session starts and turn loop advances automatically.
3. State updates render continuously without errors.
4. EndGame scene shows real winner.
5. One full match can run twice in a row without manual reset issues.

---

## 10. Phase-Wise Sequential Tasklist (Failproof Execution Order)

Follow phases strictly in order. Do not jump ahead.

## Phase 0: Environment Lock

1. Start backend at `http://127.0.0.1:5000`.
2. Confirm `/health` returns OK.
3. Confirm required asset files exist in `Assets/Suspect`, `Assets/Weapon`, `Assets/Room`.
4. Open Godot project from `D:\Murder-in-KUET\godot`.
5. Confirm autoloads: `GameSession`, `ApiClient`, `AssetDB`.

Exit criteria:
- Backend reachable.
- No missing asset files.
- Godot project opens with no autoload errors.

## Phase 1: Scene Integrity Audit

1. Open `MainMenu.tscn`, verify required nodes and script.
2. Open `ModeSelect.tscn`, verify required nodes and script.
3. Open `Cutscene.tscn`, verify `AnimationPlayer` and `SkipButton`.
4. Open `GameBoard.tscn`, verify `BoardBackground`, `PlayerTokens`, `HUD`, `TurnLog`.
5. Open `HUD.tscn`, verify `StatusLabel`, `SuggestButton`, `AccuseButton`, `EndTurnButton`.
6. Open `EndGame.tscn`, verify `WinnerLabel` and `BackToMenuButton`.

Exit criteria:
- All `%UniqueName` references in scripts map to real nodes.

## Phase 2: AI-Only Flow Hardening

1. In `ModeSelect.gd`, keep `AI_VS_AI` as default.
2. Disable or hide `HumanVsAIButton` and `HumanVsHumanButton`.
3. In `HUD` for AI mode, disable/hide `Suggest`, `Accuse`, `EndTurn`.
4. Keep cutscene destination fixed to `GameBoard.tscn`.

Exit criteria:
- User can only start AI-vs-AI route.
- No accidental entry to unfinished human flow.

## Phase 3: API Wiring Validation

1. Verify `ApiClient.start_game()` sends `players`.
2. Verify `ApiClient.run_turn()` sends `session_id`.
3. Verify response routing in `_on_request_completed()`:
- `session_id` -> `game_started`
- `move` + `state` -> `turn_processed`
- `state` only -> `state_received`
4. Verify `request_failed` logs visible reason/code.

Exit criteria:
- First `/game/start` response reaches `GameBoard._on_game_started`.
- Every `/turn` response reaches `GameBoard._on_turn_processed`.

## Phase 4: Runtime Turn Loop Validation

1. In `GameBoard._ready()`: load layout, connect signals, start match.
2. Confirm `_on_game_started` sets session + renders.
3. Confirm `_process_next_turn_if_needed` calls `ApiClient.run_turn` for AI player.
4. Confirm `_on_turn_processed` updates session, logs turn, rerenders, triggers next turn.
5. Confirm loop stops when `game_over = true`.

Exit criteria:
- Match runs start-to-finish without manual input.

## Phase 5: Visual Consistency + Asset Mapping

1. Ensure board image assigned to `BoardBackground`.
2. Ensure `board_layout.json` coordinates align with board.
3. Read `state.asset_manifest` from backend state.
4. If rendering card art, map backend paths like `Assets/...` to `res://assets/...` consistently.
5. Keep `AssetDB` alias mapping as fallback labels only.

Exit criteria:
- No room/token mismatch.
- No missing texture path errors during runtime.

## Phase 6: Endgame + Reset Stability

1. Verify `GameSession.game_ended` triggers `EndGame.tscn`.
2. Verify `set_winner()` receives actual winner name.
3. Verify `BackToMenuButton` calls `GameSession.reset_session()`.
4. Start a second full match immediately after returning to menu.

Exit criteria:
- Second match starts cleanly (no stale session/state artifacts).

## Phase 7: Regression Pass (Must Do)

Run this exact smoke sequence twice:
1. Launch backend.
2. Launch Godot.
3. `Play` -> `AI vs AI` -> `Start`.
4. Skip cutscene.
5. Observe full game until winner.
6. Return to menu.
7. Repeat.

Exit criteria:
- Zero crashes.
- Zero stuck turns.
- Zero null-node errors.
- Zero HTTP failures.

## Phase 8: Freeze Baseline

1. Mark this AI-vs-AI state as stable baseline.
2. Do not touch AI-vs-AI control path while adding future human mode.
3. Add new features behind separate mode branches only.

Exit criteria:
- AI-vs-AI remains always playable while future development continues.
