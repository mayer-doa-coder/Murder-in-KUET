# Murder In KUET - AI vs AI Development Instructions

## 1. Mission and Product Intent

Build this project as a Cluedo-inspired detective simulation where all participants are AI agents. The game is set on a KUET-themed map and should prioritize deduction quality, strategic movement, and reproducible AI benchmarking over UI complexity.

This repository should evolve into:

- A complete turn-based inference game engine.
- A multi-agent research sandbox for comparing AI strategies.
- A deterministic experiment environment for AI-vs-AI tournaments.

The primary output is not just "a playable game" but a measurable AI system where reasoning behavior can be observed, compared, and improved.

## 2. Scope: AI-vs-AI Only

All core systems must optimize for AI-vs-AI gameplay.

- Required: full AI turn automation.
- Required: support mixed AI policies in one match.
- Required: simulation mode for repeated runs.
- Optional: CLI visualization for logs.
- Not required for the core milestone: human input flow, GUI, online multiplayer.

If a feature does not improve AI match quality, simulation throughput, or analysis quality, it is lower priority.

## 3. Game Identity and Theme

The game is a KUET-themed adaptation of classic Cluedo mechanics.

### 3.1 Mystery Structure

Every match has exactly one hidden solution:

- 1 suspect
- 1 weapon
- 1 location

At game setup:

1. One card from each category becomes the hidden solution.
2. Remaining cards are dealt among active players.
3. Players use suggestions and card revelations to eliminate possibilities.
4. A final accusation ends in either victory (correct) or elimination (wrong).

### 3.2 Current Card Universe in This Repository

Use the current source of truth in `engine/cards.py`.

- Suspects: Hashem Sir, Opi Sir, Tawhid, Shejan, Hasina, Trump
- Weapons: Knife, Poison, Wrench, Laptop Charger, Anti Cutter, Pipe
- Locations: Library, Academic Building, Amar Ekushey Hall, Cafeteria, Central Field, IT Park, Rokeya Hall, VC Room, Pocket Gate

Design note:
If thematic names are changed later (for example to more generic Cluedo-style roles), update all category lists and tests consistently.

### 3.3 Board Identity

The board is a graph of KUET locations where edge weights represent corridor movement cost. Movement obeys dice budget plus optional secret passages. This is already partially modeled in `engine/board.py`.

## 4. Canonical Gameplay Rules

All AI agents must operate under these rules.

### 4.1 Turn Phases

Each active player turn follows:

1. Roll dice (2d6 by default).
2. Compute legal destinations from weighted graph and secret passage options.
3. Move (or stay if no legal move / strategic choice).
4. Make suggestion in current room.
5. Resolve suggestion by asking other players in turn order.
6. Update private knowledge model with observed evidence.
7. Optionally make final accusation.

### 4.2 Suggestion Resolution Semantics

- A suggestion contains suspect, weapon, and current room.
- Other players are checked in order after the suggester.
- The first player able to disprove reveals exactly one matching card.
- If no player can disprove, this is high-value evidence but not guaranteed proof.
- Knowledge updates are perspective-dependent:
  - The suggester may see a specific card.
  - Other players may only observe that "someone showed" or "nobody showed".

### 4.3 Elimination and Win Conditions

- Correct accusation: immediate win.
- Wrong accusation: player is eliminated from future turns.
- Game ends when one player wins or all remaining players cannot continue.

## 5. Current Repository Baseline

### 5.1 Implemented Foundations

- Card model and deck generation: `engine/cards.py`
- Weighted board and secret passages: `engine/board.py`
- Core game state container: `engine/game_state.py`
- Player and AIPlayer flow: `engine/player.py`
- Dice model: `engine/dice.py`
- Baseline random policy: `ai/random_ai.py`
- Knowledge base scaffold and feature extraction: `ai/knowledge_base.py`, `ai/features.py`

### 5.2 Partial / Incomplete Modules

- Rule-based policy scaffold: `ai/rule_based_ai.py`
- Turn manager scaffold: `engine/turn_manager.py`
- API scaffold: `api/server.py`
- CLI currently mixes human + AI; this project target is AI-only simulation.

## 6. Search-Based AI Architecture (Primary)

The AI system now follows a strict search-based architecture for competitive AI-vs-AI play.

Core characteristics:

- Adversarial search algorithms drive move selection.
- Forward-looking decision-making is required (multi-ply reasoning).
- Multi-agent competitive reasoning is the default model.

Legacy and baseline policies (Random, Rule-Based, Bayesian) remain in the codebase for benchmarking and ablation studies, but the primary AI track is now the three search agents below.

### 6.1 AI Role Definitions

AI-1: Minimax

- Deterministic adversarial search.
- Assumes opponents play optimally.
- Used as the primary reference implementation for exact game-tree reasoning.

AI-2: Expectiminimax

- Extends adversarial search with chance nodes.
- Handles uncertainty through probability-weighted outcomes.
- Used when stochastic game events (for example dice outcomes or uncertain reveals) must be modeled explicitly.

AI-3: Negamax with Alpha-Beta Pruning

- Algebraic reformulation of minimax with pruning optimization.
- Reduces effective branching cost while preserving optimal play under the same evaluation function.
- Default choice for deeper search and scalable simulation runs.

### 6.2 Unified Decision Interface (Mandatory)

All search agents must route final decision selection through a unified API:

- `choose_action(state)`

Rules:

- No agent may bypass this interface for turn-critical choices.
- Adapter layers may map engine events (move/suggest/accuse) into action objects, but search selection must happen through `choose_action(state)`.
- No hardcoded, one-off decision branches inside agent classes.

### 6.3 Game State Requirements for Search

Search-compatible state objects must include, at minimum:

- player positions
- known cards and unknown cards
- notebook data (possible/ruled-out cards)
- current turn metadata
- active player set

State rules:

- State must be immutable during evaluation.
- State must be cloneable for branching simulations.
- Transition functions must produce new state snapshots, never in-place mutations inside tree expansion.

### 6.4 Shared Evaluation Function (Mandatory)

All three search agents must use a shared evaluation function contract.

Scoring must include:

- information gain
- probability of true solution convergence
- opponent advantage / threat level

Implementation rule:

- Agent-specific search logic may differ, but terminal and heuristic value computation must flow through a shared evaluator module to keep comparisons fair.

## 7. Knowledge and Inference Design

### 7.1 Minimum Knowledge Representation

Per agent, track:

- Known cards (confirmed not in envelope)
- Eliminated cards by category
- Remaining candidate sets for suspect/weapon/location
- Suggestion history (who suggested what, who disproved)
- Optional per-opponent possibility constraints

### 7.2 Probabilistic Extension

For Bayesian AI, maintain a belief distribution over all candidate triplets:

- Initialize with uniform prior over legal solution triples.
- Update posterior from each suggestion outcome.
- Choose actions maximizing expected information gain or win probability.

### 7.3 Accusation Policy

Accusation should be risk-aware:

- Deterministic agents accuse only at certainty threshold.
- Probabilistic agents accuse when posterior confidence exceeds threshold.
- Threshold may adapt to game phase and number of active opponents.

## 8. Movement Strategy Guidelines

Movement should maximize deduction value, not random wandering.

- Prefer reachable rooms with unresolved location uncertainty.
- Penalize repeatedly revisiting fully-explored rooms.
- Use secret passages when they significantly improve information gain.
- In late game, prioritize rooms needed for final confirmation.

`ai/board_utils.py` is the primary helper layer for movement reasoning.

## 9. Simulation and Benchmarking Requirements

AI-vs-AI experiments are first-class features.

### 9.1 Simulation Runner

Add a simulation module that can:

- Run N games for a specified set of agent configurations.
- Control RNG seed for reproducibility.
- Output per-game logs and aggregate metrics.

### 9.2 Core Metrics

Track at minimum:

- Win rate by agent type
- Average turns to win
- Wrong accusation rate
- Suggestion efficiency (new information per turn)
- Elimination timing distribution

### 9.3 Output Artifacts

- Machine-readable results (CSV or JSON)
- Optional visual summary plots
- Clear experiment metadata (seed, game count, agent versions)

## 10. Engineering Standards

### 10.1 Code Quality

- Keep modules single-responsibility.
- Preserve clear docstrings and type-friendly interfaces.
- Avoid hidden state mutations across engine boundaries.

### 10.2 Determinism and Testing

- Isolate random behavior behind controlled RNG points.
- Add tests for setup correctness, suggestion resolution, elimination, and accusation outcomes.
- Add policy-level tests for deterministic heuristics under fixed seeds.

### 10.3 Performance

- Simulation mode should favor throughput.
- Avoid expensive deep-copy operations in tight loops unless required.
- Use memoization for repeated board/path computations when beneficial.

## 11. API and CLI Direction

### 11.1 CLI

CLI should support:

- AI-vs-AI quick match
- AI-vs-AI batch simulation
- Structured turn-by-turn logs

Human prompts are non-essential for the core milestone.

### 11.2 API

FastAPI endpoints should prioritize programmatic control of simulations:

- create match
- step match
- run full simulation set
- fetch metrics and logs

## 12. Near-Term Implementation Roadmap

1. Complete and stabilize current baseline loop modules (suggestion, reveal, notebook, accusation readiness).
2. Preserve baseline agents (`RandomAI`, rule-based, Bayesian track) as benchmark controls.
3. Day-5: implement AI-1 Minimax with `choose_action(state)` integration.
4. Day-6: implement AI-2 Expectiminimax with explicit chance-node modeling.
5. Day-7: implement AI-3 Negamax with Alpha-Beta pruning and depth-scaling tests.
6. Unify all three search agents under one shared evaluator and immutable cloneable state transitions.
7. Run cross-agent tournament benchmarks and publish comparative metrics.

## 13. Non-Goals for Now

- Full graphical board UI.
- Real-time networked multiplayer.
- Complex animation pipelines.
- Over-engineered microservice decomposition.

## 14. Contributor Guidance for Any AI Assistant

When generating or modifying code in this repository:

- Treat AI-vs-AI simulation capability as the primary product requirement.
- Keep rules consistent with Cluedo-like deduction mechanics.
- Prefer incremental, testable changes over broad rewrites.
- Document assumptions about hidden information and observation scope.
- Ensure any new AI policy can be benchmarked against RandomAI.

If there is a conflict between theme flavor and inference correctness, prioritize inference correctness.

## 15. Long-Term Vision

Murder In KUET should become both:

- A strategic deduction game engine, and
- A compact academic testbed for multi-agent reasoning under uncertainty.

Success means not only that games run, but that agent behavior is interpretable, comparable, and improvable over repeated experiments.