"""
board.py - KUET Map Module

Purpose: Manages the game board representing KUET campus locations.
This module handles the map layout, room connections, and player movement.
"""

import heapq
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
        """Return all rooms reachable from start within the step budget.

        Uses Dijkstra's algorithm so multi-hop paths are correctly accounted
        for: a room is reachable if the *shortest-path cost* (sum of corridor
        weights along the cheapest route) does not exceed `steps`.

        This matches real Cluedo movement where a player may traverse multiple
        corridors in one turn as long as the total square count stays within
        the dice total, stopping only when they choose to enter a room.

        Args:
            start (str): Current room name.
            steps (int): Dice-total movement budget (default 1).

        Returns:
            list[str]: Room names reachable within the step budget (excludes
                       the starting room itself).
        """
        if start not in self.graph:
            return []

        dist = {start: 0}
        heap = [(0, start)]
        reachable = []

        while heap:
            cost, node = heapq.heappop(heap)
            if cost > dist.get(node, float("inf")):
                continue
            if node != start:
                reachable.append(node)
            for neighbor in self.graph.neighbors(node):
                edge_cost = self.graph[node][neighbor].get("weight", 1)
                new_cost = cost + edge_cost
                if new_cost <= steps and new_cost < dist.get(neighbor, float("inf")):
                    dist[neighbor] = new_cost
                    heapq.heappush(heap, (new_cost, neighbor))

        return reachable

    def get_shortest_path_cost(self, start: str, end: str) -> int:
        """Return the minimum total corridor cost between two rooms.

        Useful for AI agents that want to estimate how many turns it will
        take to reach a target room given a typical dice roll.

        Args:
            start (str): Origin room name.
            end (str): Destination room name.

        Returns:
            int: Minimum total step cost, or 0 if start == end,
                 or a large sentinel (999) if no path exists.
        """
        if start == end:
            return 0
        try:
            return nx.shortest_path_length(self.graph, start, end, weight="weight")
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return 999

    def get_passage_destination(self, location):
        """Return the secret-passage exit for the given room, or None."""
        return self.passages.get(location)
