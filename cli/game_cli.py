"""
game_cli.py - Command Line Interface Module

Purpose: Provides a command-line interface for playing the game.
This module handles user input/output and displays the game through the terminal.
Supports mixed Human/AI sessions: human players are prompted for input each
turn; AI players resolve their turn automatically and print a summary.
"""

from engine.game_state import GameState
from engine.player import Player, AIPlayer
from engine.dice import roll_dice
from engine.cards import suspects, weapons
from ai.random_ai import RandomAI
from ai.board_utils import get_possible_moves


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
        print("\n" + "=" * 52)
        print("        MURDER IN KUET  —  Board Test")
        print("=" * 52)

        # Session metadata for manual gameplay test reports.
        test_gameplay_time = input("Test gameplay time: ").strip() or "N/A"
        tester_name = input("Tester name: ").strip() or "N/A"
        print(self.SEPARATOR)
        print(f"  Tester             : {tester_name}")
        print(f"  Test gameplay time : {test_gameplay_time}")
        print(self.SEPARATOR)

        # Register players
        human = Player("Detective Hasib", is_ai=False)
        ai    = AIPlayer("AI Rahim", RandomAI())
        self.game_state.add_player(human)
        self.game_state.add_player(ai)
        self.game_state.setup_game()

        # Starting positions — place at opposite ends of the KUET campus
        human.move("Library")
        ai.move("Pocket Gate")

        print("\nPlayers registered:")
        print(f"  {human.name}  (Human)  — starts at {human.position}")
        print(f"  {ai.name}  (AI)  — starts at {ai.position}")
        print("\nType the name of a location exactly as shown, or")
        print("press Enter to STAY in your current room.\n")

        # Run a fixed number of test rounds
        ROUNDS = 3
        for round_no in range(1, ROUNDS + 1):
            print(self.SEPARATOR)
            print(f"  ROUND {round_no}")
            print(self.SEPARATOR)

            for player in self.game_state.players:
                if player.is_ai:
                    self._run_ai_turn(player)
                else:
                    self._run_human_turn(player)
                print()

        print(self.SEPARATOR)
        print("Board test complete.")
        print(self.SEPARATOR)

    # ------------------------------------------------------------------
    # Turn helpers
    # ------------------------------------------------------------------

    def _run_human_turn(self, player):
        """Prompt the human player to roll dice and choose a move."""
        print(f">>> {player.name}'s turn")
        print(f"    Current location : {player.position}")

        dice = roll_dice()
        self.game_state.last_dice_roll = dice
        print(f"    You rolled       : {dice.die1} + {dice.die2} = {dice.total}")

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
            print(f"    Reachable rooms  : {', '.join(labels)}")
            print(f"    (Press Enter to stay at {player.position})")
        else:
            print(
                f"    Dice too low to exit any corridor — "
                f"staying at {player.position}."
            )

        chosen = (
            self.get_player_input(valid_moves, player.position)
            if valid_moves else None
        )

        if chosen is None:
            print(f"    {player.name} stays at {player.position}.")
        else:
            player.try_move(chosen, valid_moves)
            print(f"    {player.name} moves to {player.position}.")

        # Suggestion test flow for CLI gameplay verification.
        if player.position is None:
            print("    Suggestion phase skipped: player has no location.")
            return

        print("\n    --- Suggestion Phase ---")
        suggestion = self._collect_human_suggestion(player)
        print(f"{player.name} suggests: {suggestion}")
        revealer, card = self.game_state.process_suggestion(
            player, suggestion, verbose=False
        )

        if card:
            print(f"{revealer.name} revealed a card!")
        else:
            print("No one could disprove!")

        print("Known:", player.notebook.known_cards)
        print("Remaining suspects:", player.notebook.possible_suspects)

    def _run_ai_turn(self, ai_player):
        """Run an AI turn and print a human-readable summary."""
        print(f">>> {ai_player.name}'s turn  (AI)")
        print(f"    Current location : {ai_player.position}")

        result = ai_player.take_turn(self.game_state)

        d = result["dice"]
        print(f"    Rolled           : {d.die1} + {d.die2} = {d.total}")
        print(f"    Moved to         : {result['move']}")

        s = result["suggestion"]
        if s:
            if hasattr(s, "suspect"):
                print(
                    f"    Suggests         : {s.suspect} in {s.location}"
                    f" with {s.weapon}"
                )
            else:
                print(
                    f"    Suggests         : {s['suspect']} in {s['location']}"
                    f" with {s['weapon']}"
                )

        if result.get("revealed_card"):
            print(
                f"    Reveal           : {result.get('revealer')} revealed "
                f"{result.get('revealed_card')}"
            )
        else:
            print("    Reveal           : No card revealed")

        print("Known:", ai_player.notebook.known_cards)
        print("Remaining suspects:", ai_player.notebook.possible_suspects)

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

            print(
                f"    '{raw}' is not reachable this turn. "
                f"Choose from: {', '.join(valid_moves)}"
            )

    def _prompt_valid_choice(self, prompt: str, allowed_values: list[str]) -> str:
        """Prompt until the user enters a valid value from allowed_values."""
        canonical = {value.lower(): value for value in allowed_values}

        while True:
            raw = input(prompt).strip()
            if not raw:
                print("Input cannot be empty.")
                continue

            value = canonical.get(raw.lower())
            if value:
                return value

            print(f"Invalid choice. Expected one of: {', '.join(allowed_values)}")

    def _collect_human_suggestion(self, player):
        """Collect and validate a human player's suggestion from CLI input."""
        print("Make suggestion:")
        suspect = self._prompt_valid_choice("Suspect: ", suspects)
        weapon = self._prompt_valid_choice("Weapon: ", weapons)
        location = player.position
        return player.make_suggestion(suspect, weapon, location)

    def display_menu(self):
        """Display the available actions for the current player."""
        print("\nActions available this turn:")
        print("  [Enter]  Stay in current room and make a suggestion")
        print("  [room]   Type a room name to move there")


if __name__ == "__main__":
    GameCLI().start()

