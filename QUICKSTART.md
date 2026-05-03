# Murder in KUET — Quickstart Guide

A Cluedo-inspired murder mystery game set on the KUET campus, with five competing AI agents and a React/Vite frontend driven by a Flask REST API.

---

## Prerequisites

| Tool | Minimum version | Check |
|------|----------------|-------|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |

---

## 1. Clone the repository

```bash
git clone https://github.com/mayer-doa-coder/Murder-in-KUET.git
cd Murder-in-KUET
```

---

## 2. Backend setup

### Install Python dependencies

```bash
pip install -r requirements.txt
```

### Start the Flask API

```bash
python -m flask --app services.api run --host 127.0.0.1 --port 5000
```

The server starts at **http://127.0.0.1:5000**.

Verify it is running:

```bash
curl http://127.0.0.1:5000/health
# → {"sessions": 0, "status": "ok"}
```

---

## 3. Frontend setup

### Install Node dependencies (first time only)

```bash
cd frontend
npm install
```

### Start the Vite dev server

```bash
npm run dev
```

The app opens at **http://localhost:5173** (or 5174 if 5173 is occupied).

---

## 4. Running both together (recommended)

Open two terminals side by side:

**Terminal 1 — backend**

```bash
# from project root
python -m flask --app services.api run --host 127.0.0.1 --port 5000
```

**Terminal 2 — frontend**

```bash
cd frontend
npm run dev
```

Then open your browser to the URL Vite prints (e.g. `http://localhost:5173`).

---

## 5. API overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Liveness probe |
| `POST` | `/game/start` | Create a new game session |
| `POST` | `/turn` | Advance one turn (AI or human) |
| `POST` | `/human/turn` | Submit human player's choices |
| `GET` | `/game/state?session_id=<id>` | Read current session state |

### Example: start a game

```bash
curl -X POST http://127.0.0.1:5000/game/start \
  -H "Content-Type: application/json" \
  -d '{
    "players": [
      {"name": "Alice", "ai_type": "MinimaxAI"},
      {"name": "Bob",   "ai_type": "MctsAI"},
      {"name": "You",   "is_human": true}
    ]
  }'
```

Response includes a `session_id` — pass it to every subsequent `/turn` call.

### Available AI types

| Key | Strategy |
|-----|---------|
| `RandomAI` | Uniform-random baseline |
| `RuleBasedAI` | Deterministic notebook-probability heuristic |
| `MinimaxAI` | Minimax search with alpha-beta evaluation |
| `NegamaxAI` | Negamax + alpha-beta pruning |
| `ExpectiminimaxAI` | Expectiminimax with probabilistic chance nodes |
| `MctsAI` | Full four-phase MCTS (UCT tree search) |

---

## 6. Run the AI benchmark

Simulates 10 games with all five AI agents and saves results to `logs/metrics.json`:

```bash
python main.py
```

---

## 7. View the analytics dashboard

Requires Streamlit (included in `requirements.txt`):

```bash
streamlit run dashboard.py
```

Opens at **http://localhost:8501** — shows win rates, move counts, and decision-time charts.

---

## 8. Run tests

```bash
pytest tests/ -v
```

103 tests across MCTS node behaviour, game-state immutability, and AI benchmark stability.

---

## 9. Configuration

Edit [config/settings.py](config/settings.py) to tune:

| Key | Default | Description |
|-----|---------|-------------|
| `MAX_PLAYERS` | 5 | AI agents per game |
| `SIMULATION_RUNS` | 10 | Games per benchmark |
| `MAX_TURNS` | 250 | Turn cap per game |
| `BASE_RANDOM_SEED` | 2026 | Seed for reproducible runs |
| `MINIMAX_DEPTH` | 2 | Search depth for tree-search AIs |

---

## 10. Project structure

```
Murder-in-KUET/
├── engine/         # Core game rules (Board, Cards, Dice, GameState)
├── models/         # Data models (Player, Suggestion, Accusation)
├── ai/             # AI agent implementations + BayesianNotebook
├── config/         # GAME_CONFIG and AI_CONFIG settings
├── services/       # Flask REST API, game runner, simulation runner
├── analytics/      # Matplotlib charts and metrics export
├── cli/            # Interactive CLI driver
├── utils/          # Logger and helper utilities
├── tests/          # pytest test suite
├── frontend/       # React + Vite + Tailwind CSS game UI
├── main.py         # Multi-game AI benchmark entry point
└── dashboard.py    # Streamlit analytics dashboard
```

---

## Troubleshooting

**Port 5000 already in use**

```bash
python -m flask --app services.api run --host 127.0.0.1 --port 5001
```

Update `VITE_API_URL` in the frontend accordingly if you change the port.

**Frontend can't reach the API (CORS error)**

Flask-CORS is not configured by default. For local development the Vite dev server proxy handles this; for production builds add `flask-cors` to `requirements.txt` and configure it in `services/api.py`.

**`ModuleNotFoundError` on startup**

Make sure you are running from the project root and that all dependencies are installed:

```bash
pip install -r requirements.txt
```
