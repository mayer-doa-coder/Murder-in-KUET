"""
features.py - AI State Input Module

Purpose: Converts the current game state into a structured feature dict
that AI agents can consume for decision-making.
"""

from engine.cards import locations, suspects, weapons


def extract_features(game_state, player):
    """
    Convert the game state into a flat feature dictionary from the
    perspective of a given player.

    Args:
        game_state (GameState): The current game state.
        player (Player | AIPlayer): The player whose perspective to use.

    Returns:
        dict: Feature dict with the following keys:
            - player_name        (str)  player's name
            - player_position    (str)  current location, or None
            - known_cards        (list) card names in the player's hand
            - unknown_cards      (list) card names NOT in the player's hand
            - possible_suspects  (list) suspects not yet eliminated
            - possible_weapons   (list) weapons not yet eliminated
            - possible_locations (list) locations not yet eliminated
            - active_players     (list) names of players still in the game
            - current_turn       (int)  global turn counter
            - is_my_turn         (bool) True when it is this player's turn
            - solution_known     (bool) True when AI has deduced the answer
    """
    # All card names in the game
    all_card_names = set(suspects + weapons + locations)

    # Cards in this player's hand
    known_cards = [card.name for card in player.cards]

    # Cards not in hand — could be solution cards or held by others
    unknown_cards = sorted(all_card_names - set(known_cards))

    # Pull narrowed-down candidates from KB if the player has one,
    # otherwise fall back to the full lists
    kb = getattr(player, "notebook", None)

    if kb:
        possible_suspects = sorted(getattr(kb, "possible_suspects", set()))
        possible_weapons = sorted(getattr(kb, "possible_weapons", set()))
        possible_locations = sorted(getattr(kb, "possible_locations", set()))
        # BayesianNotebook uses is_solved(); KnowledgeBase uses is_solution_known()
        if hasattr(kb, "is_solved"):
            solution_known = kb.is_solved()
        else:
            solution_known = (
                kb.is_solution_known() if hasattr(kb, "is_solution_known") else False
            )
    else:
        # For human players, show everything not in their hand per category
        possible_suspects = [s for s in suspects if s not in known_cards]
        possible_weapons = [w for w in weapons if w not in known_cards]
        possible_locations = [loc for loc in locations if loc not in known_cards]
        solution_known = False

    # Active (non-eliminated) players
    active_players = [p.name for p in game_state.players if p.active]

    # Is it this player's turn?
    current_player = game_state.get_current_player()
    is_my_turn = current_player.name == player.name

    return {
        "player_name": player.name,
        "player_position": player.position,
        "known_cards": known_cards,
        "unknown_cards": unknown_cards,
        "possible_suspects": possible_suspects,
        "possible_weapons": possible_weapons,
        "possible_locations": possible_locations,
        "active_players": active_players,
        "current_turn": game_state.current_turn,
        "is_my_turn": is_my_turn,
        "solution_known": solution_known,
    }
