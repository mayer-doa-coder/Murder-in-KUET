"""Tests for BayesianNotebook: Bayesian updates, normalization, confidence, get_solution."""

from __future__ import annotations

import pytest

from ai.notebook import BayesianNotebook


SUSPECTS  = ["Chef", "Hallboy", "Security Guard"]
WEAPONS   = ["Knife", "Rope", "Revolver"]
LOCATIONS = ["Auditorium", "Cafeteria", "IT Park"]


def _nb() -> BayesianNotebook:
    return BayesianNotebook(SUSPECTS, WEAPONS, LOCATIONS)


# ---------------------------------------------------------------------------
# 1 — Initialisation
# ---------------------------------------------------------------------------

class TestInit:

    def test_uniform_suspects_sum_to_one(self):
        nb = _nb()
        assert sum(nb.suspects.values()) == pytest.approx(1.0)

    def test_uniform_weapons_sum_to_one(self):
        nb = _nb()
        assert sum(nb.weapons.values()) == pytest.approx(1.0)

    def test_uniform_locations_sum_to_one(self):
        nb = _nb()
        assert sum(nb.locations.values()) == pytest.approx(1.0)

    def test_possible_sets_populated(self):
        nb = _nb()
        assert nb.possible_suspects == set(SUSPECTS)
        assert nb.possible_weapons  == set(WEAPONS)
        assert nb.possible_locations == set(LOCATIONS)

    def test_known_cards_empty_at_start(self):
        nb = _nb()
        assert len(nb.known_cards) == 0

    def test_empty_suspects_raises(self):
        with pytest.raises(ValueError):
            BayesianNotebook([], WEAPONS, LOCATIONS)

    def test_duplicate_suspect_raises(self):
        with pytest.raises(ValueError):
            BayesianNotebook(["A", "A"], WEAPONS, LOCATIONS)


# ---------------------------------------------------------------------------
# 2 — normalize
# ---------------------------------------------------------------------------

class TestNormalize:

    def test_normalize_restores_unit_sum(self):
        nb = _nb()
        for key in nb.suspects:
            nb.suspects[key] *= 3.0          # inflate; sum = 3.0
        nb.normalize(nb.suspects)
        assert sum(nb.suspects.values()) == pytest.approx(1.0)

    def test_normalize_all_zero_is_noop(self):
        nb = _nb()
        zero_dist = {k: 0.0 for k in nb.suspects}
        nb.normalize(zero_dist)               # must not raise
        assert all(v == 0.0 for v in zero_dist.values())

    def test_normalize_rejects_non_dict(self):
        nb = _nb()
        with pytest.raises(TypeError):
            nb.normalize([1, 2, 3])


# ---------------------------------------------------------------------------
# 3 — eliminate
# ---------------------------------------------------------------------------

class TestEliminate:

    def test_eliminate_sets_prob_to_zero(self):
        nb = _nb()
        nb.eliminate("Chef")
        assert nb.suspects["Chef"] == pytest.approx(0.0)

    def test_eliminate_removes_from_possible(self):
        nb = _nb()
        nb.eliminate("Chef")
        assert "Chef" not in nb.possible_suspects

    def test_eliminate_normalizes_remaining(self):
        nb = _nb()
        nb.eliminate("Chef")
        assert sum(nb.suspects.values()) == pytest.approx(1.0)

    def test_eliminate_adds_to_known_cards(self):
        nb = _nb()
        nb.eliminate("Knife")
        assert "Knife" in nb.known_cards

    def test_eliminate_unknown_card_raises(self):
        nb = _nb()
        with pytest.raises(ValueError):
            nb.eliminate("NonExistent")

    def test_eliminate_weapon_does_not_touch_suspects(self):
        nb = _nb()
        before = dict(nb.suspects)
        nb.eliminate("Knife")
        assert nb.suspects == before


# ---------------------------------------------------------------------------
# 4 — update_no_reveal
# ---------------------------------------------------------------------------

class TestUpdateNoReveal:

    def test_no_reveal_boosts_suggested_suspect(self):
        nb = _nb()
        before = nb.suspects["Chef"]
        nb.update_no_reveal("Chef", "Knife", "Auditorium")
        assert nb.suspects["Chef"] > before

    def test_no_reveal_keeps_sums_at_one(self):
        nb = _nb()
        nb.update_no_reveal("Chef", "Knife", "Auditorium")
        assert sum(nb.suspects.values())   == pytest.approx(1.0)
        assert sum(nb.weapons.values())    == pytest.approx(1.0)
        assert sum(nb.locations.values())  == pytest.approx(1.0)

    def test_no_reveal_bad_boost_raises(self):
        nb = _nb()
        with pytest.raises(ValueError):
            nb.update_no_reveal("Chef", "Knife", "Auditorium", boost=0.5)

    def test_no_reveal_invalid_suspect_raises(self):
        nb = _nb()
        with pytest.raises(ValueError):
            nb.update_no_reveal("Unknown", "Knife", "Auditorium")


# ---------------------------------------------------------------------------
# 5 — confident_accusation / get_solution / is_solved
# ---------------------------------------------------------------------------

class TestConfidenceAndSolution:

    def test_confident_false_with_uniform_priors(self):
        nb = _nb()
        assert nb.confident_accusation(threshold=0.7) is False

    def test_confident_true_after_eliminating_all_but_one(self):
        nb = _nb()
        # Eliminate all but "Chef"
        nb.eliminate("Hallboy")
        nb.eliminate("Security Guard")
        # Eliminate all but "Knife"
        nb.eliminate("Rope")
        nb.eliminate("Revolver")
        # Eliminate all but "Auditorium"
        nb.eliminate("Cafeteria")
        nb.eliminate("IT Park")
        assert nb.confident_accusation(threshold=0.7) is True

    def test_get_solution_none_when_unsolved(self):
        nb = _nb()
        assert nb.get_solution() is None

    def test_get_solution_returns_triple_when_solved(self):
        nb = _nb()
        nb.eliminate("Hallboy")
        nb.eliminate("Security Guard")
        nb.eliminate("Rope")
        nb.eliminate("Revolver")
        nb.eliminate("Cafeteria")
        nb.eliminate("IT Park")
        result = nb.get_solution()
        assert isinstance(result, tuple) and len(result) == 3
        assert result == ("Chef", "Knife", "Auditorium")

    def test_is_solved_false_initially(self):
        nb = _nb()
        assert nb.is_solved() is False

    def test_is_solved_true_after_narrowing(self):
        nb = _nb()
        nb.eliminate("Hallboy")
        nb.eliminate("Security Guard")
        nb.eliminate("Rope")
        nb.eliminate("Revolver")
        nb.eliminate("Cafeteria")
        nb.eliminate("IT Park")
        assert nb.is_solved() is True

    def test_most_likely_returns_highest_prob_after_no_reveal(self):
        nb = _nb()
        nb.update_no_reveal("Chef", "Knife", "Auditorium")
        s, w, loc = nb.most_likely()
        assert s == "Chef"
        assert w == "Knife"
        assert loc == "Auditorium"
