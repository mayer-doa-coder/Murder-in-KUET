
# Murder in KUET — Project Context

> **SINGLE SOURCE OF TRUTH** for all AI agents.
> Future agents MUST read this file first and rely on it before exploring the codebase.

---

## 1. Project Overview

- **What it does**: A Cluedo-inspired deduction game set on the KUET campus where AI agents compete to solve a mystery (suspect + weapon + location) by moving across a board, making suggestions, and reasoning over hidden card information.
- **Core goal**: Multi-agent AI research platform implementing seven distinct search/reasoning strategies over an imperfect-information game.
- **Players**: 2–5 AI players compete simultaneously; first to make a correct accusation wins.
- **Mystery structure**: 1 solution card of each type (suspect, weapon, location) is hidden; remaining cards are distributed to players.

---

## 2. Architecture

### Backend Structure

```
engine/          # Core game rules and state machine
models/          # Data objects (Player, Suggestion, Accusation)
ai/              # All AI agent implementations + shared utilities
config/          # Tunable configuration constants
services/        # Flask REST API, game runner, simulation orchestration
cli/             # Interactive terminal interface
tests/           # 75 pytest tests
main.py          # Benchmark entry point
```

### Module Responsibilities

| Module | Responsibility |
|---|---|
| `engine/board.py` | KUET campus graph (9 nodes, weighted edges, secret passages) |
| `engine/game_state.py` | Authoritative game state: players, solution, deck, turn rotation |
| `engine/clue_reveal.py` | Suggestion resolution: find revealer, return revealed card |
| `engine/cards.py` | Deck construction (suspects, weapons, locations) |
| `engine/dice.py` | Dice roll mechanics |
| `models/player.py` | Player, AIPlayer, HumanPlayer data containers and action methods |
| `models/suggestion.py` | Immutable Suggestion value object |
| `models/accusation.py` | Accusation + correctness check |
| `ai/board_utils.py` | Pathfinding helpers, move enumeration, location scoring |
| `ai/notebook.py` | Notebook abstract class + BayesianNotebook implementation |
| `ai/base_ai.py` | Abstract BaseAI interface all agents implement |
| `ai/minimax_ai.py` | Minimax with determinization + StrategicEvaluationMixin |
| `ai/negamax_ai.py` | Negamax + alpha-beta skeleton |
| `ai/expectiminimax_ai.py` | Expectiminimax with explicit chance nodes |
| `ai/mcts_ai.py` | Full MCTS with UCT selection, expansion, simulation, backprop |
| `ai/ismcts_ai.py` | Information-Set MCTS (per-iteration determinization) |
| `ai/random_ai.py` | Uniform random baseline |
| `ai/rule_based_ai.py` | Notebook-probability heuristic AI |
| `config/settings.py` | `GAME_CONFIG` and `AI_CONFIG` dicts; accessor functions |
| `services/api.py` | Flask REST API (session + stateless modes; AI + human turns) |
| `services/game_runner.py` | Single game execution with metrics collection |
| `services/simulation_runner.py` | Multi-game benchmark orchestration |

---

## 3. Core Components

### GameState (`engine/game_state.py`)

- Central state container; passed (as clone) into every AI decision.
- **Key attributes**:
  - `players: list[Player]` — all participants
  - `solution: dict` — `{suspect, weapon, location}` — hidden from players
  - `deck: list[Card]` — all cards
  - `current_turn: int` — index into players (mod len)
  - `board: Board` — KUET campus graph
  - `game_over: bool`, `winner: Player`
  - `last_dice_roll` — most recent roll (used for move validation)
  - `suspects, weapons, locations: list[str]` — all names per category
- **Key methods**:
  - `setup_game()` — deal cards, pick solution, init notebooks
  - `clone()` — deep copy for simulation (never mutate root state)
  - `get_possible_moves() -> list[str]` — rooms reachable within dice total
  - `get_current_player() -> Player`
  - `next_turn()` — advance past inactive players
  - `run_turn()` — full turn: move → suggest → reveal → accuse → rotate
  - `process_suggestion(player, suggestion)` — find revealer, trigger Bayesian updates

### Player (`models/player.py`)

- **Key attributes**:
  - `name, is_ai, ai_agent` — identity and AI reference
  - `cards: list[Card]` — private hand
  - `position: str` — current room
  - `notebook: BayesianNotebook` — probability tracker
  - `active: bool` — False after a wrong accusation
- **Key methods**:
  - `move(new_location)` — unconditional teleport
  - `try_move(location, valid_moves)` — validates against legal destinations
  - `make_suggestion(suspect, weapon, location) -> Suggestion`
  - `make_accusation(suspect, weapon, location) -> Accusation`
  - `show_card(suggestion) -> Card | None` — find one matching card to reveal
  - `take_turn(state)` — delegates to `ai_agent`
- `AIPlayer` subclass owns `ai_agent` and forwards all decisions to it.

### BayesianNotebook (`ai/notebook.py`)

- Each player owns one; tracks posterior probabilities over all cards.
- **Key attributes**:
  - `suspects, weapons, locations: dict[str, float]` — probability per card (sum to 1.0 per category)
  - `possible_suspects, possible_weapons, possible_locations: set[str]` — non-zero cards
  - `known_cards: set[str]` — confirmed held by someone (prevent double-elimination)
- **Key methods**:
  - `eliminate(card: str)` — set probability to 0, renormalize
  - `update_no_reveal(suspect, weapon, location, boost=2.0)` — multiplicative Bayesian boost on suggested cards when no one disproves
  - `normalize(category)` — force category probabilities to sum to 1.0
  - `most_likely() -> (suspect, weapon, location)` — highest-probability triple
  - `is_solved() -> bool` — exactly 1 candidate remains in each category
  - `confident_accusation() -> bool` — all three max probabilities exceed threshold

### Player Types (`models/player.py`)

Three concrete player classes, all sharing the same `Player` base:

| Class | Created by | Decision source |
|---|---|---|
| `HumanPlayer(name)` | Frontend / CLI | External input via callbacks or API |
| `AIPlayer(name, agent)` | Game runner / API | `ai_agent.*` methods |
| `Player(name, is_ai=False)` | Legacy / tests | Base class; behaves as human |

Every player has `is_ai: bool` and `is_human: bool` (complement of `is_ai`).
Both `run_turn()` and `run_game()` accept optional human-input callbacks:
- `human_move_selector(player, valid_moves, state) → str | None`
- `human_suggestion_selector(player, state) → (suspect, weapon)`
- `human_accusation_selector(player, state) → None | bool | (s, w, l)`

When callbacks are `None`, human turns fall back to random valid choices (useful for tests).

`GameState.execute_human_turn(dice_roll, move, suspect, weapon, accuse, accusation_triple)`
executes a human turn using explicit inputs — designed for the REST API.

`GameState.get_human_turn_context()` pre-rolls dice and returns `{player_name, dice, valid_moves, suspects, weapons, current_position}` for display to the human.

### BaseAI Interface (`ai/base_ai.py`)

All agents implement this contract:

```python
class BaseAI:
    def choose_move(self, state, valid_moves) -> str | None: ...
    def make_suggestion(self, state) -> tuple[str, str, str]: ...
    def decide_accusation(self, state) -> bool | tuple[str, str, str]: ...
    def update_from_clue(self, card) -> None: ...       # called on reveal
    def handle_no_reveal(self, suggestion) -> None: ... # called on no-reveal
```

### Simulation System

- `GameState.clone()` provides deep copies for any search or rollout.
- States are **never mutated** during AI decisions — always clone first.
- `reveal_clue(suggestion, players, current_index)` from `engine/clue_reveal.py` resolves suggestions against real hands.
- Monte Carlo / MCTS rollouts run up to 50 steps per playout.

---

## 4. AI Algorithms

### Minimax (`ai/minimax_ai.py`)

- **Purpose**: Adversarial search treating the game as a two-sided min-max contest.
- **Decision style**: Depth-limited (default depth 2) tree search. Maximizing node = this AI; minimizing node = opponents; suggestion outcomes = chance branches.
- **Hidden info**: **Determinization** — samples 2+ worlds by randomly assigning unknown opponent cards consistent with visible hands; searches each world independently, averages scores.
- **Evaluation**: `StrategicEvaluationMixin.evaluate()` — 5-dimension weighted sum (see §5).
- **Where used**: Registered as `MinimaxAI` in the AI registry; available via API and benchmarks.

### Expectiminimax (`ai/expectiminimax_ai.py`)

- **Purpose**: Extends Minimax with explicit probabilistic chance nodes for suggestion outcomes.
- **Decision style**: Three node types — **max** (this AI acts), **chance** (probabilistic reveal/no-reveal outcome), **min** (opponent acts). Cycle: max → chance → min → max.
- **Chance node model**: Reveal probability = `1 / remaining_candidates`; no-reveal = complement. Each branch returns weighted expected value.
- **Where used**: Registered as `ExpectiminimaxAI`; depth matches `EXPECTIMINIMAX_DEPTH`.

### Negamax (`ai/negamax_ai.py`)

- **Purpose**: Equivalent reformulation of Minimax using sign-flip negation at each level.
- **Decision style**: Alpha-beta pruning; all nodes maximize the current player's negated child value. Cuts branches when `alpha >= beta`.
- **Where used**: Registered as `NegamaxAI`; depth matches `NEGAMAX_DEPTH`.

### MCTS (`ai/mcts_ai.py`)

- **Purpose**: Build and reuse a search tree using UCT bandit selection to balance exploration vs. exploitation.
- **Decision style**: Four-phase iteration (Selection → Expansion → Simulation → Backpropagation). Final move selected by **visit count** (robust).
  - **Selection**: UCT = `win_rate + C × √(ln(parent_visits) / visits)`; unvisited nodes score +∞.
  - **Expansion**: Apply one untried move (full turn: move + suggestion + reveal + Bayesian update).
  - **Simulation**: Random rollout up to `MCTS_ROLLOUT_DEPTH` steps; returns 1.0 if this AI wins.
  - **Backpropagation**: Walk to root; increment visits, accumulate reward (no sign-flip — Cluedo is racing, not zero-sum).
- **Move selection**: `make_suggestion()` uses notebook probability ranking (not MCTS) due to large suggestion space.
- **Where used**: Registered as `MctsAI`; configured by `MCTS_*` settings.

### IS-MCTS (`ai/ismcts_ai.py`)

- **Purpose**: Handles hidden information more robustly than standard MCTS by re-sampling a fresh determinization at each iteration.
- **Decision style**: Same four phases as MCTS, but each iteration starts from a different random world consistent with observed information. Tree is shared across iterations.
- **Benefit over MCTS**: More principled handling of belief state — avoids bias from a single fixed world.
- **Where used**: Registered as `IsMctsAI`; configured by `ISMCTS_*` settings.

### Bayesian Notebook (embedded in all agents)

- **Purpose**: Posterior probability tracker shared by all AI agents as their information model.
- **Decision style**: Not a search algorithm — a belief-state maintenance system. All agents read from it (`most_likely()`, `confident_accusation()`) and all clue reveals trigger updates.
- **Where used**: Every AI agent owns or reads from a `BayesianNotebook`; updates happen in `GameState.process_suggestion()`.

---

## 5. Evaluation System

### StrategicEvaluationMixin (used by Minimax, Negamax, Expectiminimax)

```
total_score = 40 × certainty
            + 20 × information_gain
            - 25 × risk
            - 15 × opponent_threat
            + 10 × position_score
            ± 10,000  (terminal win/loss bonus)
```

### Scoring Components

| Component | Method | Logic |
|---|---|---|
| **Certainty** | `score_certainty(state)` | Max posterior probability across all three categories (measures how close to solving) |
| **Information Gain** | `score_information_gain(state)` | Expected information from best suggestion: `P(reveal) × bits_per_reveal` |
| **Risk** | `score_risk(state)` | Negative; penalizes low-confidence accusation attempts |
| **Opponent Threat** | `score_opponent(state)` | Negative; penalizes when opponents have high certainty (racing pressure) |
| **Position** | `score_position(state)` | Proximity to the most-likely solution location on the board graph |

### Accusation Confidence (all agents)

```
confidence = min(max_suspect_prob, max_weapon_prob, max_location_prob)
accuse if confidence ≥ threshold  (default 0.70)
```

---

## 6. Data Flow

### Turn Lifecycle

```
GameState.run_turn()
  1. get_current_player()
  2. roll_dice() → last_dice_roll
  3. get_possible_moves() → valid_moves  (Dijkstra within dice budget)
  4. ai_agent.choose_move(state, valid_moves) → destination
  5. player.try_move(destination, valid_moves) → updates player.position
  6. ai_agent.make_suggestion(state) → (suspect, weapon, location)
  7. player.make_suggestion(...) → Suggestion object
  8. reveal_clue(suggestion, players, current_idx)
       → iterate players starting from current_idx+1
       → return first (revealer, card) match, or (None, None)
  9. IF card revealed:
       suggesting_player.notebook.eliminate(card.name)
       ai_agent.update_from_clue(card)
     ELSE (no reveal):
       for all active players:
         player.notebook.update_no_reveal(suspect, weapon, location, boost=2.0)
       ai_agent.handle_no_reveal(suggestion)
 10. ai_agent.decide_accusation(state)
       → False: pass
       → True or (s, w, l): make_accusation → check_accusation(solution)
         IF correct: game_over=True, winner=player
         IF wrong:   player.active=False
 11. next_turn() → skip inactive players, wrap around
```

### Game Modes

| Mode | Player mix | How turns resolve |
|---|---|---|
| AI vs AI | All `AIPlayer` | Fully automatic; `run_turn()` or `run_game()` with no callbacks |
| Human vs AI | Mix of `HumanPlayer` + `AIPlayer` | AI turns: automatic; human turns: callback or API |
| Human vs Human | All `HumanPlayer` | Every turn requires external input via callback or API |

#### API Turn Flow (session mode)

```
Frontend                              Server
  |                                     |
  |-- POST /turn {session_id} --------> |
  |                                     |  current player is AI?
  |                                     |    yes → run_turn() → return result
  |<-- {move, suggestion, ...} ---------|
  |                                     |  current player is human?
  |                                     |    yes → get_human_turn_context()
  |<-- {requires_human_input: true,     |         (rolls dice, stores in session)
  |     valid_moves, suspects, ...} ----|
  |                                     |
  | [Human picks move, suspect, weapon] |
  |                                     |
  |-- POST /human/turn                  |
  |   {session_id, move,                |
  |    suspect, weapon, accuse} ------> |
  |                                     |  execute_human_turn(dice, move, ...)
  |<-- {move, suggestion, revealed,     |  → apply suggestion → notebook update
  |     accusation, ...} ---------------|  → accuse if requested
```

### API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/game/start` | POST | Create session; supports `is_human: true` per player |
| `/turn` | POST | Execute next turn (auto-detects AI vs human) |
| `/human/turn` | POST | Submit human choices after `/turn` requests input |
| `/game/state` | GET | Read current session state |
| `/health` | GET | Liveness probe |

### AI Decision Flow (search-based agents)

```
choose_move(state, valid_moves):
  for each candidate_move in valid_moves:
    cloned_state = state.clone()
    apply_move(cloned_state, candidate_move)
    score = search_algorithm(cloned_state, depth)
  return argmax(score)

make_suggestion(state):
  candidates = cross(notebook.possible_suspects, notebook.possible_weapons)
  rank candidates by P(suspect) + P(weapon)
  evaluate top-N candidates via search or rollout
  return argmax(expected_value)

decide_accusation(state):
  confidence = min(max_p(suspect), max_p(weapon), max_p(location))
  if confidence >= threshold: return (best_suspect, best_weapon, best_location)
  return False
```

### Bayesian Update Flow

```
On reveal:
  notebook.eliminate(revealed_card)  →  P(card) = 0, renormalize

On no-reveal:
  notebook.update_no_reveal(suspect, weapon, location, boost=2.0)
  →  P(suggested_card) *= 2.0 for each of the three cards
  →  renormalize each category
```

---

## 7. Key Files and Responsibilities

| File | Role |
|---|---|
| `engine/game_state.py` | Central game state, turn loop, suggestion processing |
| `engine/board.py` | KUET campus graph; pathfinding and move reachability |
| `engine/clue_reveal.py` | Resolves suggestions against player hands |
| `models/player.py` | Player data and action methods; AIPlayer and HumanPlayer subclasses |
| `ai/notebook.py` | BayesianNotebook — shared belief state for all agents |
| `ai/base_ai.py` | Abstract BaseAI interface |
| `ai/board_utils.py` | Pathfinding wrappers and location scoring for AI use |
| `ai/minimax_ai.py` | Minimax + StrategicEvaluationMixin + determinization |
| `ai/expectiminimax_ai.py` | Expectiminimax with chance nodes |
| `ai/negamax_ai.py` | Negamax + alpha-beta pruning |
| `ai/mcts_ai.py` | Full MCTS with MCTSNode tree and UCT |
| `ai/ismcts_ai.py` | Information-Set MCTS (per-iteration determinization) |
| `config/settings.py` | All tunable constants; `get_config()` / `get_ai_config()` |
| `services/api.py` | Flask REST API; AI registry; session and stateless modes |
| `services/game_runner.py` | Single game execution + metrics collection |
| `main.py` | Benchmark entry point; runs N games, logs aggregate results |

---

## 8. Constraints

### Hidden Information

- Each player knows only their own hand; opponent hands are never directly observable.
- Revealed cards during suggestions are private: only the suggesting player learns the specific card.
- No-reveals are public: all players apply the Bayesian boost.
- Minimax / IS-MCTS handle hidden info via **determinization** (sampling consistent worlds).

### Performance Limits

| Parameter | Default | Effect |
|---|---|---|
| `MINIMAX_DEPTH` | 2 | Tree depth; depth 3 is max before timeout risk |
| `MINIMAX_DETERMINIZATION_SAMPLES` | 2 | Worlds per search; linear time multiplier |
| `MINIMAX_MAX_TREE_SUSPECT_CANDIDATES` | 3 | Candidate pruning in recursive search |
| `MINIMAX_MAX_TREE_WEAPON_CANDIDATES` | 3 | Candidate pruning in recursive search |
| `EXPECTIMINIMAX_DEPTH` | 2 | Chance node recursion depth |
| `NEGAMAX_DEPTH` | 2 | Alpha-beta search depth |
| `MCTS_ITERATIONS` | 50 | Tree iterations per move decision |
| `MCTS_ROLLOUT_DEPTH` | 50 | Steps per MCTS playout |
| `ISMCTS_ITERATIONS` | 50 | Tree iterations per move decision |
| `MAX_TURNS` | 250 | Hard game-length cap |

### Depth Limits

- Minimax/Negamax/Expectiminimax hard-cap at depth 3 to prevent search explosion.
- MCTS and Monte Carlo bound computation via iteration/simulation counts, not depth.
- All rollouts cap at `MCTS_ROLLOUT_DEPTH` (50) steps.

### Board Constraints

- **9 locations**: Auditorium, Student Welfare Center, IT Park, Cafeteria, Central Field, Amar Ekushey Hall, Begum Rokeya Hall, Lotus Pond, Pocket Gate.
- **Edge weights**: 2–4 squares (corridor distances, modeled as weighted graph edges).
- **Secret passages**: Auditorium ↔ Pocket Gate, Lotus Pond ↔ Begum Rokeya Hall.
- Movement budget = dice roll total; reachability computed via Dijkstra.
- A player at `position=None` may teleport to any location (game start).

---

## 9. Known Limitations

### Partial Implementations

- **NegamaxAI**: Core alpha-beta structure is present but not fully optimized for this game context; suggestion-phase search is a skeleton.
- **ExpectiminimaxAI**: Chance node probabilities use a simplified model (`1 / remaining_candidates`) rather than per-player hand-size weighting.
- **IS-MCTS**: Implemented but not extensively benchmarked against standard MCTS.

### Simplifications

- **Minimax opponent model**: Assumes all opponents play adversarially (minimizing). In reality, Cluedo opponents are racing, not coordinating against one player.
- **MCTS backpropagation**: No sign-flip at opponent nodes (treated as cooperative/racing rather than zero-sum). This is intentional but departs from standard MCTS theory.
- **Suggestion location**: Agents always suggest in their current room; no separate optimization of which room to move to in order to make a better suggestion.
- **Card reveal privacy**: When an opponent reveals a card during another player's suggestion, AI agents do not model which specific card was shown (only the suggesting player learns).
- **Determinization scope**: Only Minimax and IS-MCTS use determinization. MCTS relies on rollouts with real card sets but does not explicitly enumerate worlds.
- **No bluffing**: No agent models deceptive suggestion strategies to mislead opponents.
- **Single Bayesian update**: The notebook uses a simple multiplicative boost for no-reveals, not a full likelihood-ratio update over hand-size distributions.
