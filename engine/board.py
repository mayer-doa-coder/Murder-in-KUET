"""
board.py - KUET Map Module

Purpose: Manages the game board representing KUET campus locations.
This module handles the map layout, room connections, and player movement.
"""

import networkx as nx


class Board:

    def __init__(self):
        self.graph = nx.Graph()
        self.create_board()

    def create_board(self):
        """Build the KUET campus map as an undirected graph."""
        locations = [
            "Library",
            "Academic Building",
            "Amar Ekushey Hall",
            "Cafeteria",
            "Central Field",
            "IT Park",
            "Rokeya Hall",
            "VC Room",
            "Pocket Gate",
        ]

        for location in locations:
            self.graph.add_node(location)

        connections = [
            ("Library", "Academic Building"),
            ("Library", "VC Room"),
            ("Academic Building", "IT Park"),
            ("Academic Building", "Cafeteria"),
            ("Academic Building", "VC Room"),
            ("IT Park", "Central Field"),
            ("Cafeteria", "Central Field"),
            ("Central Field", "Amar Ekushey Hall"),
            ("Central Field", "Rokeya Hall"),
            ("Central Field", "Pocket Gate"),
            ("Amar Ekushey Hall", "Rokeya Hall"),
            ("Rokeya Hall", "Pocket Gate"),
        ]

        self.graph.add_edges_from(connections)

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
