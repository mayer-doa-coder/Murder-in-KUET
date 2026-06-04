"""Tests for StrategicEvaluationMixin: each scoring method with known inputs."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from ai.minimax_ai import StrategicEvaluationMixin
from config.settings import EVAL_CONFIG


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class Evaluator(StrategicEvaluationMixin):
    """Concrete subclass exposing the mixin's scoring methods for tests."""


def _state(suspects, weapons, locations, players=None):
    """Build a minimal state namespace with the required possibility sets."""
    return SimpleNamespace(
        possible_suspects=set(suspects),
        possible_weapons=set(weapons),
        possible_locations=set(locations),
        players=players or [],
    )


def _player_with_cards(n_cards: int):
    cards = [SimpleNamespace() for _ in range(n_cards)]
    return SimpleNamespace(cards=cards)


# ---------------------------------------------------------------------------
# 1 — score_information_gain
# ---------------------------------------------------------------------------

class TestScoreInformationGain:

    def setup_method(self):
        self.ev = Evaluator()
        self.weight    = EVAL_CONFIG["INFO_GAIN_WEIGHT"]
        self.max_score = EVAL_CONFIG["INFO_GAIN_MAX_SCORE"]

    def test_maximum_score_when_fully_solved(self):
        # 1+1+1 = 3 candidates total → (max_score - 3) * weight
        state = _state({"A"}, {"B"}, {"C"})
        expected = (self.max_score - 3) * self.weight
        assert self.ev.score_information_gain(state) == pytest.approx(expected)

    def test_score_decreases_with_more_candidates(self):
        low  = self.ev.score_information_gain(_state({"A"},        {"B"},        {"C"}))
        high = self.ev.score_information_gain(_state({"A","B","C"},{"D","E"},    {"F","G"}))
        assert low > high

    def test_exact_arithmetic_with_known_totals(self):
        # 2+2+2 = 6 → (30-6)*2 = 48
        state = _state({"A","B"}, {"C","D"}, {"E","F"})
        expected = (self.max_score - 6) * self.weight
        assert self.ev.score_information_gain(state) == pytest.approx(expected)

    def test_raises_on_none_state(self):
        with pytest.raises(ValueError):
            self.ev.score_information_gain(None)


# ---------------------------------------------------------------------------
# 2 — score_certainty
# ---------------------------------------------------------------------------

class TestScoreCertainty:

    def setup_method(self):
        self.ev = Evaluator()
        self.reward  = EVAL_CONFIG["CERTAINTY_REWARD"]
        self.partial = EVAL_CONFIG["CERTAINTY_PARTIAL_BONUS"]

    def test_full_reward_when_all_categories_solved(self):
        state = _state({"A"}, {"B"}, {"C"})
        assert self.ev.score_certainty(state) == pytest.approx(3 * self.reward)

    def test_partial_bonus_when_two_candidates(self):
        state = _state({"A","B"}, {"C","D"}, {"E","F"})
        assert self.ev.score_certainty(state) == pytest.approx(3 * self.partial)

    def test_zero_when_many_candidates(self):
        state = _state({"A","B","C"}, {"D","E","F"}, {"G","H","I"})
        assert self.ev.score_certainty(state) == pytest.approx(0.0)

    def test_mixed_categories(self):
        # one solved, one near, one uncertain
        state = _state({"A"}, {"B","C"}, {"D","E","F"})
        expected = self.reward + self.partial + 0.0
        assert self.ev.score_certainty(state) == pytest.approx(expected)

    def test_raises_on_none_state(self):
        with pytest.raises(ValueError):
            self.ev.score_certainty(None)


# ---------------------------------------------------------------------------
# 3 — score_risk
# ---------------------------------------------------------------------------

class TestScoreRisk:

    def setup_method(self):
        self.ev = Evaluator()
        self.penalty   = EVAL_CONFIG["RISK_PENALTY"]
        self.threshold = EVAL_CONFIG["RISK_THRESHOLD"]

    def test_penalty_when_product_exceeds_threshold(self):
        # 3×2×2 = 12 > 10 → -penalty
        state = _state({"A","B","C"}, {"D","E"}, {"F","G"})
        assert self.ev.score_risk(state) == pytest.approx(-self.penalty)

    def test_zero_when_product_at_or_below_threshold(self):
        # 1×1×1 = 1 ≤ 10 → 0.0
        state = _state({"A"}, {"B"}, {"C"})
        assert self.ev.score_risk(state) == pytest.approx(0.0)

    def test_zero_when_product_exactly_at_threshold(self):
        # 2×5×1 = 10 = threshold → not strictly greater → 0.0
        state = _state({"A","B"}, {"C","D","E","F","G"}, {"H"})
        assert self.ev.score_risk(state) == pytest.approx(0.0)

    def test_penalty_one_above_threshold(self):
        # 11×1×1 = 11 > 10 → -penalty
        suspects = {str(i) for i in range(11)}
        state = _state(suspects, {"W"}, {"L"})
        assert self.ev.score_risk(state) == pytest.approx(-self.penalty)

    def test_raises_on_none_state(self):
        with pytest.raises(ValueError):
            self.ev.score_risk(None)


# ---------------------------------------------------------------------------
# 4 — score_opponent
# ---------------------------------------------------------------------------

class TestScoreOpponent:

    def setup_method(self):
        self.ev = Evaluator()

    def test_zero_when_no_players(self):
        state = _state({"A"}, {"B"}, {"C"}, players=[])
        assert self.ev.score_opponent(state) == pytest.approx(0.0)

    def test_zero_when_current_player_only(self):
        current = _player_with_cards(5)
        state = _state({"A"}, {"B"}, {"C"}, players=[current])
        state.current_player = current
        assert self.ev.score_opponent(state) == pytest.approx(0.0)

    def test_negative_for_opponents_with_cards(self):
        current  = _player_with_cards(3)
        opponent = _player_with_cards(4)
        state = _state({"A"}, {"B"}, {"C"}, players=[current, opponent])
        state.current_player = current
        score = self.ev.score_opponent(state)
        assert score == pytest.approx(-4.0)

    def test_raises_on_none_state(self):
        with pytest.raises(ValueError):
            self.ev.score_opponent(None)


# ---------------------------------------------------------------------------
# 5 — evaluate (combined pipeline)
# ---------------------------------------------------------------------------

class TestEvaluate:

    def setup_method(self):
        self.ev = Evaluator()

    def test_evaluate_raises_on_none(self):
        with pytest.raises(ValueError):
            self.ev.evaluate(None)

    def test_evaluate_returns_float(self):
        state = _state({"A","B"}, {"C","D"}, {"E","F"})
        assert isinstance(self.ev.evaluate(state), float)

    def test_solved_state_scores_higher_than_unsolved(self):
        solved   = _state({"A"},        {"B"},        {"C"})
        unsolved = _state({"A","B","C"},{"D","E","F"},{"G","H","I"})
        assert self.ev.evaluate(solved) > self.ev.evaluate(unsolved)

    def test_score_is_sum_of_components(self):
        state = _state({"A"}, {"B"}, {"C"}, players=[])
        total    = self.ev.evaluate(state)
        info     = self.ev.score_information_gain(state)
        certainty= self.ev.score_certainty(state)
        risk     = self.ev.score_risk(state)
        opponent = self.ev.score_opponent(state)
        assert total == pytest.approx(info + certainty + risk + opponent)
