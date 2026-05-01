"""
board_utils.py - Board Graph Utilities for AI

Purpose: Helper functions that let AI agents query the KUET campus graph.
"""


def get_possible_moves(board, player, steps=1):
    """
    Return all valid move destinations for a player this turn.

    Combines both Cluedo movement options:

    1. Dice-based movement — adjacent rooms whose corridor weight ≤ steps.
       Low dice rolls may leave some (or all) adjacent rooms out of reach.

    2. Secret passage — if the player's room has a passage, the partner room
       is always appended as an alternative to dice movement (no step cost).
       In Cluedo a player may use the passage INSTEAD of rolling dice; here
       both options are presented together and the agent picks one.

    If the player has no position yet (game start), every room is valid
    as the initial placement.

    Args:
        board (Board): The game board.
        player (Player): The player about to move.
        steps (int): Dice total for this turn (max corridor squares).

    Returns:
        list[str]: Valid destination room names (empty = player must stay).
    """
    if player.position is None:
        return board.get_all_locations()

    moves = board.get_valid_moves(player.position, steps)

    # Append the secret passage destination when one exists and is not already
    # reachable via normal dice movement.
    passage_dest = board.get_passage_destination(player.position)
    if passage_dest and passage_dest not in moves:
        moves = moves + [passage_dest]

    return moves
