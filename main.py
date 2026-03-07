"""
main.py - Main Entry Point

Purpose: Main entry point for the Murder in KUET game.
This module initializes the game and starts either CLI or API mode.
"""

from engine.cards import create_deck
from engine.player import Player, AIPlayer
from engine.game_state import GameState
from ai.random_ai import RandomAI


def main():
    print("=" * 45)
    print("       Murder in KUET — Day 1 Checks")
    print("=" * 45)

    # 1. Deck creation
    deck = create_deck()
    cats = {}
    for card in deck:
        cats[card.category] = cats.get(card.category, 0) + 1
    print(f"\n[1] Deck creation       OK")
    print(f"    Total cards : {len(deck)}")
    print(f"    Suspects    : {cats['suspect']}")
    print(f"    Weapons     : {cats['weapon']}")
    print(f"    Locations   : {cats['location']}")

    # 2. Player creation
    human = Player("Alice")
    print(f"\n[2] Player creation     OK")
    print(f"    {human}")

    # 3. AI initialization
    agent = RandomAI()
    bot = AIPlayer("BOT-Random", agent)
    print(f"\n[3] AI initialization   OK")
    print(f"    {bot}")

    # 4. Game initialization
    game = GameState()
    game.add_player(human)
    game.add_player(bot)
    game.setup_game()
    print(f"\n[4] Game initialization OK")
    print(f"    Players     : {[p.name for p in game.players]}")
    print(f"    Solution    : <hidden>")          # never print solution in real play
    print(f"    Alice hand  : {len(human.cards)} cards")
    print(f"    BOT hand    : {len(bot.cards)} cards")
    print(f"    Cards dealt : {len(human.cards) + len(bot.cards)} / 18 remaining")

    # 5. AI takes a turn
    result = bot.take_turn(game)
    print(f"\n[5] AI turn             OK")
    print(f"    Moved to    : {result['move']}")
    print(f"    Suggestion  : {result['suggestion']}")
    print(f"    Accusation  : {result['accusation']}")

    print("\n" + "=" * 45)
    print("  All Day-1 components verified successfully")
    print("=" * 45)


if __name__ == "__main__":
    main()

