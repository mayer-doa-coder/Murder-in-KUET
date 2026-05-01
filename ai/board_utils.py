"""
board_utils.py - Board Graph Utilities for AI

Purpose: Helper functions that let AI agents query the KUET campus graph.
This module allows AI to evaluate possible moves, plan paths, and reason
about location adjacency without directly coupling to the Board internals.
"""


def get_neighbors(board, location):
    """
    Return all locations directly reachable from the given location.

    Args:
        board (Board): The game board with a NetworkX graph.
        location (str): Current location name.

    Returns:
        list[str]: Adjacent location names the player can legally move to.
    """
    return list(board.graph.neighbors(location))


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


def get_shortest_path(board, from_location, to_location):
    """
    Return the shortest path between two locations.

    Args:
        board (Board): The game board.
        from_location (str): Start location.
        to_location (str): Target location.

    Returns:
        list[str]: Ordered list of locations from start to target,
                   or an empty list if no path exists.
    """
    try:
        return board.shortest_path(from_location, to_location)
    except Exception:
        return []


def get_next_step_toward(board, from_location, to_location):
    """
    Return the immediate next location to move to when heading toward a target.

    Useful for rule-based AI that wants to reach a specific location over
    multiple turns.

    Args:
        board (Board): The game board.
        from_location (str): Current location.
        to_location (str): Desired destination.

    Returns:
        str | None: Next location to move to, or None if already there.
    """
    path = get_shortest_path(board, from_location, to_location)
    if len(path) > 1:
        return path[1]
    return None


def score_location(location, board, knowledge_base, visited_locations=None):
    """
    Score a candidate location to help AI choose the most valuable move.
    Scoring is aligned with Cluedo rules:

      In Cluedo a player can ONLY suggest the room they are currently in.
      Therefore the value of moving to a room comes entirely from what
      suggestion can be made there.

    Scoring factors:
        +5   room is still a possible murder location
             (visiting lets the AI suggest it and gather clues)
        +3   room has not been visited yet
             (fresh rooms yield new information via suggestions)
        -3   room is already eliminated from the solution
             (no deduction value; moving here wastes a turn)
        +4   near-endgame bonus: room is the last possible location AND
             at most 1 suspect + 1 weapon remain unknown
             (this is almost certainly the solution room — go there to accuse)

    Args:
        location (str): Candidate location name to evaluate.
        board (Board): The game board.
        knowledge_base (KnowledgeBase): AI's current deduction state.
        visited_locations (set | None): Locations the AI has already been to.

    Returns:
        int: Score (higher = better move target).
    """
    score = 0
    visited_locations = visited_locations or set()

    # Core Cluedo rule: you can only suggest the room you are in.
    # A possible-solution room is the most valuable destination.
    if location in knowledge_base.possible_locations:
        score += 5
    else:
        # Room is already ruled out — moving here has no deduction value.
        score -= 3

    # Unexplored rooms always produce new suggestion results.
    if location not in visited_locations:
        score += 3

    # Near-endgame: if this is the last candidate room and suspects/weapons
    # are nearly solved, this room is almost certainly the solution —
    # prioritise it strongly so the AI moves there to make the accusation.
    if (
        len(knowledge_base.possible_locations) == 1
        and location in knowledge_base.possible_locations
        and len(knowledge_base.possible_suspects) <= 2
        and len(knowledge_base.possible_weapons) <= 2
    ):
        score += 4

    return score
