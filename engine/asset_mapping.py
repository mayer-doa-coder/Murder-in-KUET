"""
asset_mapping.py - Backend card-to-asset mapping utilities.

Purpose: Provide Python-side mapping from backend card names to concrete asset
paths under the repository's Assets directory. The mapping source of truth is
the same alias file used by Godot (`godot/data/card_aliases.json`).
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from engine.cards import locations, suspects, weapons

_ROOT = Path(__file__).resolve().parent.parent
_ALIASES_PATH = _ROOT / "godot" / "data" / "card_aliases.json"
_ASSETS_ROOT = _ROOT / "Assets"

_CATEGORY_MAP = {
    "suspect": "suspects",
    "suspects": "suspects",
    "weapon": "weapons",
    "weapons": "weapons",
    "location": "locations",
    "locations": "locations",
}

_ASSET_FOLDERS = {
    "suspects": "Suspect",
    "weapons": "Weapon",
    "locations": "Room",
}

_BACKEND_POOLS = {
    "suspects": suspects,
    "weapons": weapons,
    "locations": locations,
}


def _normalize_category(category: str) -> str:
    key = str(category).strip().lower()
    if key not in _CATEGORY_MAP:
        raise ValueError(f"Unknown category: {category}")
    return _CATEGORY_MAP[key]


@lru_cache(maxsize=1)
def _load_aliases() -> dict[str, dict[str, str]]:
    if not _ALIASES_PATH.exists():
        return {}

    raw = json.loads(_ALIASES_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        return {}

    parsed: dict[str, dict[str, str]] = {}
    for category, entries in raw.items():
        if category not in ("suspects", "weapons", "locations"):
            continue
        if not isinstance(entries, dict):
            continue
        parsed[category] = {
            str(display): str(backend) for display, backend in entries.items()
        }
    return parsed


@lru_cache(maxsize=1)
def _build_manifest() -> dict[str, dict[str, dict[str, str]]]:
    aliases = _load_aliases()
    manifest: dict[str, dict[str, dict[str, str]]] = {
        "suspects": {},
        "weapons": {},
        "locations": {},
    }

    for category, backend_cards in _BACKEND_POOLS.items():
        display_to_backend = aliases.get(category, {})
        backend_to_display = {backend: display for display, backend in display_to_backend.items()}
        folder = _ASSET_FOLDERS[category]

        for backend_name in backend_cards:
            display_name = backend_to_display.get(backend_name, backend_name)
            file_name = f"{display_name}.png"
            rel_path = Path("Assets") / folder / file_name
            abs_path = _ROOT / rel_path
            if not abs_path.exists():
                raise FileNotFoundError(
                    f"Missing asset file for backend card '{backend_name}': {abs_path}"
                )

            manifest[category][backend_name] = {
                "display_name": display_name,
                "asset_path": rel_path.as_posix(),
            }

    return manifest


def get_asset_manifest() -> dict[str, dict[str, dict[str, str]]]:
    """Return full backend-name -> display-name/asset-path manifest."""
    # Return a shallow-deep copy for safety so callers cannot mutate cache.
    source = _build_manifest()
    return {
        category: {
            backend_name: {
                "display_name": entry["display_name"],
                "asset_path": entry["asset_path"],
            }
            for backend_name, entry in cards.items()
        }
        for category, cards in source.items()
    }


def map_backend_to_asset(category: str, backend_name: str) -> str:
    """Resolve one backend card name to its repository-relative asset path."""
    normalized = _normalize_category(category)
    manifest = _build_manifest()
    entry = manifest.get(normalized, {}).get(backend_name)
    if entry is None:
        raise KeyError(f"No asset mapping for {category}:{backend_name}")
    return entry["asset_path"]

