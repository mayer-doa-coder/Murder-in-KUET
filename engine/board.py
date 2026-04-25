"""
board.py - KUET Map Module

Purpose: Manages the game board representing KUET campus locations.
This module handles the map layout, room connections, and player movement.
"""

import networkx as nx


class Board:

    def __init__(self):
        self.graph = nx.Graph()
        self.passages = {}   # populated by create_board()
        self.create_board()

    def create_board(self):
        """Build the KUET campus map as a weighted undirected graph.

        Edge weights represent corridor length in squares, i.e. the number of
        dice steps needed to traverse the connecting corridor and enter the next
        room.
        """
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

        for location in locations:
            self.graph.add_node(location)

        # (room_a, room_b, corridor_length_in_squares)
        connections = [
            ("Auditorium", "Student Welfare Center", 4),
            ("Auditorium", "Lotus Pond", 2),
            ("Student Welfare Center", "IT Park", 4),
            ("Student Welfare Center", "Cafeteria", 3),
            ("Student Welfare Center", "Lotus Pond", 2),
            ("IT Park", "Central Field", 4),
            ("Cafeteria", "Central Field", 3),
            ("Central Field", "Amar Ekushey Hall", 3),
            ("Central Field", "Begum Rokeya Hall", 4),
            ("Central Field", "Pocket Gate", 2),
            ("Amar Ekushey Hall", "Begum Rokeya Hall", 2),
            ("Begum Rokeya Hall", "Pocket Gate", 3),
        ]

        for room_a, room_b, length in connections:
            self.graph.add_edge(room_a, room_b, weight=length)

        # Secret passages (corner-style shortcuts).
        self.passages = {
            "Auditorium": "Pocket Gate",
            "Pocket Gate": "Auditorium",
            "Lotus Pond": "Begum Rokeya Hall",
            "Begum Rokeya Hall": "Lotus Pond",
        }

    def get_neighbors(self, location):
        """Return a list of locations directly connected to the given location."""
        return list(self.graph.neighbors(location))

    def is_connected(self, location_a, location_b):
        """Return True if the two locations are directly connected by a path."""
        return self.graph.has_edge(location_a, location_b)

    def shortest_path(self, location_a, location_b):
        """Return the shortest path between two locations as a list of nodes."""
        return nx.shortest_path(self.graph, location_a, location_b)

    def get_all_locations(self):
        """Return a list of all locations on the board."""
        return list(self.graph.nodes)

    def get_valid_moves(self, start, steps=1):
        """Return directly adjacent rooms reachable within the dice budget."""
        valid = []
        for neighbor in self.graph.neighbors(start):
            corridor_length = self.graph[start][neighbor].get("weight", 1)
            if corridor_length <= steps:
                valid.append(neighbor)
        return valid

    def get_passage_destination(self, location):
        """Return the secret-passage exit for the given room, or None."""
        return self.passages.get(location)
