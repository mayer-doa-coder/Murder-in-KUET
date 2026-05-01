from pathlib import Path

from engine.asset_mapping import get_asset_manifest, map_backend_to_asset
from engine.cards import locations, suspects, weapons


def test_asset_manifest_contains_all_backend_cards() -> None:
    manifest = get_asset_manifest()

    assert set(manifest["suspects"].keys()) == set(suspects)
    assert set(manifest["weapons"].keys()) == set(weapons)
    assert set(manifest["locations"].keys()) == set(locations)


def test_asset_paths_exist_for_all_cards() -> None:
    root = Path(__file__).resolve().parent.parent
    manifest = get_asset_manifest()

    for category_map in manifest.values():
        for entry in category_map.values():
            assert (root / entry["asset_path"]).exists()


def test_single_lookup_returns_existing_path() -> None:
    rel_path = map_backend_to_asset("weapon", "Laptop Charger")
    assert rel_path == "Assets/Weapon/Laptop Charger.png"
