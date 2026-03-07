"""
cards.py - Suspects/Weapons/Location Cards Module

Purpose: Manages game cards including suspects, weapons, and locations.
This module defines card types, manages the deck, and handles card distribution.
"""

import random


class Card:
    """Base class for game cards."""
    
    def __init__(self, name, category):
        """Initialize a card with name and category."""
        self.name = name
        self.category = category
    
    def __repr__(self):
        """String representation of the card."""
        return f"Card({self.name}, {self.category})"


# Card Lists
suspects = [
    "Hashem Sir",
    "Opi Sir",
    "Tawhid",
    "Shejan",
    "Hasina",
    "Trump",
]

weapons = [
    "Knife",
    "Poison",
    "Wrench",
    "Laptop Charger",
    "Anti Cutter",
    "Pipe"
]

locations = [
    "Library",
    "Academic Building",
    "Amar Ekushey Hall",
    "Cafeteria",
    "Central Field",
    "IT Park",
    "Rokeya Hall",
    "VC Room",
    "Pocket Gate"
]


def create_deck():
    """
    Create a shuffled deck of all cards.
    
    Returns:
        list: A shuffled list of all Card objects.
    """
    deck = []
    for s in suspects:
        deck.append(Card(s, "suspect"))
    for w in weapons:
        deck.append(Card(w, "weapon"))
    for l in locations:
        deck.append(Card(l, "location"))

    random.shuffle(deck)
    return deck
