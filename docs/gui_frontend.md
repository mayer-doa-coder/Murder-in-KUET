# GUI / Frontend Design Guide — Murder in KUET

> This document is the definitive reference for anyone building a visual interface
> for Murder in KUET.  It describes the required UI components, board design approach,
> backend integration pattern, and ranks the available technology options.

---

## 1. Goal

Build a playable Cluedo-style interface that:

- Visualises the KUET campus board (9 rooms, corridors, secret passages).
- Shows player tokens, card hands, dice rolls, and clue sheets.
- Accepts human player input (move selection, suggestion, accusation).
- Calls the Python REST API to advance game state.
- Supports all three modes: AI vs AI (spectator), Human vs AI, Human vs Human.

---

## 2. Core UI Components

| Component | Purpose |
|---|---|
| **Board** | Central 9-room KUET campus map with corridors and secret passage indicators |
| **Player tokens** | Coloured pieces placed on rooms; animate on movement |
| **Dice panel** | Shows current roll (die1 + die2 = total); animates on each turn |
| **Move selector** | Highlights reachable rooms; player clicks to choose destination |
| **Suggestion panel** | Dropdown/card-select for suspect + weapon; locked to current room |
| **Accusation dialog** | Confirmation dialog with final suspect/weapon/location selection |
| **Clue sheet (notebook)** | Per-player probability grid; updates after each suggestion |
| **Card hand** | Private card display for human players |
| **Event log** | Chronological feed: moves, suggestions, reveals, accusations |
| **Game status bar** | Active player name, turn number, game-over banner |

---

## 3. Board Design

### 3.1 Image-based board

Use a single background image of the KUET campus.  Overlay a transparent logic
layer that maps pixel regions to room names.

```
board_image.png           (2048 × 2048 background)
  └── room_overlays/
        Auditorium.png    (transparent PNG, click region)
        Cafeteria.png
        ...
```

Each room overlay:
- Highlights on hover when it is a valid move target.
- Shows the player token(s) currently inside.
- Dims if not reachable this turn.

### 3.2 Room coordinate map

Define a JSON manifest mapping each room name to its display centroid and
bounding box in board pixels:

```json
{
  "Auditorium":            {"cx": 220, "cy": 180, "w": 300, "h": 200},
  "Student Welfare Center":{"cx": 650, "cy": 180, "w": 280, "h": 200},
  "IT Park":               {"cx": 1100,"cy": 180, "w": 260, "h": 200},
  "Cafeteria":             {"cx": 650, "cy": 500, "w": 280, "h": 200},
  "Central Field":         {"cx": 1024,"cy": 550, "w": 240, "h": 220},
  "Amar Ekushey Hall":     {"cx": 1380,"cy": 500, "w": 280, "h": 200},
  "Begum Rokeya Hall":     {"cx": 1380,"cy": 820, "w": 280, "h": 200},
  "Lotus Pond":            {"cx": 220, "cy": 820, "w": 300, "h": 200},
  "Pocket Gate":           {"cx": 650, "cy": 1000,"w": 280, "h": 180}
}
```

### 3.3 Secret passages

Draw a dashed overlay line between:
- Auditorium ↔ Pocket Gate
- Lotus Pond ↔ Begum Rokeya Hall

Label them "Secret Passage" and colour them distinctly (e.g. purple).  When a
player occupies a passage endpoint the passage destination should always appear
in the valid-moves list regardless of dice roll.

### 3.4 Corridors

Draw weighted corridor lines between connected rooms.  Optionally annotate each
corridor with its weight (2–4 squares) so human players understand movement cost.

---

## 4. Assets Needed

| Asset | Format | Notes |
|---|---|---|
| Board background | PNG / SVG | 2048×2048 recommended |
| Room highlight overlays | PNG (transparent) | One per room |
| Player token sprites | PNG | 5 colours (one per player slot) |
| Card face images | PNG | 6 suspects × card, 6 weapons × card, 9 locations × card |
| Card back image | PNG | Shown for unknown cards |
| Dice face sprites | PNG or SVG | die1 (1–6), die2 (1–6) |
| Secret passage indicator | SVG line / PNG | Dashed, coloured |
| Sound effects (optional) | MP3/OGG | Dice roll, card reveal, accusation fanfare |

---

## 5. Integration with the Backend

### 5.1 Full request flow

```
Human picks move/suggestion/accusation
         │
         ▼
  Frontend constructs JSON payload
         │
         ▼
  POST /human/turn  (or /turn for AI turns)
         │
         ▼
  Flask API → GameState.execute_human_turn()
         │
         ▼
  Updated state returned as JSON
         │
         ▼
  Frontend animates: token moves, dice shows, card panel updates
```

### 5.2 Session lifecycle

```javascript
// 1. Start a game
const { session_id, state } = await post("/game/start", {
  players: [
    { name: "You",    is_human: true },
    { name: "AI-1",  ai_type: "MctsAI" },
    { name: "AI-2",  ai_type: "MinimaxAI" },
  ]
});

// 2. Game loop
while (!state.game_over) {
  const turn = await post("/turn", { session_id });

  if (turn.requires_human_input) {
    // Show UI: highlight valid_moves, show suspect/weapon dropdowns
    const choice = await waitForHumanInput(turn);
    const result = await post("/human/turn", { session_id, ...choice });
    applyResult(result);
  } else {
    // AI turn: animate result
    applyResult(turn);
  }
}
```

### 5.3 State rendering after each turn

The API always returns the full serialized `state` object.  Use it to re-render:

```
state.players[i].position      → move token on board
state.players[i].notebook      → update clue sheet probabilities
state.last_dice_roll            → show dice result
state.game_over / state.winner  → show win/loss banner
```

---

## 6. Technology Options

### Option 1 — React + Tailwind CSS + Framer Motion ⭐ RECOMMENDED

**Stack**: React 18, TypeScript, Tailwind CSS, Framer Motion, Axios/fetch

**How it works**:
- React components for Board, PlayerPanel, DiceRoller, SuggestionModal, etc.
- Tailwind handles responsive layout; no custom CSS needed for most components.
- Framer Motion drives token movement animations, card flip transitions, dice spin.
- `fetch`/Axios calls the Flask API directly (CORS header needed on Flask).

**Board implementation**: SVG overlay on a `<img>` board background.  Each room
is an SVG `<polygon>` or `<rect>` with click handlers.  Player tokens are
`<circle>` elements animated with `motion.circle` from Framer Motion.

**Pros**:
- Fastest iteration speed; component ecosystem is vast.
- Easy to style to match KUET branding.
- Hot reload; full TypeScript type-safety.
- Can be deployed as a static site (Vite build).

**Cons**:
- Not a game engine; complex sprite animations require extra work.
- No built-in audio management (use Howler.js).

**Setup**:
```bash
npm create vite@latest murder-in-kuet-ui -- --template react-ts
cd murder-in-kuet-ui
npm install tailwindcss framer-motion axios howler
```

---

### Option 2 — Pygame (Python desktop app)

**Stack**: Python, Pygame 2

**How it works**:
- Single-process app: Pygame renders the board and handles events; game logic
  runs via direct Python imports (no HTTP API needed).
- `GameState` is imported and mutated directly; callbacks supply human input.

**Board implementation**: Blit a board PNG as background; draw `pygame.draw.circle`
for tokens; use `pygame.mouse.get_pos()` to detect room clicks.

**Pros**:
- Pure Python — no JavaScript; no server needed for local play.
- Instant integration with game engine (direct import, no serialization).
- Good for rapid prototyping and demos.

**Cons**:
- Desktop-only; no web deployment.
- Pygame UI is lower-fidelity than modern web frameworks.
- No mobile support.

**Setup**:
```bash
pip install pygame
```

---

### Option 3 — Godot 4 (Game Engine)

**Stack**: Godot 4.x, GDScript, HTTPRequest node

**How it works**:
- Godot scene tree: `Board` node → `Room` nodes (Area2D + Sprite) → `PlayerToken` nodes.
- `HTTPRequest` node calls the Flask API; JSON responses drive state updates.
- GDScript `tween()` animates tokens along paths.

**Board implementation**: Each room is an `Area2D` with a collision polygon.
Hovering/clicking rooms is handled natively via `mouse_entered` / `input_event`
signals.  Corridors are `Line2D` nodes.

**Pros**:
- Designed for games; physics, animation, audio all built in.
- Scene editor makes visual layout easy.
- Can export to Windows, Linux, macOS, HTML5 (web).

**Cons**:
- GDScript learning curve if the team is Python/JS focused.
- HTTP integration adds latency vs. direct Python calls.
- Heavier build pipeline.

**Setup**: Download Godot 4 from godotengine.org; no pip/npm required.

---

### Option 4 — Unity (Professional Game Engine)

**Stack**: Unity 2022 LTS, C#, UnityWebRequest

**How it works**:
- GameObjects for board, tokens, panels; Animator Controller for transitions.
- `UnityWebRequest` or `RestClient` calls the Flask API.
- Unity UI Toolkit (UXML/USS) for the clue sheet and menus.

**Pros**:
- Most polished visual output possible.
- Asset Store provides ready-made board, card, and token assets.
- WebGL export for browser play.

**Cons**:
- C# adds context switch if team works in Python/JS.
- Largest setup overhead (Unity Hub + Editor = ~2 GB).
- Overkill for a board game of this complexity.

---

### Option 5 — Flutter (Cross-platform)

**Stack**: Flutter 3, Dart, http package, flutter_animate

**How it works**:
- `CustomPainter` draws the board; `GestureDetector` handles taps.
- `http.post()` calls the Flask API.
- `flutter_animate` provides smooth widget transitions.

**Pros**:
- Single codebase for Android, iOS, Windows, macOS, Web.
- Hot reload; fast iteration.
- Strong widget system for menus, dialogs, and panels.

**Cons**:
- Dart is less familiar than Python/JS to most teams.
- Complex canvas drawing (board, tokens) requires more boilerplate than SVG/Godot.
- Mobile game deployment requires Play Store / App Store setup.

---

### Option 6 — Streamlit (Rapid Prototype / Debug Tool)

**Stack**: Python, Streamlit, streamlit-agraph or plotly

**How it works**:
- `streamlit run app.py` serves a browser UI.
- Board rendered as a NetworkX graph via `streamlit-agraph` or as a Plotly scatter chart with custom markers.
- Form widgets (`st.selectbox`, `st.button`) collect human input.
- Direct Python imports; no HTTP layer needed.

**Pros**:
- Fastest prototype: full working demo in < 100 lines of Python.
- No JavaScript; no build step.
- Perfect for AI research / debugging sessions.

**Cons**:
- Not suitable for production UX; page-reload on every interaction.
- Animation and real-time updates are limited.
- Not a real game interface.

---

## 7. Technology Comparison Table

| Technology | Setup difficulty | UI quality | Animation | API integration | Mobile | Deployment | Best for |
|---|---|---|---|---|---|---|---|
| **React + Tailwind** | Low | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | HTTP fetch | Web only | Static site | Full production UI |
| **Pygame** | Very low | ⭐⭐⭐ | ⭐⭐⭐ | Direct import | No | Desktop .exe | Local play / prototyping |
| **Godot 4** | Medium | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | HTTPRequest | Via export | Desktop + HTML5 | Game-feel demo |
| **Unity** | High | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | UnityWebRequest | Via export | Desktop + WebGL | Professional release |
| **Flutter** | Medium | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | http package | ✓ | Cross-platform | Mobile-first |
| **Streamlit** | Very low | ⭐⭐ | ⭐ | Direct import | Web only | `streamlit run` | Prototype / research |

---

## 8. Ranking (easiest → most powerful)

1. **Streamlit** — Use only for internal demos or debugging.
2. **Pygame** — Best for a quick playable local prototype with minimal overhead.
3. **React + Tailwind** — Best production web UI; fastest iteration for a web-focused team.
4. **Flutter** — Choose if cross-platform mobile release is a requirement.
5. **Godot 4** — Choose if game-engine feel (animations, audio, particles) matters.
6. **Unity** — Choose only if the team has C# experience and wants maximum polish.

---

## 9. Recommendation

**Use React + Tailwind CSS + Framer Motion** for the main production frontend.

**Justification**:
- The game logic lives in a Python Flask API; the frontend only needs to call HTTP
  endpoints and render JSON state.  React is ideal for this pattern.
- The board (9 rooms, 12 edges) maps cleanly to SVG elements controlled by React
  state — no game engine is necessary.
- Framer Motion makes token movement, dice rolls, and card flips feel polished
  with minimal code.
- Vite produces a static bundle deployable to any CDN or GitHub Pages.
- The existing API already returns full `GameState.to_dict()` objects; building a
  React component tree on top of that structure is straightforward.

**If the team prefers to stay in Python entirely**, use **Pygame** for a desktop
prototype first, then graduate to React once the gameplay is validated.

---

## 10. Flask CORS Configuration

The React frontend and the Flask API will run on different ports during
development.  Add CORS headers to Flask:

```python
# In services/api.py
from flask_cors import CORS
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})
```

```bash
pip install flask-cors
```

For production, restrict the allowed origin to your deployed domain.
