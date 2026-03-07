"""
dice.py - Dice Rolling Module

Purpose: Provides dice rolling mechanics for turn-based movement.
In Cluedo, two standard dice are rolled at the start of every turn and
the sum determines the maximum number of steps the active player may take
across the board that turn.
"""

import random
from collections import namedtuple

# Immutable record of a single dice roll.
# die1, die2 — individual face values (1-6 each).
# total       — sum of both dice (2-12); used as the step budget for movement.
DiceRoll = namedtuple("DiceRoll", ["die1", "die2", "total"])


def roll_dice():
    """
    Roll two standard six-sided dice (2d6), as per Cluedo rules.

    Cluedo rules relevant to movement:
    - Both dice are rolled at the start of a player's turn.
    - The total is the MAXIMUM number of squares the player may move.
    - The player is not required to use all steps — they may stop the moment
      they enter a room and make a suggestion there.
    - A player already inside a room may choose NOT to leave (skip movement
      entirely) and instead make a suggestion in the same room again.

    Returns:
        DiceRoll: Named tuple with fields:
                    die1  (int)  – first die value  (1–6)
                    die2  (int)  – second die value (1–6)
                    total (int)  – movement budget  (2–12)
    """
    die1 = random.randint(1, 6)
    die2 = random.randint(1, 6)
    return DiceRoll(die1=die1, die2=die2, total=die1 + die2)
