"""
player.py - Player Object Module

Purpose: Defines player objects and manages player-specific data.
This module handles player attributes, hand management, and player actions.
"""

from engine.dice import roll_dice
from engine.suggestion import Suggestion


class Player:

    def __init__(self, name, is_ai=False):
        self.name = name
        self.is_ai = is_ai
        self.cards = []       # cards dealt to this player
        self.position = None  # current location on the KUET board
        self.active = True    # set to False on a wrong accusation

    def add_card(self, card):
        """Add a card to the player's hand."""
        self.cards.append(card)

    def move(self, new_location):
        """Move the player to a new KUET location (raw setter).

        This bypasses validation intentionally.  In Cluedo a player can be
        FORCED to a room when another player names them in a suggestion
        ("I suggest it was Rahim, in the Library") — that teleportation ignores
        dice rolls and normal movement range.  Use try_move() for ordinary
        turn-based movement where the dice roll limits how far a player can go.
        """
        self.position = new_location

    def try_move(self, new_location, valid_moves):
        """Attempt to move to new_location only if it is within the dice budget.

        Called during a normal turn after the engine has computed valid_moves
        via BFS on the board graph using that turn's dice roll.  The agent
        picks a destination; this method enforces that the pick is legal.

        In Cluedo a player may also choose to STAY in their current room
        (pass None from choose_move) and suggest there again without moving.
        That case is handled by not calling try_move at all — None from the
        agent simply means "I'm staying put".

        Args:
            new_location (str): Destination the agent wants to move to.
            valid_moves (list[str]): Locations reachable this turn given the
                                     dice roll (pre-computed by the engine).

        Returns:
            bool: True if the move was legal and executed; False otherwise.
        """
        if new_location in valid_moves:
            self.move(new_location)
            return True
        return False

    def make_suggestion(self, suspect: str, weapon: str, location: str) -> Suggestion:
        """Create a pure suggestion object for this turn.

        This method does not mutate game state. It only validates inputs
        and returns a new Suggestion instance that can be consumed by
        reveal, AI-reasoning, and game-loop systems.

        Args:
            suspect (str): Suggested suspect name.
            weapon (str): Suggested weapon name.
            location (str): Suggested location name.

        Returns:
            Suggestion: A validated suggestion object.
        """
        return Suggestion(suspect=suspect, weapon=weapon, location=location)

    def make_accusation(self, suspect, weapon, location):
        """
        Make a final accusation to solve the murder.
        Returns a dict representing the accusation.
        A wrong accusation eliminates the player.
        """
        return {
            "suspect": suspect,
            "weapon": weapon,
            "location": location,
            "by": self.name,
            "final": True,
        }

    def show_card(self, suggestion):
        """
        Find and return one card in hand that matches the suggestion,
        to disprove it. Returns None if no matching card is held.
        """
        for card in self.cards:
            if card.name in (
                suggestion["suspect"],
                suggestion["weapon"],
                suggestion["location"],
            ):
                return card
        return None

    def take_turn(self, game_state):
        """
        Execute this player's turn.

        For AI players the agent drives every decision automatically.
        For human players this is a hook; the CLI / API layer calls the
        individual methods (move, make_suggestion, make_accusation) directly
        based on user input.

        Returns:
            dict | None: For AI players, a result dict with keys:
                           'dice'        – DiceRoll(die1, die2, total)
                           'move'        – location moved to (or None if stayed)
                           'suggestion'  – suggestion dict made this turn
                           'accusation'  – accusation dict or None
                         For human players, returns None (caller handles input).
        """
        if self.is_ai:
            # 1. Roll both dice — total is the step budget for this turn.
            dice = roll_dice()
            # Publish on game_state so any agent can read it via game_state.last_dice_roll.
            game_state.last_dice_roll = dice

            # 2. Engine computes the valid destinations (BFS up to dice.total hops).
            #    An empty position means the game just started; every location is reachable.
            from ai.board_utils import get_possible_moves
            valid_moves = get_possible_moves(game_state.board, self, steps=dice.total)

            # 3. Hand the ready-made list to the agent — it only needs to choose.
            #    Returning None means "stay in current room" (legal in Cluedo).
            move = self.ai_agent.choose_move(game_state, valid_moves)
            if move:
                moved = self.try_move(move, valid_moves)
                if not moved:
                    # Agent returned a location outside the valid set — this
                    # should not happen with a well-behaved agent, but guard
                    # against bugs in custom agents without crashing the game.
                    move = None

            game_state.current_location = self.position
            suggestion = self.ai_agent.make_suggestion(game_state)
            if isinstance(suggestion, tuple) and len(suggestion) == 3:
                suggestion = {
                    "suspect": suggestion[0],
                    "weapon": suggestion[1],
                    "location": suggestion[2],
                }
            accusation = self.ai_agent.make_accusation(game_state)

            return {
                "dice": dice,
                "move": self.position,
                "suggestion": suggestion,
                "accusation": accusation,
            }

        # Human turn — handled externally by CLI/API
        return None

    def __repr__(self):
        kind = "AI" if self.is_ai else "Human"
        return f"Player({self.name}, {kind}, position={self.position})"


class AIPlayer(Player):
    """AI-controlled player. All decisions are delegated to ai_agent."""

    def __init__(self, name, ai_agent):
        super().__init__(name, is_ai=True)
        self.ai_agent = ai_agent

    def add_card(self, card):
        """
        Add a card to hand and immediately register it with the AI's
        knowledge base so it is excluded from solution candidates.
        """
        super().add_card(card)
        if hasattr(self.ai_agent, "knowledge_base"):
            self.ai_agent.knowledge_base.add_own_card(card.name)

    def decide_accusation(self, game_state):
        """Ask the agent whether to make a final accusation this turn."""
        return self.ai_agent.make_accusation(game_state)

    def __repr__(self):
        return f"AIPlayer({self.name}, agent={type(self.ai_agent).__name__}, position={self.position})"
