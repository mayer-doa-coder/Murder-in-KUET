# Murder in KUET

A Cluedo-inspired murder mystery game set on the KUET (Khulna University of Engineering & Technology) campus, featuring five competing AI agents compared through automated simulation.

## Project Overview

Five AI strategies compete to solve the murder:

| Agent | Strategy |
|---|---|
| `RandomAI` | Uniform-random baseline |
| `RuleBasedAI` | Deterministic notebook-probability heuristic |
| `MinimaxAI` | Minimax search with strategic evaluation |
| `NegamaxAI` | Negamax + alpha-beta pruning |
| `ExpectiminimaxAI` | Expectiminimax with probabilistic chance nodes |
| `MonteCarloAI` | Monte Carlo rollouts with adaptive simulation budget |
| `MctsAI` | Full four-phase MCTS (UCT tree search) |

## Project Structure

```
Murder-in-KUET/
├── engine/         # Core game rules (Board, Cards, Dice, GameState)
├── models/         # Data models (Player, Suggestion, Accusation)
├── ai/             # All AI agent implementations + BayesianNotebook
├── config/         # GAME_CONFIG and AI_CONFIG settings
├── services/       # Simulation runner + Flask REST API + game runner
├── analytics/      # Matplotlib charts and metrics export (Visualizer)
├── cli/            # Interactive CLI driver
├── utils/          # Logger and helper utilities
├── tests/          # pytest test suite (103 tests)
├── main.py         # Entry point — runs multi-game AI benchmark
└── dashboard.py    # Streamlit dashboard for results visualization
```

## Setup

### Requirements
- Python 3.11+

### Install dependencies

```bash
pip install -r requirements.txt
```

## Running the Benchmark

```bash
python main.py
```

This runs 10 games (configurable in `config/settings.py`) with all 5 AI agents competing, then saves results to `logs/metrics.json`.

## Viewing the Dashboard

```bash
streamlit run dashboard.py
```

Open the URL shown in the terminal (usually `http://localhost:8501`).

## Running the Flask API

```bash
python -m flask --app services.api run
```

Endpoints:
- `GET  /health` — liveness probe
- `POST /game/start` — start a new game session
- `POST /turn` — advance a turn (session or stateless mode)
- `GET  /game/state` — read current game state

## Running Tests

```bash
pytest tests/ -v
```

103 tests across 4 files, covering MCTS node behaviour, Monte Carlo rollouts, game-state immutability, and AI benchmark stability.

## Configuration

Edit `config/settings.py` to adjust:

| Key | Default | Description |
|---|---|---|
| `MAX_PLAYERS` | 5 | Number of AI agents per game |
| `SIMULATION_RUNS` | 10 | Number of games per benchmark run |
| `MAX_TURNS` | 250 | Turn cap per game |
| `BASE_RANDOM_SEED` | 2026 | Starting seed for reproducible runs |
| `MINIMAX_DEPTH` | 2 | Search depth for Minimax/Negamax/Expectiminimax |
| `MONTE_CARLO_SIMULATIONS` | varies | Rollout budget for Monte Carlo AI |
| `MCTS_ITERATIONS` | varies | Iteration budget for MCTS AI |

## Board

The game is played on a graph of 9 KUET campus locations connected by weighted corridors, with 4 secret-passage pairs for instant teleportation.