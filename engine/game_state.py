"""
game_state.py - Current Game Status Module

Purpose: Manages and tracks the current state of the game.
This module maintains game status, player states, solution, and game progress.
"""

import random
from engine.cards import suspects, weapons, locations, create_deck
from engine.board import Board
from engine.clue_reveal import reveal_clue
from engine.accusation import check_accusation
from engine.dice import roll_dice


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
        self.solution = {
            "suspect": random.choice(suspects),
            "weapon": random.choice(weapons),
            "location": random.choice(locations),
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

        if verbose:
            print(f"{player.name} suggests: {suggestion}")
        revealer, card = reveal_clue(suggestion, self.players, current_index)

        if card is not None:
            if verbose and revealer is not None:
                print(f"{revealer.name} revealed a card!")
            player.notebook.eliminate(card.name)

            if player.is_ai and hasattr(player.ai_agent, "update_from_clue"):
                player.ai_agent.update_from_clue(card)
        else:
            if verbose:
                print("No one could reveal a clue!")
            if player.is_ai and hasattr(player.ai_agent, "handle_no_reveal"):
                player.ai_agent.handle_no_reveal(suggestion)

        return (revealer, card)

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
            print(f"{active_players[0].name} wins by default!")
            return True

        if len(active_players) == 0:
            self.winner = None
            self.game_over = True
            print("No players remaining. Game ends.")
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
            print(f"{player.name} wins!")
            self.winner = player
            self.game_over = True
            return True

        print(f"{player.name} eliminated!")
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
        result = player.take_turn(self)

        accusation = None
        if isinstance(result, dict):
            accusation = result.get("accusation")

        if accusation is not None:
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
            raise ValueError("Cannot run game without players")

        turns_played = 0
        current_index = self.current_turn % len(self.players)

        while not self.game_over:
            active_players = [p for p in self.players if p.active]
            if len(active_players) == 1:
                self.winner = active_players[0]
                self.game_over = True
                if verbose:
                    print(f"{active_players[0].name} wins by default!")
                break

            if len(active_players) == 0:
                self.winner = None
                self.game_over = True
                if verbose:
                    print("Game ended. No players remaining.")
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
                    print(f"\n--- {player.name} (AI) Turn ---")
                else:
                    print(f"\n--- {player.name}'s Turn ---")

            # 1) Roll dice.
            dice_roll = roll_dice()
            self.last_dice_roll = dice_roll
            dice_value = dice_roll.total
            if verbose:
                print(f"Dice: {dice_value}")

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
                    raise ValueError(f"AI player {player.name} has no ai_agent assigned")
                move = player.ai_agent.choose_move(self, valid_moves)
                # Safety fallback: if AI returns an invalid move, recover with
                # a random legal move to keep the game progressing.
                if valid_moves and move not in valid_moves:
                    move = random.choice(valid_moves)
            elif human_move_selector is not None:
                move = human_move_selector(player, valid_moves, self)
            elif valid_moves:
                move = valid_moves[0]

            if move in valid_moves:
                player.move(move)

            if move is not None:
                assert move in valid_moves, "Invalid move selected"

            self.current_location = player.position
            if verbose:
                print(f"Move: {player.position}")

            # 3) Suggestion phase.
            if player.is_ai:
                suspect, weapon, _ = player.ai_agent.make_suggestion(self)
                if suspect not in self.suspects:
                    suspect = random.choice(self.suspects)
                if weapon not in self.weapons:
                    weapon = random.choice(self.weapons)
            elif human_suggestion_selector is not None:
                suspect, weapon = human_suggestion_selector(player, self)
            else:
                suspect = self.suspects[0]
                weapon = self.weapons[0]

            suggestion = player.make_suggestion(suspect, weapon, player.position)
            assert suggestion is not None, "Suggestion failed"
            if verbose:
                print(f"Suggestion: {suggestion}")

            # 4) Clue revelation.
            revealer, card = reveal_clue(suggestion, self.players, current_index)

            # 5) Notebook update.
            if card:
                player.notebook.eliminate(card.name)
                if verbose and revealer is not None:
                    print(f"{revealer.name} revealed a card!")
            elif verbose:
                print("No one could disprove!")

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
                    solved = None
                    if hasattr(player, "notebook") and hasattr(player.notebook, "get_solution"):
                        solved = player.notebook.get_solution()

                    if solved is not None:
                        accusation = player.make_accusation(solved[0], solved[1], solved[2])
                    else:
                        accusation = player.make_accusation(suspect, weapon, player.position)
                elif isinstance(accusation, tuple) and len(accusation) == 3:
                    accusation = player.make_accusation(
                        accusation[0], accusation[1], accusation[2]
                    )

                if check_accusation(accusation, self.solution):
                    if verbose:
                        print(f"{player.name} wins!")
                    self.winner = player
                    self.game_over = True
                else:
                    if verbose:
                        print(f"{player.name} eliminated!")
                    player.active = False

            if verbose and player.is_ai:
                print(f"Accusation Decision: {should_accuse}")

            # 8) Turn rotation.
            current_index = (current_index + 1) % len(self.players)
            turns_played += 1

        return self.winner
