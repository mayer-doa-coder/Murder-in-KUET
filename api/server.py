"""
server.py - API Server Module

Purpose: Provides REST API endpoints for the game.
This module handles web-based gameplay, HTTP requests, and multiplayer functionality.
"""

from flask import Flask, jsonify, request

app = Flask(__name__)


@app.route('/')
def home():
    """Root endpoint."""
    return jsonify({"message": "Murder in KUET API Server"})


@app.route('/game/start', methods=['POST'])
def start_game():
    """Start a new game."""
    # TODO: Implement game start logic
    pass


@app.route('/game/status', methods=['GET'])
def game_status():
    """Get current game status."""
    # TODO: Implement status retrieval
    pass


if __name__ == '__main__':
    app.run(debug=True, port=5000)
