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

## 6. Target AI Architecture

Implement AI policies as interchangeable agents using a common interface.

### 6.1 Agent Contract

Agents should expose:

- `choose_move(game_state, valid_moves)`
- `make_suggestion(game_state)`
- `make_accusation(game_state)`
- `update_knowledge(suggestion, player_who_showed, card_shown=None)`

`ai/base_ai.py` is the contract anchor.

### 6.2 Policy Families to Support

1. Random AI (baseline)
2. Rule-based heuristic AI
3. Minimax-style planning AI (where computationally feasible)
4. Bayesian / probabilistic deduction AI

All advanced policies should degrade gracefully when information is sparse.

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

1. Complete `RuleBasedAI` using `KnowledgeBase` and `board_utils` scoring.
2. Implement full suggestion resolution in engine flow (including turn order reveal logic).
3. Add AI-only game loop manager for end-to-end matches.
4. Build simulation runner with reproducible seeds and aggregated metrics.
5. Add Bayesian agent prototype and compare against baseline agents.
6. Add test suite for engine invariants and AI policy behavior.

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