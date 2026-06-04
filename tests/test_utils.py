"""Targeted coverage tests for small utility and model modules.

Covers uncovered branches in:
  utils/helpers.py   — safe_max, safe_min, clamp, safe_random_choice(None)
  engine/clue_reveal.py — error paths
  models/accusation.py  — __repr__, check_accusation edge cases
  models/player.py      — is_human, try_move, show_card, take_turn, __repr__
  models/validation.py  — invalid inputs
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from engine.clue_reveal import reveal_clue
from models.accusation import Accusation, check_accusation
from models.player import AIPlayer, HumanPlayer, Player
from models.validation import validate_card_field
from utils.helpers import clamp, safe_max, safe_min, safe_random_choice
from ai.random_ai import RandomAI


# ---------------------------------------------------------------------------
# utils/helpers.py
# ---------------------------------------------------------------------------

class TestSafeRandomChoice:

    def test_none_returns_none(self):
        assert safe_random_choice(None) is None

    def test_empty_list_returns_none(self):
        assert safe_random_choice([]) is None

    def test_single_item_returns_it(self):
        assert safe_random_choice([42]) == 42

    def test_returns_element_from_set(self):
        result = safe_random_choice({1, 2, 3})
        assert result in {1, 2, 3}


class TestSafeMax:

    def test_none_returns_default(self):
        assert safe_max(None) is None

    def test_none_with_custom_default(self):
        assert safe_max(None, default=-1) == -1

    def test_empty_returns_default(self):
        assert safe_max([]) is None

    def test_single_item(self):
        assert safe_max([5]) == 5

    def test_max_of_multiple(self):
        assert safe_max([3, 1, 4, 1, 5]) == 5


class TestSafeMin:

    def test_none_returns_default(self):
        assert safe_min(None) is None

    def test_none_with_custom_default(self):
        assert safe_min(None, default=99) == 99

    def test_empty_returns_default(self):
        assert safe_min([]) is None

    def test_single_item(self):
        assert safe_min([7]) == 7

    def test_min_of_multiple(self):
        assert safe_min([3, 1, 4, 1, 5]) == 1


class TestClamp:

    def test_value_below_min_clamped(self):
        assert clamp(-5.0, 0.0, 10.0) == 0.0

    def test_value_above_max_clamped(self):
        assert clamp(15.0, 0.0, 10.0) == 10.0

    def test_value_within_range_unchanged(self):
        assert clamp(5.0, 0.0, 10.0) == 5.0

    def test_value_at_bounds_returned(self):
        assert clamp(0.0, 0.0, 10.0) == 0.0
        assert clamp(10.0, 0.0, 10.0) == 10.0


# ---------------------------------------------------------------------------
# engine/clue_reveal.py
# ---------------------------------------------------------------------------

class TestRevealClue:

    def _make_player(self, card_names):
        cards = [SimpleNamespace(name=n) for n in card_names]
        return SimpleNamespace(cards=cards)

    def _suggestion(self, s="Chef", w="Knife", loc="Auditorium"):
        return SimpleNamespace(suspect=s, weapon=w, location=loc)

    def test_empty_players_raises(self):
        with pytest.raises(ValueError):
            reveal_clue(self._suggestion(), [], 0)

    def test_non_integer_index_raises(self):
        players = [self._make_player(["Chef"])]
        with pytest.raises(ValueError):
            reveal_clue(self._suggestion(), players, "bad")

    def test_none_suggestion_raises(self):
        players = [self._make_player([])]
        with pytest.raises(ValueError):
            reveal_clue(None, players, 0)

    def test_suggestion_missing_field_raises(self):
        players = [self._make_player([])]
        bad = SimpleNamespace(suspect="Chef")   # missing weapon and location
        with pytest.raises(ValueError):
            reveal_clue(bad, players, 0)

    def test_blank_suspect_raises(self):
        players = [self._make_player([])]
        bad = SimpleNamespace(suspect="  ", weapon="Knife", location="Auditorium")
        with pytest.raises(ValueError):
            reveal_clue(bad, players, 0)

    def test_no_match_returns_none_none(self):
        # Players hold unrelated cards.
        players = [
            self._make_player(["Rope"]),
            self._make_player(["Revolver"]),
        ]
        revealer, card = reveal_clue(self._suggestion(), players, 0)
        assert revealer is None and card is None

    def test_matching_card_revealed(self):
        players = [
            self._make_player([]),             # suggester at index 0
            self._make_player(["Chef"]),       # opponent holds the suspect card
        ]
        revealer, card = reveal_clue(self._suggestion(), players, 0)
        assert card is not None
        assert card.name == "Chef"


# ---------------------------------------------------------------------------
# models/accusation.py
# ---------------------------------------------------------------------------

class TestAccusation:

    def test_repr_contains_fields(self):
        acc = Accusation("Chef", "Knife", "Auditorium")
        r = repr(acc)
        assert "Chef" in r
        assert "Knife" in r
        assert "Auditorium" in r

    def test_str_same_as_repr(self):
        acc = Accusation("Chef", "Knife", "Auditorium")
        assert str(acc) == repr(acc)


class TestCheckAccusation:

    def _acc(self, s="Chef", w="Knife", loc="Auditorium"):
        return Accusation(s, w, loc)

    def _sol(self):
        return {"suspect": "Chef", "weapon": "Knife", "location": "Auditorium"}

    def test_none_accusation_raises(self):
        with pytest.raises(ValueError):
            check_accusation(None, self._sol())

    def test_non_mapping_solution_raises(self):
        with pytest.raises(TypeError):
            check_accusation(self._acc(), ["Chef", "Knife", "Auditorium"])

    def test_accusation_missing_field_raises(self):
        bad = SimpleNamespace(suspect="Chef")   # no weapon or location
        with pytest.raises(ValueError):
            check_accusation(bad, self._sol())

    def test_solution_missing_key_raises(self):
        with pytest.raises(ValueError):
            check_accusation(self._acc(), {"suspect": "Chef"})

    def test_correct_accusation_returns_true(self):
        assert check_accusation(self._acc(), self._sol()) is True

    def test_wrong_suspect_returns_false(self):
        assert check_accusation(self._acc(s="Hallboy"), self._sol()) is False


# ---------------------------------------------------------------------------
# models/player.py
# ---------------------------------------------------------------------------

class TestPlayer:

    def test_is_human_true_for_base_player(self):
        p = Player("Alice")
        assert p.is_human is True

    def test_is_human_false_for_ai(self):
        p = AIPlayer("Bot", RandomAI())
        assert p.is_human is False

    def test_try_move_succeeds_when_in_valid(self):
        p = Player("Alice")
        result = p.try_move("Auditorium", ["Auditorium", "Cafeteria"])
        assert result is True
        assert p.position == "Auditorium"

    def test_try_move_fails_when_not_in_valid(self):
        p = Player("Alice")
        p.position = "Cafeteria"
        result = p.try_move("IT Park", ["Auditorium"])
        assert result is False
        assert p.position == "Cafeteria"

    def test_show_card_returns_matching(self):
        p = Player("Alice")
        card = SimpleNamespace(name="Chef")
        p.cards = [card]
        suggestion = SimpleNamespace(suspect="Chef", weapon="Knife", location="Auditorium")
        revealed = p.show_card(suggestion)
        assert revealed is card

    def test_show_card_returns_none_when_no_match(self):
        p = Player("Alice")
        p.cards = [SimpleNamespace(name="Rope")]
        suggestion = SimpleNamespace(suspect="Chef", weapon="Knife", location="Auditorium")
        assert p.show_card(suggestion) is None

    def test_show_card_dict_suggestion(self):
        p = Player("Alice")
        card = SimpleNamespace(name="Knife")
        p.cards = [card]
        suggestion = {"suspect": "Chef", "weapon": "Knife", "location": "Auditorium"}
        assert p.show_card(suggestion) is card

    def test_take_turn_inactive_returns_none(self):
        p = AIPlayer("Bot", RandomAI())
        p.active = False
        assert p.take_turn(None) is None

    def test_take_turn_no_agent_raises(self):
        p = Player("Alice", is_ai=True)
        p.ai_agent = None
        with pytest.raises(ValueError):
            p.take_turn(None)

    def test_take_turn_returns_agent(self):
        agent = RandomAI()
        p = AIPlayer("Bot", agent)
        assert p.take_turn(None) is agent

    def test_player_repr(self):
        p = Player("Alice")
        assert "Alice" in repr(p)

    def test_human_player_repr(self):
        p = HumanPlayer("Bob")
        assert "Bob" in repr(p)

    def test_ai_player_repr(self):
        p = AIPlayer("Clu", RandomAI())
        assert "Clu" in repr(p)


# ---------------------------------------------------------------------------
# models/validation.py
# ---------------------------------------------------------------------------

class TestValidation:

    def test_non_string_raises_type_error(self):
        with pytest.raises(TypeError):
            validate_card_field("suspect", 42)

    def test_empty_string_raises_value_error(self):
        with pytest.raises(ValueError):
            validate_card_field("suspect", "  ")

    def test_valid_string_returned_stripped(self):
        assert validate_card_field("suspect", "  Chef  ") == "Chef"
