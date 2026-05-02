# AI Techniques — Murder in KUET

## 1. Overview

### What problem are the AI agents solving?

Murder in KUET is an imperfect-information deduction game.  Each AI agent
must solve a three-part mystery (suspect + weapon + location) while competing
against other agents on the same board.  The core challenge is:

- **Hidden information** — each player knows only their own cards; opponent
  hands and the solution are unobservable.
- **Racing dynamics** — multiple agents compete simultaneously; the first to
  make a correct accusation wins.
- **Bayesian inference under uncertainty** — every suggestion and reveal (or
  non-reveal) is evidence that must be combined with prior beliefs.

### Role of AI in the game

Each AI agent controls one player and makes three decisions per turn:

| Decision | Method | Scope |
|---|---|---|
| **Move** | `choose_move(state, valid_moves)` | Which room to enter this turn |
| **Suggest** | `make_suggestion(state)` | Which (suspect, weapon, location) to name |
| **Accuse** | `decide_accusation(state)` | Whether to make a final accusation |

All agents share a `BayesianNotebook` that tracks posterior probabilities over
all cards.  Search-based agents additionally use a minimax-family or MCTS tree
to look ahead before choosing.

---

## 2. Algorithms

### 2.1 Minimax with Alpha-Beta Pruning (`ai/minimax_ai.py`)

#### How it works

Minimax models the game as a two-player adversarial tree:

```
Root (max — our AI)
 ├── Move A → Chance (opponent may reveal)
 │     ├── Min (opponent's best response)
 │     │     └── ... (depth - 1)
 │     └── ...
 └── Move B → ...
```

Each node is evaluated with `StrategicEvaluationMixin.evaluate()` at the leaf.
The maximizer picks the move that leads to the best worst-case outcome.

**Alpha-beta pruning** eliminates branches that cannot affect the final
decision:

- **β-cutoff** (maximizer): once a move scores ≥ β (the minimizer's
  guaranteed cap), the minimizer would never allow this path — skip it.
- **α-cutoff** (minimizer): once a move scores ≤ α (the maximizer's
  guaranteed floor), the maximizer already has a better option — skip it.

**Move ordering** is applied before each loop: candidate moves are pre-scored
at depth 0 and sorted so the most promising moves are tried first.  This
maximises early cutoffs and can reduce the effective branching factor from
O(b^d) to approximately O(b^(d/2)) in the best case.

**Candidate pruning** for suggestions: pairs are ranked by combined Bayesian
probability (`P(suspect) + P(weapon)`) and only the top `max_s × max_w`
candidates are evaluated (configurable via `AI_CONFIG`).

#### Why it is used

Minimax provides **deterministic, worst-case optimal** play.  It is the
conceptual baseline against which all other agents are measured.

#### Where it is applied

- `choose_move`: scores each valid destination by searching the resulting tree.
- `make_suggestion`: scores top-ranked suspect+weapon pairs.
- `decide_accusation`: delegates to `BayesianNotebook.confident_accusation()`.

#### When it is most effective

Minimax is most effective in the **mid-to-late game** when the suggestion space
has been narrowed and fewer moves need to be evaluated.  It performs poorly
when the branching factor is high (early game, many candidates) because even
alpha-beta cannot fully compensate for combinatorial explosion at depth ≥ 3.

---

### 2.2 Expectiminimax (`ai/expectiminimax_ai.py`)

#### How it works

Expectiminimax extends Minimax with a third node type — **chance nodes** —
that model probabilistic outcomes such as card reveals:

```
Max (our turn)
 └── Chance (suggestion outcome)
       ├── P(reveal)     → Min (opponent's turn)
       └── P(no-reveal)  → Min (opponent's turn)
```

The chance node computes a **weighted expected value** across all probabilistic
branches:

```
E[state] = Σ P(outcome_i) × expectiminimax(state_i, depth-1, "min")
```

The reveal probability uses the model:
```
P(reveal) = 1 / (|possible_suspects| + |possible_weapons|)
```

**Alpha-beta pruning** is applied at max and min nodes.  Chance nodes thread
the bounds to their children but do not themselves hard-prune (the expected
value requires all branch contributions).

#### Why it is used

Expectiminimax provides a more **principled treatment of uncertainty** than
plain Minimax.  Rather than ignoring the probabilistic nature of reveals, it
explicitly weights each outcome by its likelihood.

#### Where it is applied

Same decision points as Minimax (`choose_move`, `make_suggestion`,
`decide_accusation`), but with chance nodes between each ply.

#### When it is most effective

Expectiminimax is most effective when **probability estimates are reliable**
(mid-game, after several suggestions have refined the notebook).  Early-game
uniform priors make the chance-node model less informative.

---

### 2.3 Negamax with Alpha-Beta (`ai/negamax_ai.py`)

#### How it works

Negamax is an algebraically equivalent reformulation of Minimax that eliminates
the explicit maximizing/minimizing distinction.  Every node maximizes the
**negated** child value:

```
negamax(state, depth, α, β) = max over moves of:
    -negamax(child, depth-1, -β, -α)
```

This works because in a two-player zero-sum game, the opponent's loss equals
our gain.  Alpha-beta pruning is identical in structure to Minimax but the sign
flip means the same `α ≥ β` cutoff condition applies at every node.

Depth is capped at 3 (same as Minimax) to prevent search explosion.

#### Why it is used

Negamax is a **cleaner implementation** of Minimax: fewer code paths, identical
pruning logic at every node, and easier to extend (e.g., adding iterative
deepening or transposition tables in future work).

#### Where it is applied

Same interface as Minimax.  The Negamax tree is searched for both move and
suggestion decisions.

#### When it is most effective

Negamax performs similarly to Minimax.  Because Cluedo is a racing game (not
purely zero-sum), the sign-flip assumption is an approximation — opponents are
not actively trying to prevent our win, they are racing to win themselves.  The
algorithm still provides useful heuristic guidance.

---

### 2.4 MCTS — Monte Carlo Tree Search (`ai/mcts_ai.py`)

#### How it works

MCTS builds a search tree incrementally through four phases per iteration:

```
1. Selection    — traverse the tree with UCT until an unexpanded node
2. Expansion    — apply one untried move, create a child node
3. Simulation   — random rollout from the child to termination (max 50 steps)
4. Backpropagation — walk to root, updating visits and wins along the path
```

**UCT (Upper Confidence Bound applied to Trees)** balances exploration and
exploitation during selection:

```
UCT(node) = win_rate + C × √(ln(parent_visits) / visits)
          = exploitation  +  exploration bonus
```

where `C = √2 ≈ 1.414` (theoretically optimal for [0,1]-normalised rewards).
Unvisited nodes receive a score of +∞, guaranteeing each child is tried at
least once before revisiting.

**Final move selection** uses **visit count** (not win rate) because it is more
statistically stable — a lucky last-second rollout cannot flip the decision.

**Backpropagation** increments visits and accumulates reward (1.0 for our win,
0.0 for loss) from child to root without sign-flipping at opponent nodes.  This
models Cluedo as a **racing game**, not zero-sum adversarial: opponents are
trying to win, not actively trying to make us lose.

#### Why it is used

MCTS is particularly well-suited to Cluedo because:

1. The state space is too large for full enumeration but rollouts provide fast
   noisy estimates.
2. Unlike Minimax, MCTS does not require a hand-crafted evaluation function —
   the win/loss signal from rollouts provides the feedback.
3. It handles the imperfect-information setting implicitly: rollouts use the
   real card distribution in the cloned game state, so Bayesian updates
   accumulate naturally.

#### Where it is applied

- `choose_move`: MCTS tree is built from the current state; the most-visited
  child's move is returned.
- `make_suggestion`: Uses `BayesianNotebook.most_likely()` directly (the
  suggestion space is too large for tree search).
- `decide_accusation`: Notebook confidence threshold (same as Minimax).

#### When it is most effective

MCTS excels when:
- The search budget (iterations) is sufficient to distinguish good from bad moves.
- The game is in an **exploration phase** where the correct move is unclear and
  rollout diversity is more informative than deep deterministic search.
- The **late game** (few candidates) — rollouts almost always reach a win/loss
  terminal within 50 steps, giving high-quality feedback.

---

### 2.5 Bayesian Notebook (`ai/notebook.py`)

#### How it works

Every player owns a `BayesianNotebook` that maintains a posterior probability
distribution over all cards in each category:

```
suspects:  { "Chef": 0.33, "Hallboy": 0.33, "Student Boy": 0.33, ... }
weapons:   { "Knife": 0.25, "Rope": 0.25, ... }
locations: { "Auditorium": 0.11, ... }
```

Each category is normalised to sum to 1.0.  Two update rules apply:

**On reveal** (a card is shown to us):
```
eliminate(card) → P(card) = 0, renormalise remaining cards in category
```

**On no-reveal** (no opponent can disprove our suggestion):
```
update_no_reveal(suspect, weapon, location, boost=2.0)
→ P(suggested_card) *= 2.0  for each of the three suggested cards
→ renormalise each category
```

The multiplicative boost models the Bayesian likelihood update: if no one holds
any of the three suggested cards, the probability that each is the solution card
increases.

#### Why it is used

All search algorithms operate on a cloned, incomplete view of the game state.
The notebook gives them a **compact belief representation** that:

- summarises all accumulated evidence in O(n) space (n = total cards)
- provides fast `most_likely()` and `confident_accusation()` queries
- supports the `evaluate()` function's certainty and information-gain components

#### Where it is applied

- Updated by `GameState.process_suggestion()` after every real-game suggestion.
- Read by all agents via `most_likely()` for suggestion and accusation decisions.
- Read by `StrategicEvaluationMixin.evaluate()` for state scoring.

---

## 3. Algorithm Comparison

| Property | Minimax | Expectiminimax | Negamax | MCTS |
|---|---|---|---|---|
| **Type** | Deterministic tree | Probabilistic tree | Deterministic tree | Simulation |
| **Handles uncertainty** | Via determinization | Via chance nodes | Via determinization | Via rollout diversity |
| **Evaluation function** | Required | Required | Required | Not required |
| **Depth limit** | 3 | 2 | 3 | Iteration budget |
| **Alpha-beta pruning** | ✔ | ✔ (max/min only) | ✔ | N/A |
| **Move ordering** | ✔ | Partial | ✗ | UCT selection |
| **Opponent model** | Adversarial (min) | Adversarial (min) | Adversarial (negated) | Racing (no sign flip) |
| **Computational cost** | Medium | High | Medium | Configurable |
| **Best case scenario** | Mid-to-late game | Mid game (good priors) | Mid-to-late game | Late game / exploration |

### Deterministic vs Probabilistic vs Simulation

**Deterministic (Minimax / Negamax):**
- Pros: reproducible, interpretable, guaranteed best-depth play
- Cons: ignores the stochastic nature of reveals; opponent model is approximate

**Probabilistic (Expectiminimax):**
- Pros: explicitly models reveal uncertainty; more accurate expected values
- Cons: higher branching factor (chance nodes multiply paths); probability model is simplified

**Simulation (MCTS):**
- Pros: adapts naturally to any game structure; no hand-crafted evaluation needed; handles imperfect information via rollout diversity
- Cons: high variance with few iterations; move selection is heuristic not optimal; rollout quality limits decision quality

---

## 4. System Integration

### GameState interaction

All AI decision methods receive a `GameState` snapshot.  The engine guarantees:

1. The state passed to AI methods is a **deep copy** — agents may clone it
   further but must never mutate it.
2. `GameState.clone()` produces a fully independent copy for tree search and
   rollouts.
3. `GameState.get_possible_moves()` uses Dijkstra's algorithm to return all
   rooms reachable within the dice budget (including multi-hop paths).

### BayesianNotebook interaction

```
Real game turn:
  process_suggestion(player, suggestion)
    → reveal_clue() → (revealer, card)
    → IF card: player.notebook.eliminate(card.name)  [private]
    → IF no reveal: all_notebooks.update_no_reveal(s, w, l)  [public]
    → AI hooks: update_from_clue(card) / handle_no_reveal(suggestion)

AI search:
  minimax(state, depth) → evaluate(state)
    → score_certainty: reads notebook.possible_suspects/weapons/locations
    → score_information_gain: counts remaining candidates
    → score_risk: penalises large search space
    → score_opponent: counts opponent card advantage
```

### Evaluation function (`StrategicEvaluationMixin.evaluate`)

```
total_score = 40 × certainty_score
            + 20 × information_gain_score
            − 25 × risk_score
            − 15 × opponent_threat_score
            ± 10,000  (terminal win/loss bonus)
```

| Component | Logic |
|---|---|
| **certainty** | +10 per category solved, +5 per category with ≤ 2 candidates |
| **information_gain** | `(30 − total_remaining_candidates) × 2` |
| **risk** | −20 when remaining space exceeds 10 triples |
| **opponent_threat** | −1 per opponent card (proxy for opponent progress) |

Used by: `MinimaxAI`, `NegamaxAI`, `ExpectiminimaxAI`.
Not used by: `MctsAI` (uses rollout win/loss signal instead).

---

## 5. Board and Pathfinding

### Board representation

The KUET campus is modelled as a **weighted undirected graph** (NetworkX) with:

- **9 nodes** (rooms): Auditorium, Student Welfare Center, IT Park, Cafeteria,
  Central Field, Amar Ekushey Hall, Begum Rokeya Hall, Lotus Pond, Pocket Gate.
- **12 weighted edges**: corridor lengths in squares (weights 2–4).
- **2 secret passages**: Auditorium ↔ Pocket Gate, Lotus Pond ↔ Begum Rokeya Hall
  (free movement, no step cost).

### Dijkstra-based movement (`board.get_valid_moves`)

Valid destinations are computed with Dijkstra's algorithm over the weighted
graph.  A room is reachable if its **shortest-path cost** (sum of corridor
weights along the cheapest route) does not exceed the dice total:

```python
# Rooms reachable from "Auditorium" with dice total = 6:
#   Student Welfare Center  (cost 4) ✔
#   Lotus Pond              (cost 2) ✔
#   Cafeteria               (SWC + Cafeteria = 4 + 3 = 7) ✗
#   IT Park                 (SWC + IT Park   = 4 + 4 = 8) ✗
```

This correctly models Cluedo movement: a player may traverse multiple corridors
in one turn provided the cumulative square count stays within the dice budget.

Secret passages are appended as a separate step (cost-free) after the Dijkstra
pass, matching the Cluedo rule that passages are an alternative to dice movement.

### Shortest-path cost (`board.get_shortest_path_cost`)

Returns the minimum step cost between any two rooms using NetworkX's weighted
shortest-path algorithm.  AI agents (particularly the position scoring
component of the evaluation function) use this to estimate how many turns it
will take to reach a candidate solution room.

---

## 6. Optimization Notes

### Alpha-beta pruning (Minimax, Negamax, Expectiminimax)

Alpha-beta pruning reduces the effective branching factor from O(b^d) toward
O(b^(d/2)) in the best case.  Key parameters:

- `alpha`: maximizer's best score seen so far (lower bound).  A subtree is
  pruned when its value ≤ alpha (the maximizer has a better alternative).
- `beta`: minimizer's best score seen so far (upper bound).  A subtree is
  pruned when its value ≥ beta (the minimizer has a better alternative).

Both bounds are initialised to (−∞, +∞) at the root and tightened as better
moves are found.  They are threaded through the recursion so child nodes
inherit the tighter window.

### Move ordering (Minimax)

Ordering moves so the most promising candidates are tried first is critical for
alpha-beta effectiveness.  `MinimaxAI._order_moves()` pre-evaluates each
successor state at depth 0 and sorts descending (for the maximizer).

On the 9-node KUET board, the pre-evaluation overhead is negligible.  Empirical
speedup is typically 2–4× fewer nodes visited compared to random ordering.

### Simulation limits (MCTS)

- `MCTS_ITERATIONS` (default 50): total tree-building iterations per decision.
  Higher values improve decision quality at linear time cost.
- `MCTS_ROLLOUT_DEPTH` (default 50): step cap per rollout.  Prevents infinite
  loops in degenerate states without limiting normal-game coverage.
- `MCTS_EXPLORATION_CONSTANT` (default √2 ≈ 1.414): UCT trade-off parameter.
  Increase for more exploration (useful in early game with high uncertainty);
  decrease for more exploitation (useful in late game with few candidates).

### Candidate pruning (Minimax suggestion search)

Evaluating all (suspect, weapon) pairs at depth > 1 is expensive.  Minimax
limits evaluation to the top `max_s × max_w` pairs (default 3 × 3 = 9) ranked
by Bayesian notebook probability.  This focuses computation on the most likely
combinations without sacrificing accuracy at the high end of the distribution.

### Depth limits

| Algorithm | Max depth | Reason |
|---|---|---|
| Minimax | 3 | Search tree grows as O(9^d); depth 4 risks timeout |
| Negamax | 3 | Same as Minimax |
| Expectiminimax | 2 | Chance nodes double the branching factor per ply |
| MCTS | N/A | Bounded by iteration count and rollout depth cap |
