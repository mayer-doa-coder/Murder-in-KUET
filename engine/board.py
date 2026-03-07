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

        Edge weights represent corridor length in squares — the number of dice
        steps needed to traverse the connecting corridor and enter the next room.
        A player can only reach an adjacent room if corridor_weight ≤ dice_total.
        This enforces the core Cluedo movement rule: movement stops the moment
        a player enters a room; they cannot pass through it to reach another.
        """
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

        # (room_a, room_b, corridor_length_in_squares)
        # Low weights = short corridors reachable even on low dice rolls.
        # High weights = long corridors that demand a decent dice total.
        # Range 2-5 maps well to the 2d6 distribution (average 7 opens most rooms).
        connections = [
            ("Library",           "Academic Building", 4),
            ("Library",           "VC Room",           2),
            ("Academic Building", "IT Park",           4),
            ("Academic Building", "Cafeteria",         3),
            ("Academic Building", "VC Room",           2),
            ("IT Park",           "Central Field",     4),
            ("Cafeteria",         "Central Field",     3),
            ("Central Field",     "Amar Ekushey Hall", 3),
            ("Central Field",     "Rokeya Hall",       4),
            ("Central Field",     "Pocket Gate",       2),
            ("Amar Ekushey Hall", "Rokeya Hall",       2),
            ("Rokeya Hall",       "Pocket Gate",       3),
        ]

        for room_a, room_b, length in connections:
            self.graph.add_edge(room_a, room_b, weight=length)

        # Secret passages: pairs of corner rooms linked by hidden campus shortcuts,
        # mirroring Cluedo's classic diagonal-corner passage mechanic.
        # A player in one of these rooms may use the passage INSTEAD of rolling dice
        # — a free teleport to the partner room (no step cost).
        self.passages = {
            "Library":     "Pocket Gate",   # north academic wing  ↔  campus entry
            "Pocket Gate": "Library",
            "VC Room":     "Rokeya Hall",   # admin block  ↔  student residential
            "Rokeya Hall": "VC Room",
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
        """
        Return directly adjacent rooms reachable within the dice budget.

        Cluedo movement rule: a player's movement ends the moment they enter
        a room.  They cannot pass through one room to reach another in the
        same turn.  Since every node in the KUET graph IS a room, reachability
        is determined entirely by the corridor connecting two adjacent rooms:

            reachable  ←→  corridor_weight ≤ dice_total

        Secret passage destinations are NOT included here; they are appended
        by ai.board_utils.get_possible_moves so the agent can choose them.

        Args:
            start (str): Current room name.
            steps (int): Dice total — maximum corridor squares this turn.

        Returns:
            list[str]: Adjacent room names whose corridor length ≤ steps.
        """
        valid = []
        for neighbor in self.graph.neighbors(start):
            corridor_length = self.graph[start][neighbor].get("weight", 1)
            if corridor_length <= steps:
                valid.append(neighbor)
        return valid

    def get_passage_destination(self, location):
        """
        Return the secret-passage exit for the given room, or None.

        In Cluedo, certain corner rooms are linked by secret passages.
        A player may use the passage INSTEAD OF rolling dice — the move is
        immediate and costs no dice steps.

        Args:
            location (str): Room to check.

        Returns:
            str | None: Partner room name, or None if no passage exists.
        """
        return self.passages.get(location)
