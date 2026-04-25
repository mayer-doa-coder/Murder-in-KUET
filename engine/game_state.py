"""
game_state.py - Current Game Status Module

Purpose: Manages and tracks the current state of the game.
This module maintains game status, player states, solution, and game progress.
"""

import logging
from copy import deepcopy
from typing import Any
from engine.cards import suspects, weapons, locations, create_deck
from engine.board import Board
from engine.clue_reveal import reveal_clue
from models.accusation import check_accusation
from engine.dice import roll_dice
from utils.helpers import safe_random_choice


logger = logging.getLogger(__name__)


class GameState:

    def __init__(self):
        self.players = []
        self.solution = None
        self.current_turn = 0
        self.deck = []
        self.game_over = False
        self.winner = None
        self.board = Board()
        self.suspects = list(suspects)
        self.weapons = list(weapons)
        self.locations = list(locations)
        self.current_location = None
        # Set at the start of every turn so any agent can inspect it.
        self.last_dice_roll = None

    def setup_game(self):
        """
        Initialise a new game:
          1. Create the full shuffled deck.
          2. Pick one suspect, weapon, and location as the secret solution.
          3. Remove those three solution cards from the deck.
          4. Deal remaining cards evenly to all players (round-robin).
        """
        # 1. Create deck
        self.deck = create_deck()

        # 2. Choose solution cards
        chosen_suspect = safe_random_choice(suspects)
        chosen_weapon = safe_random_choice(weapons)
        chosen_location = safe_random_choice(locations)
        if chosen_suspect is None or chosen_weapon is None or chosen_location is None:
            raise ValueError("Cannot setup game without full suspect/weapon/location pools")
        self.solution = {
            "suspect": chosen_suspect,
            "weapon": chosen_weapon,
            "location": chosen_location,
        }

        # 3. Remove solution cards from the deck
        self.deck = [
            card for card in self.deck
            if card.name not in (
                self.solution["suspect"],
                self.solution["weapon"],
                self.solution["location"],
            )
        ]

        # 4. Distribute remaining cards evenly to players (round-robin)
        for i, card in enumerate(self.deck):
            self.players[i % len(self.players)].add_card(card)

    def add_player(self, player):
        """Add a player to the game."""
        self.players.append(player)

    @property
    def current_player(self):
        """Return the current player or None when no players are present."""
        if not self.players:
            return None
        return self.get_current_player()

    def clone(self) -> "GameState":
        """Create a deep copy of the current game state for safe simulation."""
        if self is None:
            raise ValueError("Invalid state")
        return deepcopy(self)

    def get_possible_moves(self) -> list[str]:
        """Return legal moves for the current player in this state snapshot.

        This method is recursion-safe and does not mutate state.
        """
        if not self.players:
            return []

        player = self.get_current_player()
        if player is None:
            return []

        if player.position is None:
            return list(self.board.get_all_locations())

        steps = 12
        if self.last_dice_roll is not None and hasattr(self.last_dice_roll, "total"):
            try:
                parsed_steps = int(self.last_dice_roll.total)
                if parsed_steps > 0:
                    steps = parsed_steps
            except (TypeError, ValueError):
                pass

        valid_moves = list(self.board.get_valid_moves(player.position, steps))
        passage_dest = self.board.get_passage_destination(player.position)
        if passage_dest and passage_dest not in valid_moves:
            valid_moves.append(passage_dest)
        return valid_moves

    def simulate_move(self, move: str) -> "GameState":
        """Return a new state with a simulated move applied.

        The original state is never mutated.
        """
        if self is None:
            raise ValueError("Invalid state")

        new_state = self.clone()

        if not isinstance(move, str) or not move.strip():
            return new_state

        allowed_moves = self.get_possible_moves()
        if move not in allowed_moves:
            return new_state

        player = new_state.current_player
        if player is None:
            return new_state

        player.move(move)
        new_state.current_location = player.position
        return new_state

    def simulate_suggestion(self, suggestion: Any) -> "GameState":
        """Return a new state with a simulated suggestion inference update.

        The update is intentionally lightweight for search expansion and keeps
        the original state untouched.
        """
        if self is None:
            raise ValueError("Invalid state")

        new_state = self.clone()
        suspect, weapon, location = self._unpack_suggestion(suggestion)

        notebook = self._get_current_notebook(new_state)
        if notebook is not None:
            suspects_set = getattr(notebook, "possible_suspects", None)
            weapons_set = getattr(notebook, "possible_weapons", None)
            locations_set = getattr(notebook, "possible_locations", None)

            # Narrow TOWARD the suggested cards: remove one non-suggested
            # alternative from each set.  The suggestion is a hypothesis that
            # these cards are the solution, so we tighten around them.
            _narrow_set_toward(suspects_set, suspect)
            _narrow_set_toward(weapons_set, weapon)
            _narrow_set_toward(locations_set, location)
        else:
            suspects_set = getattr(new_state, "possible_suspects", None)
            weapons_set = getattr(new_state, "possible_weapons", None)
            locations_set = getattr(new_state, "possible_locations", None)

            _narrow_set_toward(suspects_set, suspect)
            _narrow_set_toward(weapons_set, weapon)
            _narrow_set_toward(locations_set, location)

        return new_state

    def simulate(self, action: Any) -> "GameState":
        """Return a new state after applying a generic simulation action.

        Supported action forms:
            - str: movement destination
            - tuple/list length 3 or suggestion-like object: suggestion
            - dict: {"type": "move", "value": ...} or {"type": "suggestion", "value": ...}
        """
        if self is None:
            raise ValueError("Invalid state")

        if isinstance(action, dict):
            action_type = action.get("type")
            value = action.get("value")
            if action_type == "move":
                return self.simulate_move(value)
            if action_type == "suggestion":
                return self.simulate_suggestion(value)
            return self.clone()

        if isinstance(action, str):
            return self.simulate_move(action)

        if (
            (isinstance(action, (tuple, list)) and len(action) == 3)
            or (hasattr(action, "suspect") and hasattr(action, "weapon") and hasattr(action, "location"))
        ):
            return self.simulate_suggestion(action)

        return self.clone()

    def get_current_player(self):
        """Return the player whose turn it is."""
        return self.players[self.current_turn % len(self.players)]

    def next_turn(self):
        """Advance to the next active player's turn safely."""
        if not self.players:
            return

        self.current_turn += 1
        for _ in range(len(self.players)):
            if self.get_current_player().active:
                return
            self.current_turn += 1

        # Safety: no active players left.
        self.check_end_conditions()

    def check_accusation(self, accusation):
        """
        Check a player's final accusation against the solution.

        Args:
            accusation: Accusation object or dict-like accusation.

        Returns:
            bool: True if accusation matches the solution exactly.
        """
        if isinstance(accusation, dict):
            from types import SimpleNamespace

            accusation = SimpleNamespace(
                suspect=accusation.get("suspect"),
                weapon=accusation.get("weapon"),
                location=accusation.get("location"),
            )

        return check_accusation(accusation, self.solution)

    def is_game_over(self):
        """Return True if the game has ended."""
        return self.game_over

    def process_suggestion(self, player, suggestion, current_index=None, verbose=True):
        """Resolve a suggestion inside the game loop.

        Flow:
          1. Log the active player's suggestion.
          2. Ask opponents in circular turn order to reveal a matching card.
          3. Update current player's notebook when a card is revealed.
          4. Update AI clue knowledge or no-reveal handling hooks.

        Args:
            player: The player who made the suggestion.
            suggestion: Suggestion object with suspect/weapon/location attrs.
            current_index (int | None): Optional player index override.

        Returns:
            tuple: (revealer, card) where either may be None.
        """
        if current_index is None:
            current_index = self.players.index(player)

        if suggestion is None:
            return (None, None)

        if verbose:
            logger.info("%s suggests: %s", player.name, suggestion)
        revealer, card = reveal_clue(suggestion, self.players, current_index)

        self._apply_bayesian_notebook_updates(suggestion, card, suggesting_player=player)

        if card is not None:
            if verbose and revealer is not None:
                logger.info("%s revealed a card", revealer.name)

            if player.is_ai and hasattr(player.ai_agent, "update_from_clue"):
                player.ai_agent.update_from_clue(card)
        else:
            if verbose:
                logger.info("No one could reveal a clue")
            if player.is_ai and hasattr(player.ai_agent, "handle_no_reveal"):
                player.ai_agent.handle_no_reveal(suggestion)

        return (revealer, card)

    def _apply_bayesian_notebook_updates(
        self,
        suggestion: Any,
        card: Any | None,
        suggesting_player: Any | None = None,
    ) -> None:
        """Apply Bayesian notebook updates after a suggestion.

        Reveal information is PRIVATE in Cluedo — only the suggesting player
        learns which specific card was shown.  No-reveal information is PUBLIC
        — all players can update their probability distributions.
        """
        if suggestion is None:
            return

        if card is not None and not hasattr(card, "name"):
            raise ValueError("Invalid card object")

        suspect = getattr(suggestion, "suspect", None)
        weapon = getattr(suggestion, "weapon", None)
        location = getattr(suggestion, "location", None)
        if not all(isinstance(value, str) and value.strip() for value in (suspect, weapon, location)):
            return

        for player in self.players:
            if not getattr(player, "is_ai", False):
                continue

            if not hasattr(player, "notebook"):
                raise ValueError("Player notebook not initialized")

            notebook = player.notebook
            if card is not None:
                # Only the suggesting player learns which card was revealed.
                if suggesting_player is not None and player is not suggesting_player:
                    continue
                update_reveal = getattr(notebook, "update_reveal", None)
                if callable(update_reveal):
                    update_reveal(card.name)
            else:
                # No-reveal is public: all players update accordingly.
                update_no_reveal = getattr(notebook, "update_no_reveal", None)
                if callable(update_no_reveal):
                    update_no_reveal(suspect, weapon, location)

    def get_chance_outcomes(self, suggestion: Any | None = None) -> list[tuple[float, "GameState"]]:
        """Return probabilistic outcomes after a suggestion.

        This method models two simplified chance outcomes for expectiminimax:
          1. A matching card is revealed to the current player.
          2. No player reveals a matching card.

        Return format:
            list[(probability, state_copy)]

        Probability model:
            num_possible = len(possible_suspects) + len(possible_weapons)
            prob_reveal = 1 / num_possible
            prob_no_reveal = 1 - prob_reveal

        Args:
            suggestion: Suggestion object or tuple/list
                (suspect, weapon, location). If None, a safe fallback
                suggestion is inferred from current candidates.

        Returns:
            list: List of (probability, GameState copy) tuples.

        Raises:
            ValueError: If suggestion is None or malformed.
        """
        if suggestion is None:
            possible_suspects, possible_weapons, possible_locations = self._get_possible_sets(self)

            if not possible_suspects:
                possible_suspects = set(self.suspects)
            if not possible_weapons:
                possible_weapons = set(self.weapons)
            if not possible_locations:
                possible_locations = set(self.locations)

            current_player = self.current_player
            fallback_location = getattr(current_player, "position", None) if current_player is not None else None
            if not isinstance(fallback_location, str) or not fallback_location.strip():
                fallback_location = sorted(possible_locations)[0]

            suggestion = (
                sorted(possible_suspects)[0],
                sorted(possible_weapons)[0],
                fallback_location,
            )

        suspect, weapon, location = self._unpack_suggestion(suggestion)

        possible_suspects, possible_weapons, _possible_locations = self._get_possible_sets(self)
        num_possible = len(possible_suspects) + len(possible_weapons)

        if num_possible == 0:
            return [(1.0, self.clone())]

        prob_reveal = 1.0 / num_possible
        prob_no_reveal = 1.0 - prob_reveal

        outcomes = []

        # Case 1: card revealed -> gain direct knowledge.
        state_reveal = self.clone()
        reveal_notebook = self._get_current_notebook(state_reveal)
        if reveal_notebook is not None and hasattr(reveal_notebook, "eliminate"):
            update_reveal = getattr(reveal_notebook, "update_reveal", None)
            if suspect in getattr(reveal_notebook, "possible_suspects", set()):
                if callable(update_reveal):
                    update_reveal(suspect)
                else:
                    reveal_notebook.eliminate(suspect)
            elif weapon in getattr(reveal_notebook, "possible_weapons", set()):
                if callable(update_reveal):
                    update_reveal(weapon)
                else:
                    reveal_notebook.eliminate(weapon)
            elif location in getattr(reveal_notebook, "possible_locations", set()):
                if callable(update_reveal):
                    update_reveal(location)
                else:
                    reveal_notebook.eliminate(location)
        else:
            known_cards = getattr(state_reveal, "known_cards", None)
            if isinstance(known_cards, set):
                known_cards.add(suspect)

        outcomes.append((prob_reveal, state_reveal))

        # Case 2: no card revealed -> strong deduction toward the suggestion.
        state_no_reveal = self.clone()
        no_reveal_notebook = self._get_current_notebook(state_no_reveal)
        if no_reveal_notebook is not None:
            update_no_reveal = getattr(no_reveal_notebook, "update_no_reveal", None)
            if callable(update_no_reveal):
                update_no_reveal(suspect, weapon, location)
            else:
                suspects_set = getattr(no_reveal_notebook, "possible_suspects", None)
                weapons_set = getattr(no_reveal_notebook, "possible_weapons", None)
                locations_set = getattr(no_reveal_notebook, "possible_locations", None)

                if isinstance(suspects_set, set) and suspect in suspects_set:
                    suspects_set.intersection_update({suspect})
                if isinstance(weapons_set, set) and weapon in weapons_set:
                    weapons_set.intersection_update({weapon})
                if isinstance(locations_set, set) and location in locations_set:
                    locations_set.intersection_update({location})
        else:
            suspects_set = getattr(state_no_reveal, "possible_suspects", None)
            weapons_set = getattr(state_no_reveal, "possible_weapons", None)
            if isinstance(suspects_set, set):
                suspects_set.discard(suspect)
            if isinstance(weapons_set, set):
                weapons_set.discard(weapon)

        outcomes.append((prob_no_reveal, state_no_reveal))

        return outcomes

    def _unpack_suggestion(self, suggestion):
        """Normalize Suggestion object or tuple/list into three strings."""
        if hasattr(suggestion, "suspect") and hasattr(suggestion, "weapon") and hasattr(suggestion, "location"):
            suspect = suggestion.suspect
            weapon = suggestion.weapon
            location = suggestion.location
        elif isinstance(suggestion, (tuple, list)) and len(suggestion) == 3:
            suspect, weapon, location = suggestion
        else:
            raise ValueError("Invalid suggestion")

        if not all(isinstance(v, str) and v.strip() for v in (suspect, weapon, location)):
            raise ValueError("Invalid suggestion")

        return suspect.strip(), weapon.strip(), location.strip()

    def _get_current_notebook(self, state_obj):
        """Return current player's notebook from a state copy, if present."""
        players = getattr(state_obj, "players", None)
        current_turn = getattr(state_obj, "current_turn", None)
        if not isinstance(players, list) or not players or not isinstance(current_turn, int):
            return None

        player = players[current_turn % len(players)]
        return getattr(player, "notebook", None)

    def _get_possible_sets(self, state_obj):
        """Resolve possible sets from notebook-first, state-attribute fallback."""
        notebook = self._get_current_notebook(state_obj)
        if notebook is not None:
            return (
                set(getattr(notebook, "possible_suspects", set())),
                set(getattr(notebook, "possible_weapons", set())),
                set(getattr(notebook, "possible_locations", set())),
            )

        suspects_set = getattr(state_obj, "possible_suspects", None)
        weapons_set = getattr(state_obj, "possible_weapons", None)
        locations_set = getattr(state_obj, "possible_locations", None)

        if suspects_set is None:
            suspects_set = getattr(state_obj, "suspects", [])
        if weapons_set is None:
            weapons_set = getattr(state_obj, "weapons", [])
        if locations_set is None:
            locations_set = getattr(state_obj, "locations", [])

        return set(suspects_set), set(weapons_set), set(locations_set)

    def get_active_players(self):
        """Return a list of players who are still active in the game."""
        return [player for player in self.players if player.active]

    def check_end_conditions(self):
        """Apply default winner checks for active-player edge cases.

        Returns:
            bool: True if the game is over after applying edge-case checks.
        """
        active_players = self.get_active_players()

        if len(active_players) == 1:
            self.winner = active_players[0]
            self.game_over = True
            logger.info("%s wins by default", active_players[0].name)
            return True

        if len(active_players) == 0:
            self.winner = None
            self.game_over = True
            logger.warning("No players remaining. Game ends")
            return True

        return False

    def resolve_accusation(self, player, accusation):
        """Resolve a player's final accusation and apply win/elimination effects.

        Args:
            player: The player making the accusation.
            accusation: Accusation object or dict-like accusation.

        Returns:
            bool: True if the accusation is correct, else False.
        """
        if accusation is None:
            return False

        if check_accusation(accusation, self.solution):
            logger.info("%s wins", player.name)
            self.winner = player
            self.game_over = True
            return True

        logger.warning("%s eliminated", player.name)
        player.active = False
        self.check_end_conditions()
        return False

    def run_turn(self):
        """Run one full turn while respecting active/inactive player status.

        Returns:
            dict | None: Turn result for active player turns, otherwise None.
        """
        if self.game_over:
            return None

        if self.check_end_conditions():
            return None

        # Skip inactive players with bounded iteration to avoid infinite loops.
        checked = 0
        total = len(self.players)
        while checked < total and not self.get_current_player().active:
            self.current_turn += 1
            checked += 1

        if checked >= total:
            self.check_end_conditions()
            return None

        player = self.get_current_player()
        result = {
            "dice": None,
            "move": None,
            "suggestion": None,
            "revealer": None,
            "revealed_card": None,
            "accusation": None,
        }

        if player.is_ai:
            ai_agent = player.take_turn(self)
            if ai_agent is None:
                return None

            dice_roll = roll_dice()
            self.last_dice_roll = dice_roll
            result["dice"] = dice_roll

            if player.position is None:
                valid_moves = self.board.get_all_locations()
            else:
                valid_moves = self.board.get_valid_moves(player.position, dice_roll.total)
                passage_dest = self.board.get_passage_destination(player.position)
                if passage_dest and passage_dest not in valid_moves:
                    valid_moves = valid_moves + [passage_dest]

            move = ai_agent.choose_move(self, valid_moves)
            if move in valid_moves:
                player.move(move)
            elif move is not None:
                logger.warning("AI returned invalid move '%s' in run_turn; ignoring", move)

            self.current_location = player.position
            result["move"] = player.position

            suspect, weapon, _ = ai_agent.make_suggestion(self)
            if suspect not in self.suspects:
                fallback_suspect = safe_random_choice(self.suspects)
                if fallback_suspect is None:
                    raise ValueError("No suspects available for fallback suggestion")
                suspect = fallback_suspect

            if weapon not in self.weapons:
                fallback_weapon = safe_random_choice(self.weapons)
                if fallback_weapon is None:
                    raise ValueError("No weapons available for fallback suggestion")
                weapon = fallback_weapon

            suggestion = player.make_suggestion(suspect, weapon, player.position)
            if suggestion is None:
                return result
            result["suggestion"] = suggestion

            revealer, card = reveal_clue(suggestion, self.players, self.current_turn)
            self._apply_bayesian_notebook_updates(suggestion, card, suggesting_player=player)
            if card is not None:
                result["revealer"] = revealer.name if revealer is not None else None
                result["revealed_card"] = card.name

            if player.is_ai and card and hasattr(ai_agent, "update_from_clue"):
                ai_agent.update_from_clue(card)
            if player.is_ai and not card and hasattr(ai_agent, "handle_no_reveal"):
                ai_agent.handle_no_reveal(suggestion)

            should_accuse = False
            accusation = None
            decision = ai_agent.decide_accusation(self)
            if isinstance(decision, bool):
                should_accuse = decision
            elif decision is not None:
                should_accuse = True
                accusation = decision

            if should_accuse:
                if accusation is None:
                    solved = None
                    if hasattr(player, "notebook") and hasattr(player.notebook, "get_solution"):
                        solved = player.notebook.get_solution()
                    if solved is not None:
                        accusation = player.make_accusation(solved[0], solved[1], solved[2])
                    elif hasattr(player, "notebook") and hasattr(player.notebook, "most_likely"):
                        try:
                            best_s, best_w, best_l = player.notebook.most_likely()
                            accusation = player.make_accusation(best_s, best_w, best_l)
                        except Exception:
                            accusation = player.make_accusation(suspect, weapon, player.position)
                    else:
                        accusation = player.make_accusation(suspect, weapon, player.position)
                elif isinstance(accusation, tuple) and len(accusation) == 3:
                    accusation = player.make_accusation(accusation[0], accusation[1], accusation[2])
                result["accusation"] = accusation
                self.resolve_accusation(player, accusation)

        if not self.game_over:
            self.next_turn()

        return result

    def run_game(
        self,
        human_move_selector=None,
        human_suggestion_selector=None,
        human_accusation_selector=None,
        max_turns=None,
        verbose=True,
    ):
        """Run the full turn-based gameplay loop until game over.

        Args:
            human_move_selector: Optional callback `(player, valid_moves, state)`
                returning a chosen move or None.
            human_suggestion_selector: Optional callback
                `(player, state)` returning `(suspect, weapon)`.
            human_accusation_selector: Optional callback
                `(player, state)` returning one of:
                  - None              -> do not accuse
                  - bool              -> accuse/not accuse (True/False)
                  - tuple[str, str, str] -> explicit accusation cards
                  - accusation object -> prebuilt accusation object
            max_turns (int | None): Optional turn cap for simulations.
            verbose (bool): Whether to print per-turn logs.

        Returns:
            object | None: Winning player object, or None if no winner.
        """
        if not self.players:
            logger.error("Cannot run game without players")
            raise ValueError("Cannot run game without players")

        turns_played = 0
        current_index = self.current_turn % len(self.players)

        while not self.game_over:
            active_players = [p for p in self.players if p.active]
            if len(active_players) == 1:
                self.winner = active_players[0]
                self.game_over = True
                if verbose:
                    logger.info("%s wins by default", active_players[0].name)
                break

            if len(active_players) == 0:
                self.winner = None
                self.game_over = True
                if verbose:
                    logger.warning("Game ended. No players remaining")
                break

            if max_turns is not None and turns_played >= max_turns:
                break

            player = self.players[current_index]
            self.current_turn = current_index

            # Skip eliminated players immediately.
            if not player.active:
                current_index = (current_index + 1) % len(self.players)
                continue

            if verbose:
                if player.is_ai:
                    ai_obj = getattr(player, "ai_agent", None)
                    if ai_obj is None:
                        ai_name = "UnknownAI"
                    else:
                        core_ai = getattr(ai_obj, "_agent", ai_obj)
                        ai_name = type(core_ai).__name__
                    logger.info("--- %s (%s) Turn ---", player.name, ai_name)
                else:
                    logger.info("--- %s's Turn ---", player.name)

            # 1) Roll dice.
            dice_roll = roll_dice()
            self.last_dice_roll = dice_roll
            dice_value = dice_roll.total
            if verbose:
                logger.info("Dice: %s", dice_value)

            # 2) Movement phase.
            if player.position is None:
                valid_moves = self.board.get_all_locations()
            else:
                valid_moves = self.board.get_valid_moves(player.position, dice_value)
                passage_dest = self.board.get_passage_destination(player.position)
                if passage_dest and passage_dest not in valid_moves:
                    valid_moves = valid_moves + [passage_dest]

            move = None
            if player.is_ai:
                if getattr(player, "ai_agent", None) is None:
                    logger.error("AI player %s has no ai_agent assigned", player.name)
                    raise ValueError(f"AI player {player.name} has no ai_agent assigned")
                move = player.ai_agent.choose_move(self, valid_moves)
                # Safety fallback: if AI returns an invalid move, recover with
                # a random legal move to keep the game progressing.
                if valid_moves and move not in valid_moves:
                    logger.warning("AI returned invalid move '%s'; selecting random legal move", move)
                    move = safe_random_choice(valid_moves)
            elif human_move_selector is not None:
                move = human_move_selector(player, valid_moves, self)
            elif valid_moves:
                move = valid_moves[0]

            if move in valid_moves:
                player.move(move)
            elif move is not None:
                logger.warning("Move '%s' not in valid_moves; skipping movement", move)

            self.current_location = player.position
            if verbose:
                logger.info("Move: %s", player.position)

            # 3) Suggestion phase.
            if player.is_ai:
                suspect, weapon, _ = player.ai_agent.make_suggestion(self)
                if suspect not in self.suspects:
                    fallback_suspect = safe_random_choice(self.suspects)
                    if fallback_suspect is None:
                        raise ValueError("No suspects available for fallback suggestion")
                    suspect = fallback_suspect
                if weapon not in self.weapons:
                    fallback_weapon = safe_random_choice(self.weapons)
                    if fallback_weapon is None:
                        raise ValueError("No weapons available for fallback suggestion")
                    weapon = fallback_weapon
            elif human_suggestion_selector is not None:
                suspect, weapon = human_suggestion_selector(player, self)
            else:
                suspect = self.suspects[0]
                weapon = self.weapons[0]

            suggestion = player.make_suggestion(suspect, weapon, player.position)
            assert suggestion is not None, "Suggestion failed"
            if verbose:
                logger.info("Suggestion: %s", suggestion)

            # 4) Clue revelation.
            revealer, card = reveal_clue(suggestion, self.players, current_index)
            self._apply_bayesian_notebook_updates(suggestion, card, suggesting_player=player)

            # 5) Notebook update.
            if card:
                if verbose and revealer is not None:
                    logger.info("%s revealed a card", revealer.name)
            elif verbose:
                logger.info("No one could disprove")

            # 6) AI knowledge update.
            if player.is_ai and card and hasattr(player.ai_agent, "update_from_clue"):
                player.ai_agent.update_from_clue(card)
            if player.is_ai and not card and hasattr(player.ai_agent, "handle_no_reveal"):
                player.ai_agent.handle_no_reveal(suggestion)

            # 7) Optional accusation phase.
            should_accuse = False
            accusation = None

            if player.is_ai:
                if hasattr(player, "decide_accusation"):
                    decision = player.decide_accusation(self)
                else:
                    decision = player.ai_agent.decide_accusation(self)

                if isinstance(decision, bool):
                    should_accuse = decision
                elif decision is not None:
                    should_accuse = True
                    accusation = decision
            else:
                decision = (
                    human_accusation_selector(player, self)
                    if human_accusation_selector is not None
                    else None
                )
                if isinstance(decision, bool):
                    should_accuse = decision
                elif decision is not None:
                    should_accuse = True
                    accusation = decision

            if should_accuse:
                if accusation is None:
                    # Prefer a fully-certain solution; fall back to highest-
                    # probability candidates; last resort: current suggestion.
                    solved = None
                    if hasattr(player, "notebook") and hasattr(player.notebook, "get_solution"):
                        solved = player.notebook.get_solution()

                    if solved is not None:
                        accusation = player.make_accusation(solved[0], solved[1], solved[2])
                    elif hasattr(player, "notebook") and hasattr(player.notebook, "most_likely"):
                        try:
                            best_s, best_w, best_l = player.notebook.most_likely()
                            accusation = player.make_accusation(best_s, best_w, best_l)
                        except Exception:
                            accusation = player.make_accusation(suspect, weapon, player.position)
                    else:
                        accusation = player.make_accusation(suspect, weapon, player.position)
                elif isinstance(accusation, tuple) and len(accusation) == 3:
                    accusation = player.make_accusation(
                        accusation[0], accusation[1], accusation[2]
                    )

                if check_accusation(accusation, self.solution):
                    if verbose:
                        logger.info("%s wins", player.name)
                    self.winner = player
                    self.game_over = True
                else:
                    if verbose:
                        logger.warning("%s eliminated", player.name)
                    player.active = False

            if verbose and player.is_ai:
                logger.info("Accusation Decision: %s", should_accuse)

            # 8) Turn rotation.
            current_index = (current_index + 1) % len(self.players)
            turns_played += 1

        return self.winner

    # ── Serialization ──────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        """Serialize the game state to a JSON-compatible dictionary.

        The hidden solution is NOT included.  Pass ``_solution`` separately
        when the full state must survive a round-trip through the API.
        """
        players_data = []
        for player in self.players:
            # Unwrap InstrumentedAI or any thin wrapper that exposes ``_agent``.
            ai_type = None
            if player.is_ai and player.ai_agent is not None:
                core = getattr(player.ai_agent, "_agent", player.ai_agent)
                ai_type = type(core).__name__

            notebook_data = None
            nb = getattr(player, "notebook", None)
            if nb is not None:
                notebook_data = {
                    "suspects": dict(nb.suspects),
                    "weapons": dict(nb.weapons),
                    "locations": dict(nb.locations),
                    "possible_suspects": sorted(nb.possible_suspects),
                    "possible_weapons": sorted(nb.possible_weapons),
                    "possible_locations": sorted(nb.possible_locations),
                    "known_cards": sorted(nb.known_cards),
                }

            players_data.append({
                "name": player.name,
                "is_ai": player.is_ai,
                "ai_type": ai_type,
                "position": player.position,
                "active": player.active,
                "cards": [c.name for c in player.cards],
                "notebook": notebook_data,
            })

        dice_data = None
        if self.last_dice_roll is not None:
            dice_data = {
                "die1": self.last_dice_roll.die1,
                "die2": self.last_dice_roll.die2,
                "total": self.last_dice_roll.total,
            }

        return {
            "players": players_data,
            "current_turn": self.current_turn,
            "game_over": self.game_over,
            "winner": self.winner.name if self.winner is not None else None,
            "suspects": list(self.suspects),
            "weapons": list(self.weapons),
            "locations": list(self.locations),
            "current_location": self.current_location,
            "last_dice_roll": dice_data,
        }

    @classmethod
    def from_dict(cls, data: dict, ai_registry: dict | None = None) -> "GameState":
        """Reconstruct a GameState from a dictionary produced by ``to_dict()``.

        The caller must supply ``_solution`` inside *data* (or as a top-level
        key) so that accusation resolution works correctly.  AI agents are
        re-created fresh from *ai_registry*; their search trees are transient
        and are not preserved across serialization boundaries.  The persisted
        Bayesian notebook probabilities on each player carry all accumulated
        game knowledge.

        Args:
            data:        Dict from ``to_dict()`` plus a ``"_solution"`` key.
            ai_registry: Mapping of AI-type name → class.  When *None* or
                         when an ``ai_type`` is not found, the player is
                         created as a non-agent AI player (no decisions).

        Returns:
            GameState: Ready for ``run_turn()`` without calling ``setup_game()``.

        Raises:
            ValueError: If required fields are absent or malformed.
            TypeError:  If *data* is not a dict.
        """
        from engine.cards import Card
        from engine.dice import DiceRoll
        from models.player import AIPlayer, Player

        if not isinstance(data, dict):
            raise TypeError("data must be a dict")

        state = cls()
        state.current_turn = int(data.get("current_turn", 0))
        state.game_over = bool(data.get("game_over", False))
        state.current_location = data.get("current_location")
        state.solution = data.get("_solution")

        dr = data.get("last_dice_roll")
        if isinstance(dr, dict):
            state.last_dice_roll = DiceRoll(
                die1=int(dr["die1"]),
                die2=int(dr["die2"]),
                total=int(dr["total"]),
            )

        # Build card-name → category map from the canonical game lists so we
        # can reconstruct Card objects without re-importing cards.py here.
        card_category: dict[str, str] = {}
        for s in state.suspects:
            card_category[s] = "suspect"
        for w in state.weapons:
            card_category[w] = "weapon"
        for loc in state.locations:
            card_category[loc] = "location"

        registry = ai_registry or {}

        for p_data in data.get("players", []):
            name = p_data.get("name")
            if not isinstance(name, str) or not name.strip():
                raise ValueError("Each player entry must have a non-empty 'name'")

            is_ai = bool(p_data.get("is_ai", False))
            ai_type = p_data.get("ai_type")

            if is_ai and ai_type and ai_type in registry:
                agent = registry[ai_type]()
                player: Player = AIPlayer(name, agent)
            else:
                player = Player(name, is_ai=is_ai)

            player.position = p_data.get("position")
            player.active = bool(p_data.get("active", True))

            # Restore dealt cards directly — do NOT call add_card() because it
            # triggers notebook.eliminate() which would corrupt the restored
            # probability distributions we are about to overwrite below.
            for card_name in p_data.get("cards", []):
                category = card_category.get(card_name, "unknown")
                player.cards.append(Card(card_name, category))

            # Restore Bayesian notebook state.
            nb_data = p_data.get("notebook")
            if nb_data is not None and player.notebook is not None:
                nb = player.notebook
                if "suspects" in nb_data:
                    nb.suspects = {k: float(v) for k, v in nb_data["suspects"].items()}
                if "weapons" in nb_data:
                    nb.weapons = {k: float(v) for k, v in nb_data["weapons"].items()}
                if "locations" in nb_data:
                    nb.locations = {k: float(v) for k, v in nb_data["locations"].items()}
                if "possible_suspects" in nb_data:
                    nb.possible_suspects = set(nb_data["possible_suspects"])
                if "possible_weapons" in nb_data:
                    nb.possible_weapons = set(nb_data["possible_weapons"])
                if "possible_locations" in nb_data:
                    nb.possible_locations = set(nb_data["possible_locations"])
                if "known_cards" in nb_data:
                    nb.known_cards = set(nb_data["known_cards"])

            state.players.append(player)

        # Resolve winner reference by player name.
        winner_name = data.get("winner")
        if winner_name:
            for p in state.players:
                if p.name == winner_name:
                    state.winner = p
                    break

        return state


def _narrow_set_toward(possible_set, preferred: str) -> None:
    """Remove one non-preferred alternative from possible_set in-place.

    Used by simulate_suggestion to narrow toward the suggested cards without
    fully eliminating any candidate — the simulation stays conservative.
    """
    if not isinstance(possible_set, set) or len(possible_set) <= 1:
        return
    if preferred not in possible_set:
        return
    removable = sorted(v for v in possible_set if v != preferred)
    if removable:
        possible_set.discard(removable[0])
