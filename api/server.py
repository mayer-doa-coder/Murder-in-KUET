"""
server.py - API Server Module

Purpose: Provides REST API endpoints for the game.
Re-exports the Flask application from services.api so that both
`from api.server import app` and `from services.api import app`
resolve to the same application object.
"""

from services.api import app  # noqa: F401  re-export

__all__ = ["app"]
