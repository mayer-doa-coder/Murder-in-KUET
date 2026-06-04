"""
cards.py - Suspects/Weapons/Location Cards Module

Purpose: Manages game cards including suspects, weapons, and locations.
This module defines card types, manages the deck, and handles card distribution.
"""

import random


class Card:
    def __init__(self, name, category):
        self.name = name
        self.category = category

    def __repr__(self):
        return f"Card({self.name}, {self.category})"


suspects = [
    "Chef",
    "Hallboy",
    "Security Guard",
    "Shopkeeper",
    "Student Girl",
    "Student Boy",
]

weapons = [
    "Knife",
    "Sleeping Pills",
    "Revolver",
    "Laptop Charger",
    "Anti Cutter",
    "Rope",
]

locations = [
    "Auditorium",
    "Student Welfare Center",
    "Amar Ekushey Hall",
    "Cafeteria",
    "Central Field",
    "IT Park",
    "Begum Rokeya Hall",
    "Lotus Pond",
    "Pocket Gate",
]


def create_deck():
    deck = []
    for s in suspects:
        deck.append(Card(s, "suspect"))
    for w in weapons:
        deck.append(Card(w, "weapon"))
    for loc in locations:
        deck.append(Card(loc, "location"))

    random.shuffle(deck)
    return deck


