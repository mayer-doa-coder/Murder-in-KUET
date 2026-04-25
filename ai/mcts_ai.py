"""
mcts_ai.py — Monte Carlo Tree Search AI for Murder in KUET

Implements full MCTS across four explicit phases per iteration:

    Selection   → traverse tree with UCT until an unexpanded node
    Expansion   → apply one untried move (+ full turn) and attach child
    Simulation  → random rollout from child state to termination
    Backpropagation → update visits and wins along the path to root

After N iterations the move whose child node has the highest visit count is
returned.  Visit count is preferred over win rate for final selection because
it is more statistically stable — a lucky last-second rollout cannot flip the
decision.

Architecture
------------
  MCTSNode                  – tree node: state, stats, untried moves, UCT
  MctsAI(BaseAI)
  │
  ├── _run_mcts()           – outer loop (Selection→Expansion→Sim→BP)
  ├── _select()             – UCT traversal to the first unexpanded node
  ├── _expand()             – apply one untried move and create child
  ├── _simulate()           – random rollout, returns win/loss float
  ├── _backpropagate()      – walk to root, updating every node
  │
  ├── choose_move()         – run MCTS, return most-visited child's move
  ├── make_suggestion()     – Bayesian-ranked pair (no tree over suggestions)
  └── decide_accusation()   – notebook confidence threshold

Design notes
------------
* States are NEVER mutated. Every expansion and simulation deep-copies via
  GameState.clone() before applying any action.
* The reward signal is always from OUR player's perspective (1.0 = we win).
  At opponent nodes we still maximise OUR win rate — this models Cluedo as
  a racing game rather than a zero-sum adversarial game, which is accurate
  since players cannot directly remove information from one another.
* Hidden information (other players' cards) is handled implicitly: rollouts
  use reveal_clue() against real card sets in the cloned state, and Bayesian
  notebook updates track accumulated evidence across the real game.
"""

from __future__ import annotations

import logging
import math
import random
from copy import deepcopy
from time import perf_counter
from typing import Any, Sequence

from ai.base_ai import BaseAI
from config.settings import AI_CONFIG, get_positive_int
from engine.clue_reveal import reveal_clue
from models.suggestion import Suggestion
from utils.helpers import safe_random_choice


logger = logging.getLogger(__name__)

# Rollout step cap — matches MonteCarloAI; 50 covers the vast majority of
# real Cluedo games without risking an infinite loop in degenerate states.
_MAX_ROLLOUT_STEPS = 50


# ---------------------------------------------------------------------------
# Tree Node
# ---------------------------------------------------------------------------


class MCTSNode:
    """A single node in the MCTS game tree.

    Stores the game state, parent/child relationships, and the accumulated
    statistics (visits, wins) used by UCT to guide tree growth.

    Attributes
    ----------
    state       : deep-copied GameState snapshot — never shared with siblings.
    parent      : parent MCTSNode, or None for the root.
    move        : the move applied to parent.state to reach this state.
    children    : child nodes created so far by expansion.
    visits      : number of times this node has been visited (backpropagated).
    wins        : accumulated reward (1.0 per win) from all visits.
    untried_moves : moves not yet expanded into children; shuffled at init
                    so selection order is unbiased.
    """

    __slots__ = (
        "state", "parent", "move",
        "children", "visits", "wins", "untried_moves",
    )

    def __init__(
        self,
        state: Any,
        parent: "MCTSNode | None" = None,
        move: str | None = None,
    ) -> None:
        self.state = state
        self.parent: MCTSNode | None = parent
        self.move: str | None = move

        self.children: list[MCTSNode] = []
        self.visits: int = 0
        self.wins: float = 0.0

        # Collect valid moves for this state and shuffle immediately so the
        # expansion order does not systematically favour the first legal move.
        if getattr(state, "game_over", False):
            self.untried_moves: list[str] = []
        else:
            moves = list(state.get_possible_moves())
            random.shuffle(moves)
            self.untried_moves = moves

    # ------------------------------------------------------------------
    # Derived properties
    # ------------------------------------------------------------------

    @property
    def win_rate(self) -> float:
        """Average reward across all visits; 0 when unvisited."""
        return self.wins / self.visits if self.visits else 0.0

    def is_fully_expanded(self) -> bool:
        """True when every reachable move has a corresponding child node."""
        return len(self.untried_moves) == 0

    def is_terminal(self) -> bool:
        """True when the game is over or only one active player remains."""
        if getattr(self.state, "game_over", False):
            return True
        try:
            return len(self.state.get_active_players()) <= 1
        except Exception:
            return False

    # ------------------------------------------------------------------
    # UCT selection
    # ------------------------------------------------------------------

    def uct_value(self, parent_visits: int, exploration_constant: float) -> float:
        """Upper Confidence Bound for Trees (UCT1) score.

        UCT = win_rate  +  C × √( ln(parent_visits) / visits )
               ↑ exploitation        ↑ exploration bonus

        Unvisited nodes return +∞ so they are always prioritised over any
        partially-explored child — this guarantees every child is visited
        at least once before the algorithm revisits any of them.

        Args:
            parent_visits: Total visits of this node's parent.
            exploration_constant: C in the formula above.  sqrt(2) is the
                theoretically optimal value for rewards in [0, 1].

        Returns:
            float: UCT score, or +inf for an unvisited node.
        """
        if self.visits == 0:
            return float("inf")
        exploitation = self.wins / self.visits
        exploration = exploration_constant * math.sqrt(
            math.log(parent_visits) / self.visits
        )
        return exploitation + exploration

    def best_child(self, exploration_constant: float) -> "MCTSNode":
        """Return the child with the highest UCT score.

        Raises ValueError when called on a leaf with no children.
        """
        if not self.children:
            raise ValueError("Node has no children — cannot select best child")
        return max(
            self.children,
            key=lambda c: c.uct_value(self.visits, exploration_constant),
        )

    def most_visited_child(self) -> "MCTSNode":
        """Return the child visited most often (robust final-move criterion).

        Preferred over highest win-rate for final move selection because a
        high visit count requires sustained good performance across many
        rollouts, not just a lucky final sample.

        Raises ValueError when called on a leaf with no children.
        """
        if not self.children:
            raise ValueError("Node has no children")
        return max(self.children, key=lambda c: c.visits)

    # ------------------------------------------------------------------
    # Tree modification
    # ------------------------------------------------------------------

    def add_child(self, move: str, child_state: Any) -> "MCTSNode":
        """Create a child node for move, attach it, and return it.

        Removes move from untried_moves so the tree tracks expansion
        progress correctly.
        """
        if move in self.untried_moves:
            self.untried_moves.remove(move)
        child = MCTSNode(state=child_state, parent=self, move=move)
        self.children.append(child)
        return child

    def update(self, reward: float) -> None:
        """Increment visits and accumulate reward (called by backpropagation)."""
        self.visits += 1
        self.wins += reward

    # ------------------------------------------------------------------
    # Debugging
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        return (
            f"MCTSNode(move={self.move!r}, visits={self.visits}, "
            f"win_rate={self.win_rate:.3f}, "
            f"children={len(self.children)}, untried={len(self.untried_moves)})"
        )


# ---------------------------------------------------------------------------
# MCTS AI Agent
# ---------------------------------------------------------------------------


class MctsAI(BaseAI):
    """Full MCTS AI agent for Murder in KUET.

    On each call to choose_move() the agent builds a fresh tree from the
    current game state by running self.iterations MCTS iterations (each
    consisting of the four phases above).  The child of the root with the
    highest visit count becomes the chosen move.

    make_suggestion() and decide_accusation() delegate to Bayesian reasoning
    (notebook probability ranking and confidence threshold) because the
    combinatorial size of the suggestion space makes a separate MCTS tree
    impractical within a per-turn budget.
    """

    def __init__(
        self,
        iterations: int | None = None,
        exploration_constant: float | None = None,
    ) -> None:
        """Initialise MCTS agent with configurable budget and UCT constant.

        Args:
            iterations: Number of MCTS iterations per choose_move call.
                        Reads MCTS_ITERATIONS from AI_CONFIG when None.
            exploration_constant: UCT C value.  Reads MCTS_EXPLORATION_CONSTANT
                        from AI_CONFIG when None.  sqrt(2) is theoretically
                        optimal for win/loss rewards normalised to [0, 1].
        """
        if iterations is None:
            iterations = get_positive_int(AI_CONFIG, "MCTS_ITERATIONS", 50)
        if iterations < 1:
            raise ValueError("iterations must be >= 1")
        self.iterations: int = iterations

        if exploration_constant is None:
            raw_c = AI_CONFIG.get(
                "MCTS_EXPLORATION_CONSTANT", math.sqrt(2)
            )
            try:
                exploration_constant = float(max(0.0, raw_c))
            except (TypeError, ValueError):
                exploration_constant = math.sqrt(2)
        self.exploration_constant: float = exploration_constant

        # Per-rollout depth cap — prevents infinite loops in degenerate states.
        self._rollout_depth: int = get_positive_int(
            AI_CONFIG, "MCTS_ROLLOUT_DEPTH", 50
        )

        # Accusation confidence threshold (mirrors MonteCarloAI approach).
        raw_thresh = AI_CONFIG.get("MCTS_ACCUSATION_THRESHOLD", 0.70)
        try:
            self.accusation_threshold: float = float(
                max(0.01, min(0.99, raw_thresh))
            )
        except (TypeError, ValueError):
            self.accusation_threshold = 0.70

        # Bayesian notebook reference — kept in sync via _cache_notebook().
        self._last_notebook: Any | None = None

    # ==================================================================
    # MCTS Phase 1 — Selection
    # ==================================================================

    def _select(self, root: MCTSNode) -> MCTSNode:
        """Traverse the tree with UCT until reaching a node that needs work.

        The traversal follows the child with the highest UCT score at every
        level until one of two conditions is met:
          (a) The node has untried moves → it needs expansion.
          (b) The node is terminal → nothing more to expand or simulate.

        Args:
            root: The root of the current MCTS tree.

        Returns:
            MCTSNode: The selected node (either unexpanded or terminal).
        """
        node = root
        while not node.is_terminal():
            if not node.is_fully_expanded():
                return node  # this node has untried moves → expand it next
            if not node.children:
                # Fully expanded but zero children: the state had no reachable
                # moves so no expansion was ever possible (e.g. dead-end board
                # position with this dice roll).  Return it as a simulation leaf
                # rather than crashing on best_child().
                return node
            node = node.best_child(self.exploration_constant)
        return node

    # ==================================================================
    # MCTS Phase 2 — Expansion
    # ==================================================================

    def _expand(self, node: MCTSNode) -> MCTSNode:
        """Add exactly one new child to node and return it.

        Picks the first element of untried_moves (the list was shuffled at
        node construction so the choice is unbiased).  A full turn is applied
        in a fresh clone of node.state:

          1. Movement to the chosen location.
          2. Random suggestion drawn from remaining notebook candidates.
          3. reveal_clue() resolves the suggest with real card data.
          4. Bayesian notebook updates reflect the reveal outcome.
          5. Turn advanced to the next active player.

        Applying a full turn (not just movement) ensures sibling child nodes
        represent genuinely different knowledge states — children that differ
        only in position but share the same suggestion outcome would produce
        indistinguishable rollouts and therefore provide no discrimination
        signal for UCT.

        Args:
            node: A node with at least one untried move.

        Returns:
            MCTSNode: The newly created child node.
        """
        if not node.untried_moves:
            return node  # guard against calling expand on a fully-expanded node

        move = node.untried_moves[0]
        child_state = self._apply_full_turn(node.state, move)
        return node.add_child(move, child_state)

    def _apply_full_turn(self, state: Any, move: str) -> Any:
        """Return a new game state after a complete AI turn: move+suggest+reveal.

        The original state is NEVER mutated — all changes happen on a clone.

        Args:
            state: The current game state snapshot.
            move: The movement destination to apply.

        Returns:
            Any: A deep-copied, fully advanced game state (next player's turn).
        """
        child = self._clone_state(state)
        if not child.players:
            return child

        current_idx = child.current_turn % len(child.players)
        player = child.players[current_idx]

        # Step 1: Movement.
        possible_moves = child.get_possible_moves()
        if move in possible_moves:
            player.move(move)
            child.current_location = player.position

        # Step 2 & 3: Random suggestion + clue reveal.
        suggestion = self._build_random_suggestion(child, player)
        if suggestion is not None:
            try:
                _, card = reveal_clue(suggestion, child.players, current_idx)
            except Exception:
                card = None
            # Step 4: Bayesian notebook update.
            self._apply_bayesian_updates(child, player, suggestion, card)

        # Step 5: Advance to the next active player.
        child.next_turn()
        return child

    # ==================================================================
    # MCTS Phase 3 — Simulation (Rollout)
    # ==================================================================

    def _simulate(self, state: Any, our_player_idx: int) -> float:
        """Run a random playout from state and return win/loss for our player.

        Each step simulates a full player turn: random move → random suggest →
        reveal_clue() → Bayesian update → win-check.  The playout terminates
        when the game ends or _rollout_depth steps are exhausted.

        The input state is NEVER mutated.  A fresh clone is created at entry.

        Args:
            state: Starting game state for the rollout.
            our_player_idx: Index of the player we are rooting for.

        Returns:
            float: 1.0 if our player wins the rollout, 0.0 otherwise.
        """
        sim = self._clone_state(state)

        if not sim.players:
            return 0.0

        for _step in range(self._rollout_depth):

            # --- Terminal: engine declared game over ---
            if getattr(sim, "game_over", False):
                return self._outcome_for(sim, our_player_idx)

            # --- Terminal: active player count ---
            try:
                active = sim.get_active_players()
            except Exception:
                active = [p for p in sim.players if getattr(p, "active", False)]

            if len(active) == 0:
                return 0.0
            if len(active) == 1:
                winner_idx = sim.players.index(active[0])
                return 1.0 if winner_idx == our_player_idx else 0.0

            # --- Identify current player ---
            current_idx = sim.current_turn % len(sim.players)
            player = sim.players[current_idx]

            if not getattr(player, "active", False):
                sim.next_turn()
                continue

            # --- Movement (random) ---
            moves = sim.get_possible_moves()
            if moves:
                player.move(random.choice(moves))
                sim.current_location = player.position

            # --- Suggestion + reveal + Bayesian update ---
            suggestion = self._build_random_suggestion(sim, player)
            if suggestion is not None:
                try:
                    _, card = reveal_clue(suggestion, sim.players, current_idx)
                except Exception:
                    card = None
                self._apply_bayesian_updates(sim, player, suggestion, card)

                # Win check: did the current player's notebook just solve?
                if self._notebook_solved(player):
                    return 1.0 if current_idx == our_player_idx else 0.0

            sim.next_turn()

        # Step cap reached — nobody won within the rollout budget.
        return 0.0

    # ==================================================================
    # MCTS Phase 4 — Backpropagation
    # ==================================================================

    def _backpropagate(self, node: MCTSNode, reward: float) -> None:
        """Walk from node up to root, updating every ancestor's statistics.

        Every node on the path receives the same reward because the reward
        is always from OUR player's perspective — we do not flip sign at
        opponent nodes.  This is appropriate for Cluedo's racing structure
        where improving our knowledge does not directly harm opponents.

        Args:
            node: The leaf node where the rollout started.
            reward: float in [0.0, 1.0] — 1.0 means our player won.
        """
        current: MCTSNode | None = node
        while current is not None:
            current.update(reward)
            current = current.parent

    # ==================================================================
    # Main MCTS loop
    # ==================================================================

    def _run_mcts(
        self,
        root_state: Any,
        our_player_idx: int,
        valid_moves: list[str] | None = None,
    ) -> MCTSNode:
        """Build the MCTS tree and return the root with accumulated statistics.

        Runs self.iterations full MCTS iterations:
            1. Selection   – UCT traversal to unexpanded/terminal node
            2. Expansion   – add one new child (unless terminal)
            3. Simulation  – random rollout from child state
            4. Backpropagation – update all ancestors

        Args:
            root_state: The current game state (not mutated).
            our_player_idx: Index of the player we are optimising for.
            valid_moves: Engine-validated move list for the root level.  When
                provided, root expansion is constrained to exactly these moves
                so the tree never grows along illegal moves.

        Returns:
            MCTSNode: Root of the grown tree.  Inspect children to choose move.
        """
        root = MCTSNode(state=root_state)

        # Constrain root expansion to the engine-provided valid moves.
        # Deeper nodes compute their own moves via state.get_possible_moves().
        if valid_moves is not None:
            constrained = [m for m in valid_moves]
            random.shuffle(constrained)
            root.untried_moves = constrained

        for i in range(self.iterations):
            # --- Phase 1: Selection ---
            selected = self._select(root)

            # --- Phase 2: Expansion ---
            if selected.is_terminal():
                # Nothing to expand — backpropagate a terminal reward directly.
                expanded = selected
            elif selected.untried_moves:
                expanded = self._expand(selected)
            else:
                # Fully expanded, non-terminal: descend one more step via UCT.
                # Guard against the edge case where a node is fully expanded
                # but has no children (state had no reachable moves at all).
                if selected.children:
                    expanded = selected.best_child(self.exploration_constant)
                else:
                    expanded = selected  # dead-end leaf — simulate in place

            # --- Phase 3: Simulation ---
            reward = self._simulate(expanded.state, our_player_idx)

            # --- Phase 4: Backpropagation ---
            self._backpropagate(expanded, reward)

            logger.debug(
                "MCTS iter %d: selected=%s expanded=%s reward=%.1f",
                i + 1,
                selected.move,
                expanded.move,
                reward,
            )

        logger.debug(
            "MCTS complete: iterations=%d root_visits=%d children=%d",
            self.iterations, root.visits, len(root.children),
        )
        return root

    # ==================================================================
    # BaseAI interface
    # ==================================================================

    def choose_move(self, state: Any, valid_moves: Sequence[str]) -> str | None:
        """Select the best move using the MCTS tree.

        Builds a fresh tree from state, runs self.iterations iterations, then
        returns the move of the root child with the highest visit count.

        The visit-count criterion is preferred over win rate for final
        selection: it is resistant to variance in the last few rollouts and
        reflects the total weight of evidence accumulated across all
        iterations.

        Args:
            state: Current game state snapshot.
            valid_moves: Legal destinations for this turn (engine-computed).

        Returns:
            str | None: Chosen destination, or None when no moves exist.

        Raises:
            ValueError: If valid_moves is None.
        """
        if valid_moves is None:
            raise ValueError("valid_moves cannot be None")

        valid_moves = list(valid_moves)
        if not valid_moves:
            return None

        self._cache_notebook(state)
        our_idx = self._current_player_idx(state)

        t_start = perf_counter()
        root = self._run_mcts(state, our_idx, valid_moves=valid_moves)
        elapsed = perf_counter() - t_start

        if not root.children:
            # Tree never grew — all moves led to immediate terminal states
            # or the state had no possible moves.  Fallback to random.
            chosen = safe_random_choice(valid_moves)
            logger.debug(
                "MCTS: no children after %d iters; random fallback → '%s'",
                self.iterations, chosen,
            )
            return chosen

        best = root.most_visited_child()
        logger.debug(
            "MCTS chose '%s' visits=%d win_rate=%.3f "
            "iterations=%d elapsed=%.4fs",
            best.move, best.visits, best.win_rate,
            self.iterations, elapsed,
        )
        return best.move

    def make_suggestion(self, state: Any) -> tuple[str, str, str]:
        """Return the highest-probability (suspect, weapon, location) suggestion.

        The suggestion space (suspects × weapons) is too large for a per-turn
        MCTS tree — evaluating every pair with even a handful of rollouts
        would exceed any reasonable time budget.  Bayesian ranking is the
        correct tool: the notebook already encodes all observed evidence as
        a probability distribution.

        The suggestion is always at the player's current position (Cluedo rule).

        Raises:
            ValueError: If suggestion space is empty.
        """
        self._cache_notebook(state)
        notebook = self._last_notebook

        notebook_suspects = getattr(notebook, "possible_suspects", set()) if notebook else set()
        notebook_weapons = getattr(notebook, "possible_weapons", set()) if notebook else set()

        suspects = sorted(notebook_suspects or getattr(state, "suspects", []))
        weapons = sorted(notebook_weapons or getattr(state, "weapons", []))

        if not suspects or not weapons:
            raise ValueError("Empty suggestion space — cannot make suggestion")

        location = self._current_location(state)
        if not location:
            raise ValueError("No valid location for suggestion")

        # Rank all (suspect, weapon) pairs by combined notebook probability.
        s_probs = getattr(notebook, "suspects", {}) if notebook else {}
        w_probs = getattr(notebook, "weapons", {}) if notebook else {}

        best_s, best_w = max(
            ((s, w) for s in suspects for w in weapons),
            key=lambda sw: s_probs.get(sw[0], 0.0) + w_probs.get(sw[1], 0.0),
        )

        logger.debug("MCTS suggestion: (%s, %s, %s)", best_s, best_w, location)
        return (best_s, best_w, location)

    def decide_accusation(self, state: Any) -> bool | tuple[str, str, str]:
        """Accuse when Bayesian confidence across all three categories is high.

        Confidence = min(max suspect prob, max weapon prob, max location prob).
        All three categories must be confident simultaneously because a highly
        probable suspect is useless if the weapon is still uncertain.

        Returns a (suspect, weapon, location) tuple rather than True when
        confident so the game engine uses the correct accusation cards.

        Args:
            state: Current game state snapshot.

        Returns:
            False                  – not confident enough.
            tuple[str, str, str]   – explicit accusation when confident.

        Raises:
            ValueError: If state is None.
        """
        if state is None:
            raise ValueError("State cannot be None")

        self._cache_notebook(state)
        notebook = self._last_notebook
        if notebook is None:
            return False

        try:
            s_max = max(getattr(notebook, "suspects", {}).values(), default=0.0)
            w_max = max(getattr(notebook, "weapons", {}).values(), default=0.0)
            l_max = max(getattr(notebook, "locations", {}).values(), default=0.0)
        except Exception:
            return False

        # Weakest-link confidence: ALL categories must clear the threshold.
        confidence = min(s_max, w_max, l_max)
        logger.debug(
            "MCTS accusation check: s=%.3f w=%.3f l=%.3f → confidence=%.3f "
            "(threshold=%.2f)",
            s_max, w_max, l_max, confidence, self.accusation_threshold,
        )

        if confidence < self.accusation_threshold:
            return False

        try:
            suspect, weapon, location = notebook.most_likely()
            logger.debug("MCTS accusing: (%s, %s, %s)", suspect, weapon, location)
            return (suspect, weapon, location)
        except Exception:
            return True

    def update_from_clue(self, card: Any) -> None:
        """Eliminate a revealed card from the real-game notebook.

        Guards against double-elimination: if the card is already in
        known_cards (eliminated by a previous engine pass), the call is
        a no-op.
        """
        if card is None or self._last_notebook is None:
            return
        name = getattr(card, "name", None)
        if not (isinstance(name, str) and name.strip()):
            return
        known = getattr(self._last_notebook, "known_cards", None)
        if isinstance(known, set) and name in known:
            return
        if hasattr(self._last_notebook, "eliminate"):
            try:
                self._last_notebook.eliminate(name)
            except Exception:
                pass

    def handle_no_reveal(self, suggestion: Any) -> None:
        """Boost notebook probabilities when no opponent disproves a suggestion."""
        if self._last_notebook is None or suggestion is None:
            return
        suspect = getattr(suggestion, "suspect", None)
        weapon = getattr(suggestion, "weapon", None)
        location = getattr(suggestion, "location", None)
        update_fn = getattr(self._last_notebook, "update_no_reveal", None)
        if callable(update_fn) and all(
            isinstance(v, str) for v in (suspect, weapon, location)
        ):
            try:
                update_fn(suspect, weapon, location)
            except Exception:
                pass

    # ==================================================================
    # Private helpers
    # ==================================================================

    def _clone_state(self, state: Any) -> Any:
        """Return a fully independent copy of the game state.

        Prefers state.clone() (GameState's own deep-copy path) for speed;
        falls back to deepcopy for any other state type.
        """
        clone_fn = getattr(state, "clone", None)
        if callable(clone_fn):
            return clone_fn()
        return deepcopy(state)

    def _cache_notebook(self, state: Any) -> None:
        """Cache the current player's notebook from the engine state.

        Called at the start of every BaseAI method so that update_from_clue()
        and handle_no_reveal() always work with the most-recent notebook.
        """
        try:
            players = getattr(state, "players", None)
            current_turn = getattr(state, "current_turn", None)
            if (
                isinstance(players, list)
                and players
                and isinstance(current_turn, int)
            ):
                player = players[current_turn % len(players)]
                self._last_notebook = getattr(player, "notebook", None)
                return
        except Exception:
            pass
        self._last_notebook = None

    def _current_player_idx(self, state: Any) -> int:
        """Return the index of the player whose turn it is."""
        players = getattr(state, "players", [])
        current_turn = getattr(state, "current_turn", 0)
        if players:
            return int(current_turn) % len(players)
        return 0

    def _current_location(self, state: Any) -> str | None:
        """Return the current player's position from any supported state."""
        players = getattr(state, "players", None)
        current_turn = getattr(state, "current_turn", None)
        if isinstance(players, list) and players and isinstance(current_turn, int):
            player = players[current_turn % len(players)]
            loc = getattr(player, "position", None)
            if isinstance(loc, str) and loc.strip():
                return loc
        loc = getattr(state, "current_location", None)
        if isinstance(loc, str) and loc.strip():
            return loc
        notebook = self._last_notebook
        if notebook:
            possible = sorted(getattr(notebook, "possible_locations", []))
            if possible:
                return possible[0]
        return safe_random_choice(list(getattr(state, "locations", [])))

    def _build_random_suggestion(
        self, sim_state: Any, player: Any
    ) -> Suggestion | None:
        """Construct a random valid Suggestion for one simulation step.

        Draws uniformly from the player's remaining notebook candidates.
        Location is always the player's current position (Cluedo rule).
        """
        notebook = getattr(player, "notebook", None)
        if notebook is not None:
            suspects = list(getattr(notebook, "possible_suspects", []))
            weapons = list(getattr(notebook, "possible_weapons", []))
        else:
            suspects = list(getattr(sim_state, "suspects", []))
            weapons = list(getattr(sim_state, "weapons", []))

        location = getattr(player, "position", None)
        if not isinstance(location, str) or not location.strip():
            all_locs = getattr(sim_state, "locations", [])
            location = safe_random_choice(list(all_locs))
            if location is None:
                return None

        if not suspects or not weapons:
            return None

        try:
            return Suggestion(
                suspect=random.choice(suspects),
                weapon=random.choice(weapons),
                location=location,
            )
        except Exception:
            return None

    def _apply_bayesian_updates(
        self,
        sim_state: Any,
        current_player: Any,
        suggestion: Any,
        card: Any,
    ) -> None:
        """Apply Bayesian notebook updates after a suggestion resolves.

        Reveal (card shown): PRIVATE — only the suggesting player learns.
        No-reveal (card=None): PUBLIC — all active players update.
        """
        if card is not None:
            notebook = getattr(current_player, "notebook", None)
            if notebook is not None:
                update_fn = getattr(notebook, "update_reveal", None)
                if callable(update_fn):
                    try:
                        update_fn(card.name)
                    except Exception:
                        pass
        else:
            suspect = getattr(suggestion, "suspect", None)
            weapon = getattr(suggestion, "weapon", None)
            location = getattr(suggestion, "location", None)
            if not all(isinstance(v, str) for v in (suspect, weapon, location)):
                return
            for player in sim_state.players:
                if not getattr(player, "active", False):
                    continue
                nb = getattr(player, "notebook", None)
                if nb is None:
                    continue
                update_fn = getattr(nb, "update_no_reveal", None)
                if callable(update_fn):
                    try:
                        update_fn(suspect, weapon, location)
                    except Exception:
                        pass

    def _notebook_solved(self, player: Any) -> bool:
        """Return True when the player's notebook has narrowed to one solution."""
        notebook = getattr(player, "notebook", None)
        if notebook is None:
            return False
        is_solved_fn = getattr(notebook, "is_solved", None)
        if callable(is_solved_fn):
            try:
                return bool(is_solved_fn())
            except Exception:
                return False
        s = getattr(notebook, "possible_suspects", set())
        w = getattr(notebook, "possible_weapons", set())
        loc = getattr(notebook, "possible_locations", set())
        return len(s) == 1 and len(w) == 1 and len(loc) == 1

    def _outcome_for(self, sim: Any, our_player_idx: int) -> float:
        """Translate an engine-declared game-over into a win/loss float."""
        winner = getattr(sim, "winner", None)
        if winner is None:
            return 0.0
        try:
            winner_idx = sim.players.index(winner)
            return 1.0 if winner_idx == our_player_idx else 0.0
        except (ValueError, AttributeError):
            return 0.0
