"""
game_cli.py - Command Line Interface Module

Purpose: Provides a command-line interface for playing the game.
This module handles user input/output and displays the game through the terminal.
Supports mixed Human/AI sessions: human players are prompted for input each
turn; AI players resolve their turn automatically and print a summary.
"""

import logging

from engine.game_state import GameState
from models.player import Player, AIPlayer
from engine.dice import roll_dice
from engine.cards import suspects, weapons
from ai.random_ai import RandomAI
from ai.board_utils import get_possible_moves
from utils.logger import setup_logger


logger = logging.getLogger(__name__)


class GameCLI:
    """Interactive CLI driver for Murder in KUET."""

    SEPARATOR = "-" * 52

    def __init__(self):
        self.game_state = GameState()

    # ------------------------------------------------------------------
    # Public entry points
    # ------------------------------------------------------------------

    def start(self):
        """
        Run the board-and-movement test session.

        Sets up one human player and one AI player, places them on the
        board, and runs a short interactive loop so the human can make
        real moves while watching the AI play alongside them.
        """
        logger.info("%s", "=" * 52)
        logger.info("        MURDER IN KUET  -  Board Test")
        logger.info("%s", "=" * 52)

        # Session metadata for manual gameplay test reports.
        test_gameplay_time = input("Test gameplay time: ").strip() or "N/A"
        tester_name = input("Tester name: ").strip() or "N/A"
        logger.info("%s", self.SEPARATOR)
        logger.info("  Tester             : %s", tester_name)
        logger.info("  Test gameplay time : %s", test_gameplay_time)
        logger.info("%s", self.SEPARATOR)

        # Register players
        human = Player("Detective Hasib", is_ai=False)
        ai    = AIPlayer("AI Rahim", RandomAI())
        self.game_state.add_player(human)
        self.game_state.add_player(ai)
        self.game_state.setup_game()

        # Starting positions — place at opposite ends of the KUET campus
        human.move("Library")
        ai.move("Pocket Gate")

        logger.info("Players registered:")
        logger.info("  %s  (Human)  - starts at %s", human.name, human.position)
        logger.info("  %s  (AI)  - starts at %s", ai.name, ai.position)
        logger.info("Type the name of a location exactly as shown, or")
        logger.info("press Enter to STAY in your current room.")

        # Run a fixed number of test rounds
        ROUNDS = 3
        for round_no in range(1, ROUNDS + 1):
            logger.info("%s", self.SEPARATOR)
            logger.info("  ROUND %s", round_no)
            logger.info("%s", self.SEPARATOR)

            for player in self.game_state.players:
                if player.is_ai:
                    self._run_ai_turn(player)
                else:
                    self._run_human_turn(player)
                logger.info("")

            logger.info("%s", self.SEPARATOR)
            logger.info("Board test complete.")
            logger.info("%s", self.SEPARATOR)

    # ------------------------------------------------------------------
    # Turn helpers
    # ------------------------------------------------------------------

    def _run_human_turn(self, player):
        """Prompt the human player to roll dice and choose a move."""
        logger.info(">>> %s's turn", player.name)
        logger.info("    Current location : %s", player.position)

        dice = roll_dice()
        self.game_state.last_dice_roll = dice
        logger.info("    You rolled       : %s + %s = %s", dice.die1, dice.die2, dice.total)

        # Corridor weights + secret passages determine reachability this turn.
        valid_moves = get_possible_moves(
            self.game_state.board, player, steps=dice.total
        )

        if valid_moves:
            # Annotate any secret passage destination so the player knows it
            # is a free teleport rather than a dice-limited corridor move.
            passage = self.game_state.board.get_passage_destination(player.position)
            labels = [
                f"{m} [secret passage]" if m == passage else m
                for m in valid_moves
            ]
            logger.info("    Reachable rooms  : %s", ", ".join(labels))
            logger.info("    (Press Enter to stay at %s)", player.position)
        else:
            logger.warning("    Dice too low to exit any corridor - staying at %s.", player.position)

        chosen = (
            self.get_player_input(valid_moves, player.position)
            if valid_moves else None
        )

        if chosen is None:
            logger.info("    %s stays at %s.", player.name, player.position)
        else:
            player.try_move(chosen, valid_moves)
            logger.info("    %s moves to %s.", player.name, player.position)

        # Suggestion test flow for CLI gameplay verification.
        if player.position is None:
            logger.warning("    Suggestion phase skipped: player has no location.")
            return

        logger.info("    --- Suggestion Phase ---")
        suggestion = self._collect_human_suggestion(player)
        logger.info("%s suggests: %s", player.name, suggestion)
        revealer, card = self.game_state.process_suggestion(
            player, suggestion, verbose=False
        )

        if card:
            logger.info("%s revealed a card", revealer.name)
        else:
            logger.info("No one could disprove")

        logger.info("Known: %s", player.notebook.known_cards)
        logger.info("Remaining suspects: %s", player.notebook.possible_suspects)

    def _run_ai_turn(self, ai_player):
        """Run an AI turn and print a human-readable summary."""
        logger.info(">>> %s's turn  (AI)", ai_player.name)
        logger.info("    Current location : %s", ai_player.position)

        ai_agent = ai_player.take_turn(self.game_state)
        if ai_agent is None:
            logger.warning("    AI turn skipped (inactive or no assigned agent)")
            return

        d = roll_dice()
        self.game_state.last_dice_roll = d
        logger.info("    Rolled           : %s + %s = %s", d.die1, d.die2, d.total)

        valid_moves = get_possible_moves(self.game_state.board, ai_player, steps=d.total)
        move = ai_agent.choose_move(self.game_state, valid_moves)
        if move is not None and move in valid_moves:
            ai_player.try_move(move, valid_moves)
        elif move is not None:
            logger.warning("    AI selected invalid move '%s'; staying in place", move)

        self.game_state.current_location = ai_player.position
        logger.info("    Moved to         : %s", ai_player.position)

        suspect, weapon, location = ai_agent.make_suggestion(self.game_state)
        s = ai_player.make_suggestion(suspect, weapon, location)
        if s:
            if hasattr(s, "suspect"):
                logger.info(
                    "    Suggests         : %s in %s with %s",
                    s.suspect,
                    s.location,
                    s.weapon,
                )
            else:
                logger.info(
                    "    Suggests         : %s in %s with %s",
                    s["suspect"],
                    s["location"],
                    s["weapon"],
                )

        revealer, card = self.game_state.process_suggestion(ai_player, s, verbose=False)
        if card is not None:
            logger.info(
                "    Reveal           : %s revealed %s",
                revealer.name if revealer else None,
                card.name,
            )
        else:
            logger.info("    Reveal           : No card revealed")

        _ = ai_agent.decide_accusation(self.game_state)

        logger.info("Known: %s", ai_player.notebook.known_cards)
        logger.info("Remaining suspects: %s", ai_player.notebook.possible_suspects)

    # ------------------------------------------------------------------
    # Input handling
    # ------------------------------------------------------------------

    def get_player_input(self, valid_moves, current_position):
        """
        Prompt the human for a movement choice and validate it.

        Keeps asking until the player enters a reachable room name or
        presses Enter to stay put.  Matching is case-insensitive so
        the player does not have to worry about exact capitalisation.

        Args:
            valid_moves (list[str])  : Rooms reachable this turn.
            current_position (str)  : Player's current room (stay option).

        Returns:
            str | None: Validated room name to move to, or None to stay.
        """
        # Build a lowercase → canonical map for case-insensitive matching
        canonical = {loc.lower(): loc for loc in valid_moves}

        while True:
            raw = input("    Your move        : ").strip()

            # Empty input → stay in current room (valid Cluedo choice)
            if raw == "":
                return None

            normalised = raw.lower()
            if normalised in canonical:
                return canonical[normalised]

            logger.warning(
                "    '%s' is not reachable this turn. Choose from: %s",
                raw,
                ", ".join(valid_moves),
            )

    def _prompt_valid_choice(self, prompt: str, allowed_values: list[str]) -> str:
        """Prompt until the user enters a valid value from allowed_values."""
        canonical = {value.lower(): value for value in allowed_values}

        while True:
            raw = input(prompt).strip()
            if not raw:
                logger.warning("Input cannot be empty.")
                continue

            value = canonical.get(raw.lower())
            if value:
                return value

            logger.warning("Invalid choice. Expected one of: %s", ", ".join(allowed_values))

    def _collect_human_suggestion(self, player):
        """Collect and validate a human player's suggestion from CLI input."""
        logger.info("Make suggestion:")
        suspect = self._prompt_valid_choice("Suspect: ", suspects)
        weapon = self._prompt_valid_choice("Weapon: ", weapons)
        location = player.position
        return player.make_suggestion(suspect, weapon, location)

    def display_menu(self):
        """Display the available actions for the current player."""
        logger.info("Actions available this turn:")
        logger.info("  [Enter]  Stay in current room and make a suggestion")
        logger.info("  [room]   Type a room name to move there")


if __name__ == "__main__":
    setup_logger()
    GameCLI().start()

